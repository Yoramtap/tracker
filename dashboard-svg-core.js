"use strict";

(function initDashboardSvgCore() {
  const chartCore = window.DashboardChartCore;
  if (!window.React || !chartCore) {
    return;
  }

  const { h, renderWithRoot, isCompactViewport, toNumber, toWhole, formatTooltipDuration } =
    chartCore;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function linearScale(value, domainMin, domainMax, rangeMin, rangeMax) {
    const safeValue = toNumber(value);
    if (!Number.isFinite(safeValue)) return rangeMin;
    if (!Number.isFinite(domainMax) || domainMax === domainMin) return rangeMin;
    const ratio = (safeValue - domainMin) / (domainMax - domainMin);
    return rangeMin + ratio * (rangeMax - rangeMin);
  }

  function createBandLayout(labels, { start, end, gap = 0.2, paddingOuter = 0.08 } = {}) {
    const safeLabels = Array.isArray(labels) ? labels : [];
    const total = Math.max(0, toNumber(end) - toNumber(start));
    if (safeLabels.length === 0 || total <= 0) {
      return { bandwidth: 0, gapWidth: 0, positions: [] };
    }
    const outerUnits = paddingOuter * 2;
    const step = total / (safeLabels.length + outerUnits);
    const bandwidth = step * (1 - gap);
    const gapWidth = step - bandwidth;
    const base = toNumber(start) + step * paddingOuter;
    return {
      bandwidth,
      gapWidth,
      positions: safeLabels.map((label, index) => ({
        label,
        x: base + index * step + gapWidth / 2,
        center: base + index * step + step / 2
      }))
    };
  }

  function withAlpha(color, alpha) {
    const safeColor = String(color || "").trim();
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(safeColor);
    if (!match) return safeColor;
    const hex = match[1];
    const fullHex =
      hex.length === 3
        ? hex
            .split("")
            .map((char) => `${char}${char}`)
            .join("")
        : hex;
    const red = Number.parseInt(fullHex.slice(0, 2), 16);
    const green = Number.parseInt(fullHex.slice(2, 4), 16);
    const blue = Number.parseInt(fullHex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function teamColorForLabel(colors, label) {
    const safeLabel = String(label || "")
      .trim()
      .toLowerCase();
    if (!colors?.teams) return "#6f9fc6";
    if (safeLabel === "api") return colors.teams.api;
    if (safeLabel === "legacy fe" || safeLabel === "frontend") return colors.teams.legacy;
    if (safeLabel === "react fe" || safeLabel === "newfrontend") return colors.teams.react;
    if (safeLabel === "bc" || safeLabel === "broadcast") return colors.teams.bc;
    if (safeLabel === "workers" || safeLabel === "orchestration") return colors.teams.workers;
    if (safeLabel === "titanium" || safeLabel === "media") return colors.teams.titanium;
    return colors.teams.api;
  }

  function formatMonthTick(value, compact = false) {
    const months = toWhole(value);
    if (months <= 0) return "0";
    if (compact) return `${months}m`;
    return months === 1 ? "1 month" : `${months} months`;
  }

  function estimateTextWidth(text, fontSize = 11) {
    const safeText = String(text || "");
    return safeText.length * fontSize * 0.58;
  }

  function truncateTextToWidth(text, maxWidth, fontSize = 11) {
    const safeText = String(text || "");
    const safeMaxWidth = Math.max(0, toNumber(maxWidth));
    if (!safeText || safeMaxWidth <= 0) return "";
    if (estimateTextWidth(safeText, fontSize) <= safeMaxWidth) return safeText;
    if (estimateTextWidth("…", fontSize) > safeMaxWidth) return "";
    let output = safeText;
    while (output.length > 1 && estimateTextWidth(`${output}…`, fontSize) > safeMaxWidth) {
      output = output.slice(0, -1);
    }
    return `${output}…`;
  }

  function SvgLegend({ items }) {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    if (safeItems.length === 0) return null;
    return h(
      "div",
      { className: "svg-chart-legend", role: "presentation" },
      ...safeItems.map((item, index) =>
        h(
          "div",
          { key: item.key || `legend-item-${index}`, className: "svg-chart-legend__item" },
          h("span", {
            className: "svg-chart-legend__swatch",
            style: {
              background:
                item.swatchBackground || item.color || "rgba(31, 51, 71, 0.2)",
              borderColor: item.borderColor || withAlpha(item.color, 0.36)
            }
          }),
          h("span", { className: "svg-chart-legend__label" }, String(item.label || ""))
        )
      )
    );
  }

  function SvgTooltipCard({ colors, content }) {
    if (!content) return null;
    return h(
      "div",
      {
        className: "svg-chart-tooltip",
        style: {
          borderColor: colors?.tooltip?.border || "rgba(31, 51, 71, 0.22)",
          background: colors?.tooltip?.bg || "rgba(255,255,255,0.98)",
          color: colors?.tooltip?.text || "#1f3347"
        }
      },
      content
    );
  }

  function SvgChartShell({ width, height, legendItems = [], colors, tooltipContent = null, children }) {
    return h(
      "div",
      {
        className: "svg-chart-shell",
        style: { minHeight: `${height}px` }
      },
      h(SvgLegend, { items: legendItems }),
      h(
        "svg",
        {
          className: "svg-chart-shell__svg",
          viewBox: `0 0 ${width} ${height}`,
          width: "100%",
          height: height,
          preserveAspectRatio: "xMidYMid meet"
        },
        children
      ),
      h(SvgTooltipCard, { colors, content: tooltipContent })
    );
  }

  function renderSvgChart(containerId, canRender, elementFactory) {
    renderWithRoot(containerId, canRender, (root) => {
      root.render(elementFactory());
    });
  }

  window.DashboardSvgCore = {
    h,
    clamp,
    createBandLayout,
    formatMonthTick,
    formatTooltipDuration,
    isCompactViewport,
    linearScale,
    renderSvgChart,
    teamColorForLabel,
    truncateTextToWidth,
    toNumber,
    toWhole,
    estimateTextWidth,
    withAlpha,
    SvgChartShell
  };
})();
