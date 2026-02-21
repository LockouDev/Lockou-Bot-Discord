import {
    InteractionContextType,
    SlashCommandBuilder,
    EmbedBuilder,
    ApplicationIntegrationType,
    CommandInteraction,
    MessageComponentInteraction,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    MessageFlags,
    Component,
    Interaction,
    ColorResolvable
} from 'discord.js';
import { userInfo } from 'node:os';

const command = {

    data: new SlashCommandBuilder()
        .setName('doar')
        .setDescription('Lista de doações para o Lockou')
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        )
        .setDMPermission(true),

    async run(client: any, interaction: any) {

        const pixList = {
            NuBank: 'd46014ef-b202-4846-b548-8db0f5272097',
            MercadoPago: 'kaiojeffoficial@gmail.com',
            PicPay: 'e2d8456b-ef0f-4e17-868d-0893ce328823',
            RecargaPay: 'aac5200d-9153-4b42-b78e-ec6f33afa9bb',
        }

        const embed = new EmbedBuilder()
            .setColor('#08bfb1')
            .setTitle('❤️ Doações para o Lockou ❤️')
            .setThumbnail('https://www.advocacianunes.com.br/wp-content/uploads/2022/04/logo-pix-icone-1024.png')
            .setDescription('Clique nos botões abaixo para copiar as chaves Pix');

        /*.addFields(
            { name: 'NuBank', value: pixList.NuBank, inline: false },
            { name: 'MercadoPago', value: pixList.MercadoPago, inline: false },
            { name: 'PicPay', value: pixList.PicPay, inline: false },
            { name: 'RecargaPay', value: pixList.RecargaPay, inline: false }
        );*/

        const buttons = new ActionRowBuilder()

            .addComponents(

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
                    .setStyle(ButtonStyle.Primary)

            );


        await interaction.reply({

            embeds: [embed],
            components: [buttons]

        });

        const reply = await interaction.fetchReply();

        const collector = reply.createMessageComponentCollector({

            time: 60000,
            filter: (i: MessageComponentInteraction) => i.user.id === interaction.user.id,

        });

        collector.on('collect', async (i: MessageComponentInteraction) => {

            let key = '';
            let icon = '';
            let color = '';

            switch (i.customId) {

                case 'nubank':

                    key = pixList.NuBank;
                    icon = 'https://i.imgur.com/T0abmEf.png';
                    color = '#820ad1';

                    break;

                case 'mercadopago':

                    key = pixList.MercadoPago;
                    icon = 'https://i.imgur.com/bawKDe5.png';
                    color = '#00b5ec';

                    break;

                case 'picpay':

                    key = pixList.PicPay;
                    icon = 'https://i.imgur.com/QZ2f59O.png';
                    color = '#2eb461';

                    break;

                case 'recargapay':

                    key = pixList.RecargaPay;
                    icon = 'https://i.imgur.com/ZcY0L5P.png';
                    color = '#053e6e';

                    break;

                default:

                    return;

            }

            const embed = new EmbedBuilder()

                .setColor(color as ColorResolvable)
                .setAuthor({ name: `${key}`, iconURL: icon })

                await i.reply({ embeds: [embed] });

        });

        collector.on('end', async () => {

            if (reply && reply.deletable) {

                reply.delete().catch(() => { });

            }

        });

    },

};

export default command;

