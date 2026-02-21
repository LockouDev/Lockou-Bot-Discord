import {
    ApplicationIntegrationType,
    ColorResolvable,
    EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder,
} from 'discord.js';
import config from '../../config';

const command = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Veja o meu ping!')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        ),

    async run(client: any, interaction: any) {
        const embed = new EmbedBuilder()
            .setColor(config.discord.color as ColorResolvable)
            .setAuthor({
                name: client.user.username,
                iconURL: client.user.displayAvatarURL(),
            })
            .setDescription(`Olá **${interaction.user.username}**, meu ping está em \`${client.ws.ping}ms\``);

        await interaction.reply({ embeds: [embed] });
    },
};

export default command;
