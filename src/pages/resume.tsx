import type {ReactNode} from 'react';
import Layout from '@theme/Layout';

import styles from './resume.module.css';

interface ExperienceItem {
  company: string;
  role: string;
  period: string;
  location: string;
  description?: string;
  bullets?: string[];
  keywords?: string[];
}

interface EducationItem {
  school: string;
  degree: string;
  period: string;
}

interface Certification {
  name: string;
  issuer: string;
  date: string;
  expires?: string;
}

const resume: {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  summary: string[];
  skills: string[];
  languages: {name: string; level: string}[];
  experiences: ExperienceItem[];
  education: EducationItem[];
  certifications: Certification[];
  scores: {name: string; score: string; date: string}[];
} = {
  name: 'Julien Antony',
  title: 'Software Engineer / Tech Lead',
  location: 'Luxembourg, Luxembourg',
  linkedin: 'https://www.linkedin.com/in/antonyjulien',
  github: 'https://github.com/SeriousJul',
  summary: [
    'Passionate Software Engineer with close to 15 years of professional experience, ex-Microsoft and Certified Azure Expert.',
    'Eager to learn, natural curiosity, pragmatic, and versatile.',
    'Acquired multiple skills in different experiences on a wide range of framework and technologies. Had meaningful accomplishments on subjects such as Frontend Dev, Delivery Optimizations, Analytics, Accessibility, Backend Dev, Testing, Automation, CI/CD, Infrastructure, DevOps and GitOps.',
  ],
  skills: ['Spring Boot', 'Software Development', 'DevOps'],
  languages: [
    {name: 'Francais', level: 'Native or bilingual proficiency'},
    {name: 'English', level: 'Professional working proficiency'},
  ],
  experiences: [
    {
      company: 'Cardif Lux Vie',
      role: 'Software Engineer / Tech Lead, Digital Squad',
      period: 'Mar 2021 - Present (5 years 3 months)',
      location: 'Luxembourg',
      description:
        'The Digital Squad is responsible for the development and the maintenance of all customer facing applications. This includes internet facing web applications and partner API integrations. Its main focus is to accelerate the digitalization journey of the company.',
      bullets: [
        'Led the design and development of partners API integration',
        'Led the design and development of end-to-end digitalization of subscriptions, payments, switch and surrender of a wide range of life insurance products',
        'Defined development best practices',
        "Helped other engineers' growth through meaningful pull request review and pair programming",
        'Ensured the quality of the delivery',
        'Ensured the non-obsolescence of all our assets',
        'Introduced testing automation (both unit test and integration test)',
      ],
      keywords: [
        'Java',
        'Spring Boot',
        'SQL Server',
        'Angular',
        'RXJS',
        'Typescript',
        'JWT',
        'OAuth',
        'SAML',
        'Cypress',
      ],
    },
    {
      company: 'CleverYak',
      role: 'Software Engineer & Co founder',
      period: 'Sep 2019 - Mar 2021 (1 year 7 months)',
      location: 'Luxembourg',
      description:
        'Hands on the whole development of the product. From the ground of the infrastructure to the details of the UI.',
      keywords: [
        'Azure',
        'Kubernetes',
        'Docker',
        'Javascript',
        'Typescript',
        'React',
        '.NET Core',
        'Cloud',
        'Cypress',
        'WebRTC',
        'SignalR',
        'CosmosDB',
        'SQL Server',
        'Azure Functions',
      ],
    },
    {
      company: 'Microsoft',
      role: 'Software Engineer II',
      period: 'Jan 2017 - Sep 2019 (2 years 9 months)',
      location: '',
      description:
        'Scaling and implementing features on Skype and Microsoft Teams for millions of users, both consumers and businesses.',
      keywords: ['Azure', 'Typescript', 'C#', 'React', 'React Native'],
    },
    {
      company: 'POST Luxembourg',
      role: 'Senior Analyst Developer',
      period: 'Jul 2015 - Dec 2016 (1 year 6 months)',
      location: '',
      description:
        'MyPost is a brand new selfcare website for POST clients. Currently users can see their mobile consumption, order options and link their contracts together. It is available on every device they have (responsive design).',
      bullets: [
        'Defining Software architecture',
        'Development of the application from scratch',
        'Continuous integration',
        'Data model specification and implementation',
        'Production and deployment support',
        'Technical Lead for junior and consultant to ensure they meet the quality gate and project deadlines',
      ],
      keywords: [
        'Java 8',
        'Play Framework',
        'Micro-services',
        'Swagger',
        'JavaScript',
        'AngularJS',
        'Docker',
        'Oracle',
        'MongoDB',
        'Git (TFS)',
        'Bash',
        'Jenkins',
        'Sonar',
        'Rundeck',
        'Intellij',
        'Visual Studo Code',
        'Gitkraken',
        'Liferay',
      ],
    },
    {
      company: 'Government of Luxembourg for ARHS Consulting',
      role: 'Analyst Developer',
      period: 'May 2013 - Jul 2015 (2 years 11 months)',
      location: 'Luxembourg',
      description:
        'The application allows non-established taxable persons supplying telecommunications, broadcasting or electronic services to non-taxable persons to fulfill their VAT obligations against the European Member States where consumers of their services are established.',
      bullets: [
        'Development of the application by implementing features and technical services: front-end, workflows, templating, mailing and XML based exchange between Member States',
        'Data model specification and implementation',
        'Production and deployment support',
        'Support to the testing team',
        'Documentation of the application: detailed design and installation guide',
      ],
      keywords: [
        'Batch Scripts',
        'DB2',
        'DB2 SQL',
        'Eclipse',
        'Git',
        'Java',
        'JavaScript',
        'JIRA/Greenhopper',
        'JPA (Java Persistence API)',
        'jQuery',
        'JSON (JavaScript Object Notation)',
        'JSP (Java Server Pages)',
        'JUnit',
        'Maven',
        'Mockito',
        'OpenJPA',
        'Oracle Database',
        'PL/SQL',
        'SQL',
        'Struts 2',
        'SVN (Subversion)',
        'TortoiseSVN',
        'WebSphere',
        'WSDL (Web Services Description Language)',
        'XML',
        'XPath',
        'XSD (XML Schema)',
        'XSLT (Extensible Stylesheet Language Transformation)',
      ],
    },
    {
      company: 'Government of Luxembourg for ARHS Consulting',
      role: 'Analyst Developer',
      period: 'Jan 2013 - Apr 2013 (4 months)',
      location: 'Luxembourg',
      description:
        'Development of a web application allowing the management of prohibited weapons and security companies.',
      bullets: [
        'Management of requests to buy, hold, loan or export prohibited weapons',
        'Management of agreements for the armories and shooting clubs',
        'Management of agreements for the security companies and their agents',
        'To hold electronically or print the different official documents related to these activities',
      ],
      bullets2: [
        'Development of the application, including workflows, front-end and batch processing',
        'Support to the testing team',
        'Documentation of the application: Integration guide and technical guide',
      ],
      keywords: [
        'Batch Scripts',
        'DB2',
        'DB2 SQL',
        'Eclipse',
        'Java',
        'JavaScript',
        'JIRA/Greenhopper',
        'JPA',
        'jQuery',
        'JSON',
        'JSP',
        'JUnit',
        'Maven',
        'Mockito',
        'OpenJPA',
        'SQL',
        'Struts 2',
        'SVN',
        'TortoiseSVN',
        'WebSphere',
        'Windows',
        'WSDL',
        'XML',
        'XSD',
      ],
    },
    {
      company: 'Government of Luxembourg for ARHS Consulting',
      role: 'Junior Analyst Developer',
      period: 'Sep 2012 - Dec 2012 (4 months)',
      location: 'Luxembourg',
      description:
        'The "DSS Applet for e-CODEX and e-Justice Portal" project is aimed at creating an applet, built on top of the open source library DSS (Digital Signature Service) developed by ARHS, for facilitating electronic signature.',
      bullets: [
        'Technical analysis',
        'Development of the application, including the front-end and the signing Applet',
        'Support to the testing team',
        'Documentation of the application: Integration guide and technical guide',
      ],
      keywords: [
        'Electronic Signatures',
        'Batch Scripts',
        'Java',
        'Java Applets',
        'JavaScript',
        'JBoss Application Server',
        'JCE (Java Cryptography Extension)',
        'JIRA/Greenhopper',
        'jQuery',
        'JSF',
        'JSON',
        'JUnit',
        'Maven',
        'Mockito',
        'MySQL',
        'NetBeans',
        'SQL',
        'Struts',
        'SVN',
        'TortoiseSVN',
        'UNIX',
        'UNIX Shell Scripts',
        'Windows',
        'XML',
      ],
    },
    {
      company: 'PSA Peugeot Citroen',
      role: 'Software Engineer - Apprenticeship',
      period: 'Sep 2009 - Aug 2012 (3 years)',
      location: 'Sochaux',
      bullets: [
        'Support project owner by animating workshops, proposing functional solutions based on best practices (ITIL)',
        'Functional and technical analysis',
        'Development of the application: participation on both front-end and back-end',
        'Implementation of ITIL Workflow (Changes, Incidents)',
        'Implementation of a Data-warehouse for the Business Intelligence project',
        'Presentation to client',
        'Documentation of the application: user guide, technical guide and installation guide',
        'Training of the users',
        'Follow-up and maintenance: Incident management and change management',
      ],
      keywords: [
        'Batch Scripts',
        'BusinessObjects Reporter',
        'BusinessObjects Universe Designer',
        'DB2',
        'DB2 SQL',
        'Eclipse',
        'HP Release Control',
        'HP Service Manager',
        'ITIL',
        'Java',
        'JIRA/Greenhopper',
        'Lean Management',
        'Oracle Database',
        'PL/SQL',
        'SQL',
        'TSQL',
        'UNIX',
        'UNIX Shell Scripts',
        'Windows',
        'XML',
      ],
    },
    {
      company: 'Dexia',
      role: 'IT Helpdesk - Summer job',
      period: 'Aug 2009 - Aug 2009 (1 month)',
      location: '',
      description:
        'Migration of computer equipment such as desktops and laptops from Windows 2K to Windows XP. Support for the end-users.',
      keywords: ['Windows', 'Word', 'Outlook'],
    },
    {
      company: 'Mosolf',
      role: 'Software Developer - Internship',
      period: 'Apr 2009 - Jun 2009 (3 months)',
      location: 'Hambach-Roth',
      description:
        'Specification and development of a business module for temporary employees management. The application allows e-Timekeeping for temporary employees and generates invoices that are ready to be sent to temp agencies.',
      keywords: ['Windev', 'HSQL', 'UML', 'Latex'],
    },
  ],
  education: [
    {
      school: 'Ecole Nationale Superieure dInformatique et de Mathematiques Appliquees de Grenoble / ENSIMAG',
      degree: 'Ingénieur, Informatique et systeme dinformation',
      period: '2009 - 2012',
    },
    {
      school: 'Université de Metz',
      degree: 'DUT, Informatique',
      period: '2007 - 2009',
    },
  ],
  certifications: [
    {
      name: 'Microsoft Certified: Azure Developer Associate',
      issuer: 'Microsoft',
      date: 'Aug 2019',
      expires: 'Aug 2024',
    },
    {
      name: 'Microsoft Certified: Azure DevOps Engineer Expert',
      issuer: 'Microsoft',
      date: 'Aug 2019',
      expires: 'Aug 2024',
    },
    {
      name: 'Microsoft Certified: Azure Solutions Architect Expert',
      issuer: 'Microsoft',
      date: 'Aug 2019',
      expires: 'Aug 2024',
    },
  ],
  scores: [
    {name: 'TOEIC', score: '825', date: 'May 2011'},
  ],
};

function Keywords({items}: {items: string[]}): ReactNode {
  return (
    <div className={styles.keywords}>
      {items.map((k) => (
        <span key={k} className={styles.keyword}>
          {k}
        </span>
      ))}
    </div>
  );
}

function SectionTitle({title}: {title: string}): ReactNode {
  return (
    <div className={styles.sectionTitle}>
      <h2>{title}</h2>
    </div>
  );
}

function ContactLine(): ReactNode {
  return (
    <div className={styles.contactRow}>
      <span>{resume.email}</span>
      <span>{resume.phone}</span>
    </div>
  );
}

function Header(): ReactNode {
  return (
    <div className={styles.header}>
      <h1 className={styles.name}>{resume.name}</h1>
      <p className={styles.title}>{resume.title}</p>
      <ContactLine />
    </div>
  );
}

function SummaryPage(): ReactNode {
  return (
    <div className={styles.page}>
      <Header />

      <SectionTitle title="Top Skills" />
      <div className={styles.skillsGrid}>
        {resume.skills.map((s) => (
          <span key={s} className={styles.skillBadge}>
            {s}
          </span>
        ))}
      </div>

      <SectionTitle title="Summary" />
      <ul className={styles.summaryList}>
        {resume.summary.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <SectionTitle title="Languages" />
      <div className={styles.languagesGrid}>
        {resume.languages.map((l) => (
          <div key={l.name} className={styles.languageItem}>
            <strong>{l.name}</strong>
            <span>{l.level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ExperiencePageProps {
  exp: ExperienceItem;
  isFirst?: boolean;
}

function ExperiencePage({exp, isFirst}: ExperiencePageProps): ReactNode {
  return (
    <div className={styles.expPage}>
      {isFirst ? null : <div className={styles.pageBreak} />}
      <SectionTitle title="Experience" />
      <div className={styles.expHeader}>
        <div>
          <h3 className={styles.expCompany}>{exp.company}</h3>
          <p className={styles.expRole}>{exp.role}</p>
        </div>
        <div className={styles.expMeta}>
          <span>{exp.period}</span>
          {exp.location && <span className={styles.expSep}>&middot;</span>}
          {exp.location && <span>{exp.location}</span>}
        </div>
      </div>
      {exp.description && <p className={styles.expDesc}>{exp.description}</p>}
      {exp.bullets && (
        <ul className={styles.expBullets}>
          {exp.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {exp.keywords && <Keywords items={exp.keywords} />}
    </div>
  );
}

function EducationPage(): ReactNode {
  return (
    <div className={styles.page}>
      <SectionTitle title="Education" />
      {resume.education.map((e) => (
        <div key={e.school} className={styles.eduItem}>
          <h3 className={styles.eduSchool}>{e.school}</h3>
          <p className={styles.eduDegree}>{e.degree}</p>
          <span className={styles.eduPeriod}>{e.period}</span>
        </div>
      ))}

      <SectionTitle title="Licenses & Certifications" />
      {resume.certifications.map((c) => (
        <div key={c.name} className={styles.certItem}>
          <h4 className={styles.certName}>{c.name}</h4>
          <span className={styles.certIssuer}>{c.issuer}</span>
          <span className={styles.certDate}>
            Issued {c.date}
            {c.expires && <> · Expires {c.expires}</>}
          </span>
        </div>
      ))}

      <SectionTitle title="Test Scores" />
      {resume.scores.map((s) => (
        <div key={s.name} className={styles.scoreItem}>
          <h4 className={styles.scoreName}>{s.name}</h4>
          <span>
            Score: {s.score}
          </span>
          <span className={styles.scoreDate}>{s.date}</span>
        </div>
      ))}
    </div>
  );
}

export default function Resume(): ReactNode {
  return (
    <Layout
      title={`${resume.name} - Resume`}
      description={`Resume of ${resume.name}, Software Engineer / Tech Lead`}>
      <div className={styles.viewer}>
        <div className={styles.pages}>
          <SummaryPage />
          {resume.experiences.map((exp, i) => (
            <ExperiencePage key={exp.company} exp={exp} isFirst={i === 0} />
          ))}
          <EducationPage />
        </div>
      </div>
    </Layout>
  );
}
