import Link from "next/link";
import styles from "./primary-nav.module.css";

export default function PrimaryNav() {
  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/">
          The Build Notes Kitchen
        </Link>
        <nav className={styles.links} aria-label="Primary">
          <Link className={styles.link} href="/manifesto">
            Manifesto
          </Link>
          <Link className={styles.link} href="/prds">
            PRDs
          </Link>
          <Link className={styles.link} href="/relay">
            Relay
          </Link>
          <Link className={styles.link} href="/blog">
            Build notes
          </Link>
        </nav>
      </div>
    </header>
  );
}
