#!/usr/bin/env node
// Prisma's datasource `provider` cannot be set via env() (only `url` can, as of
// the installed Prisma version) -- see apps/web/prisma/README.md. This script
// is the "npm script" half of that workaround: it copies the single verbatim
// schema.prisma and swaps the literal provider line, so schema.prisma itself
// never has to be hand-edited per environment.
//
// Usage: node generate-schema.mjs [sqlite|postgresql]
// Falls back to $DATABASE_PROVIDER, then to "postgresql" (matches CONTRACTS §7.16:
// unset DATABASE_PROVIDER means postgresql; local dev sets it to sqlite).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const provider = process.argv[2] ?? process.env.DATABASE_PROVIDER ?? 'postgresql';

if (provider !== 'sqlite' && provider !== 'postgresql') {
  console.error(`Unknown DATABASE_PROVIDER "${provider}" -- expected "sqlite" or "postgresql".`);
  process.exit(1);
}

const source = readFileSync(join(dir, 'schema.prisma'), 'utf8');
const generated = source.replace('provider = "postgresql"', `provider = "${provider}"`);
writeFileSync(join(dir, 'schema.generated.prisma'), generated);
console.log(`apps/web/prisma/schema.generated.prisma written (provider="${provider}")`);
