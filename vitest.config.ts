import { defineConfig } from 'vitest/config';

// apps/web/test/*.ts (T-30 onward: db.test.ts, repo-*.test.ts) directly
// mutate the real, process-wide `process.env.DATABASE_URL` and a shared
// `globalThis` Prisma-client stash to exercise "DB on / off / unreachable"
// per test -- see lib/db.ts's own header comment. Vitest's default
// cross-file concurrency can interleave two such files' async hooks, so one
// file's `delete process.env.DATABASE_URL` races a sibling file's
// `process.env.DATABASE_URL = <live path>`, handing `getDb()` a live
// PrismaClient when a test expects null. Chai's object inspector then hangs
// trying to pretty-print that client's proxy-heavy internals for the
// failure message (`RangeError: Maximum call stack size exceeded`, no
// capturable trace -- the crash is inside chai, not the code under test).
// Root-caused and reproduced directly, 2026-09-17: forcing single-process,
// serialised file execution makes it disappear reliably across repeated
// runs. This is the fix, not a workaround -- these files share real
// process-wide state that was never safe to touch from two files at once,
// independent of this specific crash mode.
export default defineConfig({
  test: {
    fileParallelism: false,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
