"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CombinedTeamTrendChart,
} from "@/domains/backlog/ui/combined-team-trend-chart";
import styles from "./page.module.css";
import type { BacklogSnapshot, TeamKey } from "@/domains/backlog/types";

const REFRESH_COOLDOWN_MS = 15_000;

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

async function fetchSnapshot(endpoint: string, method: "GET" | "POST") {
  const response = await fetch(endpoint, {
    method,
    cache: "no-store",
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error ?? "Backlog request failed.");
  }

  return payload as BacklogSnapshot;
}

export default function BacklogPage() {
  const [snapshot, setSnapshot] = useState<BacklogSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleTeams, setVisibleTeams] = useState<Record<TeamKey, boolean>>(
    DEFAULT_TEAM_VISIBLE,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showUpdatedToast, setShowUpdatedToast] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  const isOnCooldown = nowMs < cooldownUntil;
  const refreshDisabled = isRefreshing || isOnCooldown || !snapshot;
  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - nowMs) / 1000));

  const syncedLabel = useMemo(() => {
    if (!snapshot?.source.syncedAt) return "Not synced";
    return snapshot.source.syncedAt.replace("T", " ").replace("Z", " UTC");
  }, [snapshot?.source.syncedAt]);

  const updatedLabel = useMemo(() => {
    if (!snapshot?.updatedAt) return "Unknown";
    return snapshot.updatedAt.replace("T", " ").replace("Z", " UTC");
  }, [snapshot?.updatedAt]);

  useEffect(() => {
    let active = true;
    fetchSnapshot("/api/backlog/read", "GET")
      .then((payload) => {
        if (!active) return;
        setSnapshot(payload);
        setLoadError(null);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load backlog snapshot.");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showUpdatedToast) return;
    const timeout = window.setTimeout(() => setShowUpdatedToast(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [showUpdatedToast]);

  useEffect(() => {
    if (!isOnCooldown) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isOnCooldown]);

  const onRefresh = async () => {
    if (refreshDisabled) return;
    setIsRefreshing(true);
    setNowMs(Date.now());

    try {
      const payload = await fetchSnapshot("/api/backlog/refresh", "POST");
      setSnapshot(payload);
      setLoadError(null);
      setShowUpdatedToast(true);
      setCooldownUntil(Date.now() + REFRESH_COOLDOWN_MS);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to refresh backlog snapshot.");
      // On failure allow immediate retry; do not consume cooldown budget.
      setCooldownUntil(0);
    } finally {
      setIsRefreshing(false);
    }
  };

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
          <p className={styles.syncedBadge}>
            Last updated: {updatedLabel}
            {snapshot?.schemaVersion ? ` (schema v${snapshot.schemaVersion})` : ""}
          </p>

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

          {loadError ? <p className={styles.loadError}>{loadError}</p> : null}

          <CombinedTeamTrendChart
            points={snapshot?.combinedPoints ?? []}
            visibleTeams={visibleTeams}
          />

          <div className={styles.bottomSyncControls}>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.refreshButton}
                data-refreshing={isRefreshing ? "true" : "false"}
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
                    : `${snapshot?.source.note ?? "Backlog trend snapshot"} — Click to refresh`
                }
                disabled={refreshDisabled}
                onClick={onRefresh}
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
              <span className={styles.syncedBadge}>
                {isRefreshing ? "Refreshing Jira..." : refreshDisabled && secondsLeft > 0 ? `Refresh unlocks in ${secondsLeft}s` : `Synced: ${syncedLabel}`}
              </span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
