import Fs from 'node:fs';
import Path from 'node:path';
import { pathToFileURL } from 'node:url';

type EventModule = {
    name?: string;
    execute?: (Client: any) => void;
};

function CollectEventFiles(Dir: string, Files: string[] = []): string[] {
    const Entries = Fs.readdirSync(Dir, { withFileTypes: true });

    for (const Entry of Entries) {
        const FullPath = Path.join(Dir, Entry.name);
        if (Entry.isDirectory()) {
            CollectEventFiles(FullPath, Files);
            continue;
        }

        if (Entry.isFile() && Entry.name.endsWith('.ts')) {
            Files.push(FullPath);
        }
    }

    return Files;
}

export default async function EventsHandler(Client: any): Promise<void> {
    const EventsRoot = Path.resolve(process.cwd(), 'Events');
    if (!Fs.existsSync(EventsRoot)) {
        console.warn('[EVENTS] Pasta Events nao encontrada.');
        return;
    }

    const EventFiles = CollectEventFiles(EventsRoot);
    const LoadedByFolder: Record<string, string[]> = {};

    for (const EventFile of EventFiles) {
        const Imported = await import(pathToFileURL(EventFile).href);
        const EventModule: EventModule = (Imported.default ?? Imported) as EventModule;
        const EventName = EventModule.name ?? Path.basename(EventFile, '.ts');

        if (typeof EventModule.execute === 'function') {
            EventModule.execute(Client);
        }

        const Folder =
            Path
                .relative(EventsRoot, Path.dirname(EventFile))
                .replace(/\\/g, '/') || 'root';

        if (!LoadedByFolder[Folder]) {
            LoadedByFolder[Folder] = [];
        }

        LoadedByFolder[Folder].push(EventName);
    }

    const Summary = Object.entries(LoadedByFolder)
        .map(([Folder, Names]) => `[${Folder}: ${Names.join(', ')}]`)
        .join(' - ');

    console.log(`[EVENTS] Eventos carregados: ${Summary}`);
}
