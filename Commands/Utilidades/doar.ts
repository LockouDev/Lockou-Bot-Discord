import {
    InteractionContextType,
    SlashCommandBuilder,
    EmbedBuilder,
    ApplicationIntegrationType,
    MessageComponentInteraction,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    MessageFlags,
    ColorResolvable,
    ComponentType,
} from 'discord.js';

const Command = {
    data: new SlashCommandBuilder()
        .setName('doar')
        .setDescription('Lista de doações para o Lockou')
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall,
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
        .setDMPermission(true),

    async run(_client: any, Interaction: any) {
        const PixList = {
            NuBank: 'd46014ef-b202-4846-b548-8db0f5272097',
            MercadoPago: 'kaiojeffoficial@gmail.com',
            PicPay: 'e2d8456b-ef0f-4e17-868d-0893ce328823',
            RecargaPay: 'aac5200d-9153-4b42-b78e-ec6f33afa9bb',
        };

        const Embed = new EmbedBuilder()
            .setColor('#08bfb1')
            .setTitle('Doações para o Lockou')
            .setThumbnail('https://www.advocacianunes.com.br/wp-content/uploads/2022/04/logo-pix-icone-1024.png')
            .setDescription('Clique nos botões abaixo para copiar as chaves Pix');

        const Buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('nubank')
                .setLabel('NuBank')
                .setEmoji('1389994298233323614')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('mercadopago')
                .setLabel('MercadoPago')
                .setEmoji('1389994643680395354')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('picpay')
                .setLabel('PicPay')
                .setEmoji('1389994870189592766')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('recargapay')
                .setLabel('RecargaPay')
                .setEmoji('1389995433656451233')
                .setStyle(ButtonStyle.Primary),
        );

        const Reply = await Interaction.reply({
            embeds: [Embed],
            components: [Buttons],
            fetchReply: true,
        });

        if (!Reply || typeof (Reply as any).createMessageComponentCollector !== 'function') {
            return;
        }

        const Collector = (Reply as any).createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60_000,
            filter: (I: MessageComponentInteraction) => I.user.id === Interaction.user.id,
        });

        Collector.on('collect', async (I: MessageComponentInteraction) => {
            let Key = '';
            let Icon = '';
            let Color = '';

            switch (I.customId) {
                case 'nubank':
                    Key = PixList.NuBank;
                    Icon = 'https://i.imgur.com/T0abmEf.png';
                    Color = '#820ad1';
                    break;
                case 'mercadopago':
                    Key = PixList.MercadoPago;
                    Icon = 'https://i.imgur.com/bawKDe5.png';
                    Color = '#00b5ec';
                    break;
                case 'picpay':
                    Key = PixList.PicPay;
                    Icon = 'https://i.imgur.com/QZ2f59O.png';
                    Color = '#2eb461';
                    break;
                case 'recargapay':
                    Key = PixList.RecargaPay;
                    Icon = 'https://i.imgur.com/ZcY0L5P.png';
                    Color = '#053e6e';
                    break;
                default:
                    return;
            }

            const ResponseEmbed = new EmbedBuilder()
                .setColor(Color as ColorResolvable)
                .setAuthor({ name: Key, iconURL: Icon });

            await I.reply({
                embeds: [ResponseEmbed],
                flags: MessageFlags.Ephemeral,
            });
        });

        Collector.on('end', async () => {
            if ('deletable' in (Reply as any) && (Reply as any).deletable) {
                (Reply as any).delete().catch(() => {});
            }
        });
    },
};

export default Command;
