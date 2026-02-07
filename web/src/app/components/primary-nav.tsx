 "use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./primary-nav.module.css";
import NightVisionToggle from "./night-vision-toggle";

export default function PrimaryNav() {
  const pathname = usePathname();
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/">
          The Build Notes Kitchen
        </Link>
        <div className={styles.actions}>
          <nav className={styles.links} aria-label="Primary">
            <Link
              className={styles.link}
              href="/relay"
              aria-current={isCurrent("/relay") ? "page" : undefined}
            >
              Relay
            </Link>
            <Link
              className={styles.link}
              href="/manifesto"
              aria-current={isCurrent("/manifesto") ? "page" : undefined}
            >
              Manifesto
            </Link>
            <Link
              className={styles.link}
              href="/backlog"
              aria-current={isCurrent("/backlog") ? "page" : undefined}
            >
              Backlog
            </Link>
          </nav>
          <NightVisionToggle />
        </div>
      </div>
    </header>
  );
}
