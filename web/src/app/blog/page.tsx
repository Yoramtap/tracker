import Link from "next/link";
import styles from "./page.module.css";
import { posts } from "./posts";
import KeyboardCardGrid from "../components/keyboard-card-grid";
import { getPrdCards } from "../prds/data";

export default function BlogIndexPage() {
  const prds = getPrdCards();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>prds + build notes</p>
          <h1>Plans first, notes next.</h1>
          <p className={styles.subtitle}>
            Start with the PRDs, then follow the stories that shipped them.
          </p>
        </div>
        <Link className={styles.backLink} href="/">
          back to home
        </Link>
      </header>

      <section className={styles.section} id="prds">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionKicker}>prds</p>
            <h2>Specs that led the work</h2>
          </div>
          <Link className={styles.sectionLink} href="/prds">
            View all PRDs
          </Link>
        </div>
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
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionKicker}>build notes</p>
            <h2>Stories that shipped it</h2>
          </div>
          <Link className={styles.sectionLink} href="/blog">
            View all notes
          </Link>
        </div>
      <KeyboardCardGrid
        items={[...posts].reverse().map((post) => ({
          ...post,
          category: "story",
        }))}
        classNames={{
          grid: styles.cards,
          card: styles.card,
          meta: styles.cardMeta,
          excerpt: styles.cardExcerpt,
          link: styles.cardLink,
          focused: styles.cardFocused,
        }}
        linkLabel="Read the note"
        backspaceHref="/"
      />
      </section>

      <div className={styles.pagination}>
        <a href="#" aria-disabled="true">
          older notes
        </a>
      </div>
    </div>
  );
}
