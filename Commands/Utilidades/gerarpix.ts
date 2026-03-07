import 'dotenv/config';
import {
    InteractionContextType,
    EmbedBuilder,
    SlashCommandBuilder,
    AttachmentBuilder,
    ApplicationIntegrationType,
    MessageFlags,
} from 'discord.js';
import Fs from 'node:fs';
import Path from 'node:path';

type Authorization = {
    userId: string;
    commandName: string;
};

const FilePath = Path.join(process.cwd(), 'Registro', 'autorizacoes.json');

function LoadAuthorizations(): Authorization[] {
    Fs.mkdirSync(Path.dirname(FilePath), { recursive: true });

    if (!Fs.existsSync(FilePath)) {
        Fs.writeFileSync(FilePath, '[]', 'utf-8');
    }

    try {
        const Data = Fs.readFileSync(FilePath, 'utf-8');
        const Parsed = JSON.parse(Data);
        return Array.isArray(Parsed) ? Parsed : [];
    } catch {
        return [];
    }
}

const Command = {
    data: new SlashCommandBuilder()
        .setName('gerarpix')
        .setDescription('Gerar pix')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
        .addNumberOption((Option) =>
            Option
                .setName('valor')
                .setDescription('Valor em Real Brasileiro')
                .setRequired(true),
        )
        .addStringOption((Option) =>
            Option
                .setName('descricao')
                .setDescription('Descrição do PIX')
                .setRequired(true),
        ),

    async run(_client: any, Interaction: any) {
        const BotOwnerId = process.env.BOT_OWNER;
        const Authorizations = LoadAuthorizations();

        const IsAuthorized =
            Interaction.user.id === BotOwnerId ||
            Authorizations.some(
                (Authorization) =>
                    Authorization.userId === Interaction.user.id &&
                    Authorization.commandName === 'gerarpix',
            );

        if (!IsAuthorized) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('Acesso negado')
                .setDescription(
                    'Você não está autorizado(a) a usar este comando, solicite permissão ao dono do bot',
                );

            await Interaction.reply({ embeds: [Embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const Amount = Interaction.options.getNumber('valor');
        if (!Amount || Amount <= 0) {
            await Interaction.reply({
                content: 'O valor deve ser maior que zero',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const Description = Interaction.options.getString('descricao');
        if (!Description) {
            await Interaction.reply({
                content: 'Descrição inválida',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const AccessToken = process.env.MERCADO_PAGO_ACCESS_TEST_TOKEN;
        const PayerEmail = process.env.MERCADO_PAGO_EMAIL;
        if (!AccessToken || !PayerEmail) {
            await Interaction.reply({
                content: 'Credenciais do Mercado Pago não configuradas no .env',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        try {
            await Interaction.deferReply();

            const [{ MercadoPagoConfig, Payment: MercadoPagoPayment }, SharpModule] = await Promise.all([
                import('mercadopago'),
                import('sharp'),
            ]);
            const Sharp = SharpModule.default;

            const PaymentClient = new MercadoPagoConfig({
                accessToken: AccessToken,
                options: { timeout: 5000 },
            });

            const PaymentInstance = new MercadoPagoPayment(PaymentClient);

            const Response = await PaymentInstance.create({
                body: {
                    transaction_amount: Amount,
                    description: Description,
                    payment_method_id: 'pix',
                    payer: { email: PayerEmail },
                },
            });

            const TransactionData = (Response as any)?.point_of_interaction?.transaction_data;
            const QrCodeBase64 = TransactionData?.qr_code_base64 as string | undefined;
            const CopyPasteCode = TransactionData?.qr_code as string | undefined;

            if (!QrCodeBase64 || !CopyPasteCode) {
                throw new Error('Resposta do Mercado Pago sem QR Code de PIX');
            }

            const QrCodeBuffer = Buffer.from(QrCodeBase64, 'base64');
            const ResizedQrCode = await Sharp(QrCodeBuffer).resize(256, 256).png().toBuffer();

            const Attachment = new AttachmentBuilder(ResizedQrCode, { name: 'qrcode.png' });
            const Embed = new EmbedBuilder()
                .setColor('#4DB6AC')
                .setTitle(`Valor: R$ ${Amount.toFixed(2)}`)
                .setDescription(`PIX Copiar e Colar\n\`\`\`${CopyPasteCode}\`\`\``)
                .addFields([
                    {
                        name: 'Descrição do Pagamento',
                        value: `\`\`${Description}\`\``,
                        inline: false,
                    },
                ])
                .setImage('attachment://qrcode.png');

            await Interaction.editReply({ embeds: [Embed], files: [Attachment] });
        } catch (Error) {
            console.error('[GERARPIX] Falha ao gerar pagamento PIX:', Error);
            if (Interaction.deferred || Interaction.replied) {
                await Interaction.editReply({
                    content: 'Ocorreu um erro ao gerar o pagamento via PIX, tente novamente mais tarde',
                });
                return;
            }

            await Interaction.reply({
                content: 'Ocorreu um erro ao gerar o pagamento via PIX, tente novamente mais tarde',
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};

export default Command;
