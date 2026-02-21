import 'dotenv/config';
import { Client, IntentsBitField, MessageFlags, Partials } from 'discord.js';
import * as noblox from 'noblox.js';
import commandsHandler from './Handler/commands';
import eventsHandler from './Handler/events';

type SlashCommandModule = {
    data?: {
        name?: string;
        toJSON?: () => { name?: string };
    };
    run: (client: BotClient, interaction: any) => Promise<unknown> | unknown;
};

type BotClient = Client & {
    slashCommands: {
        local: Map<string, SlashCommandModule>;
        global: Map<string, SlashCommandModule>;
    };
};

function isInteractionAlreadyAcknowledged(error: any): boolean {
    return error?.code === 40060 || error?.rawError?.code === 40060;
}

function isUnknownInteraction(error: any): boolean {
    return error?.code === 10062 || error?.rawError?.code === 10062;
}

function isInteractionNotReplied(error: any): boolean {
    return error?.code === 'InteractionNotReplied';
}

function isIgnorableInteractionError(error: any): boolean {
    return (
        isInteractionAlreadyAcknowledged(error) ||
        isUnknownInteraction(error) ||
        isInteractionNotReplied(error)
    );
}

const client = new Client({
    intents: [
        IntentsBitField.Flags.DirectMessages,
        IntentsBitField.Flags.GuildInvites,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildPresences,
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.GuildEmojisAndStickers,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.GuildMessages,
    ],
    partials: [
        Partials.User,
        Partials.Message,
        Partials.Reaction,
        Partials.Channel,
        Partials.GuildMember,
    ],
}) as BotClient;

function patchInteractionResponses(interaction: any): void {
    if (interaction.__lockouPatchedResponses) {
        return;
    }
    interaction.__lockouPatchedResponses = true;

    const originalReply = typeof interaction.reply === 'function' ? interaction.reply.bind(interaction) : null;
    const originalEditReply =
        typeof interaction.editReply === 'function' ? interaction.editReply.bind(interaction) : null;
    const originalFollowUp =
        typeof interaction.followUp === 'function' ? interaction.followUp.bind(interaction) : null;
    const originalDeferReply =
        typeof interaction.deferReply === 'function' ? interaction.deferReply.bind(interaction) : null;
    const originalUpdate = typeof interaction.update === 'function' ? interaction.update.bind(interaction) : null;
    const originalDeferUpdate =
        typeof interaction.deferUpdate === 'function' ? interaction.deferUpdate.bind(interaction) : null;

    if (originalReply && originalEditReply && originalFollowUp) {
        interaction.reply = async (payload: any) => {
            try {
                return await originalReply(payload);
            } catch (error) {
                if (isUnknownInteraction(error) || isInteractionNotReplied(error)) {
                    return null;
                }

                if (!isInteractionAlreadyAcknowledged(error)) {
                    throw error;
                }

                try {
                    return await originalEditReply(payload);
                } catch {
                    // Some payloads (e.g. flags/ephemeral) are invalid for editReply
                }

                try {
                    if (!interaction.deferred && !interaction.replied) {
                        return null;
                    }

                    return await originalFollowUp(payload);
                } catch (followUpError) {
                    if (isIgnorableInteractionError(followUpError)) {
                        return null;
                    }

                    throw followUpError;
                }
            }
        };
    }

    if (originalEditReply && originalFollowUp) {
        interaction.editReply = async (payload: any) => {
            try {
                return await originalEditReply(payload);
            } catch (error) {
                if (isUnknownInteraction(error) || isInteractionNotReplied(error)) {
                    return null;
                }

                if (!isInteractionAlreadyAcknowledged(error)) {
                    throw error;
                }

                try {
                    if (!interaction.deferred && !interaction.replied) {
                        return null;
                    }

                    return await originalFollowUp(payload);
                } catch (followUpError) {
                    if (isIgnorableInteractionError(followUpError)) {
                        return null;
                    }

                    throw followUpError;
                }
            }
        };
    }

    if (originalFollowUp) {
        interaction.followUp = async (payload: any) => {
            try {
                if (!interaction.deferred && !interaction.replied) {
                    return null;
                }

                return await originalFollowUp(payload);
            } catch (error) {
                if (isIgnorableInteractionError(error)) {
                    return null;
                }

                throw error;
            }
        };
    }

    if (originalDeferReply) {
        interaction.deferReply = async (payload: any) => {
            try {
                return await originalDeferReply(payload);
            } catch (error) {
                if (isIgnorableInteractionError(error)) {
                    return null;
                }

                throw error;
            }
        };
    }

    if (originalUpdate && originalEditReply && originalFollowUp) {
        interaction.update = async (payload: any) => {
            try {
                return await originalUpdate(payload);
            } catch (error) {
                if (isUnknownInteraction(error) || isInteractionNotReplied(error)) {
                    return null;
                }

                if (!isInteractionAlreadyAcknowledged(error)) {
                    throw error;
                }

                try {
                    return await originalEditReply(payload);
                } catch {
                    // Some update payload shapes are incompatible with editReply.
                }

                try {
                    if (!interaction.deferred && !interaction.replied) {
                        return null;
                    }

                    return await originalFollowUp(payload);
                } catch (followUpError) {
                    if (isIgnorableInteractionError(followUpError)) {
                        return null;
                    }

                    throw followUpError;
                }
            }
        };
    }

    if (originalDeferUpdate) {
        interaction.deferUpdate = async () => {
            try {
                return await originalDeferUpdate();
            } catch (error) {
                if (isIgnorableInteractionError(error)) {
                    return null;
                }

                throw error;
            }
        };
    }
}

client.on('interactionCreate', async (interaction) => {
    patchInteractionResponses(interaction);

    if (!interaction.isChatInputCommand()) {
        return;
    }

    let command =
        client.slashCommands?.local?.get(interaction.commandName) ||
        client.slashCommands?.global?.get(interaction.commandName);

    if (!command) {
        console.warn(`[COMMAND] Comando não encontrado no cache: ${interaction.commandName}`);
        try {
            await interaction.reply({
                content: 'Algo deu errado ao executar esse comando',
                flags: MessageFlags.Ephemeral,
            });
        } catch (replyError) {
            console.error('[COMMAND] Falha ao responder comando inexistente:', replyError);
        }
        return;
    }

    try {
        const autoDeferTimer = setTimeout(async () => {
            if (interaction.deferred || interaction.replied) {
                return;
            }

            try {
                await interaction.deferReply();
            } catch (deferError) {
                if (isIgnorableInteractionError(deferError)) {
                    return;
                }

                console.error('[COMMAND] Falha no auto-defer da interação:', deferError);
            }
        }, 1200);

        try {
            await command.run(client, interaction);
        } finally {
            clearTimeout(autoDeferTimer);
        }
    } catch (error) {
        if (isIgnorableInteractionError(error)) {
            return;
        }

        console.error(`[COMMAND] Erro no comando ${interaction.commandName}:`, error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: 'Ocorreu um erro ao executar este comando',
                });
                return;
            }

            await interaction.reply({
                content: 'Ocorreu um erro ao executar este comando.',
                flags: MessageFlags.Ephemeral,
            });
        } catch (fallbackError) {
            if (isIgnorableInteractionError(fallbackError)) {
                return;
            }

            console.error('[COMMAND] Falha ao enviar fallback de erro:', fallbackError);
        }
    }
});

async function bootstrap(): Promise<void> {
    const discordToken = process.env.DISCORD_BOT_TOKEN;
    if (!discordToken) {
        throw new Error('A variável DISCORD_BOT_TOKEN nao esta definida');
    }

    await commandsHandler(client);
    await eventsHandler(client);
    await client.login(discordToken);

    const robloxCookie = process.env.COOKIE;
    if (robloxCookie) {
        await noblox.setCookie(robloxCookie);
    } else {
        console.warn('[ROBLOX] COOKIE não definida, Recursos Roblox podem falhar');
    }
}

bootstrap().catch((error) => {
    console.error('[BOOT] Falha ao iniciar o bot:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[PROCESS] unhandledRejection', promise, 'reason:', reason);
});

process.on('uncaughtException', (err, origin) => {
    console.error('[PROCESS] uncaughtException', err, origin);
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
    console.error('[PROCESS] uncaughtExceptionMonitor', err, origin);
});

export default client;
