import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type EventModule = {
    name?: string;
    execute?: (client: any) => void;
};

function collectEventFiles(dir: string, files: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectEventFiles(fullPath, files);
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.ts')) {
            files.push(fullPath);
        }
    }

    return files;
}

export default async function eventsHandler(client: any): Promise<void> {
    const eventsRoot = path.resolve(process.cwd(), 'Events');
    if (!fs.existsSync(eventsRoot)) {
        console.warn('[EVENTS] Pasta Events nao encontrada.');
        return;
    }

    const eventFiles = collectEventFiles(eventsRoot);
    const loadedByFolder: Record<string, string[]> = {};

    for (const eventFile of eventFiles) {
        const imported = await import(pathToFileURL(eventFile).href);
        const eventModule: EventModule = (imported.default ?? imported) as EventModule;
        const eventName = eventModule.name ?? path.basename(eventFile, '.ts');

        if (typeof eventModule.execute === 'function') {
            eventModule.execute(client);
        }

        const folder =
            path
                .relative(eventsRoot, path.dirname(eventFile))
                .replace(/\\/g, '/') || 'root';

        if (!loadedByFolder[folder]) {
            loadedByFolder[folder] = [];
        }

        loadedByFolder[folder].push(eventName);
    }

    const summary = Object.entries(loadedByFolder)
        .map(([folder, names]) => `[${folder}: ${names.join(', ')}]`)
        .join(' - ');

    console.log(`[EVENTS] Eventos carregados: ${summary}`);
}
