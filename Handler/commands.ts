import 'dotenv/config';
import { REST, Routes, Collection } from 'discord.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type CommandModule = {
    data?: {
        name: string;
        guildOnly?: boolean;
        toJSON: () => Record<string, any>;
    };
    run?: (client: any, interaction: any) => Promise<unknown> | unknown;
};

type CommandData = Record<string, any>;

export default async function commandsHandler(client: any): Promise<void> {
    const token = process.env.DISCORD_BOT_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;

    if (!token || !clientId) {
        console.error('[COMMANDS] DISCORD_BOT_TOKEN e DISCORD_CLIENT_ID sao obrigatorios.');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(token);
    const localSlashCommands = new Collection<string, CommandModule>();
    const globalSlashCommands = new Collection<string, CommandModule>();
    const loadedLocalCommands: CommandData[] = [];
    const loadedGlobalCommands: CommandData[] = [];

    try {
        const commandsRoot = path.resolve(process.cwd(), 'Commands');
        const folders = await fs.readdir(commandsRoot, { withFileTypes: true });

        for (const folder of folders) {
            if (!folder.isDirectory()) {
                continue;
            }

            const folderPath = path.join(commandsRoot, folder.name);
            const files = await fs.readdir(folderPath, { withFileTypes: true });

            for (const file of files) {
                if (!file.isFile() || !file.name.endsWith('.ts')) {
                    continue;
                }

                try {
                    const modulePath = path.join(folderPath, file.name);
                    const imported = await import(pathToFileURL(modulePath).href);
                    const command: CommandModule = (imported.default ?? imported) as CommandModule;

                    if (!command?.data || typeof command.run !== 'function') {
                        console.warn(`[COMMANDS] Comando "${file.name}" esta incompleto.`);
                        continue;
                    }

                    const jsonCommand = command.data.toJSON();
                    if (command.data.guildOnly) {
                        localSlashCommands.set(command.data.name, command);
                        loadedLocalCommands.push(jsonCommand);
                        continue;
                    }

                    globalSlashCommands.set(command.data.name, command);
                    loadedGlobalCommands.push(jsonCommand);
                } catch (error) {
                    console.error(`[COMMANDS] Falha ao carregar "${folder.name}/${file.name}":`, error);
                }
            }
        }

        client.slashCommands = { local: localSlashCommands, global: globalSlashCommands };

        client.once('clientReady', async () => {
            const guildId = process.env.DISCORD_GUILD_ID;

            if (guildId) {
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    await syncCommands(
                        rest,
                        Routes.applicationGuildCommands(clientId, guildId),
                        loadedLocalCommands,
                        'guild',
                    );
                } else {
                    console.warn('[COMMANDS] Guild ID para comandos locais nao encontrada no cache.');
                }
            } else {
                console.warn('[COMMANDS] DISCORD_GUILD_ID nao definido. Ignorando comandos locais.');
            }

            const uniqueGlobalCommands = Array.from(
                new Map(loadedGlobalCommands.map((command) => [command.name, command])).values(),
            );

            await syncCommands(
                rest,
                Routes.applicationCommands(clientId),
                uniqueGlobalCommands,
                'global',
            );
        });
    } catch (error) {
        console.error('[COMMANDS] Erro ao carregar comandos:', error);
    }
}

async function syncCommands(
    rest: REST,
    route: `/${string}`,
    commands: CommandData[],
    scope: 'guild' | 'global',
): Promise<void> {
    try {
        console.log(`[COMMANDS] Sincronizando comandos ${scope}...`);

        const existingCommands = (await rest.get(route)) as Array<Record<string, any>>;
        const toRegister: CommandData[] = [];
        const toUpdate: CommandData[] = [];
        const toDelete = [...existingCommands];

        for (const command of commands) {
            const existing = existingCommands.find((registered) => registered.name === command.name);
            if (!existing) {
                toRegister.push(command);
                continue;
            }

            const isDifferent = !areCommandsEqual(existing, command);
            if (isDifferent) {
                toUpdate.push({ id: existing.id, ...command });
            }

            const index = toDelete.indexOf(existing);
            if (index !== -1) {
                toDelete.splice(index, 1);
            }
        }

        for (const command of toRegister) {
            await rest.post(route, { body: command });
            console.log(`[COMMANDS] Novo comando registrado: ${command.name}`);
        }

        for (const command of toUpdate) {
            await rest.patch(`${route}/${command.id}` as `/${string}`, { body: command });
            console.log(`[COMMANDS] Comando atualizado: ${command.name}`);
        }

        for (const command of toDelete) {
            await rest.delete(`${route}/${command.id}` as `/${string}`);
            console.log(`[COMMANDS] Comando removido: ${command.name}`);
        }

        console.log(`[COMMANDS] Sincronizacao ${scope} concluida.`);
    } catch (error) {
        console.error(`[COMMANDS] Erro ao sincronizar comandos ${scope}:`, error);
    }
}

function areCommandsEqual(current: CommandData, next: CommandData): boolean {
    return JSON.stringify(normalizeCommandData(current)) === JSON.stringify(normalizeCommandData(next));
}

function normalizeCommandData(command: CommandData): CommandData {
    return {
        name: command.name,
        description: command.description,
        options: normalizeOptions(command.options ?? []),
    };
}

function normalizeOptions(options: CommandData[]): CommandData[] {
    return options
        .map((option) => {
            const normalized: CommandData = {
                type: option.type,
                name: option.name,
                description: option.description,
                required: Boolean(option.required),
            };

            if (option.choices) {
                normalized.choices = [...option.choices].sort((a, b) =>
                    a.name.localeCompare(b.name),
                );
            }

            if (option.options) {
                normalized.options = normalizeOptions(option.options);
            }

            return normalized;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}
