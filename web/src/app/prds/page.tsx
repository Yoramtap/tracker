import Link from "next/link";
import styles from "./page.module.css";
import { getPrdEntries } from "./data";
import { getPrdSlugsFromTags, posts } from "./story/posts";

export default function PrdsPage() {
  const prdEntries = getPrdEntries();
  const sortedPosts = [...posts].sort((a, b) => {
    const aTime = Date.parse(a.date);
    const bTime = Date.parse(b.date);
    if (aTime !== bTime) return bTime - aTime;
    return 0;
  });
  const prdGroups = prdEntries.map((entry) => {
    const relatedStories = sortedPosts.filter((post) =>
      getPrdSlugsFromTags(post.tags).includes(entry.slug)
    );
    return {
      ...entry,
      storyCount: relatedStories.length,
      relatedStories,
    };
  });
  const visiblePrdGroups = prdGroups.slice(0, 5);
  const olderPrdGroups = prdGroups.slice(5);

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

      <p className={styles.context}>
        Active briefs and the stories that shipped them.
      </p>

      <ul className={styles.prdList}>
        {visiblePrdGroups.map((prd) => (
          <li key={prd.slug} className={styles.prdItem}>
            <details className={styles.prdDetails}>
              <summary className={styles.prdSummary}>
                <div>
                  <p className={styles.prdMeta}>{prd.date}</p>
                  <h2 className={styles.prdTitle}>{prd.title}</h2>
                </div>
                <div className={styles.prdProgress}>
                  <span className={styles.prdCount}>
                    {prd.storyCount} {prd.storyCount === 1 ? "story" : "stories"}
                  </span>
                  <span className={styles.prdMeter} aria-hidden="true">
                    <span
                      className={styles.prdMeterFill}
                      style={{
                        width: `${Math.min(prd.storyCount * 20, 100)}%`,
                      }}
                    />
                  </span>
                </div>
              </summary>
              <div className={styles.prdBody}>
                <p className={styles.prdExcerpt}>{prd.summary}</p>
                <Link className={styles.prdLink} href={`/prds/${prd.slug}`}>
                  Open PRD
                </Link>
                {prd.relatedStories.length > 0 ? (
                  <details className={styles.storyDetails}>
                    <summary className={styles.storySummary}>
                      <span className={styles.storyIcon} aria-hidden="true">
                        +
                      </span>
                      Stories ({prd.storyCount})
                    </summary>
                    <ul className={styles.storyList}>
                      {prd.relatedStories.map((post) => (
                        <li key={post.slug} className={styles.storyItem}>
                          <Link className={styles.storyLink} href={`/prds/story/${post.slug}`}>
                            <span className={styles.storyTitle}>{post.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </details>
          </li>
        ))}
        {olderPrdGroups.length > 0 ? (
          <li className={styles.olderItem}>
            <details className={styles.olderDetails}>
              <summary className={styles.olderSummary}>
                <span className={styles.olderIcon} aria-hidden="true">
                  +
                </span>
                Show older PRDs
              </summary>
              <ul className={styles.prdList}>
                {olderPrdGroups.map((prd) => (
                  <li key={prd.slug} className={styles.prdItem}>
                    <details className={styles.prdDetails}>
                      <summary className={styles.prdSummary}>
                        <div>
                          <p className={styles.prdMeta}>{prd.date}</p>
                          <h2 className={styles.prdTitle}>{prd.title}</h2>
                        </div>
                        <div className={styles.prdProgress}>
                          <span className={styles.prdCount}>
                            {prd.storyCount}{" "}
                            {prd.storyCount === 1 ? "story" : "stories"}
                          </span>
                          <span className={styles.prdMeter} aria-hidden="true">
                            <span
                              className={styles.prdMeterFill}
                              style={{
                                width: `${Math.min(prd.storyCount * 20, 100)}%`,
                              }}
                            />
                          </span>
                        </div>
                      </summary>
                      <div className={styles.prdBody}>
                        <p className={styles.prdExcerpt}>{prd.summary}</p>
                        <Link className={styles.prdLink} href={`/prds/${prd.slug}`}>
                          Open PRD
                        </Link>
                        {prd.relatedStories.length > 0 ? (
                          <details className={styles.storyDetails}>
                            <summary className={styles.storySummary}>
                              <span className={styles.storyIcon} aria-hidden="true">
                                +
                              </span>
                              Stories ({prd.storyCount})
                            </summary>
                            <ul className={styles.storyList}>
                              {prd.relatedStories.map((post) => (
                                <li key={post.slug} className={styles.storyItem}>
                                  <Link
                                    className={styles.storyLink}
                                    href={`/prds/story/${post.slug}`}
                                  >
                                    <span className={styles.storyTitle}>{post.title}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
