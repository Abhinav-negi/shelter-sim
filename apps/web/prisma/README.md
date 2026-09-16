# Prisma: provider switching

`schema.prisma` is the single, verbatim source of truth (CONTRACTS.md §7.12). Its
`datasource.provider` is a Prisma string literal, not `env(...)` -- the installed
Prisma version only allows `env()` on `url`, not on `provider` itself.

So every `db:*` script first runs `generate-schema.mjs`, which copies
`schema.prisma` to the gitignored `schema.generated.prisma` with the provider
line swapped to whichever `DATABASE_PROVIDER` says (default `postgresql`,
matching CONTRACTS §7.16; pass/set `sqlite` for local dev). All Prisma CLI
calls target `schema.generated.prisma`, never `schema.prisma` directly, so the
checked-in file never needs a hand edit per environment.

Local dev: copy `.env.example` to `.env` with `DATABASE_PROVIDER=sqlite` and
`DATABASE_URL="file:./dev.db"`. The committed migration in `migrations/` was
generated and is tested against SQLite; regenerate it against a live Postgres
instance (`npm run db:migrate:deploy` after pointing `DATABASE_URL` at one)
before the first production deploy.
