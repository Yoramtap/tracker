import Link from "next/link";
import styles from "./primary-nav.module.css";
import NightVisionToggle from "./night-vision-toggle";

export default function PrimaryNav() {
  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/">
          The Build Notes Kitchen
        </Link>
        <div className={styles.actions}>
          <nav className={styles.links} aria-label="Primary">
            <Link className={styles.link} href="/relay">
              Relay
            </Link>
            <Link className={styles.link} href="/snake">
              Snake
            </Link>
            <Link className={styles.link} href="/manifesto">
              Manifesto
            </Link>
            <Link className={styles.link} href="/prds">
              PRDs
            </Link>
          </nav>
          <NightVisionToggle />
        </div>
      </div>
    </header>
  );
}
