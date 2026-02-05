"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { type ReplayEvent } from "./data";

type ReplayFilter = "all" | "prds" | "stories";
type ReplayStatus = "planned" | "shipped";

type ReplayEventGroup = {
  id: string;
  label: string;
  events: ReplayEvent[];
};

const FILTER_OPTIONS: { id: ReplayFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "prds", label: "PRDs" },
  { id: "stories", label: "Stories" },
];

const formatDateLabel = (dateValue: string): string => {
  const timestamp = Date.parse(dateValue);
  if (Number.isNaN(timestamp)) return dateValue;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
};

const getDateGroupId = (dateValue: string): string => {
  const timestamp = Date.parse(dateValue);
  if (Number.isNaN(timestamp)) return `raw:${dateValue}`;
  return new Date(timestamp).toISOString().slice(0, 10);
};

const groupReplayEventsByDate = (events: ReplayEvent[]): ReplayEventGroup[] => {
  const groups = new Map<string, ReplayEventGroup>();

  events.forEach((event) => {
    const groupId = getDateGroupId(event.date);
    const existingGroup = groups.get(groupId);

    if (existingGroup) {
      existingGroup.events.push(event);
      return;
    }

    groups.set(groupId, {
      id: groupId,
      label: formatDateLabel(event.date),
      events: [event],
    });
  });

  return Array.from(groups.values());
};

const getEventTypeLabel = (type: ReplayEvent["type"]): string =>
  type === "prd_created" ? "PRD created" : "Story shipped";

const getEventLinkLabel = (type: ReplayEvent["type"]): string =>
  type === "prd_created" ? "Open PRD" : "Open Story";

const getEventStatus = (type: ReplayEvent["type"]): ReplayStatus =>
  type === "story_shipped" ? "shipped" : "planned";

const getStatusLabel = (status: ReplayStatus): string =>
  status === "shipped" ? "Shipped" : "Planned";

const parseReplayFilter = (value: string | null): ReplayFilter => {
  if (value === "prds" || value === "stories") return value;
  return "all";
};

const filterReplayEvents = (
  events: ReplayEvent[],
  filter: ReplayFilter,
): ReplayEvent[] => {
  if (filter === "prds") {
    return events.filter((event) => event.type === "prd_created");
  }

  if (filter === "stories") {
    return events.filter((event) => event.type === "story_shipped");
  }

  return events;
};

const getEmptyStateMessage = (filter: ReplayFilter): string => {
  if (filter === "prds") return "No PRD replay events yet.";
  if (filter === "stories") return "No shipped story replay events yet.";
  return "No replay events yet. Shipped stories and PRDs will appear here once they are recorded.";
};

const getFilterHref = (pathname: string, filter: ReplayFilter): string =>
  filter === "all" ? pathname : `${pathname}?filter=${filter}`;

const isSmallViewport = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 860px)").matches;
};

type ReplayTimelineProps = {
  replayEvents: ReplayEvent[];
};

type ReplayDetailContentProps = {
  event: ReplayEvent;
};

const ReplayDetailContent = ({ event }: ReplayDetailContentProps) => {
  const status = getEventStatus(event.type);

  return (
    <>
      <div className={styles.detailMetaRow}>
        <p className={styles.detailType}>{getEventTypeLabel(event.type)}</p>
        <span className={styles.statusPill} data-status={status}>
          {getStatusLabel(status)}
        </span>
      </div>
      <h3 className={styles.detailTitle}>{event.title}</h3>
      <p className={styles.detailDate}>{formatDateLabel(event.date)}</p>
      <p className={styles.detailSummary}>{event.summary}</p>
      <Link className={styles.detailLink} href={event.href}>
        {getEventLinkLabel(event.type)}
      </Link>
    </>
  );
};

export const ReplayTimeline = ({ replayEvents }: ReplayTimelineProps) => {
  const pathname = usePathname() ?? "/replay";
  const searchParams = useSearchParams();
  const selectedFilter = parseReplayFilter(searchParams.get("filter"));
  const filteredEvents = useMemo(
    () => filterReplayEvents(replayEvents, selectedFilter),
    [replayEvents, selectedFilter],
  );
  const replayEventGroups = useMemo(
    () => groupReplayEventsByDate(filteredEvents),
    [filteredEvents],
  );
  const detailPanelRef = useRef<HTMLElement>(null);
  const [userSelectedEventId, setUserSelectedEventId] = useState<string | null>(null);

  const selectedEvent =
    filteredEvents.find((event) => event.id === userSelectedEventId) ??
    filteredEvents[0] ??
    null;

  useEffect(() => {
    if (!selectedEvent) return;

    if (isSmallViewport()) {
      const inlineDetail = document.getElementById(`inline-detail-${selectedEvent.id}`);
      inlineDetail?.focus();
      return;
    }

    detailPanelRef.current?.focus();
  }, [selectedEvent]);

  return (
    <>
      <h2 className={styles.timelineTitle}>Timeline</h2>
      <p className={styles.timelineMeta}>
        {filteredEvents.length} events shown from PRDs and shipped stories.
      </p>
      <nav className={styles.filters} aria-label="Replay filters">
        {FILTER_OPTIONS.map((option) => {
          const isActive = option.id === selectedFilter;
          return (
            <Link
              key={option.id}
              href={getFilterHref(pathname, option.id)}
              className={styles.filterLink}
              aria-current={isActive ? "page" : undefined}
              data-active={isActive}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>
      {replayEventGroups.length > 0 && selectedEvent ? (
        <div className={styles.timelineLayout}>
          <ol className={styles.groupList}>
            {replayEventGroups.map((group) => (
              <li key={group.id} className={styles.groupItem}>
                <h3 className={styles.groupDate}>{group.label}</h3>
                <ul className={styles.cardList}>
                  {group.events.map((event) => {
                    const isSelected = event.id === selectedEvent.id;
                    const status = getEventStatus(event.type);
                    return (
                      <li
                        key={event.id}
                        className={styles.cardItem}
                        data-selected={isSelected}
                        data-status={status}
                      >
                        <button
                          type="button"
                          className={styles.cardButton}
                          onClick={() => setUserSelectedEventId(event.id)}
                          aria-pressed={isSelected}
                        >
                          <div className={styles.cardMetaRow}>
                            <p className={styles.cardType}>{getEventTypeLabel(event.type)}</p>
                            <span className={styles.statusPill} data-status={status}>
                              {getStatusLabel(status)}
                            </span>
                          </div>
                          <h4 className={styles.cardTitle}>{event.title}</h4>
                        </button>
                        <div className={styles.cardActions}>
                          <Link className={styles.cardLink} href={event.href}>
                            {getEventLinkLabel(event.type)}
                          </Link>
                        </div>
                        {isSelected ? (
                          <section
                            id={`inline-detail-${event.id}`}
                            className={styles.inlineDetail}
                            aria-label={`Details for ${event.title}`}
                            tabIndex={-1}
                          >
                            <ReplayDetailContent event={event} />
                          </section>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
          <aside
            id={`desktop-detail-${selectedEvent.id}`}
            ref={detailPanelRef}
            className={styles.detailPanel}
            aria-live="polite"
            tabIndex={-1}
          >
            <p className={styles.detailKicker}>Selected event</p>
            <ReplayDetailContent event={selectedEvent} />
          </aside>
        </div>
      ) : (
        <p className={styles.emptyState}>{getEmptyStateMessage(selectedFilter)}</p>
      )}
    </>
  );
};
