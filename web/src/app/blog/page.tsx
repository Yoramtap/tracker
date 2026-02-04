import Link from "next/link";
import styles from "./page.module.css";
import { posts } from "./posts";

export default function BlogIndexPage() {
  const sortedPosts = [...posts].sort((a, b) => {
    const aTime = Date.parse(a.date);
    const bTime = Date.parse(b.date);
    if (aTime !== bTime) return bTime - aTime;
    return 0;
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>build notes</p>
          <h1>Stories that shipped it.</h1>
          <p className={styles.subtitle}>
            Each entry captures what shipped, what changed, and what we learned.
          </p>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionKicker}>build notes</p>
            <h2>Stories that shipped it</h2>
          </div>
        </div>
        <ul className={styles.noteList}>
          {sortedPosts.map((post) => (
            <li key={post.slug} className={styles.noteItem}>
              <Link className={styles.noteLink} href={`/blog/${post.slug}`}>
                <p className={styles.noteMeta}>
                  <span>{post.category}</span>
                  <span>{post.date}</span>
                </p>
                <h3 className={styles.noteTitle}>{post.title}</h3>
                <p className={styles.noteSummary}>{post.summary}</p>
                <span className={styles.noteCta}>Read the note</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.pagination}>
        <a href="#" aria-disabled="true">
          older notes
        </a>
      </div>
    </div>
  );
}
