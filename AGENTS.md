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

Issues and specs for this repo live as GitHub issues in `SeriousJul/seriousjul.github.io`, used through the `gh` CLI. Run the commands from inside this clone and `gh` infers the repo from `git remote -v`.

- Create: `gh issue create --title "..." --body "..."`. Use a heredoc for a multi-line body.
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, with `--label` filters as needed
- Comment: `gh issue comment <number> --body "..."`
- Apply or remove labels: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

When a skill says "publish to the issue tracker", create a GitHub issue. When a skill says "fetch the relevant ticket", run `gh issue view <number> --comments`.

**PRs as a triage surface: no.** External PRs stay out of the triage queue.

Wayfinding, used by `/wayfinder`. The map is one issue labelled `wayfinder:map` that holds the Notes, Decisions-so-far, and Fog body. Child tickets link to the map as GitHub sub-issues; where sub-issues are not enabled, add each child to a task list in the map body and put `Part of #<map>` at the top of the child. Label children `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`. Blocking uses GitHub's native issue dependencies: `gh api --method POST repos/SeriousJul/seriousjul.github.io/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-database-id>`, where `<blocker-database-id>` comes from `gh api repos/SeriousJul/seriousjul.github.io/issues/<n> --jq .id` (the database id, not the `#number` or `node_id`). A ticket is unblocked when `issue_dependencies_summary.blocked_by` is zero and it has no assignee; first child in map order wins. Claim with `gh issue edit <n> --add-assignee @me`. Resolve by commenting the answer, closing the ticket, then appending a context pointer and link to the map's Decisions-so-far.

### Triage labels

The skills speak in terms of five canonical triage roles. This repo uses each role name as its own label string, plus one extra label for review outcomes.

| Role | Label in our tracker | Meaning |
| ------------------------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an AFK agent |
| `ready-for-human` | `ready-for-human` | Requires human implementation |
| `wontfix` | `wontfix` | Will not be actioned |
| _(extra, not a role)_ | `needs-work` | A PR needs more work before it can merge |

When a skill mentions a role, apply the label string from the middle column above. Create the ones this repo does not have yet with `gh label create <name> --description "..." --color ededed`.

### Domain docs

Single-context layout. `CONTEXT.md` at the repo root holds the domain glossary, and ADRs live in `docs/adr/`. Read both before exploring an area, and name domain concepts with the vocabulary `CONTEXT.md` defines instead of drifting to synonyms it avoids. If a file does not exist yet, proceed silently and do not propose creating it; `/domain-modeling` writes these lazily when a term or a decision actually gets resolved. If output would contradict an existing ADR, say so explicitly rather than silently overriding it.

`docs/` is this site's Docusaurus content root and `sidebars.ts` autogenerates the Tutorial sidebar from that whole tree, so anything added under `docs/adr/` publishes as a public page. Keep agent-only docs out of `docs/`, or exclude them in `docusaurus.config.ts` with `docs: { exclude: ['adr/**'] }`.
