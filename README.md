# SeriousJul's Personal Website

This is the source code for my personal website hosted at https://seriousjul.github.io.

## Technologies Used

- [Docusaurus 3.10.1](https://docusaurus.io/) - Static site generator
- React 19
- TypeScript
- GitHub Pages for hosting

## Project Structure

```
.
├── blog/                 # Blog posts
├── docs/                 # Documentation
├── src/                  # Source code
│   ├── components/       # Reusable components
│   ├── css/              # Custom CSS
│   └── pages/            # Custom pages
├── static/               # Static assets
└── .github/workflows/    # CI/CD workflows
```

This repository never carries third-party source. See the [Dependency Policy](#dependency-policy) section below.

## Development

### Prerequisites

- Node.js >= 20.0
- npm

### Installation

```bash
npm install
```

### Local Development

```bash
npm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```bash
npm run build
```

## Dependency Management

This project uses [Dependabot](https://docs.github.com/en/code-security/dependabot) to automatically keep dependencies up to date. Dependabot will create pull requests for dependency updates on a weekly basis, helping to maintain security and stability.

For more information about Dependabot configuration, see the [.github/dependabot.yml](.github/dependabot.yml) file.

### Dependency Policy

This project never patches third-party source. A local patch - changed third-party source installed in place of the registry copy - is forbidden by [ADR-0001](docs/adr/0001-no-local-patches-to-third-party-dependencies.md).

The sanctioned way to answer an advisory is a **registry version pin**: a published registry version selected through `overrides` in `package.json`. Where an advisory has no upstream fix, the response is a reachability analysis, a registry pin where one exists, and **dependency replacement** - removal of the dependency, or of the code path that reaches it - when the dependency is unhealthy. The policy is enforced by `tests/dependency-policy.test.mjs`, which fails the build on any non-registry dependency spec or any tracked third-party source path.

CI runs with `NO_UPDATE_NOTIFIER=1` set, so the `update-notifier` notification path (the only runtime consumer of `http-cache-semantics`) never runs there. Set the same variable in your local environment for local development (for example `export NO_UPDATE_NOTIFIER=1` in bash, or `$env:NO_UPDATE_NOTIFIER = "1"` in PowerShell) before starting the dev server.

This command generates static content into the `build` directory and can be served using any static contents hosting service.

### Deployment

```bash
npm run deploy
```

This command builds the website and deploys it to GitHub Pages.

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment:

- **Workflow**: `.github/workflows/ci-cd.yml`
- **Build & Test**: Runs on every push and pull request to main branch
- **Deploy**: Automatically deploys to GitHub Pages when changes are pushed to main branch
