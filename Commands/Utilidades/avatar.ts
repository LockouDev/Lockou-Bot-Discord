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

const Command = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Veja o avatar de um usuário')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
        .addUserOption((Option) =>
            Option
                .setName('usuario')
                .setDescription('Para ver o avatar do usuário')
                .setRequired(false),
        )
        .addStringOption((Option) =>
            Option
                .setName('id')
                .setDescription('ID do usuário para ver o avatar')
                .setRequired(false),
        ),

    async run(Client: any, Interaction: CommandInteraction<CacheType>) {
        if (!Interaction.isChatInputCommand()) {
            return;
        }

        const IsInteractionAlreadyAcknowledged = (Error: any): boolean =>
            Error?.code === 40060 || Error?.rawError?.code === 40060;
        const IsUnknownInteraction = (Error: any): boolean =>
            Error?.code === 10062 || Error?.rawError?.code === 10062;
        const IsInteractionNotReplied = (Error: any): boolean => Error?.code === 'InteractionNotReplied';
        const IsIgnorableInteractionError = (Error: any): boolean =>
            IsInteractionAlreadyAcknowledged(Error) || IsUnknownInteraction(Error) || IsInteractionNotReplied(Error);

        const EnsureInteractionAcknowledged = async (): Promise<boolean> => {
            if (Interaction.deferred || Interaction.replied) {
                return true;
            }

            try {
                await Interaction.deferReply();
                return true;
            } catch (Error) {
                if (IsIgnorableInteractionError(Error)) {
                    return false;
                }

                throw Error;
            }
        };

        const Respond = async (Payload: any) => {
            const CanReply = await EnsureInteractionAcknowledged();
            if (!CanReply) {
                return;
            }

            try {
                await Interaction.editReply(Payload);
            } catch (Error) {
                if (IsIgnorableInteractionError(Error)) {
                    return;
                }

                throw Error;
            }
        };

        const CanReply = await EnsureInteractionAcknowledged();
        if (!CanReply) {
            return;
        }

        try {
            let User: User | null = Interaction.options.getUser('usuario');
            const Id = Interaction.options.getString('id');

            if (!User && Id) {
                try {
                    User = await Client.users.fetch(Id);
                } catch {
                    await Respond({
                        content: 'Não encontrei nenhum usuário com esse ID',
                    });
                    return;
                }
            }

            if (!User) {
                User = Interaction.user;
            }

            const AvatarOptions: ImageURLOptions = {
                size: 4096,
                extension: User.avatar?.startsWith('a_') ? 'gif' : 'png',
            };

            const ImageURL = User.displayAvatarURL(AvatarOptions);
            const Attachment = new AttachmentBuilder(ImageURL).setName(
                `avatar_${User.username}.${AvatarOptions.extension}`,
            );

            await Respond({ files: [Attachment] });
        } catch (Error) {
            console.error('Erro no comando /avatar:', Error);
            await Respond({
                content: 'Erro ao exibir o avatar, tente novamente mais tarde',
            });
        }
    },
};

export default Command;
