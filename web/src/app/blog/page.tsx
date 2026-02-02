import Link from "next/link";
import styles from "./page.module.css";
import { posts } from "./posts";

export default function BlogIndexPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>build notes</p>
          <h1>All notes, gentle and steady.</h1>
          <p className={styles.subtitle}>
            Recent build logs to warm the week, each with a small change and a calm,
            considered rhythm.
          </p>
        </div>
        <Link className={styles.backLink} href="/">
          back to home
        </Link>
      </header>

      <section className={styles.cards}>
        {[...posts].reverse().map((post) => (
          <Link key={post.title} className={styles.card} href={`/blog/${post.slug}`}>
            <p className={styles.cardMeta}>
              <span>{post.category}</span>
              <span>{post.date}</span>
            </p>
            <h3>{post.title}</h3>
            <p className={styles.cardExcerpt}>{post.summary}</p>
            <span className={styles.cardLink}>Read the note</span>
          </Link>
        ))}
      </section>

      <div className={styles.pagination}>
        <a href="#" aria-disabled="true">
          older notes
        </a>
      </div>
    </div>
  );
}
