# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Project

Docusaurus 3.10.2 static site (TypeScript) for a personal blog and docs site hosted at https://seriousjul.github.io. Deployed to GitHub Pages from the `gh-pages` branch.

## Commands

```bash
npm start          # Start local dev server (http://localhost:3000)
npm run build      # Build static site into build/
npm run serve      # Serve the build directory locally
npm run typecheck  # Run TypeScript type checking
npm run deploy     # Deploy to gh-pages branch
```

Node >= 20 required. Uses npm (not yarn despite README mentioning yarn).

## Dependency Policy

This project never patches third-party source. A local patch - changed third-party source installed in place of the registry copy - is forbidden by [ADR-0001](docs/adr/0001-no-local-patches-to-third-party-dependencies.md). The vocabulary is in [GLOSSARY.md](GLOSSARY.md).

- The sanctioned way to answer an advisory is a **registry version pin**: a published registry version selected through `overrides` in `package.json`.
- Where an advisory has no upstream fix, the response is a reachability analysis, a registry pin where one exists, and **dependency replacement** when the dependency is unhealthy.
- No `file:`, `link:`, path, git, `github:` or tarball dependency spec is allowed, and no tracked third-party source path is allowed. `tests/dependency-policy.test.mjs` fails the build if either appears. Reopening a banned shape requires a new ADR.
- CI sets `NO_UPDATE_NOTIFIER=1` so the `update-notifier` path (the only runtime consumer of `http-cache-semantics`) never runs there. Set the same variable in your local environment for local development.

## Architecture

- **Config**: `docusaurus.config.ts` — single config file with classic preset (docs + blog + theme). Future v4 compat flag enabled. Deploys via GitHub Pages to `gh-pages` branch.
- **Sidebars**: `sidebars.ts` — auto-generates `tutorialSidebar` from the docs/ directory tree.
- **Src**:
  - `src/pages/` — React pages (`index.tsx` homepage with hero banner + features, `markdown-page.mdx` template).
  - `src/components/HomepageFeatures/` — Reusable feature card grid component.
  - `src/css/custom.css` — Global Infima theme overrides (green palette, light/dark mode vars).
- **Content**: `docs/` (MDX tutorial docs under `_category_.json` groups), `blog/` (MDX blog posts + `authors.yml` + `tags.yml`).
- **Static**: `static/img/` — favicon, logo, social card, illustrations served at root path.
- **Build output**: `build/` (gitignored).

## Key Files

| Path | Purpose |
|------|-----|
| `docusaurus.config.ts` | Site config, navbar (Tutorial, Blog, LinkedIn, GitHub), footer, Prism themes |
| `sidebars.ts` | Auto-generated tutorial sidebar |
| `src/pages/index.tsx` | Homepage — hero banner + HomepageFeatures grid |
| `src/css/custom.css` | Green color palette, dark mode colors |
| `tsconfig.json` | Extends @docusaurus/tsconfig, strict mode |

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `SeriousJul/seriousjul.github.io`, driven with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.
