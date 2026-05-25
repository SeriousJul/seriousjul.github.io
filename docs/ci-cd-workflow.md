# CI/CD Workflow

This project uses GitHub Actions for continuous integration and deployment.

## Workflow File

The workflow is defined in `.github/workflows/ci-cd.yml`.

## Workflow Details

The workflow runs on:
- Push events to the `main` branch
- Pull request events to the `main` branch

### Steps

1. **Checkout code** - Checks out the repository code
2. **Setup Node.js** - Sets up Node.js environment (version 20)
3. **Install dependencies** - Installs project dependencies using npm
4. **Build** - Builds the Docusaurus site
5. **Deploy** - Deploys the built site to GitHub Pages

## Environment Variables

The workflow uses the following environment variables:
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- `NODE_VERSION` - Set to `20.x`

## Deployment

The site is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.