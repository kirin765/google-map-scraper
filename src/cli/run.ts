import { createLogger } from '../utils/logger.js';
import { buildScrapeJobFromParsedArgs, parseCliArgs, printCliUsage } from './args.js';
import { scrapeRegionKeywords, createPipelineSummary } from '../pipelines/scrape-region-keywords.js';
import type { BrowserLauncher, Logger } from '../types/shared.js';

export interface CliRunDependencies {
  browserLauncher?: BrowserLauncher;
  logger?: Logger;
}

export async function runCli(argv: string[] = process.argv.slice(2), dependencies: CliRunDependencies = {}): Promise<void> {
  const parsedArgs = parseCliArgs(argv);
  const logger = dependencies.logger ?? createLogger({ scope: 'cli' });

  if (parsedArgs.help) {
    console.log(printCliUsage());
    return;
  }

  const job = buildScrapeJobFromParsedArgs(parsedArgs);
  logger.info('starting scrape job', {
    region: job.region,
    keywords: job.keywords,
    outputDir: job.outputDir,
    outputFormat: job.outputFormat,
  });

  const result = await scrapeRegionKeywords(job, {
    browserLauncher: dependencies.browserLauncher,
    logger: logger.child('pipeline'),
  });

  logger.info('scrape completed', createPipelineSummary(result));
  console.log(`Wrote ${result.outputPath}`);
}
