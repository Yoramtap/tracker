import Link from "next/link";
import styles from "./page.module.css";
import { getPrdCards } from "./data";

export default function PrdsPage() {
  const prds = getPrdCards();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>prds</p>
          <h1>Product briefs, end to end.</h1>
          <p className={styles.subtitle}>
            Each brief captures what we planned, what we built, and the checks that
            got it shipped.
          </p>
        </div>
      </header>

      <ul className={styles.prdList}>
        {prds.map((prd) => (
          <li key={prd.slug} className={styles.prdItem}>
            <details className={styles.prdDetails}>
              <summary className={styles.prdSummary}>
                <div>
                  <p className={styles.prdMeta}>{prd.date}</p>
                  <h2 className={styles.prdTitle}>{prd.title}</h2>
                </div>
                <p className={styles.prdCount}>{prd.storyCount} stories</p>
              </summary>
              <div className={styles.prdBody}>
                <p className={styles.prdExcerpt}>{prd.summary}</p>
                <Link className={styles.prdLink} href={`/prds/${prd.slug}`}>
                  Open PRD
                </Link>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
