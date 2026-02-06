"use client";

import { useMemo, useRef, useState } from "react";
import type { CombinedTrendPoint, TeamKey, TrendPoint } from "./types";
import styles from "./page.module.css";

type HoverState = {
  x: number;
  y: number;
  date: string;
  team: string;
  total: number;
  highlightedLabel: string;
  highlightedCount: number;
} | null;

type PriorityKey = "highest" | "high" | "medium" | "low" | "lowest";

const PRIORITIES: Array<{ key: PriorityKey; label: string; color: string }> = [
  { key: "highest", label: "Highest", color: "#9c3b2f" },
  { key: "high", label: "High", color: "#ba7a36" },
  { key: "medium", label: "Medium", color: "#66707a" },
  { key: "low", label: "Low", color: "#3f8cab" },
  { key: "lowest", label: "Lowest", color: "#1f648d" },
];
const STACK_PRIORITIES = [...PRIORITIES].reverse();

const TEAMS: Array<{ key: TeamKey; label: string }> = [
  { key: "api", label: "API" },
  { key: "legacy", label: "Legacy FE" },
  { key: "react", label: "React FE" },
];

function toAxisMaxWithHeadroom(value: number) {
  if (value <= 0) return 5;
  const withHeadroom = value + Math.max(1, value * 0.08);
  return Math.max(5, Math.ceil(withHeadroom / 5) * 5);
}

function parseAxisDate(date: string) {
  const source = date.startsWith("API ") ? date.slice(4) : date;
  const [year, month, day] = source.split("-");
  if (!year || !month || !day) return null;
  return {
    top: `${month}/${day}`,
    bottom: year,
  };
}

function totalForPoint(point: TrendPoint) {
  return point.highest + point.high + point.medium + point.low + point.lowest;
}

export function CombinedTeamTrendChart({
  points,
  visibleTeams,
}: {
  points: CombinedTrendPoint[];
  visibleTeams: Record<TeamKey, boolean>;
}) {
  const [hover, setHover] = useState<HoverState>(null);
  const [visiblePriorities, setVisiblePriorities] = useState<Record<PriorityKey, boolean>>({
    highest: true,
    high: true,
    medium: true,
    low: true,
    lowest: true,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const maxValue = useMemo(() => {
    const visibleTeamCount = TEAMS.filter((team) => visibleTeams[team.key]).length;
    const isTeamFiltered = visibleTeamCount < TEAMS.length;

    const activePriorityKeys = isTeamFiltered
      ? PRIORITIES.map((priority) => priority.key)
      : PRIORITIES.filter((priority) => visiblePriorities[priority.key]).map(
          (priority) => priority.key,
        );

    const totalVisible = (point: TrendPoint) =>
      activePriorityKeys.reduce((sum, key) => sum + (point[key] as number), 0);

    const rawMax = points.reduce((max, point) => {
      const apiTotal = visibleTeams.api ? totalVisible(point.api) : 0;
      const legacyTotal = visibleTeams.legacy ? totalVisible(point.legacy) : 0;
      const reactTotal = visibleTeams.react ? totalVisible(point.react) : 0;
      return Math.max(
        max,
        apiTotal,
        legacyTotal,
        reactTotal,
      );
    }, 0);
    return toAxisMaxWithHeadroom(rawMax);
  }, [points, visiblePriorities, visibleTeams]);

  const chartHeight = 370;
  const marginTop = 16;
  const marginRight = 12;
  const marginBottom = 104;
  const marginLeft = 36;
  const groupCount = Math.max(1, points.length);
  const groupWidth = 66;
  const plotWidth = groupCount * groupWidth;
  const chartWidth = marginLeft + plotWidth + marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;
  const axisY = marginTop + plotHeight;
  const teamLabelY = axisY + 8;
  const yTickStep = 5;
  const yTicks = Array.from({ length: Math.floor(maxValue / yTickStep) + 1 }, (_, i) => {
    const value = i * yTickStep;
    const y = marginTop + plotHeight - (plotHeight * value) / maxValue;
    return { value, y };
  });

  const onPriorityClick = (key: PriorityKey) => {
    const next = { ...visiblePriorities, [key]: !visiblePriorities[key] };
    const activeCount = PRIORITIES.filter((priority) => next[priority.key]).length;
    if (activeCount === 0) return;
    setVisiblePriorities(next);
  };

  const setHoverFromPointer = (
    clientX: number,
    clientY: number,
    date: string,
    team: string,
    total: number,
    highlightedLabel: string,
    highlightedCount: number,
  ) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setHover({
      x: clientX - bounds.left,
      y: clientY - bounds.top,
      date,
      team,
      total,
      highlightedLabel,
      highlightedCount,
    });
  };

  return (
    <section className={styles.panel} aria-label="Combined team trend">
      <div
        ref={containerRef}
        className={styles.interactiveChart}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          width={chartWidth}
          height={chartHeight}
          role="img"
          aria-label="Combined team bug trend with stacked bars"
          className={styles.interactiveSvg}
        >
          {yTicks.map((tick) => (
            <g key={`combined-y-${tick.value}`}>
              <text
                x={marginLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                className={styles.axisTickLabel}
              >
                {tick.value}
              </text>
            </g>
          ))}

          <line
            x1={marginLeft}
            y1={axisY}
            x2={chartWidth - marginRight}
            y2={axisY}
            className={styles.axisLine}
          />

          {points.map((point, pointIndex) => {
            const slotLeft = marginLeft + pointIndex * groupWidth;
            const innerWidth = 54;
            const innerLeft = slotLeft + Math.floor((groupWidth - innerWidth) / 2);
            const barGap = 6;
            const teamCount = TEAMS.length;
            const barWidth =
              teamCount > 0
                ? Math.max(3, Math.floor((innerWidth - (teamCount - 1) * barGap) / teamCount))
                : 0;

            return (
              <g key={`combined-${point.date}`}>
                {pointIndex > 0 ? (
                  <line
                    x1={slotLeft}
                    y1={marginTop}
                    x2={slotLeft}
                    y2={marginTop + plotHeight}
                    className={styles.slotDivider}
                  />
                ) : null}
                <rect
                  x={slotLeft}
                  y={marginTop}
                  width={groupWidth}
                  height={plotHeight}
                  className={styles.plotBand}
                  data-alt={pointIndex % 2 === 0 ? "false" : "true"}
                />

                {TEAMS.map((team, teamIndex) => {
                  const isVisible = visibleTeams[team.key];
                  const teamPoint = point[team.key];
                  const total = PRIORITIES.reduce((sum, priority) => {
                    if (!visiblePriorities[priority.key]) return sum;
                    return sum + (teamPoint[priority.key] as number);
                  }, 0);
                  const x = innerLeft + teamIndex * (barWidth + barGap);
                  let accumulated = 0;

                  return (
                    <g
                      key={`${point.date}-${team.key}`}
                      aria-hidden={isVisible ? undefined : true}
                    >
                      {STACK_PRIORITIES.map((priority) => {
                        const value = visiblePriorities[priority.key]
                          ? (teamPoint[priority.key] as number)
                          : 0;
                        const pxBottom = Math.round((accumulated / maxValue) * plotHeight);
                        const pxTop = Math.round(((accumulated + value) / maxValue) * plotHeight);
                        const snappedHeight = pxTop - pxBottom;
                        const y = marginTop + plotHeight - pxTop;
                        accumulated += value;
                        return (
                          <rect
                            key={`${point.date}-${team.key}-${priority.key}`}
                            x={x}
                            y={y}
                            width={barWidth}
                            height={isVisible && value > 0 ? Math.max(1, snappedHeight) : 0}
                            fill={priority.color}
                            className={styles.interactiveBar}
                            rx={0}
                            onMouseMove={
                              isVisible
                                ? (event) =>
                                    setHoverFromPointer(
                                      event.clientX,
                                      event.clientY,
                                      point.date,
                                      team.label,
                                      total,
                                      priority.label,
                                      value,
                                    )
                                : undefined
                            }
                            onMouseLeave={isVisible ? () => setHover(null) : undefined}
                            onFocus={
                              isVisible
                                ? () =>
                                    setHover({
                                      x: x + barWidth / 2,
                                      y,
                                      date: point.date,
                                      team: team.label,
                                      total,
                                      highlightedLabel: priority.label,
                                      highlightedCount: value,
                                    })
                                : undefined
                            }
                            onBlur={isVisible ? () => setHover(null) : undefined}
                            tabIndex={isVisible ? 0 : -1}
                            aria-label={
                              isVisible
                                ? `${point.date} ${team.label} ${priority.label} ${value}, total ${total}`
                                : undefined
                            }
                          />
                        );
                      })}
                    </g>
                  );
                })}

                <text
                  x={innerLeft + barWidth / 2}
                  y={teamLabelY}
                  textAnchor="end"
                  className={styles.axisLabelTeam}
                  transform={`rotate(-90 ${innerLeft + barWidth / 2} ${teamLabelY})`}
                >
                  API
                </text>
                <text
                  x={innerLeft + (barWidth + barGap) + barWidth / 2}
                  y={teamLabelY}
                  textAnchor="end"
                  className={styles.axisLabelTeam}
                  transform={`rotate(-90 ${
                    innerLeft + (barWidth + barGap) + barWidth / 2
                  } ${teamLabelY})`}
                >
                  Legacy FE
                </text>
                <text
                  x={innerLeft + 2 * (barWidth + barGap) + barWidth / 2}
                  y={teamLabelY}
                  textAnchor="end"
                  className={styles.axisLabelTeam}
                  transform={`rotate(-90 ${
                    innerLeft + 2 * (barWidth + barGap) + barWidth / 2
                  } ${teamLabelY})`}
                >
                  React FE
                </text>

                {(() => {
                  const axisDate = parseAxisDate(point.date);
                  if (!axisDate) return null;
                  return (
                    <text
                      x={slotLeft + groupWidth / 2}
                      y={chartHeight - 26}
                      textAnchor="middle"
                      className={styles.axisLabel}
                    >
                      <tspan x={slotLeft + groupWidth / 2} dy="0">
                        {axisDate.top}
                      </tspan>
                      <tspan x={slotLeft + groupWidth / 2} dy="12" className={styles.axisLabelYear}>
                        {axisDate.bottom}
                      </tspan>
                    </text>
                  );
                })()}
              </g>
            );
          })}
        </svg>

        {hover ? (
          <div
            className={styles.chartTooltip}
            style={{
              left: `min(calc(100% - 170px), ${Math.max(8, hover.x + 10)}px)`,
              top: `${Math.max(10, hover.y - 48)}px`,
            }}
          >
            <strong>{hover.team}</strong>
            <span>{hover.date}</span>
            <span>
              {hover.highlightedLabel}: {hover.highlightedCount}
            </span>
            <span>Total: {hover.total}</span>
          </div>
        ) : null}
      </div>

      <div className={styles.priorityLegend}>
        {PRIORITIES.map((priority) => (
          <button
            key={priority.key}
            type="button"
            className={styles.priorityLegendButton}
            data-active={visiblePriorities[priority.key] ? "true" : "false"}
            onClick={() => onPriorityClick(priority.key)}
            aria-pressed={visiblePriorities[priority.key]}
          >
            <i style={{ background: priority.color }} className={styles.legendDot} />
            {priority.label}
          </button>
        ))}
      </div>
    </section>
  );
}
