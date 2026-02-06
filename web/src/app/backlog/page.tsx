"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { backlogSource, getBoardBacklogReports, type BugIssue, type TrendPoint } from "./data";
import {
  CombinedTeamTrendChart,
  type CombinedTrendPoint,
  type TeamKey,
} from "./combined-team-trend-chart";

const DEFAULT_TEAM_VISIBLE: Record<TeamKey, boolean> = {
  api: true,
  legacy: true,
  react: true,
};

const TEAM_FILTERS: Array<{ key: TeamKey; label: string }> = [
  { key: "api", label: "API" },
  { key: "legacy", label: "Legacy FE" },
  { key: "react", label: "React FE" },
];

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDerivedTrendFromBugs(bugs: BugIssue[]): TrendPoint[] {
  if (bugs.length === 0) return [];

  const created = bugs
    .map((bug) => new Date(`${bug.createdAt}T00:00:00Z`))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (created.length === 0) return [];

  const start = created[0].getTime();
  const end = Date.now();
  const pointsCount = 10;
  const step = pointsCount > 1 ? (end - start) / (pointsCount - 1) : 0;

  const points: TrendPoint[] = [];
  for (let index = 0; index < pointsCount; index += 1) {
    const at = new Date(start + step * index);
    const boundary = formatIsoDate(at);
    let highest = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    for (const bug of bugs) {
      if (bug.createdAt > boundary) continue;
      if (bug.priority === "Highest") highest += 1;
      else if (bug.priority === "High") high += 1;
      else if (bug.priority === "Medium") medium += 1;
      else if (bug.priority === "Low") low += 1;
    }

    points.push({
      date: boundary,
      highest,
      high,
      medium,
      low,
      lowest: 0,
    });
  }

  return points;
}

function normalizeTrendDate(date: string) {
  return date.startsWith("API ") ? date.slice(4) : date;
}

function emptyTrendPoint(date: string): TrendPoint {
  return { date, highest: 0, high: 0, medium: 0, low: 0, lowest: 0 };
}

export default function BacklogPage() {
  const REFRESH_COOLDOWN_MS = 15_000;
  const [refreshTick, setRefreshTick] = useState(0);
  const reports = useMemo(() => {
    return [...getBoardBacklogReports()];
  }, [refreshTick]);
  const [visibleTeams, setVisibleTeams] = useState<Record<TeamKey, boolean>>(
    DEFAULT_TEAM_VISIBLE,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(backlogSource.syncedAt);
  const [showUpdatedToast, setShowUpdatedToast] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const syncedLabel = syncedAt.replace("T", " ").replace("Z", " UTC");
  const isOnCooldown = nowMs < cooldownUntil;
  const refreshDisabled = isRefreshing || isOnCooldown;
  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - nowMs) / 1000));

  useEffect(() => {
    if (!showUpdatedToast) return;
    const timeout = window.setTimeout(() => setShowUpdatedToast(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [showUpdatedToast]);

  useEffect(() => {
    if (!isOnCooldown) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [isOnCooldown]);

  const combinedPoints = useMemo<CombinedTrendPoint[]>(() => {
    const byId = new Map(reports.map((report) => [report.boardId, report]));
    const apiReport = byId.get(38);
    const legacyReport = byId.get(39);
    const reactReport = byId.get(46);

    const apiTrend = (apiReport?.trend ?? (apiReport ? buildDerivedTrendFromBugs(apiReport.bugs) : []))
      .map((point) => ({ ...point, date: normalizeTrendDate(point.date) }));
    const legacyTrend =
      legacyReport?.trend ?? (legacyReport ? buildDerivedTrendFromBugs(legacyReport.bugs) : []);
    const reactTrend =
      reactReport?.trend ?? (reactReport ? buildDerivedTrendFromBugs(reactReport.bugs) : []);

    const apiByDate = new Map(apiTrend.map((point) => [point.date, point]));
    const legacyByDate = new Map(legacyTrend.map((point) => [point.date, point]));
    const reactByDate = new Map(reactTrend.map((point) => [point.date, point]));

    const allDates = Array.from(
      new Set([
        ...apiTrend.map((point) => point.date),
        ...legacyTrend.map((point) => point.date),
        ...reactTrend.map((point) => point.date),
      ]),
    ).sort();

    return allDates.map((date) => ({
      date,
      api: apiByDate.get(date) ?? emptyTrendPoint(date),
      legacy: legacyByDate.get(date) ?? emptyTrendPoint(date),
      react: reactByDate.get(date) ?? emptyTrendPoint(date),
    }));
  }, [reports]);

  return (
    <div className={styles.page}>
      <section className={styles.dashboardGrid} aria-label="Combined team trend chart">
        <article className={`${styles.panel} ${styles.boardCard}`}>
          <header className={styles.boardCardHeader}>
            <div className={styles.titleWithLogo}>
              <img
                src="https://cdn.prod.website-files.com/5bc9fe82c6c2f54b071f0033/6968ee53f5e5c615b7f403e3_NEP%2040th%20Anniversary%20ALL%20Logos_V2-08.avif"
                alt="NEP 40 logo"
                className={styles.nepLogo}
              />
              <h2>Combined Team Bug Trend</h2>
            </div>
          </header>
          <div className={styles.controlRow}>
            <div className={styles.combinedTeamToggles} role="group" aria-label="Filter teams">
              {TEAM_FILTERS.map((team) => {
                const active = visibleTeams[team.key];
                return (
                  <button
                    key={team.key}
                    type="button"
                    className={styles.combinedTeamToggle}
                    data-active={active ? "true" : "false"}
                    onClick={() => {
                      const next = { ...visibleTeams, [team.key]: !visibleTeams[team.key] };
                      if (!Object.values(next).some(Boolean)) return;
                      setVisibleTeams(next);
                    }}
                    aria-pressed={active}
                  >
                    <span>{team.label}</span>
                    {active ? <span className={styles.combinedTeamToggleClose}>×</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <CombinedTeamTrendChart
            points={combinedPoints}
            visibleTeams={visibleTeams}
            onVisibleTeamsChange={setVisibleTeams}
            showTeamControls={false}
          />
          <div className={styles.bottomSyncControls}>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.refreshButton}
                aria-label={
                  refreshDisabled
                    ? `Refresh available in ${secondsLeft}s`
                    : isRefreshing
                      ? "Refreshing data"
                      : "Refresh data"
                }
                title={
                  refreshDisabled
                    ? `Refresh in ${secondsLeft}s`
                    : `${backlogSource.note} — Click to refresh`
                }
                disabled={refreshDisabled}
                onClick={() => {
                  if (refreshDisabled) return;
                  setIsRefreshing(true);
                  setRefreshTick((value) => value + 1);
                  setSyncedAt(new Date().toISOString());
                  setShowUpdatedToast(true);
                  setNowMs(Date.now());
                  setCooldownUntil(Date.now() + REFRESH_COOLDOWN_MS);
                  window.setTimeout(() => setIsRefreshing(false), 260);
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  aria-hidden="true"
                  className={styles.refreshIcon}
                >
                  <path
                    d="M20 12a8 8 0 1 1-2.34-5.66"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M20 4v5h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {showUpdatedToast ? <div className={styles.updatedToast}>Updated</div> : null}
              <span className={styles.syncedBadge}>Synced: {syncedLabel}</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
