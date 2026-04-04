"use strict";

(function initDashboardPretextLayout() {
  const dashboardRuntimeContract =
    window.DashboardRuntimeContract ||
    (() => {
      throw new Error("Dashboard runtime contract not loaded.");
    })();
  const PRETEXT_MODULE_URL = dashboardRuntimeContract.getSourcePath("vendor", "pretext.mjs");
  const SUMMARY_FONT = '700 15px "Roboto"';
  const SUMMARY_LINE_HEIGHT = 22;
  const OBSTACLE_GAP = 18;
  let pretextPromise = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isLayoutEnabled(search = window.location.search) {
    try {
      const params = new URLSearchParams(search);
      const layout = String(params.get("workflow-layout") || params.get("layout") || "")
        .trim()
        .toLowerCase();
      if (layout === "legacy" || layout === "classic" || layout === "baseline") return false;
      return true;
    } catch {
      return true;
    }
  }

  const isWorkflowEnabled = isLayoutEnabled;

  function getPretext() {
    const bundledPretext = window.DashboardPretextModule;
    if (
      bundledPretext &&
      typeof bundledPretext.prepareWithSegments === "function" &&
      typeof bundledPretext.layoutNextLine === "function"
    ) {
      return Promise.resolve(bundledPretext);
    }
    if (!pretextPromise) {
      pretextPromise = import(PRETEXT_MODULE_URL);
    }
    return pretextPromise;
  }

  function renderUtilityListPanel(containerId, model) {
    const container = document.getElementById(containerId);
    if (!container || !model) return false;

    const accentColor = String(
      model.accentColor || model.teamColor || "var(--chart-active)"
    ).trim();
    const statsItems = (Array.isArray(model.stats) ? model.stats : []).filter(
      (item) => String(item?.value || "").trim().length > 0
    );
    const statsMarkup = statsItems
      .map(
        (item) => `
          <div class="dashboard-utility-layout__stat">
            <dt>${escapeHtml(item?.label)}</dt>
            <dd>${escapeHtml(item?.value)}</dd>
          </div>
        `
      )
      .join("");

    const footerBitsMarkup = (Array.isArray(model.footerBits) ? model.footerBits : [])
      .filter(Boolean)
      .map((item) => `<span>${escapeHtml(item)}</span>`)
      .join("");

    const rowsMarkup = (Array.isArray(model.rows) ? model.rows : [])
      .map((row) => {
        const width = Math.max(10, Math.min(100, Number(row?.width) || 0));
        const rowAccent = String(row?.color || accentColor || "").trim();
        const rowStyle = rowAccent ? ` style="--row-accent:${escapeHtml(rowAccent)}"` : "";
        const fillStyle = rowAccent
          ? ` style="width:${width}%;background:${escapeHtml(rowAccent)}"`
          : ` style="width:${width}%;"`;
        const detailText = String(row?.detailText || row?.description || "").trim();
        const rowHref = String(row?.href || row?.rowHref || "").trim();
        const rowLinkAriaLabel = String(row?.linkAriaLabel || "").trim();
        const labelMarkup = rowHref
          ? `<a class="dashboard-utility-layout__label-link" href="${escapeHtml(rowHref)}" target="_blank" rel="noopener noreferrer"${
              rowLinkAriaLabel ? ` aria-label="${escapeHtml(rowLinkAriaLabel)}"` : ""
            }><span class="dashboard-utility-layout__label-link-text">${escapeHtml(
              row?.label
            )}</span><svg class="dashboard-utility-layout__label-link-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2.5h4v4"></path><path d="M13.5 2.5L7.75 8.25"></path><path d="M6 4.5H3.5v8h8V10"></path></svg></a>`
          : escapeHtml(row?.label);
        const metaBits = (Array.isArray(row?.metaBits) ? row.metaBits : [])
          .map((item) => String(item || "").trim())
          .filter(Boolean);
        return `
          <div class="dashboard-utility-layout__row"${rowStyle}>
            <div class="dashboard-utility-layout__row-head">
              <div class="dashboard-utility-layout__label-group">
                <span class="dashboard-utility-layout__label">${labelMarkup}</span>
                ${
                  String(row?.sampleText || "").trim()
                    ? `<span class="dashboard-utility-layout__sample">${escapeHtml(row.sampleText)}</span>`
                    : ""
                }
                ${
                  detailText
                    ? `<span class="dashboard-utility-layout__detail">${escapeHtml(detailText)}</span>`
                    : ""
                }
              </div>
              <span class="dashboard-utility-layout__value">${escapeHtml(row?.valueText)}</span>
            </div>
            ${
              metaBits.length > 0
                ? `<div class="dashboard-utility-layout__meta">${metaBits
                    .map(
                      (item) =>
                        `<span class="dashboard-utility-layout__meta-bit">${escapeHtml(item)}</span>`
                    )
                    .join("")}</div>`
                : ""
            }
            <div class="dashboard-utility-layout__rail" aria-hidden="true">
              <div class="dashboard-utility-layout__fill"${fillStyle}></div>
            </div>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `
      <section class="dashboard-utility-layout" style="--utility-accent:${escapeHtml(accentColor)};--utility-stat-columns:${Math.max(1, Math.min(4, statsItems.length || 1))};">
        ${statsMarkup ? `<dl class="dashboard-utility-layout__stats">${statsMarkup}</dl>` : ""}
        <div class="dashboard-utility-layout__columns" aria-hidden="true">
          <span>${escapeHtml(String(model.columnStartLabel || "Item"))}</span>
          <span>${escapeHtml(String(model.columnEndLabel || "Value"))}</span>
        </div>
        <div class="dashboard-utility-layout__list">${rowsMarkup}</div>
        ${footerBitsMarkup ? `<div class="dashboard-utility-layout__footer">${footerBitsMarkup}</div>` : ""}
      </section>
    `;

    return true;
  }

  function renderStatsStrip(containerId, model) {
    const container = document.getElementById(containerId);
    if (!container) return false;

    const accentColor = String(
      model?.accentColor || model?.teamColor || "var(--chart-active)"
    ).trim();
    const statsItems = (Array.isArray(model?.stats) ? model.stats : []).filter(
      (item) => String(item?.value || "").trim().length > 0
    );

    if (statsItems.length === 0) {
      container.hidden = true;
      container.innerHTML = "";
      return false;
    }

    const statsMarkup = statsItems
      .map(
        (item) => `
          <div class="dashboard-utility-layout__stat">
            <dt>${escapeHtml(item?.label)}</dt>
            <dd>${escapeHtml(item?.value)}</dd>
          </div>
        `
      )
      .join("");

    container.hidden = false;
    container.innerHTML = `
      <section class="dashboard-chart-summary" style="--utility-accent:${escapeHtml(accentColor)};--utility-stat-columns:${Math.max(1, Math.min(4, statsItems.length || 1))};">
        <dl class="dashboard-utility-layout__stats">${statsMarkup}</dl>
      </section>
    `;
    return true;
  }

  function renderPretextCard(containerId, model) {
    return renderUtilityListPanel(containerId, model);
  }

  const renderWorkflowBreakdownCard = renderPretextCard;

  function renderManagementAcceptancePanel(containerId, model) {
    return renderUtilityListPanel(containerId, model);
  }

  function resolveTarget(target) {
    if (!target) return null;
    if (typeof target === "string") return document.getElementById(target);
    if (target instanceof Element) return target;
    return null;
  }

  function renderPanelLead(target, model) {
    const container = resolveTarget(target);
    if (!container) return false;
    const summaryText = String(model?.summaryText || "").trim();
    if (!summaryText) {
      container.innerHTML = "";
      container.hidden = true;
      return false;
    }

    const chipsMarkup = (Array.isArray(model?.chips) ? model.chips : [])
      .filter(Boolean)
      .map((item) => `<span class="dashboard-panel-lead__chip">${escapeHtml(item)}</span>`)
      .join("");

    const calloutLabel = String(model?.calloutLabel || "").trim();
    const calloutValue = String(model?.calloutValue || "").trim();
    const calloutSubtext = String(model?.calloutSubtext || "").trim();
    const calloutMarkup =
      calloutLabel || calloutValue || calloutSubtext
        ? `
      <aside class="dashboard-panel-lead__callout">
        ${calloutLabel ? `<span class="dashboard-panel-lead__callout-label">${escapeHtml(calloutLabel)}</span>` : ""}
        ${calloutValue ? `<strong>${escapeHtml(calloutValue)}</strong>` : ""}
        ${calloutSubtext ? `<span>${escapeHtml(calloutSubtext)}</span>` : ""}
      </aside>
    `
        : "";

    container.hidden = false;
    container.innerHTML = `
      <section class="dashboard-panel-lead" style="--panel-lead-accent:${escapeHtml(model?.accentColor || "rgba(72, 114, 167, 0.2)")};">
        <div class="dashboard-panel-lead__summary-shell">
          <div class="dashboard-panel-lead__summary">${escapeHtml(summaryText)}</div>
          ${calloutMarkup}
        </div>
        ${chipsMarkup ? `<div class="dashboard-panel-lead__chips">${chipsMarkup}</div>` : ""}
      </section>
    `;

    if (calloutMarkup) {
      const leadNode = container.querySelector(".dashboard-panel-lead");
      if (leadNode) {
        enhanceSummaryShell(leadNode, summaryText, {
          summarySelector: ".dashboard-panel-lead__summary",
          obstacleSelector: ".dashboard-panel-lead__callout",
          enhancedClassName: "dashboard-panel-lead--enhanced",
          lineClassName: "dashboard-panel-lead__line"
        });
      }
    }
    return true;
  }

  async function enhanceSummaryShell(rootNode, summaryText, options = {}) {
    const summarySelector = String(
      options.summarySelector || ".workflow-breakdown-pretext__summary"
    );
    const obstacleSelector = String(
      options.obstacleSelector || ".workflow-breakdown-pretext__obstacle"
    );
    const enhancedClassName = String(
      options.enhancedClassName || "workflow-breakdown-card--enhanced"
    );
    const lineClassName = String(options.lineClassName || "workflow-breakdown-pretext__line");
    const summaryNode = rootNode?.querySelector?.(summarySelector) || null;
    const obstacleNode = rootNode?.querySelector?.(obstacleSelector) || null;
    if (!summaryNode || !obstacleNode || summaryText.length === 0) return;

    const renderToken = `${Date.now()}-${Math.random()}`;
    summaryNode.dataset.renderToken = renderToken;

    try {
      const pretext = await getPretext();
      await document.fonts.ready;
      if (!summaryNode.isConnected || summaryNode.dataset.renderToken !== renderToken) return;

      const prepared = pretext.prepareWithSegments(summaryText, SUMMARY_FONT);
      const lines = [];
      let cursor = { segmentIndex: 0, graphemeIndex: 0 };
      let y = 0;
      const obstacleTop = Math.max(0, obstacleNode.offsetTop - summaryNode.offsetTop);
      const obstacleBottom = obstacleTop + obstacleNode.offsetHeight;
      const fullWidth = Math.max(220, Math.floor(summaryNode.clientWidth));
      const routedWidth = Math.max(140, fullWidth - obstacleNode.offsetWidth - OBSTACLE_GAP);

      while (true) {
        const widthBudget = y >= obstacleTop && y < obstacleBottom ? routedWidth : fullWidth;
        const line = pretext.layoutNextLine(prepared, cursor, widthBudget);
        if (line === null) break;
        lines.push({ text: line.text, y });
        cursor = line.end;
        y += SUMMARY_LINE_HEIGHT;
      }

      summaryNode.textContent = "";
      summaryNode.style.height = `${Math.max(y, SUMMARY_LINE_HEIGHT)}px`;
      rootNode.classList.add(enhancedClassName);

      lines.forEach((line) => {
        const lineNode = document.createElement("div");
        lineNode.className = lineClassName;
        lineNode.textContent = line.text;
        lineNode.style.top = `${line.y}px`;
        summaryNode.appendChild(lineNode);
      });
    } catch {
      summaryNode.textContent = summaryText;
    }
  }

  const api = {
    isLayoutEnabled,
    isWorkflowEnabled,
    renderPanelLead,
    renderStatsStrip,
    renderUtilityListPanel,
    renderManagementAcceptancePanel,
    renderPretextCard,
    renderWorkflowBreakdownCard
  };

  window.DashboardPretextLayout = api;
  window.DashboardPretextExperiment = api;
})();
