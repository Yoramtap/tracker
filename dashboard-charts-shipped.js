"use strict";

(function initDashboardShippedCharts() {
  const core = window.DashboardChartCore;
  const dashboardUiUtils = window.DashboardViewUtils;
  const dataUtils = window.DashboardDataUtils;
  if (!core) {
    throw new Error("Dashboard chart core not loaded.");
  }
  if (!dashboardUiUtils) {
    throw new Error("Dashboard UI helpers not loaded.");
  }
  if (!dataUtils) {
    throw new Error("Dashboard data helpers not loaded.");
  }

  const { getPrCycleTeamColor } = core;
  const { escapeHtml } = dashboardUiUtils;
  const { toCount } = dataUtils;
  const shipmentMonthShortFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC"
  });
  const shipmentMonthLongFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });

  function normalizeProductCycleTeamKey(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw === "orchestration" || raw === "workers") return "workers";
    if (raw === "multi team" || raw === "multi-team" || raw === "multiteam") {
      return "multiteam";
    }
    return raw;
  }

  function normalizeDisplayTeamName(name) {
    const raw = String(name || "").trim();
    const key = normalizeProductCycleTeamKey(raw);
    if (key === "workers") return "Workers";
    if (key === "multiteam") return "Multi team";
    return raw;
  }

  function formatShipmentMonthButton(dateText) {
    const parsed = new Date(`${String(dateText || "").trim()}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime())) return String(dateText || "").trim();
    return shipmentMonthShortFormatter.format(parsed);
  }

  function formatShipmentMonthLabel(dateText) {
    const parsed = new Date(`${String(dateText || "").trim()}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime())) return String(dateText || "").trim();
    return shipmentMonthLongFormatter.format(parsed);
  }

  function formatShipmentAreaLabel(areaLabel) {
    const raw = String(areaLabel || "").trim();
    if (raw === "Commissioning & Support") return "Commissioning";
    return raw;
  }

  function buildJiraIssueBrowseUrl(issueKey) {
    const safeIssueKey = String(issueKey || "").trim();
    if (!safeIssueKey) return "";
    return `https://nepgroup.atlassian.net/browse/${encodeURIComponent(safeIssueKey)}`;
  }

  function renderProductCycleShipmentsTimeline({
    containerId,
    timelineSnapshot,
    selectedYear,
    selectedMonthKey
  }) {
    const container = document.getElementById(containerId);
    if (!container) return false;
    const months = Array.isArray(timelineSnapshot?.months) ? timelineSnapshot.months : [];
    if (months.length === 0) {
      container.innerHTML = "";
      return false;
    }

    const years = Array.from(
      new Set(
        months
          .map((month) => String(month?.monthKey || "").trim().slice(0, 4))
          .filter((year) => /^\d{4}$/.test(year))
      )
    ).sort((left, right) => left.localeCompare(right));
    const activeYear = years.includes(String(selectedYear || "").trim())
      ? String(selectedYear || "").trim()
      : years[years.length - 1];
    const monthsInYear = months
      .filter((month) => String(month?.monthKey || "").trim().startsWith(`${activeYear}-`))
      .sort((left, right) => String(left?.monthKey || "").localeCompare(String(right?.monthKey || "")));
    const selectedMonth =
      monthsInYear.find(
        (month) => String(month?.monthKey || "").trim() === String(selectedMonthKey || "").trim()
      ) || monthsInYear[monthsInYear.length - 1];
    const monthMap = new Map(
      monthsInYear.map((month) => [String(month?.monthKey || "").trim(), month])
    );
    const activeYearIndex = Math.max(0, years.indexOf(activeYear));
    const previousYear = activeYearIndex > 0 ? years[activeYearIndex - 1] : "";
    const nextYear = activeYearIndex < years.length - 1 ? years[activeYearIndex + 1] : "";

    const monthButtonsMarkup = Array.from({ length: 12 }, (_, monthIndex) => {
      const monthNumber = String(monthIndex + 1).padStart(2, "0");
      const monthKey = `${activeYear}-${monthNumber}`;
      const monthSnapshot = monthMap.get(monthKey) || null;
      const monthStart = monthSnapshot?.monthStart || `${monthKey}-01`;
      const isActive = monthKey === String(selectedMonth?.monthKey || "").trim();
      const isDisabled = !monthSnapshot;
      return `
        <button
          type="button"
          class="shipped-month-picker__button${isActive ? " is-active" : ""}"
          data-shipped-month-key="${escapeHtml(monthKey)}"
          ${isDisabled ? "disabled" : ""}
          aria-pressed="${isActive ? "true" : "false"}"
        >
          <span class="shipped-month-picker__label">${escapeHtml(
            formatShipmentMonthButton(monthStart)
          )}</span>
        </button>
      `;
    }).join("");

    const teamSectionsMarkup = (Array.isArray(selectedMonth?.teams) ? selectedMonth.teams : [])
      .map((teamRow) => {
        const normalizedTeamKey = String(teamRow?.team || "").trim();
        const teamName = normalizeDisplayTeamName(normalizedTeamKey);
        const shippedCount = toCount(teamRow?.shippedCount);
        const teamColor = getPrCycleTeamColor(normalizedTeamKey);
        const ideasMarkup = (Array.isArray(teamRow?.ideas) ? teamRow.ideas : [])
          .map((idea) => {
            const issueKey = String(idea?.issueKey || "").trim();
            const productAreaLabel = formatShipmentAreaLabel(idea?.productAreaLabel);
            const summary = String(idea?.summary || "").trim();
            const issueUrl = buildJiraIssueBrowseUrl(issueKey);
            return `
              <li class="shipped-team-list__idea">
                <span class="shipped-team-list__idea-meta">
                  <a
                    class="shipped-team-list__idea-key"
                    href="${escapeHtml(issueUrl)}"
                    target="_blank"
                    rel="noreferrer"
                    title="${escapeHtml(issueKey)}"
                    aria-label="${escapeHtml(`${issueKey}: ${summary}`)}"
                  >${escapeHtml(issueKey)}</a>
                </span>
                <span class="shipped-team-list__idea-title">${escapeHtml(summary)}</span>
                <span class="shipped-team-list__idea-area">${escapeHtml(productAreaLabel)}</span>
              </li>
            `;
          })
          .join("");

        return `
          <section class="shipped-team-list__group" style="--shipment-accent:${escapeHtml(teamColor)};">
            <div class="shipped-team-list__team-row">
              <span class="shipped-team-list__team-node" aria-hidden="true"></span>
              <div class="shipped-team-list__team-copy">
                <div class="shipped-team-list__team-name">${escapeHtml(teamName)}</div>
                <div class="shipped-team-list__team-meta">${shippedCount} shipped</div>
              </div>
            </div>
            ${ideasMarkup ? `<ul class="shipped-team-list__ideas">${ideasMarkup}</ul>` : ""}
          </section>
        `;
      })
      .join("");

    const emptyMonthMarkup = `
      <div class="shipped-team-list__empty">
        <strong>No shipped ideas recorded.</strong>
        <span>This month is on the timeline, but nothing hit Done in the tracked product cycle.</span>
      </div>
    `;

    container.innerHTML = `
      <div class="product-cycle-shipments">
        <div class="shipped-timeline">
          <div class="shipped-timeline__controls">
            <div class="shipped-timeline__year-switch" aria-label="Shipment year">
              ${
                previousYear
                  ? `
              <button
                type="button"
                class="shipped-timeline__nav"
                data-shipped-year-target="${escapeHtml(previousYear)}"
                aria-label="Show previous year"
              >
                <span aria-hidden="true">‹</span>
              </button>
              `
                  : '<span class="shipped-timeline__nav-placeholder" aria-hidden="true"></span>'
              }
              <div class="shipped-timeline__year-label">${escapeHtml(activeYear)}</div>
              ${
                nextYear
                  ? `
              <button
                type="button"
                class="shipped-timeline__nav"
                data-shipped-year-target="${escapeHtml(nextYear)}"
                aria-label="Show next year"
              >
                <span aria-hidden="true">›</span>
              </button>
              `
                  : '<span class="shipped-timeline__nav-placeholder" aria-hidden="true"></span>'
              }
            </div>
            <div class="shipped-month-picker" role="group" aria-label="Months in ${escapeHtml(activeYear)}">
              ${monthButtonsMarkup}
            </div>
          </div>
          <section class="shipped-timeline__detail" aria-label="${escapeHtml(
            formatShipmentMonthLabel(String(selectedMonth?.monthStart || "").trim())
          )} shipped ideas">
            <div class="shipped-timeline__detail-header">
              <div class="shipped-timeline__detail-copy">
                <h3 class="shipped-timeline__detail-title">${escapeHtml(
                  formatShipmentMonthLabel(String(selectedMonth?.monthStart || "").trim())
                )}</h3>
              </div>
              <div class="shipped-timeline__detail-callout">
                <strong>${toCount(selectedMonth?.totalShipped)} shipped</strong> this month
              </div>
            </div>
            <div class="shipped-team-list" aria-label="Teams with shipped ideas">
              ${teamSectionsMarkup || emptyMonthMarkup}
            </div>
          </section>
        </div>
      </div>
    `;
    return true;
  }

  Object.assign(window.DashboardCharts || (window.DashboardCharts = {}), {
    renderProductCycleShipmentsTimeline
  });
})();
