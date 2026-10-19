import type {ReactNode} from 'react';

import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './index.module.css';

const LINKS = [
  {to: '/blog', label: 'Blog'},
  {to: '/resume', label: 'Resume'},
  {to: '/sudoku', label: 'Sudoku'},
  {to: '/snake', label: 'Snake'},
] as const;

function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();

  return (
    <Layout title="Home" description={siteConfig.tagline}>
      <header className={styles.header}>
        <div className="container">
          <Heading as="h1" className={styles.title}>
            {siteConfig.title}
          </Heading>
          <p className={styles.tagline}>{siteConfig.tagline}</p>
          <nav className={styles.links}>
            {LINKS.map(link => (
              <Link key={link.to} to={link.to} className={styles.link}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    </Layout>
  );
}

export default Home;
