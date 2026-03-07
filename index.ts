import 'dotenv/config';
import { Client, IntentsBitField, MessageFlags, Options } from 'discord.js';
import CommandsHandler from './Handler/commands';
import EventsHandler from './Handler/events';
import { RunUtf8Guard } from './Handler/Utf8Guard';

type SlashCommandModule = {
    data?: {
        name?: string;
        toJSON?: () => { name?: string };
    };
    run: (Client: BotClient, Interaction: any) => Promise<unknown> | unknown;
};

type BotClient = Client & {
    slashCommands: {
        local: Map<string, SlashCommandModule>;
        global: Map<string, SlashCommandModule>;
    };
};

const DiscordToken = process.env.DISCORD_BOT_TOKEN;
const RestartWindowMs = 5 * 60_000;
const MaxRestartsInWindow = 6;
const RestartDelayMs = 4_000;
const ForceExitDelayMs = 25_000;
const MinRestartIntervalMs = 15_000;

const RestartHistory: number[] = [];
let IsRestarting = false;
let LastRestartTimestamp = 0;

function IsInteractionAlreadyAcknowledged(Error: any): boolean {
    return Error?.code === 40060 || Error?.rawError?.code === 40060;
}

function IsUnknownInteraction(Error: any): boolean {
    return Error?.code === 10062 || Error?.rawError?.code === 10062;
}

function IsUnknownWebhook(Error: any): boolean {
    return Error?.code === 10015 || Error?.rawError?.code === 10015;
}

function IsInteractionNotReplied(Error: any): boolean {
    return Error?.code === 'InteractionNotReplied';
}

function IsIgnorableInteractionError(Error: any): boolean {
    return (
        IsInteractionAlreadyAcknowledged(Error) ||
        IsUnknownInteraction(Error) ||
        IsUnknownWebhook(Error) ||
        IsInteractionNotReplied(Error)
    );
}

const ClientInstance = new Client({
    intents: [
        IntentsBitField.Flags.DirectMessages,
        IntentsBitField.Flags.Guilds,
    ],
    makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        ApplicationCommandManager: 0,
        ApplicationEmojiManager: 0,
        AutoModerationRuleManager: 0,
        BaseGuildEmojiManager: 0,
        DMMessageManager: 5,
        EntitlementManager: 0,
        GuildBanManager: 0,
        GuildEmojiManager: 0,
        GuildForumThreadManager: 0,
        GuildInviteManager: 0,
        GuildMemberManager: 0,
        GuildMessageManager: 10,
        GuildScheduledEventManager: 0,
        GuildStickerManager: 0,
        GuildTextThreadManager: 0,
        MessageManager: 20,
        PresenceManager: 0,
        ReactionManager: 0,
        ReactionUserManager: 0,
        StageInstanceManager: 0,
        ThreadManager: 0,
        ThreadMemberManager: 0,
        UserManager: 200,
        VoiceStateManager: 0,
    }),
    sweepers: {
        messages: {
            interval: 300,
            lifetime: 600,
        },
        threads: {
            interval: 3600,
            lifetime: 1800,
        },
    },
}) as BotClient;

function Sleep(Ms: number): Promise<void> {
    return new Promise((Resolve) => setTimeout(Resolve, Ms));
}

function CanRestartNow(): boolean {
    const Now = Date.now();

    while (RestartHistory.length > 0 && Now - RestartHistory[0] > RestartWindowMs) {
        RestartHistory.shift();
    }

    if (RestartHistory.length >= MaxRestartsInWindow) {
        return false;
    }

    RestartHistory.push(Now);
    return true;
}

async function RestartClient(Reason: string, Error?: unknown): Promise<void> {
    if (!DiscordToken) {
        console.error('[RECOVERY] DISCORD_BOT_TOKEN nao definido. Encerrando processo.');
        process.exit(1);
    }

    if (IsRestarting) {
        console.warn(`[RECOVERY] Reinicio ja em andamento. Motivo ignorado: ${Reason}`);
        return;
    }

    const Now = Date.now();
    if (Now - LastRestartTimestamp < MinRestartIntervalMs) {
        console.warn(`[RECOVERY] Ignorando reinicio por cooldown. Motivo: ${Reason}`);
        return;
    }

    if (!CanRestartNow()) {
        console.error('[RECOVERY] Limite de reinicios excedido. Encerrando para evitar loop.');
        process.exit(1);
    }

    IsRestarting = true;
    LastRestartTimestamp = Now;

    console.error(`[RECOVERY] Reiniciando sessao do bot. Motivo: ${Reason}`);
    if (Error) {
        console.error('[RECOVERY] Erro que disparou o reinicio:', Error);
    }

    const ForceExitTimer = setTimeout(() => {
        console.error('[RECOVERY] Reinicio travado. Encerrando processo.');
        process.exit(1);
    }, ForceExitDelayMs);
    ForceExitTimer.unref();

    try {
        ClientInstance.destroy();
    } catch (DestroyError) {
        console.error('[RECOVERY] Falha ao destruir client antes do reinicio:', DestroyError);
    }

    try {
        await Sleep(RestartDelayMs);
        await ClientInstance.login(DiscordToken);
        console.log('[RECOVERY] Sessao reestabelecida com sucesso.');
    } catch (RestartError) {
        console.error('[RECOVERY] Falha ao reiniciar sessao. Encerrando processo:', RestartError);
        process.exit(1);
    } finally {
        clearTimeout(ForceExitTimer);
        IsRestarting = false;
    }
}

function PatchInteractionResponses(Interaction: any): void {
    if (Interaction.__lockouPatchedResponses) {
        return;
    }
    Interaction.__lockouPatchedResponses = true;

    const OriginalReply = typeof Interaction.reply === 'function' ? Interaction.reply.bind(Interaction) : null;
    const OriginalEditReply =
        typeof Interaction.editReply === 'function' ? Interaction.editReply.bind(Interaction) : null;
    const OriginalFollowUp =
        typeof Interaction.followUp === 'function' ? Interaction.followUp.bind(Interaction) : null;
    const OriginalDeferReply =
        typeof Interaction.deferReply === 'function' ? Interaction.deferReply.bind(Interaction) : null;
    const OriginalUpdate = typeof Interaction.update === 'function' ? Interaction.update.bind(Interaction) : null;
    const OriginalDeferUpdate =
        typeof Interaction.deferUpdate === 'function' ? Interaction.deferUpdate.bind(Interaction) : null;

    if (OriginalReply && OriginalEditReply && OriginalFollowUp) {
        Interaction.reply = async (Payload: any) => {
            try {
                return await OriginalReply(Payload);
            } catch (Error) {
                if (IsUnknownInteraction(Error) || IsInteractionNotReplied(Error)) {
                    return null;
                }

                if (!IsInteractionAlreadyAcknowledged(Error)) {
                    throw Error;
                }

                try {
                    return await OriginalEditReply(Payload);
                } catch {
                    // Some payloads (e.g. flags/ephemeral) are invalid for editReply
                }

                try {
                    if (!Interaction.deferred && !Interaction.replied) {
                        return null;
                    }

                    return await OriginalFollowUp(Payload);
                } catch (FollowUpError) {
                    if (IsIgnorableInteractionError(FollowUpError)) {
                        return null;
                    }

                    throw FollowUpError;
                }
            }
        };
    }

    if (OriginalEditReply && OriginalFollowUp) {
        Interaction.editReply = async (Payload: any) => {
            try {
                return await OriginalEditReply(Payload);
            } catch (Error) {
                if (IsUnknownInteraction(Error) || IsInteractionNotReplied(Error)) {
                    return null;
                }

                if (!IsInteractionAlreadyAcknowledged(Error)) {
                    throw Error;
                }

                try {
                    if (!Interaction.deferred && !Interaction.replied) {
                        return null;
                    }

                    return await OriginalFollowUp(Payload);
                } catch (FollowUpError) {
                    if (IsIgnorableInteractionError(FollowUpError)) {
                        return null;
                    }

                    throw FollowUpError;
                }
            }
        };
    }

    if (OriginalFollowUp) {
        Interaction.followUp = async (Payload: any) => {
            try {
                if (!Interaction.deferred && !Interaction.replied) {
                    return null;
                }

                return await OriginalFollowUp(Payload);
            } catch (Error) {
                if (IsIgnorableInteractionError(Error)) {
                    return null;
                }

                throw Error;
            }
        };
    }

    if (OriginalDeferReply) {
        Interaction.deferReply = async (Payload: any) => {
            try {
                return await OriginalDeferReply(Payload);
            } catch (Error) {
                if (IsIgnorableInteractionError(Error)) {
                    return null;
                }

                throw Error;
            }
        };
    }

    if (OriginalUpdate && OriginalEditReply && OriginalFollowUp) {
        Interaction.update = async (Payload: any) => {
            try {
                return await OriginalUpdate(Payload);
            } catch (Error) {
                if (IsUnknownInteraction(Error) || IsInteractionNotReplied(Error)) {
                    return null;
                }

                if (!IsInteractionAlreadyAcknowledged(Error)) {
                    throw Error;
                }

                try {
                    return await OriginalEditReply(Payload);
                } catch {
                    // Some update payload shapes are incompatible with editReply.
                }

                try {
                    if (!Interaction.deferred && !Interaction.replied) {
                        return null;
                    }

                    return await OriginalFollowUp(Payload);
                } catch (FollowUpError) {
                    if (IsIgnorableInteractionError(FollowUpError)) {
                        return null;
                    }

                    throw FollowUpError;
                }
            }
        };
    }

    if (OriginalDeferUpdate) {
        Interaction.deferUpdate = async () => {
            try {
                return await OriginalDeferUpdate();
            } catch (Error) {
                if (IsIgnorableInteractionError(Error)) {
                    return null;
                }

                throw Error;
            }
        };
    }
}

ClientInstance.on('interactionCreate', async (Interaction) => {
    PatchInteractionResponses(Interaction);

    if (!Interaction.isChatInputCommand()) {
        return;
    }

    let Command =
        ClientInstance.slashCommands?.local?.get(Interaction.commandName) ||
        ClientInstance.slashCommands?.global?.get(Interaction.commandName);

    if (!Command) {
        console.warn(`[COMMAND] Comando nao encontrado no cache: ${Interaction.commandName}`);
        try {
            await Interaction.reply({
                content: 'Algo deu errado ao executar esse comando',
                flags: MessageFlags.Ephemeral,
            });
        } catch (ReplyError) {
            console.error('[COMMAND] Falha ao responder comando inexistente:', ReplyError);
        }
        return;
    }

    try {
        const AutoDeferTimer = setTimeout(async () => {
            if (Interaction.deferred || Interaction.replied) {
                return;
            }

            try {
                await Interaction.deferReply();
            } catch (DeferError) {
                if (IsIgnorableInteractionError(DeferError)) {
                    return;
                }

                console.error('[COMMAND] Falha no auto-defer da interacao:', DeferError);
            }
        }, 1200);

        try {
            await Command.run(ClientInstance, Interaction);
        } finally {
            clearTimeout(AutoDeferTimer);
        }
    } catch (Error) {
        if (IsIgnorableInteractionError(Error)) {
            return;
        }

        console.error(`[COMMAND] Erro no comando ${Interaction.commandName}:`, Error);
        try {
            if (Interaction.deferred || Interaction.replied) {
                await Interaction.editReply({
                    content: 'Ocorreu um erro ao executar este comando',
                });
                return;
            }

            await Interaction.reply({
                content: 'Ocorreu um erro ao executar este comando',
                flags: MessageFlags.Ephemeral,
            });
        } catch (FallbackError) {
            if (IsIgnorableInteractionError(FallbackError)) {
                return;
            }

            console.error('[COMMAND] Falha ao enviar fallback de erro:', FallbackError);
        }
    }
});

ClientInstance.on('shardError', (Error) => {
    console.error('[GATEWAY] shardError detectado:', Error);
    void RestartClient('shardError', Error);
});

ClientInstance.on('invalidated', () => {
    console.error('[GATEWAY] Sessao invalidada pelo Discord (invalidated)');
    void RestartClient('invalidated');
});

async function Bootstrap(): Promise<void> {
    if (!DiscordToken) {
        throw new Error('A variavel DISCORD_BOT_TOKEN nao esta definida');
    }

    RunUtf8Guard({
        Strict: process.env.UTF8_GUARD !== '0',
        Verbose: process.env.UTF8_GUARD_VERBOSE !== '0',
    });

    await CommandsHandler(ClientInstance);
    await EventsHandler(ClientInstance);
    await ClientInstance.login(DiscordToken);
}

Bootstrap().catch((Error) => {
    console.error('[BOOT] Falha ao iniciar o bot:', Error);
    process.exit(1);
});

process.on('unhandledRejection', (Reason, PromiseRef) => {
    console.error('[PROCESS] unhandledRejection', PromiseRef, 'reason:', Reason);
    if (IsIgnorableInteractionError(Reason)) {
        return;
    }

    void RestartClient('unhandledRejection', Reason);
});

process.on('uncaughtException', (Err, Origin) => {
    console.error('[PROCESS] uncaughtException', Err, Origin);
    void RestartClient(`uncaughtException:${Origin}`, Err);
});

process.on('uncaughtExceptionMonitor', (Err, Origin) => {
    console.error('[PROCESS] uncaughtExceptionMonitor', Err, Origin);
});
if (process.env.LOG_MEMORY === '1') {
    setInterval(() => {
        const Usage = process.memoryUsage();
        const RssMb = (Usage.rss / 1024 / 1024).toFixed(1);
        const HeapUsedMb = (Usage.heapUsed / 1024 / 1024).toFixed(1);
        const ExternalMb = (Usage.external / 1024 / 1024).toFixed(1);
        console.log('[MEMORY] rss=' + RssMb + 'MB heap=' + HeapUsedMb + 'MB external=' + ExternalMb + 'MB');
    }, 60_000).unref();
}
export default ClientInstance;

