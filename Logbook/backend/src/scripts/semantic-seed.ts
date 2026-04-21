import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SemanticSearchIndexingService } from '../semantic-search/semantic-search.indexing';

function parseBooleanArg(name: string) {
  return process.argv.includes(`--${name}`) || process.env[name.toUpperCase()] === 'true';
}

function parseNumberEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const indexingService = app.get(SemanticSearchIndexingService);
    const fullReindex = parseBooleanArg('full-reindex') || process.env.SEMANTIC_SEED_FULL_REINDEX === 'true';
    const batchSize = parseNumberEnv('SEMANTIC_SEED_BATCH_SIZE', 25);
    const stateFile = process.env.SEMANTIC_SEED_STATE_FILE;

    const result = await indexingService.reindex({
      fullReindex,
      batchSize,
      stateFile,
      resume: true,
      onProgress: (event) => {
        console.log(`[semantic:seed] ${event.message}`);
      },
    });

    console.log(`[semantic:seed] ${result.message}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('[semantic:seed] failed:', error);
  process.exit(1);
});
