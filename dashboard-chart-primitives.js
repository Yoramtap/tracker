/* global React */
"use strict";

(function initDashboardChartPrimitives() {
  if (!window.React) {
    window.DashboardChartPrimitives = null;
    return;
  }

  const h = React.createElement;
  const SHARED_CATEGORY_BLUE_TINTS = ["#CFE0F8", "#9EBAE3", "#6D95D1", "#3F73B8", "#295996"];

  function makeTooltipLine(
    key,
    text,
    colors,
    {
      margin = "2px 0",
      fontSize = "12px",
      fontWeight,
      color,
      lineHeight = "1.4",
      subItems = null,
      isTitle = false
    } = {}
  ) {
    return {
      key,
      text: String(text ?? ""),
      style: {
        margin,
        color: color || colors.text,
        fontSize: fontSize || undefined,
        fontWeight: fontWeight || undefined,
        lineHeight: lineHeight || undefined
      },
      subItems: Array.isArray(subItems) ? subItems : null,
      isTitle: Boolean(isTitle)
    };
  }

  function tooltipTitleLine(key, text, colors) {
    return makeTooltipLine(key, text, colors, {
      margin: "0 0 6px",
      fontWeight: 700,
      fontSize: null,
      isTitle: true
    });
  }

  function createTooltipContent(colors, buildLines) {
    return function renderTooltip({ active, payload }) {
      if (!active || !Array.isArray(payload) || payload.length === 0) return null;
      const row = payload[0]?.payload || {};
      return renderTooltipCard(colors, buildLines(row, payload));
    };
  }

  function isCoarsePointerDevice() {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches
    );
  }

  function dismissTooltipFromTap(node) {
    if (!node || typeof node.closest !== "function" || typeof window === "undefined") return;
    const wrapper = node.closest(".recharts-wrapper");
    if (!wrapper) return;
    try {
      wrapper.dispatchEvent(
        new MouseEvent("mouseleave", {
          bubbles: true,
          cancelable: true,
          view: window
        })
      );
    } catch {
      // no-op
    }
    try {
      wrapper.dispatchEvent(
        new Event("touchend", {
          bubbles: true,
          cancelable: true
        })
      );
    } catch {
      // no-op
    }
  }

  function toggleLegendKey(prevSet, key) {
    const next = new Set(prevSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  function renderTooltipCard(colors, blocks) {
    const suppressHoverPropagation = (event) => {
      if (!event) return;
      event.stopPropagation();
    };
    const suppressHoverPropagationCapture = (event) => {
      if (!event) return;
      event.stopPropagation();
      if (typeof event.preventDefault === "function") event.preventDefault();
    };
    const normalizeLine = (entry, index) => {
      if (!entry) return null;
      if (typeof entry === "string") {
        return { key: `line-${index}`, text: entry, subItems: null, isTitle: false, style: {} };
      }
      if (typeof entry === "object" && "text" in entry) return entry;
      return null;
    };
    const asSubItems = (line) => {
      if (!line || line.isTitle) return [];
      if (Array.isArray(line.subItems) && line.subItems.length > 0) {
        return line.subItems
          .map((item) => (typeof item === "string" ? item.trim() : item))
          .filter((item) => {
            if (item === null || item === undefined) return false;
            if (typeof item === "string") return item.length > 0;
            return true;
          });
      }
      const text = String(line.text || "").trim();
      const colonIndex = text.indexOf(":");
      if (colonIndex > 0) {
        const label = text.slice(0, colonIndex).trim();
        const detail = text.slice(colonIndex + 1).trim();
        const parts = detail.split(",").map((part) => part.trim()).filter(Boolean);
        if (parts.length > 1) {
          line.text = label;
          return parts;
        }
      }
      return [];
    };
    const normalizeMainText = (line) => {
      if (!line || line.isTitle) return String(line?.text || "");
      const text = String(line.text || "").trim();
      const colonIndex = text.indexOf(":");
      if (colonIndex > 0) {
        const label = text.slice(0, colonIndex).trim();
        const detail = text.slice(colonIndex + 1).trim();
        const parts = detail.split(",").map((part) => part.trim()).filter(Boolean);
        if (parts.length > 1) return label;
      }
      return text;
    };
    const lines = (Array.isArray(blocks) ? blocks : []).map(normalizeLine).filter(Boolean);

    return h(
      "div",
      {
        style: {
          border: `1px solid ${colors.tooltip.border}`,
          background: colors.tooltip.bg,
          color: colors.tooltip.text,
          borderRadius: "6px",
          padding: "8px 10px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.1)"
        },
        onMouseEnter: suppressHoverPropagation,
        onMouseMove: suppressHoverPropagation,
        onMouseOver: suppressHoverPropagation,
        onMouseEnterCapture: suppressHoverPropagationCapture,
        onMouseMoveCapture: suppressHoverPropagationCapture,
        onMouseOverCapture: suppressHoverPropagationCapture,
        onPointerEnter: suppressHoverPropagation,
        onPointerMove: suppressHoverPropagation,
        onPointerEnterCapture: suppressHoverPropagationCapture,
        onPointerMoveCapture: suppressHoverPropagationCapture,
        onClick: (event) => {
          if (!isCoarsePointerDevice()) return;
          event.preventDefault();
          event.stopPropagation();
          dismissTooltipFromTap(event.currentTarget);
        }
      },
      ...lines.map((line, index) => {
        if (line.isTitle) {
          return h(
            "p",
            {
              key: line.key || `tooltip-title-${index}`,
              style: {
                margin: "0 0 6px",
                color: line?.style?.color || colors.text,
                fontSize: line?.style?.fontSize || "12px",
                fontWeight: line?.style?.fontWeight || 700,
                lineHeight: line?.style?.lineHeight || "1.4"
              }
            },
            String(line.text || "")
          );
        }

        const subItems = asSubItems(line);
        return h(
          "ul",
          {
            key: line.key || `tooltip-ul-${index}`,
            style: {
              margin: 0,
              paddingLeft: "18px",
              listStyleType: "disc"
            }
          },
          h(
            "li",
            {
              style: {
                margin: "2px 0",
                color: line?.style?.color || colors.text,
                fontSize: line?.style?.fontSize || "12px",
                fontWeight: 500,
                lineHeight: line?.style?.lineHeight || "1.4"
              }
            },
            h("span", null, normalizeMainText(line)),
            subItems.length > 0
              ? h(
                  "ul",
                  {
                    style: {
                      margin: "4px 0 0",
                      paddingLeft: "16px",
                      listStyleType: "circle"
                    }
                  },
                  subItems.map((sub, subIndex) =>
                    h(
                      "li",
                      {
                        key: `${line.key || index}-sub-${subIndex}`,
                        style: {
                          margin: "1px 0",
                          fontSize: "11px",
                          fontWeight: 500,
                          lineHeight: "1.35",
                          color: "rgba(31,51,71,0.9)"
                        }
                      },
                      React.isValidElement(sub) ? sub : String(sub)
                    )
                  )
                )
              : null
          )
        );
      })
    );
  }

  function renderLegendNode({ colors, defs, hiddenKeys, setHiddenKeys, compact = false }) {
    const shortLabel = (value) => {
      const raw = String(value || "");
      if (!compact) return raw;
      if (raw === "BC long-standing (30d+)") return "BC 30d+";
      if (raw === "BC long-standing (60d+)") return "BC 60d+";
      if (raw === "Median Dev") return "Dev";
      if (raw === "Median UAT") return "UAT";
      return raw;
    };
    return h(
      "details",
      {
        className: "series-drawer",
        open: true
      },
      h(
        "summary",
        { className: "series-drawer__summary" },
        "Series"
      ),
      h(
        "div",
        { className: "series-drawer__items" },
        defs.map((item) => {
          const key = item?.dataKey || "";
          const hidden = hiddenKeys.has(key);
          const swatchColor = item?.stroke || item?.fill || colors.text;
          return h(
            "button",
            {
              type: "button",
              className: "series-drawer__item",
              "aria-pressed": hidden ? "false" : "true",
              title: hidden ? `Show ${item.name}` : `Hide ${item.name}`,
              onClick: () => setHiddenKeys((prev) => toggleLegendKey(prev, key))
            },
            h("span", {
              className: "series-drawer__swatch",
              style: { background: swatchColor, opacity: hidden ? 0.35 : 1 }
            }),
            h(
              "span",
              {
                className: "series-drawer__label",
                style: {
                  color: "var(--text, #1f3347)",
                  opacity: hidden ? 0.45 : 1,
                  textDecoration: hidden ? "line-through" : "none",
                  fontSize: compact ? 11 : 12
                }
              },
              shortLabel(item.name)
            )
          );
        })
      )
    );
  }

  function axisTick(colors) {
    return { fill: colors.text, fontSize: 12, fontWeight: 500 };
  }

  function buildCategoryColorsFromRows(rows, categoryKey) {
    const uniqueLabels = [];
    const seen = new Set();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const label = String(row?.[categoryKey] || "");
      if (!label || seen.has(label)) return;
      seen.add(label);
      uniqueLabels.push(label);
    });
    const mapped = {};
    uniqueLabels.forEach((label, index) => {
      mapped[label] = SHARED_CATEGORY_BLUE_TINTS[index % SHARED_CATEGORY_BLUE_TINTS.length];
    });
    return mapped;
  }

  function twoLineCategoryTickFactory(
    colors,
    { textAnchor = "end", dy = 3, line2Dy = 14, secondaryLabels = null } = {}
  ) {
    return function twoLineCategoryTick(props) {
      const { x, y, payload } = props || {};
      const raw = String(payload?.value || "");
      const splitIndex = raw.indexOf(" (n=");
      const fallbackLine2 = splitIndex > 0 ? raw.slice(splitIndex + 1) : "";
      const mappedLine2 =
        secondaryLabels && typeof secondaryLabels === "object"
          ? String(secondaryLabels[raw] || "")
          : "";
      const line1 = raw;
      const line2 = mappedLine2 || fallbackLine2;
      if (secondaryLabels && textAnchor === "middle") {
        return h(
          "g",
          { transform: `translate(${x},${y})` },
          h(
            "text",
            {
              x: 0,
              y: 12,
              textAnchor: "middle",
              fill: colors.text,
              fontSize: 12
            },
            line1
          ),
          line2
            ? h(
                "text",
                {
                  x: 0,
                  y: 28,
                  textAnchor: "middle",
                  fill: "rgba(31,51,71,0.78)",
                  fontSize: 11
                },
                line2
              )
            : null
        );
      }
      return h(
        "g",
        { transform: `translate(${x},${y})` },
        h(
          "text",
          {
            x: 0,
            y: 0,
            dy,
            textAnchor,
            fill: colors.text,
            fontSize: 12
          },
          h("tspan", { x: 0, dy: 0 }, line1),
          line2
            ? h("tspan", { x: 0, dy: line2Dy, fill: "rgba(31,51,71,0.75)", fontSize: 11 }, line2)
            : null
        )
      );
    };
  }

  function baseYAxisProps(colors, domain = null) {
    return {
      stroke: colors.text,
      tick: axisTick(colors),
      allowDecimals: false,
      ...(domain ? { domain } : {})
    };
  }

  window.DashboardChartPrimitives = {
    axisTick,
    baseYAxisProps,
    buildCategoryColorsFromRows,
    createTooltipContent,
    makeTooltipLine,
    renderLegendNode,
    twoLineCategoryTickFactory,
    tooltipTitleLine
  };
})();
