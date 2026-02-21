import { pathToFileURL } from 'node:url';
await import(pathToFileURL('Commands/Utilidades/devex.ts').href);
await import(pathToFileURL('index.ts').href);
console.log('imports ok');
