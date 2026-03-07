import Fs from 'node:fs';
import Path from 'node:path';

type Utf8GuardOptions = {
    Strict?: boolean;
    Verbose?: boolean;
    RootPath?: string;
    Targets?: string[];
};

type Utf8Issue = {
    filePath: string;
    reason: string;
    line: number;
    excerpt: string;
};

const Utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const TextExtensions = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.json',
    '.md',
    '.txt',
    '.yml',
    '.yaml',
    '.env',
    '.config',
]);
const TextFileNames = new Set(['bun', 'discloud.config', '.gitignore']);
const IgnoredDirectories = new Set(['.git', 'node_modules', 'dist']);
const DefaultTargets = ['Commands', 'Events', 'Handler', 'index.ts', 'config.ts'];

const SuspiciousPatterns: Array<{ regex: RegExp; reason: string }> = [
    { regex: /\uFFFD/u, reason: 'contains replacement character U+FFFD' },
    { regex: /\u00C3[\u0080-\u00BF]/u, reason: 'contains suspicious mojibake sequence with U+00C3' },
    { regex: /\u00C2[\u0080-\u00BF]/u, reason: 'contains suspicious mojibake sequence with U+00C2' },
    { regex: /\u00E2[\u0080-\u00BF]{1,2}/u, reason: 'contains suspicious mojibake sequence with U+00E2' },
];

function IsTextFile(FilePath: string): boolean {
    const BaseName = Path.basename(FilePath);
    if (TextFileNames.has(BaseName)) {
        return true;
    }

    const Extension = Path.extname(FilePath).toLowerCase();
    return TextExtensions.has(Extension);
}

function GetLineAndExcerpt(Content: string, Index: number): { line: number; excerpt: string } {
    const SafeIndex = Math.max(0, Math.min(Index, Content.length));
    const Before = Content.slice(0, SafeIndex);
    const Line = Before.split(/\r?\n/).length;
    const LineText = Content.split(/\r?\n/)[Line - 1] ?? '';
    return {
        line: Line,
        excerpt: LineText.trim().slice(0, 160),
    };
}

function FindMojibakeIssue(FilePath: string, Content: string): Utf8Issue | null {
    for (const Pattern of SuspiciousPatterns) {
        const Match = Pattern.regex.exec(Content);
        if (!Match || typeof Match.index !== 'number') {
            continue;
        }

        const { line, excerpt } = GetLineAndExcerpt(Content, Match.index);
        return {
            filePath: Path.relative(process.cwd(), FilePath),
            reason: Pattern.reason,
            line,
            excerpt,
        };
    }

    return null;
}

function WalkFiles(TargetPath: string, Collector: string[]): void {
    if (!Fs.existsSync(TargetPath)) {
        return;
    }

    const Stat = Fs.statSync(TargetPath);
    if (Stat.isFile()) {
        if (IsTextFile(TargetPath)) {
            Collector.push(TargetPath);
        }
        return;
    }

    if (!Stat.isDirectory()) {
        return;
    }

    for (const Entry of Fs.readdirSync(TargetPath, { withFileTypes: true })) {
        if (Entry.isDirectory() && IgnoredDirectories.has(Entry.name)) {
            continue;
        }

        const FullPath = Path.join(TargetPath, Entry.name);
        if (Entry.isDirectory()) {
            WalkFiles(FullPath, Collector);
            continue;
        }

        if (Entry.isFile() && IsTextFile(FullPath)) {
            Collector.push(FullPath);
        }
    }
}

export function RunUtf8Guard(Options: Utf8GuardOptions = {}): void {
    const RootPath = Options.RootPath ?? process.cwd();
    const Strict = Options.Strict ?? true;
    const Verbose = Options.Verbose ?? true;
    const Targets = Options.Targets ?? DefaultTargets;

    const Files: string[] = [];
    for (const Target of Targets) {
        WalkFiles(Path.resolve(RootPath, Target), Files);
    }

    const Issues: Utf8Issue[] = [];

    for (const FilePath of Files) {
        const BufferData = Fs.readFileSync(FilePath);
        let Decoded = '';

        try {
            Decoded = Utf8Decoder.decode(BufferData);
        } catch {
            Issues.push({
                filePath: Path.relative(process.cwd(), FilePath),
                reason: 'file is not valid UTF-8',
                line: 1,
                excerpt: '',
            });
            continue;
        }

        const MojibakeIssue = FindMojibakeIssue(FilePath, Decoded);
        if (MojibakeIssue) {
            Issues.push(MojibakeIssue);
        }
    }

    if (Issues.length === 0) {
        if (Verbose) {
            console.log(`[UTF8] Check complete in ${Files.length} file(s), no issues found`);
        }
        return;
    }

    console.error(`[UTF8] Found ${Issues.length} encoding issue(s)`);
    for (const Issue of Issues) {
        const Location = `${Issue.filePath}:${Issue.line}`;
        if (Issue.excerpt) {
            console.error(`[UTF8] ${Location} - ${Issue.reason} | ${Issue.excerpt}`);
            continue;
        }

        console.error(`[UTF8] ${Location} - ${Issue.reason}`);
    }

    if (Strict) {
        throw new Error('[UTF8] Startup blocked due to encoding issue(s)');
    }
}

if (import.meta.main) {
    try {
        RunUtf8Guard({
            Strict: process.env.UTF8_GUARD !== '0',
            Verbose: true,
        });
    } catch (Error) {
        console.error(Error);
        process.exit(1);
    }
}
