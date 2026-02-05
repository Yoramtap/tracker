import { getPrdEntries } from "../prds/data";
import { getPrdSlugsFromTags, posts } from "../prds/story/posts";

export type ReplayEventType = "prd_created" | "story_shipped";

export type ReplayEvent = {
  id: string;
  type: ReplayEventType;
  title: string;
  date: string;
  summary: string;
  prdSlug: string;
  href: string;
};

type SortableReplayEvent = ReplayEvent & {
  sortTimestamp: number | null;
  fallbackOrder: number;
};

const parseTimestamp = (value: string): number | null => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const resolveStoryPrdSlug = (tags?: string[], fallbackSlug?: string): string | null => {
  const fromTags = getPrdSlugsFromTags(tags)[0];
  return fromTags ?? fallbackSlug ?? null;
};

const toSortableReplayEvents = (): SortableReplayEvent[] => {
  const prdEvents: ReplayEvent[] = getPrdEntries().map((entry) => ({
    id: `prd-created:${entry.slug}`,
    type: "prd_created",
    title: entry.title,
    date: entry.date,
    summary: entry.summary,
    prdSlug: entry.slug,
    href: `/prds/${entry.slug}`,
  }));

  const storyEvents: ReplayEvent[] = posts.flatMap((post) => {
    const prdSlug = resolveStoryPrdSlug(post.tags, post.prdSlug);
    if (!prdSlug) return [];

    return [
      {
        id: `story-shipped:${post.slug}`,
        type: "story_shipped" as const,
        title: post.title,
        date: post.date,
        summary: post.excerpt,
        prdSlug,
        href: `/prds/story/${post.slug}`,
      },
    ];
  });

  return [...prdEvents, ...storyEvents].map((event, index) => ({
    ...event,
    sortTimestamp: parseTimestamp(event.date),
    fallbackOrder: index,
  }));
};

export const getReplayEvents = (): ReplayEvent[] => {
  const stripSortMetadata = (event: SortableReplayEvent): ReplayEvent => ({
    id: event.id,
    type: event.type,
    title: event.title,
    date: event.date,
    summary: event.summary,
    prdSlug: event.prdSlug,
    href: event.href,
  });

  return toSortableReplayEvents()
    .sort((a, b) => {
      if (a.sortTimestamp !== null && b.sortTimestamp !== null) {
        if (a.sortTimestamp !== b.sortTimestamp) {
          return b.sortTimestamp - a.sortTimestamp;
        }
      } else if (a.sortTimestamp !== null) {
        return -1;
      } else if (b.sortTimestamp !== null) {
        return 1;
      }

      return a.fallbackOrder - b.fallbackOrder;
    })
    .map(stripSortMetadata);
};
