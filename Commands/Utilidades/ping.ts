import {
    ApplicationIntegrationType,
    ColorResolvable,
    EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder,
} from 'discord.js';
import Config from '../../config';

const Command = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Veja o meu ping!')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        ),

    async run(Client: any, Interaction: any) {
        const Embed = new EmbedBuilder()
            .setColor(Config.discord.color as ColorResolvable)
            .setAuthor({
                name: Client.user.username,
                iconURL: Client.user.displayAvatarURL(),
            })
            .setDescription(`Olá **${Interaction.user.username}**, meu ping está em \`${Client.ws.ping}ms\``);

        await Interaction.reply({ embeds: [Embed] });
    },
};

export default Command;
