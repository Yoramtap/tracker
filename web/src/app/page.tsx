import fs from "fs";
import path from "path";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import { getPrdCards } from "./prds/data";
import InsightCarousel, { type InsightEntry } from "./components/insight-carousel";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const QUOTE_PATH = path.resolve(process.cwd(), "..", "data", "daily-quote.md");

const parseInsightEntries = (): InsightEntry[] => {
  try {
    if (!fs.existsSync(QUOTE_PATH)) return [];
    const content = fs.readFileSync(QUOTE_PATH, "utf-8");
    const blocks = content.split("\n---\n");
    return blocks
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const lines = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .filter((line) => line !== "---");
        const dateLine = lines.find((line) => line.startsWith("date:"));
        const authorLine = lines.find((line) => line.startsWith("author:"));
        const date = dateLine ? dateLine.replace("date:", "").trim() : "";
        const author = authorLine ? authorLine.replace("author:", "").trim() : "";
        const quoteLines = lines.filter(
          (line) => !line.startsWith("date:") && !line.startsWith("author:")
        );
        return { date, author, lines: quoteLines };
      })
      .filter((entry) => entry.date && entry.author && entry.lines.length > 0);
  } catch {
    return [];
  }
};

export default function Home() {
  const prds = getPrdCards().slice(0, 3);
  const insights = parseInsightEntries();
  return (
    <div className={styles.page}>
      <div className={styles.main}>
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

        {insights.length > 0 ? <InsightCarousel entries={insights} /> : null}

        {/* say-hi block intentionally hidden for now */}
      </div>
      <footer className={styles.footer}>
        <div>
          <p className={styles.footerTitle}>The Build Notes Kitchen</p>
        </div>
      </footer>
    </div>
  );
}
