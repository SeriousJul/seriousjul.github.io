import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'SeriousJul',
  tagline: 'Personal Website and Blog',
  favicon: 'img/seriousjul.png',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://seriousjul.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'SeriousJul', // Usually your GitHub org/user name.
  projectName: 'seriousjul.github.io', // Usually your repo name.
  deploymentBranch: 'gh-pages', // The branch to deploy to.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/SeriousJul/seriousjul.github.io/tree/main/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/SeriousJul/seriousjul.github.io/tree/main/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          // Posts are short; the list view shows the full text.
          onUntruncatedBlogPosts: 'ignore',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'SeriousJul',
      logo: {
        alt: 'SeriousJul Logo',
        src: 'img/seriousjul.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'notes',
          position: 'left',
          label: 'Notes',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          type: 'dropdown',
          label: 'Sudoku',
          position: 'left',
          items: [
            { to: '/sudoku', label: 'Sudoku 1' },
            { to: '/sudoku2', label: 'Sudoku 2' },
            { to: '/sudoku3', label: 'Sudoku 3' },
            { to: '/sudoku4', label: 'Sudoku 4×4' },
            { to: '/sudoku5', label: 'Sudoku 5' },
            { to: '/sudoku6', label: 'Sudoku 6' },
            { to: '/sudoku7', label: 'Sudoku 7' },
          ],
        },
        {to: '/resume', label: 'Resume', position: 'left'},
        {to: '/snake', label: 'Snake', position: 'left'},
        {
          href: 'https://www.linkedin.com/in/antonyjulien',
          label: 'LinkedIn',
          position: 'right',
        },
        {
          href: 'https://github.com/SeriousJul/seriousjul.github.io',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
