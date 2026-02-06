"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { TrendPoint } from "./data";
import styles from "./page.module.css";

export type SeriesKey = "highest" | "high" | "medium" | "low" | "lowest";

type HoverState = {
  x: number;
  y: number;
  date: string;
  label: string;
  value: number;
} | null;

const SERIES: Array<{ key: SeriesKey; label: string; color: string }> = [
  { key: "highest", label: "Highest", color: "#e10613" },
  { key: "high", label: "High", color: "#f58a1f" },
  { key: "medium", label: "Medium", color: "#6f7782" },
  { key: "low", label: "Low", color: "#00a3e0" },
  { key: "lowest", label: "Lowest", color: "#005b96" },
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

export function ApiTrendChart({
  title,
  points,
  visibleSeries,
  onVisibleSeriesChange,
}: {
  title: string;
  points: TrendPoint[];
  visibleSeries: Record<SeriesKey, boolean>;
  onVisibleSeriesChange: (next: Record<SeriesKey, boolean>) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const maxValue = useMemo(() => {
    const rawMax = points.reduce((max, point) => {
      const pointMax = SERIES.reduce((seriesMax, series) => {
        const visible = visibleSeries[series.key];
        return Math.max(seriesMax, visible ? point[series.key] : 0);
      }, 0);
      return Math.max(max, pointMax);
    }, 0);
    return toAxisMaxWithHeadroom(rawMax);
  }, [points, visibleSeries]);

  const chartWidth = 980;
  const chartHeight = 320;
  const marginTop = 16;
  const marginRight = 12;
  const marginBottom = 74;
  const marginLeft = 36;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;
  const groupCount = Math.max(1, points.length);
  const groupWidth = plotWidth / groupCount;
  const yTickStep = 5;
  const yTicks = Array.from({ length: Math.floor(maxValue / yTickStep) + 1 }, (_, i) => {
    const value = i * yTickStep;
    const y = marginTop + plotHeight - (plotHeight * value) / maxValue;
    return { value, y };
  });

  const onLegendClick = (key: SeriesKey) => {
    const next = { ...visibleSeries, [key]: !visibleSeries[key] };
    const visibleCount = Object.values(next).filter(Boolean).length;
    if (visibleCount === 0) return;
    onVisibleSeriesChange(next);
  };

  const setHoverFromPointer = (
    clientX: number,
    clientY: number,
    date: string,
    label: string,
    value: number,
  ) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setHover({
      x: clientX - bounds.left,
      y: clientY - bounds.top,
      date,
      label,
      value,
    });
  };

  return (
    <section className={styles.panel} aria-label={`${title} trend`}>
      <div className={styles.trendHeader}>
        <h3>{title}</h3>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => {
            setIsRefreshing(true);
            window.location.reload();
          }}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div
        ref={containerRef}
        className={styles.interactiveChart}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label="Interactive bug trend grouped bar chart"
          className={styles.interactiveSvg}
        >
          {yTicks.map((tick) => (
            <g key={`y-${tick.value}`}>
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
            y1={marginTop + plotHeight}
            x2={chartWidth - marginRight}
            y2={marginTop + plotHeight}
            className={styles.axisLine}
          />

          {points.map((point, pointIndex) => {
            const slotLeft = marginLeft + pointIndex * groupWidth;
            const innerWidth = groupWidth * 0.82;
            const innerLeft = slotLeft + (groupWidth - innerWidth) / 2;
            const barGap = 2;
            const seriesCount = SERIES.length;
            const barWidth =
              seriesCount > 0
                ? Math.max(2, (innerWidth - (seriesCount - 1) * barGap) / seriesCount)
                : 0;

            return (
              <g key={point.date}>
                <rect
                  x={slotLeft}
                  y={marginTop}
                  width={groupWidth}
                  height={plotHeight}
                  className={styles.plotBand}
                  data-alt={pointIndex % 2 === 0 ? "false" : "true"}
                />

                <line
                  x1={slotLeft}
                  y1={marginTop}
                  x2={slotLeft}
                  y2={marginTop + plotHeight}
                  className={styles.slotDivider}
                />

                {SERIES.map((series, seriesIndex) => {
                  const isVisible = visibleSeries[series.key];
                  const value = point[series.key];
                  const pxHeight = value > 0 ? Math.round((value / maxValue) * plotHeight) : 0;
                  const x = innerLeft + seriesIndex * (barWidth + barGap);
                  const y = marginTop + plotHeight - pxHeight;
                  return (
                    <rect
                      key={`${point.date}-${series.key}`}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={isVisible && value > 0 ? Math.max(1, pxHeight) : 0}
                      fill={series.color}
                      rx={0}
                      className={styles.interactiveBar}
                      onMouseMove={
                        isVisible
                          ? (event) =>
                              setHoverFromPointer(
                                event.clientX,
                                event.clientY,
                                point.date,
                                series.label,
                                value,
                              )
                          : undefined
                      }
                      onFocus={
                        isVisible
                          ? () =>
                              setHover({
                                x: x + barWidth / 2,
                                y,
                                date: point.date,
                                label: series.label,
                                value,
                              })
                          : undefined
                      }
                      onBlur={isVisible ? () => setHover(null) : undefined}
                      tabIndex={isVisible ? 0 : -1}
                      aria-hidden={isVisible ? undefined : true}
                      aria-label={isVisible ? `${point.date} ${series.label} ${value}` : undefined}
                    />
                  );
                })}

                {(() => {
                  const axisDate = parseAxisDate(point.date);
                  if (!axisDate) {
                    return (
                      <text
                        x={slotLeft + groupWidth / 2}
                        y={chartHeight - 24}
                        textAnchor="middle"
                        className={styles.axisLabel}
                      >
                        {point.date}
                      </text>
                    );
                  }

                  return (
                    <text
                      x={slotLeft + groupWidth / 2}
                      y={chartHeight - 30}
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

          <line
            x1={chartWidth - marginRight}
            y1={marginTop}
            x2={chartWidth - marginRight}
            y2={marginTop + plotHeight}
            className={styles.slotDivider}
          />
        </svg>

        {hover ? (
          <div
            className={styles.chartTooltip}
            style={{
              left: `min(calc(100% - 160px), ${Math.max(8, hover.x + 10)}px)`,
              top: `${Math.max(10, hover.y - 48)}px`,
            }}
          >
            <strong>{hover.label}</strong>
            <span>{hover.date}</span>
            <span>{hover.value}</span>
          </div>
        ) : null}
      </div>

      <div className={styles.interactiveLegend}>
        {SERIES.map((series) => {
          const active = visibleSeries[series.key];
          return (
            <button
              key={series.key}
              type="button"
              className={styles.legendButton}
              data-active={active ? "true" : "false"}
              onClick={() => onLegendClick(series.key)}
              style={{ "--series-color": series.color } as CSSProperties}
            >
              <i style={{ background: series.color }} className={styles.legendDot} />
              {series.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
