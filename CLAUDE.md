# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Docusaurus 3.10.1 static site (TypeScript) for a personal blog and docs site hosted at https://seriousjul.github.io. Deployed to GitHub Pages from the `gh-pages` branch.

## Commands

```pwsh
npm start          # Start local dev server (http://localhost:3000)
npm run build      # Build static site into build/
npm run serve      # Serve the build directory locally
npm run typecheck  # Run TypeScript type checking
npm run deploy     # Deploy to gh-pages branch
```

Node >= 20 required. Uses npm (not yarn despite README mentioning yarn).

## Shell

Always use PowerShell (pwsh) for shell commands instead of bash.

## agent-browser

Always use PowerShell (pwsh) to invoke `agent-browser` commands — never use the Bash tool for agent-browser.

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
