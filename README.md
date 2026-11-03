# fork_

**Recipes, version-controlled.** A recipe site for engineers. Find a recipe, **fork** it, tweak it, **commit** your changes, and **diff** your version against the original. Every recipe is stored as a dependency graph and rendered as a [Cooking for Engineers](https://www.cookingforengineers.com/)-style table.

```
$ fork clone ada_bakes/banana-nut-bread
$ fork diff upstream   +80g dark chocolate  −30g sugar
$ fork cook --servings 20
```

## Features

| | |
|---|---|
| **Fork, commit, diff** | Recipes live at `user/slug` like repos. Every edit is a commit with a message. A fork shares its parent's history (like git), shows how many commits it is *ahead/behind*, and can *sync* from upstream. You also get ingredient-level and word-level diffs, revert to any commit, and a fork network tree. |
| **The table** | Steps are a graph: each step lists the ingredients and earlier steps it consumes. That graph renders as a CFE table where cells merge rightwards. Hover a cell to trace what feeds it and where it goes. Click a step to mark it done. The same graph also renders as a numbered step list and as a **critical-path timeline** (log-time Gantt). |
| **Scale & convert** | Scale by servings (`?servings=20`), switch between original, metric and US units with ingredient-aware densities (1 cup flour ≈ 125 g, 1 cup sugar ≈ 200 g), and show **baker's percentages** and hydration for bread and pastry. |
| **Import** | Paste a link: we read the page's schema.org JSON-LD (no AI needed). You can also paste text (an offline heuristic parser, or AI), upload a **photo** of a cookbook page (AI vision), or start blank. The imported recipe opens in the editor for review before the first commit. |
| **Editor** | Spreadsheet-style ingredient rows with drag-to-reorder (dnd-kit), bulk paste, an "inputs" picker per step that wires the graph, an **auto-wire** button that infers the graph from the step text, a live table preview, and a commit bar (⌘↵) that shows a diffstat. |
| **AI sous-chef** | A chat panel with the recipe and its graph as context. Ask for a change ("make it vegan", "−30% sugar") and it comes back as a **reviewable diff**. You toggle each hunk on or off, then commit it (as the owner) or fork it with the changes. Highlight any text on the page to explain it, find a substitute, or ask about it. |
| **Pantry** | Track the ingredients and equipment you own (presets included). Each recipe shows a pantry match bar, its *missing deps*, and its required equipment. A "What can I make?" list ranks recipes by how well your pantry covers them. |
| **Shopping list** | Send an ingredient list (only what's missing, or everything) from any recipe, already scaled. Quantities are merged across recipes, converting units when it's safe. Items are grouped by aisle. You can check them off, move checked items into the pantry, or copy the list as a markdown checklist. |
| **Social** | Stars, discussions with *issues* that can be opened and closed, "cooked it" **build logs** (success/partial/failed plus a rating and notes, pinned to a commit), a CI-style builds tab, profiles with a contribution heatmap, a global `git log` feed, and trending. |
| **Cook mode** | A full-screen, one-step-at-a-time view. Navigate with `j`/`k` or the arrow keys, press `t` to start the step's timer, and the screen stays awake. Timers dock in the corner and notify you when they finish. |
| **UX** | JetBrains Mono, zero border radius, dark and light themes, a ⌘K command palette with live search, an IDE-style status bar, shields-style badges, interface sounds (Cuelume, can be muted), Thinking Orbs for AI states, print styles, and export to Markdown, Cooklang or JSON. |

## Stack

- **Next.js 16** (App Router, Turbopack, server actions), **React 19**, **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (radix, *lyra* preset), Phosphor icons, `motion`
- **Clerk** (Core 3) for auth
- **Drizzle ORM** on **Postgres**. Any Postgres in production (Supabase, Neon…); embedded **PGlite** in local dev, so there's nothing to install
- **Vercel AI SDK v7** with Anthropic, OpenAI or the AI Gateway (`generateText` + `Output.object` for imports, `streamText` + tools for chat)
- [`thinking-orbs`](https://libraries.dev/orbs) for AI loading states, [`cuelume`](https://cuelume.dev) for interface sounds, interaction patterns adapted from [Beautiful UI](https://www.beautifului.dev) (Diff Table, Selection Actions, Prompt Bar, Thinking: MIT)
- `nuqs` (URL state), `cheerio` (JSON-LD extraction), `diff` (word diffs), `@dnd-kit`, `react-markdown`, `sonner`, `cmdk`
- **Vitest** (unit tests) and **Playwright** + `@clerk/testing` (end-to-end tests)

## Getting started

```bash
pnpm install
npx clerk@latest init --accountless --framework next   # writes temporary Clerk dev keys to .env.local (no account needed)
pnpm dev
```

Open http://localhost:3000. The first request creates an embedded Postgres in `./.data/pglite`, runs the migrations and seeds demo users and recipes. `pnpm db:reset-local` deletes that database so it is recreated on the next start.

### Preview mode (no Clerk, no database)

The app deploys and runs with **zero configuration**:

- **No Clerk keys** → auth is off. Everything is browsable; sign-in, forking, editing, pantry and shopping show a "preview" notice.
- **No `DATABASE_URL`** → an embedded PGlite database is used: persisted in `./.data` locally, **in memory** on Vercel/serverless (seeded on each cold start with deterministic ids, so links stay stable across instances).

A "preview mode · read-only demo" badge shows in the status bar. Add the Clerk keys and `DATABASE_URL` to the Vercel project and redeploy to turn it into the real app.

### Enabling AI

Add **one** of these to `.env.local` and restart. The first one found is used:

```bash
ANTHROPIC_API_KEY=...   # default model: claude-sonnet-5-5
OPENAI_API_KEY=...      # default model: gpt-5-mini
AI_GATEWAY_API_KEY=...  # Vercel AI Gateway
AI_MODEL=...            # optional override
```

Without a key, everything else still works. The sous-chef shows an "AI offline" state. Link imports use JSON-LD and text imports use the offline parser.

### Using a real Postgres (Neon / Supabase / …)

On Vercel, `pnpm vercel-build` runs `scripts/migrate.ts` before `next build`. It applies the pending migrations from `drizzle/` automatically whenever a database URL is set (preferring the direct `DATABASE_URL_UNPOOLED`). With `SEED_DEMO=true` it also inserts the demo content, but only into an empty database. Without a URL it does nothing, and the app stays in preview mode.

Locally:

```bash
echo 'DATABASE_URL=postgres://…' >> .env.local
pnpm db:migrate     # apply drizzle/ migrations
pnpm db:seed        # migrations + demo content (only if the DB is empty)
```

The schema lives in `src/db/schema.ts`. After you change it, run `pnpm db:generate` to create a new migration.

## Scripts

| | |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm test` | unit tests (parser, graph → table layout, units, diff, JSON-LD, pantry matching) |
| `pnpm test:e2e` | Playwright smoke test against the running dev server: sign in, fork, edit + commit, pantry, shopping list, star, build log, import, cook mode. Needs an existing Clerk user (`E2E_EMAIL`). |
| `pnpm lint` / `typecheck` | ESLint, including the React Compiler rules, and `tsc` |
| `pnpm db:*` | `generate`, `migrate`, `seed`, `studio`, `reset-local` |

## Architecture notes

```
src/
  lib/recipe/      pure domain logic (shared by server and client, unit tested)
    schema.ts      RecipeData (zod): ingredients + steps with `inputs` (the graph)
    graph.ts       graph → CFE table layout (row/col spans), downstream map, critical-path schedule
    parse.ts       ingredient-line parser, free-text parser, action/timing inference, graph inference
    jsonld.ts      schema.org Recipe extraction
    units.ts       unit normalisation, density-aware conversion, fraction formatting
    diff.ts        structural recipe diff + partial apply (for AI hunks)
    scale.ts       scaling, baker's percentages     match.ts  pantry coverage
  db/              drizzle schema, client (postgres-js | PGlite), seed data
  app/actions.ts   server actions (create/commit/fork/sync/revert/star/cook/comment/pantry/shopping)
  app/api/         /import (link/text/photo), /chat (streaming + proposeChanges tool), /search
  app/[user]/[slug]/(repo)/  recipe, history, commit/[sha], compare, forks, discussions, builds
  components/      recipe/ (table, views, diff, actions), editor/, ai/, shell/, pantry/, shopping/
```

**Commits are immutable JSON snapshots** of `RecipeData`. `parent_id` forms the history chain. A fork's head starts out pointing at the upstream head commit, so its history walk (`WITH RECURSIVE`) continues into the parent recipe, just like git. Diffs are computed between snapshots, matching items by id first and then by normalised name or text.

## Roadmap ideas

- Pull requests: propose a fork's changes back upstream and merge them hunk by hunk
- Nutrition estimates, allergen flags, cost per serving
- Image uploads (UploadThing / Vercel Blob) and photos on build logs
- Follows and a personalised feed, collections ("awesome-lists")
- A browser extension to send any page to Fork; video imports (YouTube / TikTok transcripts)
- An oven-temperature and bulk-ferment calculator, and a temperature → time table for sourdough

## Credits

The table format was invented by Michael Chu at [cookingforengineers.com](https://www.cookingforengineers.com/). Seed recipes are original.
