import {
    InteractionContextType,
    SlashCommandBuilder,
    AttachmentBuilder,
    CommandInteraction,
    ImageURLOptions,
    ApplicationIntegrationType,
    CacheType,
    User,
} from 'discord.js';

const command = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Veja o avatar de um usuário')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
        .addUserOption((option) =>
            option
                .setName('usuario')
                .setDescription('Para ver o avatar do usuário')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('id')
                .setDescription('ID do usuário para ver o avatar')
                .setRequired(false),
        ),

    async run(client: any, interaction: CommandInteraction<CacheType>) {
        if (!interaction.isChatInputCommand()) {
            return;
        }

        const isInteractionAlreadyAcknowledged = (error: any): boolean =>
            error?.code === 40060 || error?.rawError?.code === 40060;
        const isUnknownInteraction = (error: any): boolean =>
            error?.code === 10062 || error?.rawError?.code === 10062;
        const isInteractionNotReplied = (error: any): boolean => error?.code === 'InteractionNotReplied';
        const isIgnorableInteractionError = (error: any): boolean =>
            isInteractionAlreadyAcknowledged(error) || isUnknownInteraction(error) || isInteractionNotReplied(error);

        const ensureInteractionAcknowledged = async (): Promise<boolean> => {
            if (interaction.deferred || interaction.replied) {
                return true;
            }

            try {
                await interaction.deferReply();
                return true;
            } catch (error) {
                if (isIgnorableInteractionError(error)) {
                    return false;
                }

                throw error;
            }
        };

        const respond = async (payload: any) => {
            const canReply = await ensureInteractionAcknowledged();
            if (!canReply) {
                return;
            }

            try {
                await interaction.editReply(payload);
            } catch (error) {
                if (isIgnorableInteractionError(error)) {
                    return;
                }

                throw error;
            }
        };

        const canReply = await ensureInteractionAcknowledged();
        if (!canReply) {
            return;
        }

        try {
            let user: User | null = interaction.options.getUser('usuario');
            const id = interaction.options.getString('id');

            if (!user && id) {
                try {
                    user = await client.users.fetch(id);
                } catch {
                    await respond({
                        content: 'Não encontrei nenhum usuário com esse ID',
                    });
                    return;
                }
            }

            if (!user) {
                user = interaction.user;
            }

            const avatarOptions: ImageURLOptions = {
                size: 4096,
                extension: user.avatar?.startsWith('a_') ? 'gif' : 'png',
            };

            const imageURL = user.displayAvatarURL(avatarOptions);
            const attachment = new AttachmentBuilder(imageURL).setName(
                `avatar_${user.username}.${avatarOptions.extension}`,
            );

            await respond({ files: [attachment] });
        } catch (error) {
            console.error('Erro no comando /avatar:', error);
            await respond({
                content: 'Erro ao exibir o avatar. Tente novamente mais tarde',
            });
        }
    },
};

export default command;
