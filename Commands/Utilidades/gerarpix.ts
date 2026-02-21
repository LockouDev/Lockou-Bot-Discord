import 'dotenv/config';
import {
    InteractionContextType,
    EmbedBuilder,
    SlashCommandBuilder,
    AttachmentBuilder,
    ApplicationIntegrationType,
    MessageFlags,
} from 'discord.js';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

type Authorization = {
    userId: string;
    commandName: string;
};

const filePath = path.join(process.cwd(), 'Registro', 'autorizacoes.json');

function loadAuthorizations(): Authorization[] {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]', 'utf-8');
    }

    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

const command = {
    data: new SlashCommandBuilder()
        .setName('gerarpix')
        .setDescription('Gerar pix')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
        .addNumberOption((option) =>
            option
                .setName('valor')
                .setDescription('Valor em Real Brasileiro')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('descricao')
                .setDescription('Descrição do PIX')
                .setRequired(true),
        ),

    async run(_client: any, interaction: any) {
        const botOwnerId = process.env.BOT_OWNER;
        const authorizations = loadAuthorizations();

        const isAuthorized =
            interaction.user.id === botOwnerId ||
            authorizations.some(
                (authorization) =>
                    authorization.userId === interaction.user.id &&
                    authorization.commandName === 'gerarpix',
            );

        if (!isAuthorized) {
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('Acesso negado')
                .setDescription(
                    'Voce não está autorizado(a) a usar este comando, Solicite permissão ao dono do bot',
                );

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const amount = interaction.options.getNumber('valor');
        if (!amount || amount <= 0) {
            await interaction.reply({
                content: 'O valor deve ser maior que zero',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const description = interaction.options.getString('descricao');
        if (!description) {
            await interaction.reply({
                content: 'Descricao invalida',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const accessToken = process.env.MERCADO_PAGO_ACCESS_TEST_TOKEN;
        const payerEmail = process.env.MERCADO_PAGO_EMAIL;
        if (!accessToken || !payerEmail) {
            await interaction.reply({
                content: 'Credenciais do Mercado Pago nao configuradas no .env',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const paymentClient = new MercadoPagoConfig({
            accessToken,
            options: { timeout: 5000 },
        });

        const payment = new Payment(paymentClient);

        try {
            await interaction.deferReply();

            const response = await payment.create({
                body: {
                    transaction_amount: amount,
                    description,
                    payment_method_id: 'pix',
                    payer: { email: payerEmail },
                },
            });

            const transactionData = (response as any)?.point_of_interaction?.transaction_data;
            const qrCodeBase64 = transactionData?.qr_code_base64 as string | undefined;
            const copyPasteCode = transactionData?.qr_code as string | undefined;

            if (!qrCodeBase64 || !copyPasteCode) {
                throw new Error('Resposta do Mercado Pago sem QR Code de PIX');
            }

            const qrCodePath = path.join(__dirname, 'qrcode.png');
            const qrCodeBuffer = Buffer.from(qrCodeBase64, 'base64');

            await sharp(qrCodeBuffer).resize(256, 256).toFile(qrCodePath);

            const attachment = new AttachmentBuilder(qrCodePath);
            const embed = new EmbedBuilder()
                .setColor('#4DB6AC')
                .setTitle(`Valor: R$ ${amount.toFixed(2)}`)
                .setDescription(`PIX Copiar e Colar\n\`\`\`${copyPasteCode}\`\`\``)
                .addFields([
                    {
                        name: 'Descrição do Pagamento',
                        value: `\`\`${description}\`\``,
                        inline: false,
                    },
                ])
                .setImage('attachment://qrcode.png');

            await interaction.editReply({ embeds: [embed], files: [attachment] });
            fs.unlinkSync(qrCodePath);
        } catch (error) {
            console.error('[GERARPIX] Falha ao gerar pagamento PIX:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: 'Ocorreu um erro ao gerar o pagamento via PIX, Tente novamente mais tarde',
                });
                return;
            }

            await interaction.reply({
                content: 'Ocorreu um erro ao gerar o pagamento via PIX, Tente novamente mais tarde',
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};

export default command;

