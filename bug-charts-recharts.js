/* global React, ReactDOM, Recharts */
"use strict";

(function initBugChartsRecharts() {
  if (!window.React || !window.ReactDOM || !window.Recharts) {
    window.BugChartsRecharts = null;
    return;
  }

  const h = React.createElement;
  const {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    ComposedChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    Cell
  } = Recharts;

  const TEAM_CONFIG = [
    { key: "api", label: "API" },
    { key: "legacy", label: "Legacy FE" },
    { key: "react", label: "React FE" },
    { key: "bc", label: "BC" }
  ];
  const PRIORITY_CONFIG = [
    { key: "highest", label: "Highest" },
    { key: "high", label: "High" },
    { key: "medium", label: "Medium" },
    { key: "low", label: "Low" },
    { key: "lowest", label: "Lowest" }
  ];
  const PRIORITY_STACK_ORDER = [...PRIORITY_CONFIG].reverse();
  const PRIORITY_LABELS = PRIORITY_CONFIG.reduce((acc, item) => {
    acc[item.key] = item.label;
    return acc;
  }, {});
  const BAR_LAYOUT = {
    categoryGap: "18%",
    groupGap: 2,
    denseMax: 12,
    normalMax: 22,
    wideMax: 28
  };

  const roots = {
    trend: null,
    composition: null,
    uat: null,
    management: null,
    sprintGoals: null,
    productCycle: null,
    lifecycleDays: null
  };
  const rootContainerIds = {};

  function toNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  function totalForPoint(point) {
    return (
      toNumber(point?.highest) +
      toNumber(point?.high) +
      toNumber(point?.medium) +
      toNumber(point?.low) +
      toNumber(point?.lowest)
    );
  }

  function formatDateShort(date) {
    const [year, month, day] = String(date || "").split("-");
    if (!year || !month || !day) return String(date || "");
    return `${month}/${day}`;
  }

  function ensureRoot(kind, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    rootContainerIds[kind] = containerId;
    if (!roots[kind]) {
      roots[kind] = ReactDOM.createRoot(container);
    }
    return roots[kind];
  }

  function clearChart({ containerId }) {
    if (!containerId) return;
    for (const [kind, id] of Object.entries(rootContainerIds)) {
      if (id === containerId && roots[kind]) {
        roots[kind].render(null);
        return;
      }
    }

    const container = document.getElementById(containerId);
    if (container) container.innerHTML = "";
  }

  function buildTrendData(snapshot) {
    const points = Array.isArray(snapshot?.combinedPoints) ? snapshot.combinedPoints : [];
    return points.map((point) => {
      const api = point?.api || {};
      const legacy = point?.legacy || {};
      const react = point?.react || {};
      const bc = point?.bc || {};
      return {
        date: point.date,
        dateShort: formatDateShort(point.date),
        api: totalForPoint(api),
        legacy: totalForPoint(legacy),
        react: totalForPoint(react),
        bc: totalForPoint(bc),
        bcLong30: toNumber(bc.longstanding_30d_plus),
        bcLong60: toNumber(bc.longstanding_60d_plus),
        breakdown: {
          api,
          legacy,
          react,
          bc
        }
      };
    });
  }

  function buildCompositionData(snapshot, scope) {
    const points = Array.isArray(snapshot?.combinedPoints) ? snapshot.combinedPoints : [];
    const selectedTeams =
      scope === "all" ? TEAM_CONFIG : TEAM_CONFIG.filter((team) => team.key === scope);
    const isSingleTeam = scope !== "all";

    const rows = [];
    for (const point of points) {
      selectedTeams.forEach((team, teamIndex) => {
        const teamPoint = point?.[team.key] || {};
        const shortDate = formatDateShort(point.date);
        rows.push({
          bucketLabel: isSingleTeam ? shortDate : `${shortDate} • ${team.label}`,
          tickLabel: isSingleTeam ? shortDate : teamIndex === 0 ? shortDate : "",
          date: point.date,
          team: team.label,
          highest: toNumber(teamPoint.highest),
          high: toNumber(teamPoint.high),
          medium: toNumber(teamPoint.medium),
          low: toNumber(teamPoint.low),
          lowest: toNumber(teamPoint.lowest),
          total: totalForPoint(teamPoint)
        });
      });
    }
    return rows;
  }

  function TrendTooltipContent(colors) {
    return function renderTrendTooltip({ active, payload }) {
      if (!active || !Array.isArray(payload) || payload.length === 0) return null;
      const row = payload[0]?.payload || {};

      const blocks = [
        h(
          "p",
          {
            key: "date",
            style: { margin: "0 0 6px", fontWeight: 600, color: colors.text }
          },
          row.date || ""
        )
      ];

      for (const item of payload) {
        blocks.push(
          h(
            "p",
            {
              key: item.dataKey,
              style: { margin: "2px 0", color: item.color || colors.text, fontSize: "12px" }
            },
            `${item.name}: ${toNumber(item.value)}`
          )
        );
      }

      return h(
        "div",
        {
          style: {
            border: `1px solid ${colors.tooltip.border}`,
            background: colors.tooltip.bg,
            color: colors.tooltip.text,
            borderRadius: "6px",
            padding: "8px 10px",
            boxShadow: "0 8px 18px rgba(0,0,0,0.12)"
          }
        },
        blocks
      );
    };
  }

  function CompositionTooltipContent(colors) {
    return function renderCompositionTooltip({ active, payload }) {
      if (!active || !Array.isArray(payload) || payload.length === 0) return null;
      const row = payload[0]?.payload || {};

      const blocks = [
        h(
          "p",
          {
            key: "title",
            style: { margin: "0 0 6px", fontWeight: 600, color: colors.text }
          },
          `${row.team || ""} · ${row.date || ""}`
        ),
        h(
          "p",
          {
            key: "total",
            style: { margin: "0 0 6px", fontSize: "12px", color: colors.text }
          },
          `Total: ${toNumber(row.total)}`
        )
      ];

      for (const item of payload) {
        blocks.push(
          h(
            "p",
            {
              key: item.dataKey,
              style: { margin: "2px 0", color: item.color || colors.text, fontSize: "12px" }
            },
            `${item.name}: ${toNumber(item.value)}`
          )
        );
      }

      return h(
        "div",
        {
          style: {
            border: `1px solid ${colors.tooltip.border}`,
            background: colors.tooltip.bg,
            color: colors.tooltip.text,
            borderRadius: "6px",
            padding: "8px 10px",
            boxShadow: "0 8px 18px rgba(0,0,0,0.12)"
          }
        },
        blocks
      );
    };
  }

  function UatAgingTooltipContent(colors, priorities) {
    return function renderUatAgingTooltip({ active, payload }) {
      if (!active || !Array.isArray(payload) || payload.length === 0) return null;
      const row = payload[0]?.payload || {};
      const blocks = [
        h(
          "p",
          {
            key: "title",
            style: { margin: "0 0 6px", fontWeight: 600, color: colors.text }
          },
          row.bucketLabel || ""
        ),
        h(
          "p",
          {
            key: "total",
            style: { margin: "0 0 6px", fontSize: "12px", color: colors.text }
          },
          `Total: ${toNumber(row.total)}`
        )
      ];

      for (const priority of priorities) {
        const value = toNumber(row[priority.key]);
        if (value <= 0) continue;
        blocks.push(
          h(
            "p",
            {
              key: priority.key,
              style: {
                margin: "2px 0",
                color: colors.priorities[priority.key] || colors.text,
                fontSize: "12px"
              }
            },
            `${PRIORITY_LABELS[priority.key] || priority.key}: ${value}`
          )
        );
      }

      return h(
        "div",
        {
          style: {
            border: `1px solid ${colors.tooltip.border}`,
            background: colors.tooltip.bg,
            color: colors.tooltip.text,
            borderRadius: "6px",
            padding: "8px 10px",
            boxShadow: "0 8px 18px rgba(0,0,0,0.12)"
          }
        },
        blocks
      );
    };
  }

  function toggleLegendKey(prevSet, key) {
    const next = new Set(prevSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  function legendFormatter(hiddenKeys) {
    return (value, entry) =>
      h(
        "span",
        {
          style: {
            opacity: hiddenKeys.has(entry?.dataKey) ? 0.45 : 1,
            textDecoration: hiddenKeys.has(entry?.dataKey) ? "line-through" : "none"
          }
        },
        value
      );
  }

  function getLegendKey(entry) {
    return entry?.dataKey || entry?.payload?.dataKey || null;
  }

  function buildLegendPayload(defs, type) {
    return defs.map((item) => ({
      value: item.name,
      type,
      color: item.stroke || item.fill,
      dataKey: item.dataKey
    }));
  }

  function groupedCategoryGap(rowsCount) {
    if (rowsCount <= 8) return "2%";
    if (rowsCount <= 14) return "8%";
    return BAR_LAYOUT.categoryGap;
  }

  function groupedBarGeometry(rowsCount, seriesCount = 2) {
    const safeSeriesCount = Math.max(1, Math.floor(toNumber(seriesCount) || 1));
    let categoryGap = BAR_LAYOUT.categoryGap;
    let targetGroupWidth = 68;
    if (rowsCount <= 8) {
      categoryGap = "2%";
      targetGroupWidth = 120;
    } else if (rowsCount <= 14) {
      categoryGap = "8%";
      targetGroupWidth = 92;
    }
    const rawBarSize = (targetGroupWidth - BAR_LAYOUT.groupGap * (safeSeriesCount - 1)) / safeSeriesCount;
    const barSize = Math.max(12, Math.round(rawBarSize));
    return {
      categoryGap,
      barSize,
      maxBarSize: Math.max(barSize, Math.round(barSize * 1.25))
    };
  }

  function activeBarStyle(colors) {
    return {
      fillOpacity: 1,
      stroke: colors.text,
      strokeOpacity: 0.42,
      strokeWidth: 1.2
    };
  }

  function barBaseStyle(colors) {
    return {
      stroke: colors.text,
      strokeOpacity: 0.24,
      strokeWidth: 0.85
    };
  }

  function activeLineDot(colors) {
    return {
      r: 6,
      stroke: colors.tooltip.bg,
      strokeWidth: 2.2
    };
  }

  function TrendChartView({ rows, colors, yUpper }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const lineDefs = [
      {
        dataKey: "api",
        name: "API",
        stroke: colors.teams.api,
        strokeWidth: 2.5,
        dot: { r: 3 }
      },
      {
        dataKey: "legacy",
        name: "Legacy FE",
        stroke: colors.teams.legacy,
        strokeWidth: 2.5,
        dot: { r: 3 }
      },
      {
        dataKey: "react",
        name: "React FE",
        stroke: colors.teams.react,
        strokeWidth: 2.5,
        dot: { r: 3 }
      },
      {
        dataKey: "bc",
        name: "BC",
        stroke: colors.teams.bc,
        strokeWidth: 2.5,
        dot: { r: 3 }
      },
      {
        dataKey: "bcLong30",
        name: "BC long-standing (30d+)",
        stroke: "#8e9aaa",
        strokeDasharray: "4 3",
        strokeWidth: 2,
        dot: { r: 3 }
      },
      {
        dataKey: "bcLong60",
        name: "BC long-standing (60d+)",
        stroke: "#6f7f92",
        strokeDasharray: "7 4",
        strokeWidth: 2,
        dot: { r: 3 }
      }
    ];

    return h(
      ResponsiveContainer,
      { width: "100%", height: 460 },
      h(
        LineChart,
        {
          data: rows,
          margin: { top: 18, right: 20, bottom: 42, left: 20 }
        },
        h(CartesianGrid, { stroke: colors.grid, vertical: false }),
        h(XAxis, {
          dataKey: "dateShort",
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          tickMargin: 8
        }),
        h(YAxis, {
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          domain: [0, yUpper]
        }),
        h(Tooltip, {
          content: TrendTooltipContent(colors),
          cursor: { stroke: colors.active, strokeWidth: 1.5, strokeDasharray: "3 3" }
        }),
        h(Legend, {
          verticalAlign: "top",
          height: 36,
          wrapperStyle: { color: colors.text, cursor: "pointer" },
          payload: buildLegendPayload(lineDefs, "line"),
          onClick: (entry) => {
            const key = getLegendKey(entry);
            if (!key) return;
            setHiddenKeys((prev) => toggleLegendKey(prev, key));
          },
          formatter: legendFormatter(hiddenKeys)
        }),
        lineDefs.map((line) =>
          h(Line, {
            key: line.dataKey,
            type: "monotone",
            dataKey: line.dataKey,
            name: line.name,
            stroke: line.stroke,
            strokeDasharray: line.strokeDasharray,
            strokeWidth: line.strokeWidth,
            dot: line.dot,
            activeDot: activeLineDot(colors),
            hide: hiddenKeys.has(line.dataKey)
          })
        )
      )
    );
  }

  function CompositionChartView({ rows, colors, scope }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const isAllTeams = scope === "all";
    const categoryGap = isAllTeams ? BAR_LAYOUT.categoryGap : groupedCategoryGap(rows.length);
    const priorityDefs = PRIORITY_STACK_ORDER.map((priority) => ({
      dataKey: priority.key,
      name: priority.label,
      fill: colors.priorities[priority.key]
    }));

    return h(
      ResponsiveContainer,
      { width: "100%", height: 560 },
      h(
        BarChart,
        {
          data: rows,
          margin: { top: 18, right: 20, bottom: 52, left: 20 },
          barCategoryGap: categoryGap,
          barGap: BAR_LAYOUT.groupGap,
          maxBarSize: isAllTeams ? BAR_LAYOUT.denseMax : BAR_LAYOUT.normalMax
        },
        h(CartesianGrid, { stroke: colors.grid, vertical: false }),
        h(XAxis, {
          dataKey: isAllTeams ? "tickLabel" : "bucketLabel",
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          angle: 0,
          textAnchor: "middle",
          interval: 0,
          height: 40,
          tickFormatter: (value, index) => {
            if (!isAllTeams) return value;
            if (!value) return "";
            const dateIndex = Math.floor(index / TEAM_CONFIG.length);
            return dateIndex % 2 === 0 ? value : "";
          }
        }),
        h(YAxis, {
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          allowDecimals: false
        }),
        h(Tooltip, {
          content: CompositionTooltipContent(colors),
          cursor: { fill: "rgba(31,51,71,0.12)" }
        }),
        h(Legend, {
          verticalAlign: "top",
          height: 36,
          wrapperStyle: { color: colors.text, cursor: "pointer" },
          payload: buildLegendPayload(priorityDefs, "rect"),
          onClick: (entry) => {
            const key = getLegendKey(entry);
            if (!key) return;
            setHiddenKeys((prev) => toggleLegendKey(prev, key));
          },
          formatter: legendFormatter(hiddenKeys)
        }),
        priorityDefs.map((priority) =>
          h(Bar, {
            key: priority.dataKey,
            dataKey: priority.dataKey,
            name: priority.name,
            stackId: "backlog",
            fill: priority.fill,
            ...barBaseStyle(colors),
            activeBar: activeBarStyle(colors),
            hide: hiddenKeys.has(priority.dataKey)
          })
        )
      )
    );
  }

  function UatAgingChartView({ chartRows, activePriorities, colors }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const priorityDefs = activePriorities.map((priority) => ({
      dataKey: priority.key,
      name: priority.label,
      fill: colors.priorities[priority.key]
    }));
    const geometry = groupedBarGeometry(chartRows.length, priorityDefs.length);

    return h(
      ResponsiveContainer,
      { width: "100%", height: 460 },
      h(
        BarChart,
        {
          data: chartRows,
          margin: { top: 18, right: 20, bottom: 52, left: 20 },
          barCategoryGap: geometry.categoryGap,
          barGap: BAR_LAYOUT.groupGap,
          maxBarSize: geometry.maxBarSize
        },
        h(CartesianGrid, { stroke: colors.grid, vertical: false }),
        h(XAxis, {
          dataKey: "bucketLabel",
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          interval: 0,
          height: 44
        }),
        h(YAxis, {
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          allowDecimals: false
        }),
        h(Tooltip, {
          content: UatAgingTooltipContent(colors, activePriorities),
          cursor: { fill: "rgba(31,51,71,0.12)" }
        }),
        h(Legend, {
          verticalAlign: "top",
          height: 36,
          wrapperStyle: { color: colors.text, cursor: "pointer" },
          payload: buildLegendPayload(priorityDefs, "rect"),
          onClick: (entry) => {
            const key = getLegendKey(entry);
            if (!key) return;
            setHiddenKeys((prev) => toggleLegendKey(prev, key));
          },
          formatter: legendFormatter(hiddenKeys)
        }),
        priorityDefs.map((priority) =>
          h(Bar, {
            key: priority.dataKey,
            dataKey: priority.dataKey,
            name: priority.name,
            fill: priority.fill,
            barSize: geometry.barSize,
            ...barBaseStyle(colors),
            activeBar: activeBarStyle(colors),
            hide: hiddenKeys.has(priority.dataKey)
          })
        )
      )
    );
  }

  function SprintGoalsTooltipContent(colors) {
    return function renderSprintGoalsTooltip({ active, payload }) {
      if (!active || !Array.isArray(payload) || payload.length === 0) return null;
      const row = payload[0]?.payload || {};
      const blocks = [
        h(
          "p",
          { key: "date", style: { margin: "0 0 6px", fontWeight: 600, color: colors.text } },
          row.date || ""
        )
      ];
      for (const item of payload) {
        const suffix = item?.dataKey === "successRate" ? "%" : "";
        const value = Number.isFinite(item?.value) ? item.value.toFixed(item?.dataKey === "successRate" ? 1 : 0) : "0";
        blocks.push(
          h(
            "p",
            {
              key: item.dataKey,
              style: { margin: "2px 0", color: item.color || colors.text, fontSize: "12px" }
            },
            `${item.name}: ${value}${suffix}`
          )
        );
      }
      return h(
        "div",
        {
          style: {
            border: `1px solid ${colors.tooltip.border}`,
            background: colors.tooltip.bg,
            color: colors.tooltip.text,
            borderRadius: "6px",
            padding: "8px 10px",
            boxShadow: "0 8px 18px rgba(0,0,0,0.12)"
          }
        },
        blocks
      );
    };
  }

  function SprintGoalsChartView({ rows, colors, yUpper }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const geometry = groupedBarGeometry(rows.length, 2);
    const defs = [
      { dataKey: "goalsTotal", name: "Goals Total", fill: colors.teams.api, type: "rect" },
      { dataKey: "goalsPassed", name: "Goals Passed", fill: colors.teams.react, type: "rect" },
      { dataKey: "successRate", name: "Success Rate", stroke: colors.teams.bc, type: "line" }
    ];
    return h(
      ResponsiveContainer,
      { width: "100%", height: 440 },
      h(
        ComposedChart,
        {
          data: rows,
          margin: { top: 18, right: 56, bottom: 52, left: 20 },
          barCategoryGap: geometry.categoryGap,
          barGap: BAR_LAYOUT.groupGap,
          maxBarSize: geometry.maxBarSize
        },
        h(CartesianGrid, { stroke: colors.grid, vertical: false }),
        h(XAxis, {
          dataKey: "dateShort",
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          interval: 0,
          height: 40
        }),
        h(YAxis, {
          yAxisId: "left",
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          allowDecimals: false,
          domain: [0, yUpper]
        }),
        h(YAxis, {
          yAxisId: "right",
          orientation: "right",
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          domain: [0, 100],
          tickFormatter: (value) => `${value}%`
        }),
        h(Tooltip, {
          content: SprintGoalsTooltipContent(colors),
          cursor: { fill: "rgba(31,51,71,0.12)" }
        }),
        h(Legend, {
          verticalAlign: "top",
          height: 36,
          wrapperStyle: { color: colors.text, cursor: "pointer" },
          payload: defs.map((item) => ({
            value: item.name,
            type: item.type,
            color: item.stroke || item.fill,
            dataKey: item.dataKey
          })),
          onClick: (entry) => {
            const key = getLegendKey(entry);
            if (!key) return;
            setHiddenKeys((prev) => toggleLegendKey(prev, key));
          },
          formatter: legendFormatter(hiddenKeys)
        }),
        h(Bar, {
          dataKey: "goalsTotal",
          name: "Goals Total",
          yAxisId: "left",
          fill: colors.teams.api,
          barSize: geometry.barSize,
          ...barBaseStyle(colors),
          activeBar: activeBarStyle(colors),
          hide: hiddenKeys.has("goalsTotal")
        }),
        h(Bar, {
          dataKey: "goalsPassed",
          name: "Goals Passed",
          yAxisId: "left",
          fill: colors.teams.react,
          barSize: geometry.barSize,
          ...barBaseStyle(colors),
          activeBar: activeBarStyle(colors),
          hide: hiddenKeys.has("goalsPassed")
        }),
        h(Line, {
          type: "monotone",
          dataKey: "successRate",
          name: "Success Rate",
          yAxisId: "right",
          stroke: colors.teams.bc,
          strokeWidth: 2.5,
          dot: { r: 3 },
          activeDot: activeLineDot(colors),
          hide: hiddenKeys.has("successRate")
        })
      )
    );
  }

  function ManagementTooltipContent(colors) {
    return function renderManagementTooltip({ active, payload }) {
      if (!active || !Array.isArray(payload) || payload.length === 0) return null;
      const row = payload[0]?.payload || {};
      const blocks = [
        h(
          "p",
          { key: "label", style: { margin: "0 0 6px", fontWeight: 600, color: colors.text } },
          row.label || ""
        )
      ];
      for (const item of payload) {
        const isDev = item?.dataKey === "devMedian";
        const count = isDev ? toNumber(row.devCount) : toNumber(row.uatCount);
        const avg = isDev ? toNumber(row.devAvg) : toNumber(row.uatAvg);
        blocks.push(
          h(
            "p",
            {
              key: item.dataKey,
              style: { margin: "2px 0", color: item.color || colors.text, fontSize: "12px" }
            },
            `${item.name}: ${toNumber(item.value).toFixed(2)} days (avg ${avg.toFixed(2)}, n ${count})`
          )
        );
      }
      return h(
        "div",
        {
          style: {
            border: `1px solid ${colors.tooltip.border}`,
            background: colors.tooltip.bg,
            color: colors.tooltip.text,
            borderRadius: "6px",
            padding: "8px 10px",
            boxShadow: "0 8px 18px rgba(0,0,0,0.12)"
          }
        },
        blocks
      );
    };
  }

  function ManagementChartView({ rows, colors, yUpper, devColor, uatColor }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const defs = [
      { dataKey: "devMedian", name: "Median Dev", fill: devColor },
      { dataKey: "uatMedian", name: "Median UAT", fill: uatColor }
    ];
    const geometry = groupedBarGeometry(rows.length, defs.length);
    return h(
      ResponsiveContainer,
      { width: "100%", height: 420 },
      h(
        BarChart,
        {
          data: rows,
          margin: { top: 18, right: 20, bottom: 52, left: 20 },
          barCategoryGap: geometry.categoryGap,
          barGap: BAR_LAYOUT.groupGap,
          maxBarSize: geometry.maxBarSize
        },
        h(CartesianGrid, { stroke: colors.grid, vertical: false }),
        h(XAxis, {
          dataKey: "label",
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          interval: 0,
          height: 40
        }),
        h(YAxis, {
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          allowDecimals: false,
          domain: [0, yUpper]
        }),
        h(Tooltip, { content: ManagementTooltipContent(colors), cursor: { fill: "rgba(31,51,71,0.12)" } }),
        h(Legend, {
          verticalAlign: "top",
          height: 36,
          wrapperStyle: { color: colors.text, cursor: "pointer" },
          payload: buildLegendPayload(defs, "rect"),
          onClick: (entry) => {
            const key = getLegendKey(entry);
            if (!key) return;
            setHiddenKeys((prev) => toggleLegendKey(prev, key));
          },
          formatter: legendFormatter(hiddenKeys)
        }),
        defs.map((def) =>
          h(Bar, {
            key: def.dataKey,
            dataKey: def.dataKey,
            name: def.name,
            fill: def.fill,
            barSize: geometry.barSize,
            ...barBaseStyle(colors),
            activeBar: activeBarStyle(colors),
            hide: hiddenKeys.has(def.dataKey)
          })
        )
      )
    );
  }

  function ProductCycleTooltipContent(colors, metricLabel) {
    return function renderProductCycleTooltip({ active, payload }) {
      if (!active || !Array.isArray(payload) || payload.length === 0) return null;
      const row = payload[0]?.payload || {};
      const blocks = [
        h(
          "p",
          { key: "team", style: { margin: "0 0 6px", fontWeight: 600, color: colors.text } },
          row.team || ""
        )
      ];
      for (const item of payload) {
        const key = item?.dataKey;
        const meta = row?.[`meta_${key}`] || {};
        blocks.push(
          h(
            "p",
            {
              key,
              style: { margin: "2px 0", color: item.color || colors.text, fontSize: "12px" }
            },
            `${item.name}: ${toNumber(item.value).toFixed(2)} days (${metricLabel}), n ${toNumber(
              meta.n
            )}, median ${toNumber(meta.median).toFixed(2)}, avg ${toNumber(meta.average).toFixed(2)}`
          )
        );
      }
      return h(
        "div",
        {
          style: {
            border: `1px solid ${colors.tooltip.border}`,
            background: colors.tooltip.bg,
            color: colors.tooltip.text,
            borderRadius: "6px",
            padding: "8px 10px",
            boxShadow: "0 8px 18px rgba(0,0,0,0.12)"
          }
        },
        blocks
      );
    };
  }

  function ProductCycleChartView({ rows, seriesDefs, colors, yUpper, metricLabel }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const geometry = groupedBarGeometry(rows.length, seriesDefs.length);
    return h(
      ResponsiveContainer,
      { width: "100%", height: 520 },
      h(
        BarChart,
        {
          data: rows,
          margin: { top: 30, right: 20, bottom: 52, left: 20 },
          barCategoryGap: geometry.categoryGap,
          barGap: BAR_LAYOUT.groupGap,
          maxBarSize: geometry.maxBarSize
        },
        h(CartesianGrid, { stroke: colors.grid, vertical: false }),
        h(XAxis, {
          dataKey: "team",
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          interval: 0,
          height: 40
        }),
        h(YAxis, {
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          allowDecimals: false,
          domain: [0, yUpper]
        }),
        h(Tooltip, {
          content: ProductCycleTooltipContent(colors, metricLabel),
          cursor: { fill: "rgba(31,51,71,0.12)" }
        }),
        h(Legend, {
          verticalAlign: "top",
          height: 36,
          wrapperStyle: { color: colors.text, cursor: "pointer" },
          payload: buildLegendPayload(
            seriesDefs.map((series) => ({
              dataKey: series.key,
              name: series.name,
              fill: series.color
            })),
            "rect"
          ),
          onClick: (entry) => {
            const key = getLegendKey(entry);
            if (!key) return;
            setHiddenKeys((prev) => toggleLegendKey(prev, key));
          },
          formatter: legendFormatter(hiddenKeys)
        }),
        seriesDefs.map((series) =>
          h(
            Bar,
            {
              key: series.key,
              dataKey: series.key,
              name: series.name,
              hide: hiddenKeys.has(series.key),
              fill: series.color,
              barSize: geometry.barSize,
              ...barBaseStyle(colors),
              activeBar: activeBarStyle(colors)
            },
            rows.map((row, index) =>
              h(Cell, {
                key: `${series.key}-${index}`,
                fill: row[`color_${series.key}`] || series.color
              })
            )
          )
        )
      )
    );
  }

  function LifecycleTooltipContent(colors, metricLabel) {
    return function renderLifecycleTooltip({ active, payload }) {
      if (!active || !Array.isArray(payload) || payload.length === 0) return null;
      const row = payload[0]?.payload || {};
      const blocks = [
        h(
          "p",
          { key: "team", style: { margin: "0 0 6px", fontWeight: 600, color: colors.text } },
          row.team || ""
        )
      ];
      for (const item of payload) {
        const key = item?.dataKey;
        const meta = row?.[`meta_${key}`] || {};
        blocks.push(
          h(
            "p",
            {
              key,
              style: { margin: "2px 0", color: item.color || colors.text, fontSize: "12px" }
            },
            `${item.name}: ${toNumber(item.value).toFixed(2)} days (${metricLabel}), n ${toNumber(
              meta.n
            )}, median ${toNumber(meta.median).toFixed(2)}, avg ${toNumber(meta.average).toFixed(2)}`
          )
        );
      }
      return h(
        "div",
        {
          style: {
            border: `1px solid ${colors.tooltip.border}`,
            background: colors.tooltip.bg,
            color: colors.tooltip.text,
            borderRadius: "6px",
            padding: "8px 10px",
            boxShadow: "0 8px 18px rgba(0,0,0,0.12)"
          }
        },
        blocks
      );
    };
  }

  function LifecycleDaysChartView({ rows, phaseDefs, colors, yUpper, metricLabel }) {
    const [hiddenKeys, setHiddenKeys] = React.useState(() => new Set());
    const geometry = groupedBarGeometry(rows.length, phaseDefs.length);
    return h(
      ResponsiveContainer,
      { width: "100%", height: 520 },
      h(
        BarChart,
        {
          data: rows,
          margin: { top: 30, right: 20, bottom: 52, left: 20 },
          barCategoryGap: geometry.categoryGap,
          barGap: BAR_LAYOUT.groupGap,
          maxBarSize: geometry.maxBarSize
        },
        h(CartesianGrid, { stroke: colors.grid, vertical: false }),
        h(XAxis, {
          dataKey: "team",
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          interval: 0,
          height: 40
        }),
        h(YAxis, {
          stroke: colors.text,
          tick: { fill: colors.text, fontSize: 11 },
          allowDecimals: false,
          domain: [0, yUpper]
        }),
        h(Tooltip, {
          content: LifecycleTooltipContent(colors, metricLabel),
          cursor: { fill: "rgba(31,51,71,0.12)" }
        }),
        h(Legend, {
          verticalAlign: "top",
          height: 36,
          wrapperStyle: { color: colors.text, cursor: "pointer" },
          payload: buildLegendPayload(
            phaseDefs.map((phase) => ({ dataKey: phase.key, name: phase.label, fill: phase.color })),
            "rect"
          ),
          onClick: (entry) => {
            const key = getLegendKey(entry);
            if (!key) return;
            setHiddenKeys((prev) => toggleLegendKey(prev, key));
          },
          formatter: legendFormatter(hiddenKeys)
        }),
        phaseDefs.map((phase) =>
          h(Bar, {
            key: phase.key,
            dataKey: phase.key,
            name: phase.label,
            fill: phase.color,
            barSize: geometry.barSize,
            ...barBaseStyle(colors),
            activeBar: activeBarStyle(colors),
            hide: hiddenKeys.has(phase.key)
          })
        )
      )
    );
  }

  function renderTrendChart({ containerId, snapshot, colors }) {
    const root = ensureRoot("trend", containerId);
    if (!root) return;

    const rows = buildTrendData(snapshot);
    if (rows.length === 0) {
      root.render(null);
      return;
    }

    const yMax = Math.max(
      10,
      ...rows.map((row) => row.api),
      ...rows.map((row) => row.legacy),
      ...rows.map((row) => row.react),
      ...rows.map((row) => row.bc),
      ...rows.map((row) => row.bcLong30),
      ...rows.map((row) => row.bcLong60)
    );
    const yUpper = Math.ceil(yMax * 1.08);

    root.render(h(TrendChartView, { rows, colors, yUpper }));
  }

  function renderCompositionChart({ containerId, snapshot, colors, scope = "bc" }) {
    const root = ensureRoot("composition", containerId);
    if (!root) return;

    const rows = buildCompositionData(snapshot, scope);
    if (rows.length === 0) {
      root.render(null);
      return;
    }

    root.render(h(CompositionChartView, { rows, colors, scope }));
  }

  function renderUatAgingChart({ containerId, rows, priorities, colors }) {
    const root = ensureRoot("uat", containerId);
    if (!root) return;

    const chartRows = Array.isArray(rows) ? rows : [];
    const activePriorities = PRIORITY_STACK_ORDER.filter((item) =>
      Array.isArray(priorities) ? priorities.includes(item.key) : false
    );
    if (chartRows.length === 0 || activePriorities.length === 0) {
      root.render(null);
      return;
    }

    root.render(h(UatAgingChartView, { chartRows, activePriorities, colors }));
  }

  function renderSprintGoalsChart({ containerId, rows, colors }) {
    const root = ensureRoot("sprintGoals", containerId);
    if (!root) return;
    const chartRows = Array.isArray(rows) ? rows : [];
    if (chartRows.length === 0) {
      root.render(null);
      return;
    }
    const yMax = Math.max(
      1,
      ...chartRows.map((row) => toNumber(row.goalsTotal)),
      ...chartRows.map((row) => toNumber(row.goalsPassed))
    );
    const yUpper = Math.max(1, Math.ceil(yMax * 1.2));
    root.render(h(SprintGoalsChartView, { rows: chartRows, colors, yUpper }));
  }

  function renderManagementChart({ containerId, rows, colors, devColor, uatColor }) {
    const root = ensureRoot("management", containerId);
    if (!root) return;
    const chartRows = Array.isArray(rows) ? rows : [];
    if (chartRows.length === 0) {
      root.render(null);
      return;
    }
    const yMax = Math.max(
      1,
      ...chartRows.map((row) => toNumber(row.devMedian)),
      ...chartRows.map((row) => toNumber(row.uatMedian))
    );
    const yUpper = Math.max(1, Math.ceil(yMax * 1.12));
    root.render(h(ManagementChartView, { rows: chartRows, colors, yUpper, devColor, uatColor }));
  }

  function renderProductCycleChart({ containerId, rows, seriesDefs, colors, metricLabel = "Median" }) {
    const root = ensureRoot("productCycle", containerId);
    if (!root) return;
    const chartRows = Array.isArray(rows) ? rows : [];
    const defs = Array.isArray(seriesDefs) ? seriesDefs : [];
    if (chartRows.length === 0 || defs.length === 0) {
      root.render(null);
      return;
    }
    const yValues = defs.flatMap((series) =>
      chartRows.map((row) => toNumber(row?.[series.key]))
    );
    const yMax = yValues.length > 0 ? Math.max(...yValues) : 1;
    const yUpper = Math.max(1, Math.ceil(yMax * 1.15));
    root.render(h(ProductCycleChartView, { rows: chartRows, seriesDefs: defs, colors, yUpper, metricLabel }));
  }

  function renderLifecycleDaysChart({ containerId, rows, phaseDefs, colors, metricLabel = "Median" }) {
    const root = ensureRoot("lifecycleDays", containerId);
    if (!root) return;
    const chartRows = Array.isArray(rows) ? rows : [];
    const defs = Array.isArray(phaseDefs) ? phaseDefs : [];
    if (chartRows.length === 0 || defs.length === 0) {
      root.render(null);
      return;
    }
    const yValues = defs.flatMap((phase) => chartRows.map((row) => toNumber(row?.[phase.key])));
    const yMax = yValues.length > 0 ? Math.max(...yValues) : 1;
    const yUpper = Math.max(1, Math.ceil(yMax * 1.15));
    root.render(h(LifecycleDaysChartView, { rows: chartRows, phaseDefs: defs, colors, yUpper, metricLabel }));
  }

  window.BugChartsRecharts = {
    renderTrendChart,
    renderCompositionChart,
    renderUatAgingChart,
    renderSprintGoalsChart,
    renderManagementChart,
    renderProductCycleChart,
    renderLifecycleDaysChart,
    clearChart
  };
})();
