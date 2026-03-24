import { pathToFileURL } from 'node:url';

import { runCli } from './cli/run.js';

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  await runCli(argv);
}

const isDirectExecution = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectExecution) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
