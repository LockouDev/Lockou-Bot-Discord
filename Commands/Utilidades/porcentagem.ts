import {
    InteractionContextType,
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    ApplicationIntegrationType
} from 'discord.js';

const Command = {

    data: new SlashCommandBuilder()

        .setName('porcentagem')
        .setDescription('Veja o resultado de uma porcentagem em 70% para colocar em uma Gamepass do Roblox')
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        )
        .addStringOption(Option =>
            Option
                .setName('valor')
                .setDescription('Valor para converter com a porcentagem')
                .setRequired(true)),

    async run(Client: any, Interaction: any) {

        const ValorString = Interaction.options.getString('valor');
        const Valor = parseFloat(ValorString);

        if (isNaN(Valor)) {

            return Interaction.reply({

                content: '❌ Por favor, insira um valor numérico',
                ephemeral: true,

            });

        }

        const Resultado = Math.ceil(Valor / 0.7);

        const Embed = new EmbedBuilder()

            .setColor('#98F768')
            .setTitle(`70% de ${Valor}`)
            .setDescription(`${Resultado}`);

        await Interaction.reply({ embeds: [Embed] });

    },

};

export default Command;

