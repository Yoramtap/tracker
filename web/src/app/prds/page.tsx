import Link from "next/link";
import styles from "./page.module.css";
import KeyboardCardGrid from "../components/keyboard-card-grid";
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
        <Link className={styles.backLink} href="/">
          back to home
        </Link>
      </header>

      <KeyboardCardGrid
        items={prds}
        hrefBase="/prds"
        classNames={{
          grid: styles.cards,
          card: styles.card,
          meta: styles.cardMeta,
          excerpt: styles.cardExcerpt,
          link: styles.cardLink,
          focused: styles.cardFocused,
          count: styles.cardCount,
        }}
        linkLabel="Read the PRD"
        backspaceHref="/"
      />
    </div>
  );
}
