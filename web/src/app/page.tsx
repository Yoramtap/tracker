import fs from "fs";
import path from "path";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import { getPrdCards } from "./prds/data";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const QUOTE_PATH = path.resolve(process.cwd(), "..", "data", "daily-quote.md");

type DailyQuote = {
  date: string;
  author: string;
  lines: string[];
};

const readDailyQuote = (): DailyQuote | null => {
  try {
    if (!fs.existsSync(QUOTE_PATH)) return null;
    const content = fs.readFileSync(QUOTE_PATH, "utf-8");
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 3) return null;
    const [date, author, ...quoteLines] = lines;
    if (!date || !author || quoteLines.length === 0) return null;
    return { date, author, lines: quoteLines };
  } catch {
    return null;
  }
};

export default function Home() {
  const prds = getPrdCards().slice(0, 3);
  const quote = readDailyQuote();
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>the build notes kitchen</p>
            <h1>Ship, note, repeat.</h1>
            <p className={styles.tagline}>
              We document each feature end-to-end: PRD, stories, build, checks,
              notes, and the final ship.
            </p>
            <div className={styles.heroCtas}>
              <Link className={styles.primaryCta} href="/prds">
                Explore the PRDs
              </Link>
            </div>
          </div>
          <div className={styles.heroImageWrap}>
            <Image
              src={`${basePath}/images/hero-day.png`}
              alt=""
              width={640}
              height={426}
              priority
              className={styles.heroImageDay}
            />
            <Image
              src={`${basePath}/images/hero-night.png`}
              alt=""
              width={640}
              height={426}
              priority
              className={styles.heroImageNight}
            />
          </div>
        </section>

        <div className={styles.sectionDivider} aria-hidden="true" />

        <section className={`${styles.featured} ${styles.prdSection}`} id="prds">
          <div className={styles.prdIntro}>
            <span className={styles.prdChip}>Current Work</span>
            <p className={styles.prdLabel}>Active briefs</p>
            <Link className={styles.prdLink} href="/prds">
              View all PRDs
            </Link>
          </div>
          <ul className={styles.notesList}>
            {prds.map((prd) => (
              <li key={prd.slug} className={styles.notesItem}>
                <Link className={styles.notesLink} href={`/prds/${prd.slug}`}>
                  <h3 className={styles.notesTitle}>{prd.title}</h3>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {quote ? (
          <section className={styles.quoteSection}>
            <p className={styles.quoteLabel}>Insight</p>
            <div className={styles.quoteCard}>
              <div className={styles.quoteText}>
                {quote.lines.map((line, index) => (
                  <p key={`${line}-${index}`} className={styles.quoteLine}>
                    {line}
                  </p>
                ))}
              </div>
              <p className={styles.quoteMeta}>
                {quote.author} · {quote.date}
              </p>
            </div>
          </section>
        ) : null}

        {/* say-hi block intentionally hidden for now */}
      </main>
      <footer className={styles.footer}>
        <div>
          <p className={styles.footerTitle}>The Build Notes Kitchen</p>
        </div>
      </footer>
    </div>
  );
}
