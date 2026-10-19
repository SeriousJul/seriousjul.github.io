import type {ReactNode} from 'react';

import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './index.module.css';

const INTERNAL_LINKS = [
  {to: '/news', label: 'News'},
  {to: '/resume', label: 'Resume'},
] as const;

const EXTERNAL_LINKS = [
  {
    href: 'https://seriousjul.github.io/my-little-software-factory/',
    label: 'Software Factory',
  },
  {href: 'https://seriousjul.github.io/pi-extensions/', label: 'Pi Extensions'},
] as const;

function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();

  return (
    <Layout title="Home" description={siteConfig.tagline}>
      <header className={styles.hero}>
        <div className="container">
          <img
            className={styles.avatar}
            src="/img/seriousjul.png"
            alt="SeriousJul avatar"
            width={96}
            height={96}
          />
          <Heading as="h1" className={styles.title}>
            {siteConfig.title}
          </Heading>
          <p className={styles.tagline}>{siteConfig.tagline}</p>
          <nav className={styles.links}>
            {INTERNAL_LINKS.map(link => (
              <Link key={link.to} to={link.to} className={styles.link}>
                {link.label}
              </Link>
            ))}
            {EXTERNAL_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                className={styles.link}
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
    </Layout>
  );
}

export default Home;
