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
