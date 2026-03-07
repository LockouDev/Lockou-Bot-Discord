import {
    InteractionContextType,
    SlashCommandBuilder,
    AttachmentBuilder,
    CommandInteraction,
    ApplicationIntegrationType,
    User,
} from 'discord.js';

const Command = {
    data: new SlashCommandBuilder()
        .setName('banner')
        .setDescription('Veja o banner de um usuário')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
        .addUserOption((Option) =>
            Option
                .setName('usuario')
                .setDescription('Usuário para ver o banner')
                .setRequired(false),
        )
        .addStringOption((Option) =>
            Option
                .setName('id')
                .setDescription('ID do usuário para ver o banner')
                .setRequired(false),
        ),

    async run(Client: any, Interaction: CommandInteraction) {
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

            const FetchedUser = await Client.users.fetch(User.id, { force: true });
            const BannerUrl = FetchedUser.bannerURL({ size: 4096, extension: 'png' });

            if (!BannerUrl) {
                await Respond({
                    content: `O usuário **${User.username}** não possui banner`,
                });
                return;
            }

            const Extension = BannerUrl.includes('.gif') ? 'gif' : 'png';
            const Attachment = new AttachmentBuilder(BannerUrl).setName(`banner_${User.username}.${Extension}`);

            await Respond({ files: [Attachment] });
        } catch (Error) {
            console.error('Erro no comando /banner:', Error);
            await Respond({
                content: 'Erro ao exibir o banner. Tente novamente mais tarde',
            });
        }
    },
};

export default Command;
