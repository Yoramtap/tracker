import fs from "node:fs/promises";
import path from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;
const CONTRIBUTOR_DUPLICATE_STATUS = "duplicate";
const DEFAULT_CONTRIBUTOR_PROJECT = "TFC";
const DEFAULT_CONTRIBUTOR_LABEL = "Contributors";
const DEFAULT_CONTRIBUTOR_TEAMS_FIELD = "customfield_10201";
const DEFAULT_CONTRIBUTOR_TOP_LIMIT = 12;
const DEFAULT_PRODUCT_CYCLE_PROJECT_KEY = "TPS";
const DEFAULT_PRODUCT_CYCLE_CHANGELOG_CONCURRENCY = 5;
const DEFAULT_PRODUCT_CYCLE_PRODUCT_AREA_FIELD = "customfield_10214";
const PRODUCT_CYCLE_SCOPE_KEY = "inception";
const PRODUCT_CYCLE_SCOPE_LABEL = "All ideas";
const PRODUCT_CYCLE_MULTI_TEAM_LABEL = "Multi team";
const PRODUCT_CYCLE_TEAM_ORDER = [
  PRODUCT_CYCLE_MULTI_TEAM_LABEL,
  "API",
  "Frontend",
  "Broadcast",
  "Orchestration",
  "Titanium",
  "Shift"
];
const PRODUCT_CYCLE_TEAM_MATCHERS = [
  ["API", "api"],
  ["Frontend", "front"],
  ["Broadcast", "broadcast"],
  ["Titanium", "titanium"],
  ["Orchestration", "orchestration"],
  ["Shift", "shift"]
];
const PRODUCT_CYCLE_IDEA_OVERRIDES = {
  "TPS-116": { primaryTeam: "Broadcast" },
  "TPS-105": { primaryTeam: "Broadcast" },
  "TPS-52": { primaryTeam: "API" },
  "TPS-98": { primaryTeam: "API" },
  "TPS-369": { primaryTeam: "Orchestration" },
  "TPS-107": { exclude: true },
  "TPS-166": { exclude: true },
  "TPS-72": { exclude: true },
  "TPS-104": { exclude: true }
};
const PRODUCT_CYCLE_STAGE_ALIASES = {
  parking_lot: ["parking lot", "park and lot"],
  design: ["design", "design phase"],
  ready_for_development: ["ready for development", "ready for delivery"],
  in_development: ["in development", "delivery", "in delivery"],
  feedback: ["feedback", "uat", "user acceptance testing"],
  done: ["done"]
};
const PRODUCT_CYCLE_PHASE_KEYS = [
  "parking_lot",
  "design",
  "ready_for_development",
  "in_development",
  "feedback"
];
const PRODUCT_CYCLE_STAGE_DEFS = [
  { key: "parking_lot", label: "Parking" },
  { key: "design", label: "Design" },
  { key: "ready_for_development", label: "Ready" },
  { key: "in_development", label: "In Development" },
  { key: "feedback", label: "UAT" }
];
const PRODUCT_CYCLE_SHIPPED_TIMELINE_START_MONTH = 0;
const DEFAULT_FLOW_DEV_STATUSES = ["In Progress", "Review", "In Review"];
const DEFAULT_FLOW_UAT_STATUSES = ["UAT"];
const DEFAULT_FLOW_DONE_STATUSES = ["Done", "Won't Fix", "Duplicate"];
const FLOW_PRIORITY_BANDS = ["medium", "high", "highest"];
const FLOW_PRIORITY_BAND_MAP = {
  highest: ["Highest", "P0", "P1", "Critical", "Blocker"],
  high: ["High", "P2"],
  medium: ["Medium", "P3"]
};
const DEFAULT_FACILITY_FIELD = "customfield_10094";
const DEFAULT_BUSINESS_UNIT_FIELD = "customfield_10451";
const DEFAULT_BUSINESS_UNIT_DONE_CACHE_OVERLAP_DAYS = 2;
const DEFAULT_BUSINESS_UNIT_DONE_CACHE_MAX_AGE_DAYS = 14;
const FACILITY_UNSPECIFIED = "Unspecified";
const BUSINESS_UNIT_UNMAPPED = "Business unit unmapped";
const CACHE_DIR_PATH = path.resolve(
  process.env.REFRESH_CACHE_DIR || path.join(process.cwd(), ".cache")
);
const BUSINESS_UNIT_DONE_CACHE_PATH = path.join(CACHE_DIR_PATH, "business-unit-uat-done-cache.json");
const BUSINESS_UNIT_DONE_CACHE_TMP_PATH = path.join(
  CACHE_DIR_PATH,
  "business-unit-uat-done-cache.json.tmp"
);

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

const PREFERRED_FIELD_TEXT_KEYS = ["value", "name", "displayName", "label", "title"];

function parsePositiveIntLike(value, fallback) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function toCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.trunc(number);
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function uniqueSorted(values) {
  return [
    ...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))
  ].sort((left, right) => left.localeCompare(right));
}

function quoteJqlValue(value) {
  const escaped = String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function chunk(values, size) {
  const safeSize = Math.max(1, Number(size) || 1);
  const chunks = [];
  for (let index = 0; index < values.length; index += safeSize) {
    chunks.push(values.slice(index, index + safeSize));
  }
  return chunks;
}

function arithmeticMean(values, fallback = 0) {
  const nums = (values || []).filter(
    (value) => typeof value === "number" && Number.isFinite(value)
  );
  if (nums.length === 0) return fallback;
  return round2(nums.reduce((sum, value) => sum + value, 0) / nums.length);
}

function median(values, fallback = 0) {
  const nums = (values || [])
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (nums.length === 0) return fallback;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 1) return round2(nums[mid]);
  return round2((nums[mid - 1] + nums[mid]) / 2);
}

function buildStats(values) {
  const safeValues = (Array.isArray(values) ? values : []).filter(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0
  );
  return {
    n: safeValues.length,
    average: arithmeticMean(safeValues, 0),
    median: median(safeValues, 0)
  };
}

function sortHistoriesByCreated(values) {
  return (Array.isArray(values) ? values : []).slice().sort((left, right) => {
    return new Date(left?.created || 0).getTime() - new Date(right?.created || 0).getTime();
  });
}

function asIsoDateTime(value) {
  const at = new Date(String(value || "")).getTime();
  if (!Number.isFinite(at)) return "";
  return new Date(at).toISOString();
}

function diffDays(startIso, endIso) {
  const startAt = new Date(String(startIso || "")).getTime();
  const endAt = new Date(String(endIso || "")).getTime();
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt < startAt) return null;
  return round2((endAt - startAt) / DAY_MS);
}

function readFieldValues(rawValue) {
  if (rawValue === null || rawValue === undefined) return [];
  if (Array.isArray(rawValue)) {
    return uniqueSorted(rawValue.flatMap((item) => readFieldValues(item)));
  }
  const text = readPreferredFieldText(rawValue);
  return text ? [text] : [];
}

function readPreferredFieldText(rawValue, fallback = "") {
  if (rawValue === null || rawValue === undefined) return fallback;
  if (typeof rawValue === "object" && !Array.isArray(rawValue)) {
    for (const key of PREFERRED_FIELD_TEXT_KEYS) {
      const candidate = String(rawValue?.[key] || "").trim();
      if (candidate) return candidate;
    }
    return fallback;
  }
  return String(rawValue || "").trim() || fallback;
}

function extractLinkedIssueKeys(issue) {
  const links = Array.isArray(issue?.fields?.issuelinks) ? issue.fields.issuelinks : [];
  const keys = [];
  for (const link of links) {
    const outwardKey = String(link?.outwardIssue?.key || "").trim();
    const inwardKey = String(link?.inwardIssue?.key || "").trim();
    if (outwardKey) keys.push(outwardKey);
    if (inwardKey) keys.push(inwardKey);
  }
  return uniqueSorted(keys);
}

function contributorIdentity(issue) {
  const assignee = issue?.fields?.assignee;
  const accountId = String(assignee?.accountId || "").trim();
  const displayName = String(assignee?.displayName || "").trim();
  if (!accountId && !displayName) {
    return {
      contributorId: "",
      contributorName: "",
      assigned: false
    };
  }
  return {
    contributorId: accountId || `name:${displayName.toLowerCase()}`,
    contributorName: displayName || "Unknown",
    assigned: true
  };
}

async function buildLinkedIssueTeamIndex({
  site,
  email,
  token,
  searchJiraIssues,
  linkedIssueKeys,
  teamsFieldId
}) {
  const index = new Map();
  if (!teamsFieldId) return index;

  for (const batch of chunk(uniqueSorted(linkedIssueKeys), 100)) {
    if (batch.length === 0) continue;
    const jql = `key IN (${batch.map((key) => quoteJqlValue(key)).join(", ")})`;
    const issues = await searchJiraIssues(site, email, token, jql, [teamsFieldId]);
    for (const issue of issues) {
      index.set(String(issue?.key || "").trim(), readFieldValues(issue?.fields?.[teamsFieldId]));
    }
  }

  return index;
}

function buildDefaultContributorJql({ project, label }) {
  return [`project = ${quoteJqlValue(project)}`, `labels = ${quoteJqlValue(label)}`].join(" AND ");
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJsonAtomic(filePath, tmpPath, value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  try {
    await fs.mkdir(path.dirname(tmpPath), { recursive: true });
    await fs.writeFile(tmpPath, serialized, "utf8");
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    await fs.unlink(tmpPath).catch(() => undefined);
    throw error;
  }
}

function snapshotAgeInDays(updatedAt) {
  const timestamp = new Date(String(updatedAt || "")).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return (Date.now() - timestamp) / DAY_MS;
}

function shiftIsoDateTime(isoDateTime, deltaDays) {
  const timestamp = new Date(String(isoDateTime || "")).getTime();
  if (!Number.isFinite(timestamp)) return "";
  return new Date(timestamp + deltaDays * DAY_MS).toISOString();
}

function parseEnvList(rawValue, fallbackValues) {
  const text = String(rawValue || "").trim();
  const values = text ? text.split(",") : fallbackValues;
  return uniqueSorted(
    (Array.isArray(values) ? values : [values]).map((value) => String(value || "").trim())
  );
}

function parseBooleanLike(value, fallback = false) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return fallback;
  return !["0", "false", "no", "off"].includes(raw);
}

function readScalarFieldValue(rawValue, fallback = "") {
  if (rawValue === null || rawValue === undefined) return fallback;
  if (Array.isArray(rawValue)) {
    const values = rawValue
      .map((item) => readScalarFieldValue(item, ""))
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    return values.join(", ") || fallback;
  }
  return readPreferredFieldText(rawValue, fallback);
}

function readFacilityValue(rawValue) {
  return readScalarFieldValue(rawValue, FACILITY_UNSPECIFIED);
}

function readBusinessUnitValue(rawValue) {
  return readScalarFieldValue(rawValue, BUSINESS_UNIT_UNMAPPED);
}

function normalizeStatusName(value) {
  return normalizeText(value);
}

function buildLifecycleEventData(histories) {
  const enteredAt = Object.fromEntries(
    [...PRODUCT_CYCLE_PHASE_KEYS, "done"].map((key) => [key, ""])
  );
  const lifecycleEvents = [];

  for (const history of sortHistoriesByCreated(histories)) {
    const historyAt = asIsoDateTime(history?.created);
    if (!historyAt) continue;
    for (const item of history?.items || []) {
      if (normalizeText(item?.field) !== "status") continue;
      const fromStage = lifecycleStageFromStatus(item?.fromString || "");
      const toStage = lifecycleStageFromStatus(item?.toString || "");
      lifecycleEvents.push({ at: historyAt, fromStage, toStage });
      if (fromStage && !enteredAt[fromStage]) enteredAt[fromStage] = historyAt;
      if (toStage && !enteredAt[toStage]) enteredAt[toStage] = historyAt;
    }
  }

  return { lifecycleEvents, enteredAt };
}

function createStageDurationBuckets(stageDefs, teams) {
  return new Map(
    (Array.isArray(stageDefs) ? stageDefs : []).map((stageDef) => [
      stageDef.label,
      Object.fromEntries((Array.isArray(teams) ? teams : []).map((team) => [team, []]))
    ])
  );
}

function buildCurrentStageRows(stageDurationsByTeam, teams) {
  const teamDefs = (Array.isArray(teams) ? teams : []).map((team, index) => ({
    slot: `slot_${index}`,
    name: team,
    team
  }));
  const rows = PRODUCT_CYCLE_STAGE_DEFS.map((stageDef) => {
    const row = {
      phaseKey: stageDef.key,
      phaseLabel: stageDef.label
    };
    for (const teamDef of teamDefs) {
      const values = stageDurationsByTeam.get(stageDef.label)?.[teamDef.team] || [];
      const stats = buildStats(values);
      const average = round2(stats.average || 0);
      row[teamDef.slot] = average;
      row[`meta_${teamDef.slot}`] = {
        team: teamDef.team,
        n: toCount(stats.n),
        average
      };
    }
    return row;
  });
  const yUpper = Math.max(
    1,
    ...rows.flatMap((row) =>
      teamDefs.map((teamDef) => {
        const value = Number(row?.[teamDef.slot]);
        return Number.isFinite(value) ? value : 0;
      })
    )
  );
  return { teamDefs, rows, yUpper: round2(yUpper) };
}

function toStatusSet(values) {
  return new Set((values || []).map((value) => normalizeStatusName(value)).filter(Boolean));
}

function parseStatusTransitions(changelog) {
  const transitions = [];
  for (const history of changelog?.histories ?? []) {
    const at = String(history?.created || "").trim();
    const atMs = new Date(at).getTime();
    if (!Number.isFinite(atMs)) continue;
    for (const item of history?.items ?? []) {
      if (normalizeStatusName(item?.field) !== "status") continue;
      transitions.push({
        at,
        atMs,
        from: String(item?.fromString || "").trim(),
        to: String(item?.toString || "").trim()
      });
    }
  }
  transitions.sort((left, right) => left.atMs - right.atMs);
  return transitions;
}

function durationDays(startAt, endAt) {
  const startMs = new Date(String(startAt || "")).getTime();
  const endMs = new Date(String(endAt || "")).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return (endMs - startMs) / DAY_MS;
}

function daysSinceIsoDateTime(isoDateTime, nowIso = new Date().toISOString()) {
  const atMs = new Date(String(isoDateTime || "")).getTime();
  const nowMs = new Date(String(nowIso || "")).getTime();
  if (!Number.isFinite(atMs) || !Number.isFinite(nowMs)) return 0;
  return Math.floor(Math.max(0, nowMs - atMs) / DAY_MS);
}

function computeIssueFlowMetrics(issue, changelog, config) {
  const devSet = toStatusSet(config?.devStatuses);
  const uatSet = toStatusSet(config?.uatStatuses);
  const doneSet = toStatusSet(config?.doneStatuses);
  const createdAt = String(issue?.fields?.created || "").trim();
  const createdMs = new Date(createdAt).getTime();
  const nowIso = String(config?.nowIso || new Date().toISOString());
  const nowMs = new Date(nowIso).getTime();
  const currentStatus = String(issue?.fields?.status?.name || "").trim();
  const currentStatusKey = normalizeStatusName(currentStatus);
  const transitions = parseStatusTransitions(changelog);

  let firstDevAt = "";
  let firstUatAt = "";
  let doneAt = "";
  let uatLoopCount = 0;
  let lastUatEntryAt = "";

  if (!Number.isFinite(createdMs) || !Number.isFinite(nowMs)) {
    return {
      dev_time_to_first_uat_days: null,
      entered_uat: false,
      first_uat_at: null,
      is_currently_in_uat: false,
      uat_time_days: 0,
      done_at: null,
      uat_loop_count: 0,
      uat_current_age_days: 0
    };
  }

  const initialStatus = transitions[0]?.from || currentStatus;
  const initialStatusKey = normalizeStatusName(initialStatus);
  if (devSet.has(initialStatusKey)) firstDevAt = createdAt;
  if (uatSet.has(initialStatusKey)) {
    firstUatAt = createdAt;
    uatLoopCount = 1;
    lastUatEntryAt = createdAt;
  }

  for (const transition of transitions) {
    const fromKey = normalizeStatusName(transition.from);
    const toKey = normalizeStatusName(transition.to);
    if (!firstDevAt && devSet.has(toKey)) firstDevAt = transition.at;
    if (uatSet.has(toKey) && !uatSet.has(fromKey)) {
      if (!firstUatAt) firstUatAt = transition.at;
      uatLoopCount += 1;
      lastUatEntryAt = transition.at;
    }
    if (doneSet.has(toKey)) doneAt = transition.at;
  }

  // Only count an issue as done when its current status still ends in a done state.
  if (doneSet.has(currentStatusKey)) {
    if (!doneAt) doneAt = nowIso;
  } else {
    doneAt = "";
  }

  const timelineEndAt = doneAt || nowIso;
  const timelineEndMs = new Date(timelineEndAt).getTime();
  const safeTimelineEndAt = Number.isFinite(timelineEndMs) ? timelineEndAt : nowIso;

  let uatDays = 0;
  let devToFirstUatDays = 0;
  let activeStatus = initialStatus;
  let cursorAt = createdAt;

  for (const transition of transitions) {
    const cursorMs = new Date(cursorAt).getTime();
    if (!Number.isFinite(cursorMs)) {
      cursorAt = transition.at;
      activeStatus = transition.to;
      continue;
    }

    const cappedEndAt =
      new Date(transition.at).getTime() > new Date(safeTimelineEndAt).getTime()
        ? safeTimelineEndAt
        : transition.at;
    const activeKey = normalizeStatusName(activeStatus);
    const segmentDays = durationDays(cursorAt, cappedEndAt);
    if (uatSet.has(activeKey)) uatDays += segmentDays;

    if (firstDevAt && firstUatAt) {
      const segmentStartMs = new Date(cursorAt).getTime();
      const segmentEndMs = new Date(cappedEndAt).getTime();
      const firstDevMs = new Date(firstDevAt).getTime();
      const firstUatMs = new Date(firstUatAt).getTime();
      const clippedStartMs = Math.max(segmentStartMs, firstDevMs);
      const clippedEndMs = Math.min(segmentEndMs, firstUatMs);
      if (devSet.has(activeKey) && clippedEndMs > clippedStartMs) {
        devToFirstUatDays += (clippedEndMs - clippedStartMs) / DAY_MS;
      }
    }

    if (cappedEndAt === safeTimelineEndAt) {
      cursorAt = safeTimelineEndAt;
      activeStatus = transition.to;
      break;
    }

    cursorAt = transition.at;
    activeStatus = transition.to;
  }

  if (new Date(cursorAt).getTime() < new Date(safeTimelineEndAt).getTime()) {
    const activeKey = normalizeStatusName(activeStatus);
    const segmentDays = durationDays(cursorAt, safeTimelineEndAt);
    if (uatSet.has(activeKey)) uatDays += segmentDays;
    if (firstDevAt && firstUatAt) {
      const segmentStartMs = new Date(cursorAt).getTime();
      const segmentEndMs = new Date(safeTimelineEndAt).getTime();
      const firstDevMs = new Date(firstDevAt).getTime();
      const firstUatMs = new Date(firstUatAt).getTime();
      const clippedStartMs = Math.max(segmentStartMs, firstDevMs);
      const clippedEndMs = Math.min(segmentEndMs, firstUatMs);
      if (devSet.has(activeKey) && clippedEndMs > clippedStartMs) {
        devToFirstUatDays += (clippedEndMs - clippedStartMs) / DAY_MS;
      }
    }
  }

  return {
    dev_time_to_first_uat_days: firstUatAt ? round2(devToFirstUatDays) : null,
    entered_uat: Boolean(firstUatAt),
    first_uat_at: firstUatAt || null,
    is_currently_in_uat: uatSet.has(currentStatusKey),
    uat_time_days: round2(uatDays),
    done_at: doneAt || null,
    uat_loop_count: uatLoopCount,
    uat_current_age_days:
      uatSet.has(currentStatusKey) && lastUatEntryAt
        ? daysSinceIsoDateTime(lastUatEntryAt, nowIso)
        : 0
  };
}

function resolveFlowPriorityBand(priorityName) {
  const normalized = normalizeStatusName(priorityName);
  if (!normalized) return "";
  for (const band of FLOW_PRIORITY_BANDS) {
    const values = FLOW_PRIORITY_BAND_MAP[band] || [];
    if (values.some((value) => normalizeStatusName(value) === normalized)) {
      return band;
    }
  }
  return "";
}

function createFlowAggregateNode() {
  return {
    devToFirstUat: [],
    uatForFlow: [],
    devIssueIds: new Set(),
    uatIssueIds: new Set()
  };
}

function appendFlowAggregateValues(node, row) {
  if (!node || !row) return;
  const devToFirstUat = row?.metrics?.dev_time_to_first_uat_days;
  const loopCount = toCount(row?.metrics?.uat_loop_count);
  const uatDays = row?.metrics?.uat_time_days;
  const issueKey = String(row?.key || "").trim();
  if (typeof devToFirstUat === "number" && Number.isFinite(devToFirstUat)) {
    node.devToFirstUat.push(devToFirstUat);
    if (issueKey) node.devIssueIds.add(issueKey);
  }
  if (loopCount > 0 && typeof uatDays === "number" && Number.isFinite(uatDays)) {
    node.uatForFlow.push(uatDays);
    if (issueKey) node.uatIssueIds.add(issueKey);
  }
}

function summarizeFlowAggregateNode(node) {
  const safeNode = node && typeof node === "object" ? node : createFlowAggregateNode();
  const uniqueIssueIds = Array.from(
    new Set([...safeNode.devIssueIds, ...safeNode.uatIssueIds])
  ).sort((left, right) => left.localeCompare(right));
  return {
    avg_dev_days:
      safeNode.devToFirstUat.length > 0 ? arithmeticMean(safeNode.devToFirstUat, null) : null,
    avg_uat_days: safeNode.uatForFlow.length > 0 ? arithmeticMean(safeNode.uatForFlow, null) : null,
    n_dev: safeNode.devIssueIds.size,
    n_uat: safeNode.uatIssueIds.size,
    n: uniqueIssueIds.length,
    issue_ids: uniqueIssueIds
  };
}

function buildFlowByBusinessUnit(rows) {
  const byBusinessUnit = {};
  for (const row of rows || []) {
    const band = resolveFlowPriorityBand(row?.priorityName || row?.priority || "");
    if (!FLOW_PRIORITY_BANDS.includes(band)) continue;

    const businessUnit = String(row?.businessUnit || "").trim() || BUSINESS_UNIT_UNMAPPED;
    const facility = String(row?.facility || "").trim() || FACILITY_UNSPECIFIED;
    const businessUnitNode =
      byBusinessUnit[businessUnit] ||
      (byBusinessUnit[businessUnit] = {
        aggregate: createFlowAggregateNode(),
        facilities: {}
      });

    appendFlowAggregateValues(businessUnitNode.aggregate, row);
    const facilityNode =
      businessUnitNode.facilities[facility] ||
      (businessUnitNode.facilities[facility] = createFlowAggregateNode());
    appendFlowAggregateValues(facilityNode, row);
  }

  return Object.fromEntries(
    Object.entries(byBusinessUnit)
      .map(([businessUnit, node]) => {
        const aggregate = summarizeFlowAggregateNode(node.aggregate);
        const facilities = Object.fromEntries(
          Object.entries(node.facilities)
            .map(([facility, facilityNode]) => [facility, summarizeFlowAggregateNode(facilityNode)])
            .filter(([, metrics]) => toCount(metrics?.n) > 0)
            .sort((left, right) => {
              const leftN = toCount(left?.[1]?.n);
              const rightN = toCount(right?.[1]?.n);
              if (rightN !== leftN) return rightN - leftN;
              return String(left[0] || "").localeCompare(String(right[0] || ""));
            })
        );
        return [businessUnit, { ...aggregate, facilities }];
      })
      .filter(([, metrics]) => toCount(metrics?.n) > 0)
      .sort((left, right) => {
        const leftN = toCount(left?.[1]?.n);
        const rightN = toCount(right?.[1]?.n);
        if (rightN !== leftN) return rightN - leftN;
        return String(left[0] || "").localeCompare(String(right[0] || ""));
      })
  );
}

function buildBusinessUnitRows(flowByBusinessUnit) {
  return Object.entries(flowByBusinessUnit || {})
    .map(([businessUnit, metrics]) => {
      const node = metrics && typeof metrics === "object" ? metrics : {};
      const facilities = Object.entries(
        node?.facilities && typeof node.facilities === "object" ? node.facilities : {}
      )
        .map(([facility, facilityMetrics]) => ({
          label: String(facility || FACILITY_UNSPECIFIED),
          devAvg: Number(facilityMetrics?.avg_dev_days) || 0,
          uatAvg: Number(facilityMetrics?.avg_uat_days) || 0,
          devCount: toCount(facilityMetrics?.n_dev),
          uatCount: toCount(facilityMetrics?.n_uat),
          sampleCount: toCount(facilityMetrics?.n),
          issueIds: Array.isArray(facilityMetrics?.issue_ids) ? facilityMetrics.issue_ids : []
        }))
        .filter((row) => row.sampleCount > 0)
        .sort((left, right) => {
          const leftIsUnspecified =
            String(left.label || "")
              .trim()
              .toLowerCase() === "unspecified";
          const rightIsUnspecified =
            String(right.label || "")
              .trim()
              .toLowerCase() === "unspecified";
          if (leftIsUnspecified && !rightIsUnspecified) return 1;
          if (!leftIsUnspecified && rightIsUnspecified) return -1;
          return String(left.label || "").localeCompare(String(right.label || ""));
        });

      const issueItems = facilities.flatMap((facilityRow) => {
        const facilityLabel =
          String(facilityRow?.label || "")
            .trim()
            .toLowerCase() === "unspecified"
            ? "Facility unmapped"
            : `Facility ${String(facilityRow?.label || "").trim() || "unmapped"}`;
        return (Array.isArray(facilityRow?.issueIds) ? facilityRow.issueIds : []).map(
          (issueId) => ({
            issueId: String(issueId || "").trim(),
            facilityLabel
          })
        );
      });

      return {
        label: String(businessUnit || BUSINESS_UNIT_UNMAPPED),
        devAvg: Number(node?.avg_dev_days) || 0,
        uatAvg: Number(node?.avg_uat_days) || 0,
        devCount: toCount(node?.n_dev),
        uatCount: toCount(node?.n_uat),
        sampleCount: toCount(node?.n),
        issueIds: Array.isArray(node?.issue_ids) ? node.issue_ids : [],
        issueItems,
        facilities
      };
    })
    .filter((row) => row.sampleCount > 0)
    .sort((left, right) => {
      const leftLabel = String(left?.label || "").trim();
      const rightLabel = String(right?.label || "").trim();
      const leftIsTechDebt = leftLabel.toLowerCase() === "tech debt";
      const rightIsTechDebt = rightLabel.toLowerCase() === "tech debt";
      if (leftIsTechDebt && !rightIsTechDebt) return 1;
      if (!leftIsTechDebt && rightIsTechDebt) return -1;
      return leftLabel.localeCompare(rightLabel);
    });
}

function buildBusinessUnitCurrentUatJql({ project, issueType, label, uatStatuses }) {
  const clauses = [
    `project = ${quoteJqlValue(project)}`,
    `labels = ${quoteJqlValue(label)}`,
    `status IN (${(Array.isArray(uatStatuses) ? uatStatuses : []).map((status) => quoteJqlValue(status)).join(", ")})`
  ];
  if (issueType) clauses.push(`type = ${quoteJqlValue(issueType)}`);
  return clauses.join(" AND ");
}

function buildBusinessUnitDoneRebuildJql({ project, issueType, label, doneStatuses }) {
  const clauses = [
    `project = ${quoteJqlValue(project)}`,
    `labels = ${quoteJqlValue(label)}`,
    `status IN (${(Array.isArray(doneStatuses) ? doneStatuses : []).map((status) => quoteJqlValue(status)).join(", ")})`
  ];
  if (issueType) clauses.push(`type = ${quoteJqlValue(issueType)}`);
  return clauses.join(" AND ");
}

function buildBusinessUnitIncrementalJql({ project, issueType, label, updatedSince }) {
  const clauses = [
    `project = ${quoteJqlValue(project)}`,
    `labels = ${quoteJqlValue(label)}`,
    `updated >= ${quoteJqlValue(String(updatedSince || "").slice(0, 10))}`
  ];
  if (issueType) clauses.push(`type = ${quoteJqlValue(issueType)}`);
  return clauses.join(" AND ");
}

function createDoneCacheEntry(row) {
  return {
    key: String(row?.key || "").trim(),
    priority: String(row?.priority || "").trim(),
    priorityName: String(row?.priorityName || "").trim(),
    businessUnit: String(row?.businessUnit || "").trim(),
    facility: String(row?.facility || "").trim(),
    issueUpdatedAt: String(row?.issueUpdatedAt || "").trim(),
    metrics: {
      dev_time_to_first_uat_days: row?.metrics?.dev_time_to_first_uat_days ?? null,
      entered_uat: row?.metrics?.entered_uat === true,
      first_uat_at: row?.metrics?.first_uat_at || null,
      is_currently_in_uat: row?.metrics?.is_currently_in_uat === true,
      uat_time_days: Number(row?.metrics?.uat_time_days) || 0,
      done_at: row?.metrics?.done_at || null,
      uat_loop_count: toCount(row?.metrics?.uat_loop_count),
      uat_current_age_days: Number(row?.metrics?.uat_current_age_days) || 0
    }
  };
}

function buildDoneCacheValue({ rows, refreshedAt, watermarkUpdatedSince, source }) {
  return {
    updatedAt: String(refreshedAt || new Date().toISOString()),
    watermarkUpdatedSince: String(watermarkUpdatedSince || refreshedAt || new Date().toISOString()),
    source: {
      project: String(source?.project || "").trim(),
      issueType: String(source?.issueType || "").trim(),
      label: String(source?.label || "").trim(),
      doneStatuses: uniqueSorted(source?.doneStatuses || [])
    },
    rows: Array.isArray(rows) ? rows.map(createDoneCacheEntry).filter((row) => row.key) : []
  };
}

function isDoneCacheSourceMatch(cache, { project, issueType, label, doneStatuses }) {
  const cacheSource = cache?.source && typeof cache.source === "object" ? cache.source : {};
  return (
    String(cacheSource.project || "").trim() === String(project || "").trim() &&
    String(cacheSource.issueType || "").trim() === String(issueType || "").trim() &&
    String(cacheSource.label || "").trim() === String(label || "").trim() &&
    JSON.stringify(uniqueSorted(cacheSource.doneStatuses || [])) ===
      JSON.stringify(uniqueSorted(doneStatuses || []))
  );
}

function shouldKeepDoneCacheRow(row) {
  return (
    row?.metrics?.entered_uat === true &&
    Boolean(String(row?.metrics?.done_at || "").trim()) &&
    toCount(row?.metrics?.uat_loop_count) > 0
  );
}

function buildBusinessUnitIssueFlowRow(issue, metrics, { facilityFieldId, businessUnitFieldId }) {
  return {
    key: String(issue?.key || "").trim(),
    priority: normalizeText(issue?.fields?.priority?.name),
    priorityName: String(issue?.fields?.priority?.name || "").trim(),
    businessUnit: readBusinessUnitValue(issue?.fields?.[businessUnitFieldId]),
    facility: readFacilityValue(issue?.fields?.[facilityFieldId]),
    issueUpdatedAt: String(issue?.fields?.updated || "").trim(),
    metrics
  };
}

export async function refreshContributorsSnapshot(options = {}) {
  const logger = options.logger || console;
  const envValue = options.envValue || ((_, fallback = "") => fallback);
  const site = String(options.site || "").trim();
  const email = String(options.email || "").trim();
  const token = String(options.token || "").trim();
  const searchJiraIssues = options.searchJiraIssues;

  if (typeof searchJiraIssues !== "function") {
    throw new Error("refreshContributorsSnapshot requires searchJiraIssues.");
  }

  const project = String(envValue("CONTRIBUTOR_PROJECT", DEFAULT_CONTRIBUTOR_PROJECT) || "").trim();
  const label = String(envValue("CONTRIBUTOR_LABEL", DEFAULT_CONTRIBUTOR_LABEL) || "").trim();
  const teamsFieldId = String(
    envValue("CONTRIBUTOR_TEAMS_FIELD", DEFAULT_CONTRIBUTOR_TEAMS_FIELD) || ""
  ).trim();
  const topLimit = parsePositiveIntLike(
    envValue("CONTRIBUTOR_TOP_LIMIT", String(DEFAULT_CONTRIBUTOR_TOP_LIMIT)),
    DEFAULT_CONTRIBUTOR_TOP_LIMIT
  );
  const configuredJql = String(envValue("CONTRIBUTOR_JQL", "") || "").trim();
  const jql = configuredJql || buildDefaultContributorJql({ project, label });
  const issueFields = [
    "assignee",
    "labels",
    "status",
    "issuelinks",
    ...(teamsFieldId ? [teamsFieldId] : [])
  ];

  const issues = await searchJiraIssues(site, email, token, jql, issueFields);
  const linkedIssueKeys = uniqueSorted(issues.flatMap((issue) => extractLinkedIssueKeys(issue)));
  const linkedIssueTeams = await buildLinkedIssueTeamIndex({
    site,
    email,
    token,
    searchJiraIssues,
    linkedIssueKeys,
    teamsFieldId
  });

  const byContributor = new Map();
  let missingAssigneeCount = 0;
  let missingTeamCount = 0;
  let excludedDuplicateCount = 0;

  for (const issue of issues) {
    const statusLabel = String(issue?.fields?.status?.name || "Unknown").trim() || "Unknown";
    if (normalizeText(statusLabel) === CONTRIBUTOR_DUPLICATE_STATUS) {
      excludedDuplicateCount += 1;
      continue;
    }

    const identity = contributorIdentity(issue);
    if (!identity.assigned) {
      missingAssigneeCount += 1;
      continue;
    }

    const contributorKey = identity.contributorId;
    if (!byContributor.has(contributorKey)) {
      byContributor.set(contributorKey, {
        contributorName: identity.contributorName,
        totalIssues: 0,
        doneIssues: 0,
        activeIssues: 0,
        linkedIssues: 0,
        teams: new Set(),
        linkedTeams: new Set()
      });
    }

    const issueTeams = readFieldValues(issue?.fields?.[teamsFieldId]);
    if (issueTeams.length === 0) missingTeamCount += 1;

    const linkedKeys = extractLinkedIssueKeys(issue);
    const linkedTeams = uniqueSorted(linkedKeys.flatMap((key) => linkedIssueTeams.get(key) || []));
    const isDone = normalizeText(issue?.fields?.status?.statusCategory?.name) === "done";
    const row = byContributor.get(contributorKey);
    row.totalIssues += 1;
    if (isDone) row.doneIssues += 1;
    else row.activeIssues += 1;
    row.linkedIssues += linkedKeys.length;
    for (const team of issueTeams) row.teams.add(team);
    for (const linkedTeam of linkedTeams) row.linkedTeams.add(linkedTeam);
  }

  const ranked = [...byContributor.values()].sort((left, right) => {
    if (right.totalIssues !== left.totalIssues) return right.totalIssues - left.totalIssues;
    if (right.doneIssues !== left.doneIssues) return right.doneIssues - left.doneIssues;
    return String(left.contributorName || "").localeCompare(String(right.contributorName || ""));
  });
  const topRows = ranked.slice(0, topLimit);
  const chartRows = topRows.map((row) => ({
    contributor: String(row.contributorName || "Unknown"),
    totalIssues: toCount(row.totalIssues),
    doneIssues: toCount(row.doneIssues),
    activeIssues: toCount(row.activeIssues)
  }));
  const summary = {
    total_issues: chartRows.reduce((sum, row) => sum + toCount(row.totalIssues), 0),
    active_issues: chartRows.reduce((sum, row) => sum + toCount(row.activeIssues), 0),
    done_issues: chartRows.reduce((sum, row) => sum + toCount(row.doneIssues), 0),
    total_contributors: chartRows.length,
    linked_issues: topRows.reduce((sum, row) => sum + toCount(row.linkedIssues), 0)
  };

  logger.log(
    `Computed contributors snapshot (${summary.total_issues} issues across ${summary.total_contributors} contributors, duplicates excluded=${excludedDuplicateCount}).`
  );

  return {
    updatedAt: new Date().toISOString(),
    source: {
      project,
      label,
      jql
    },
    summary,
    chartData: {
      rows: chartRows
    },
    quality: {
      missing_assignee_count: missingAssigneeCount,
      missing_team_count: missingTeamCount,
      excluded_duplicate_count: excludedDuplicateCount
    }
  };
}

export async function refreshBusinessUnitUatChartData(options = {}) {
  const logger = options.logger || console;
  const envValue = options.envValue || ((_, fallback = "") => fallback);
  const site = String(options.site || "").trim();
  const email = String(options.email || "").trim();
  const token = String(options.token || "").trim();
  const searchJiraIssues = options.searchJiraIssues;
  const fetchIssueChangelog = options.fetchIssueChangelog;
  const mapWithConcurrency = options.mapWithConcurrency;

  if (typeof searchJiraIssues !== "function") {
    throw new Error("refreshBusinessUnitUatChartData requires searchJiraIssues.");
  }
  if (typeof fetchIssueChangelog !== "function") {
    throw new Error("refreshBusinessUnitUatChartData requires fetchIssueChangelog.");
  }
  if (typeof mapWithConcurrency !== "function") {
    throw new Error("refreshBusinessUnitUatChartData requires mapWithConcurrency.");
  }

  const project = String(envValue("UAT_PROJECT", "TFC") || "").trim();
  const issueType = String(envValue("UAT_ISSUE_TYPE", "") || "").trim();
  const label = String(envValue("UAT_LABEL", "Broadcast") || "").trim();
  const devStatuses = parseEnvList(
    envValue("BUSINESS_UNIT_DEV_STATUSES", DEFAULT_FLOW_DEV_STATUSES.join(",")),
    DEFAULT_FLOW_DEV_STATUSES
  );
  const uatStatuses = parseEnvList(
    envValue("BUSINESS_UNIT_UAT_STATUSES", DEFAULT_FLOW_UAT_STATUSES.join(",")),
    DEFAULT_FLOW_UAT_STATUSES
  );
  const doneStatuses = parseEnvList(
    envValue("BUSINESS_UNIT_DONE_STATUSES", DEFAULT_FLOW_DONE_STATUSES.join(",")),
    DEFAULT_FLOW_DONE_STATUSES
  );
  const facilityFieldId = String(
    envValue("UAT_FACILITY_FIELD", DEFAULT_FACILITY_FIELD) || ""
  ).trim();
  const businessUnitFieldId = String(
    envValue("UAT_BUSINESS_UNIT_FIELD", DEFAULT_BUSINESS_UNIT_FIELD) || ""
  ).trim();
  const changelogConcurrency = parsePositiveIntLike(
    envValue("BUSINESS_UNIT_CHANGELOG_CONCURRENCY", "6"),
    6
  );
  const doneCacheOverlapDays = parsePositiveIntLike(
    envValue(
      "BUSINESS_UNIT_DONE_CACHE_OVERLAP_DAYS",
      String(DEFAULT_BUSINESS_UNIT_DONE_CACHE_OVERLAP_DAYS)
    ),
    DEFAULT_BUSINESS_UNIT_DONE_CACHE_OVERLAP_DAYS
  );
  const doneCacheMaxAgeDays = parsePositiveIntLike(
    envValue(
      "BUSINESS_UNIT_DONE_CACHE_MAX_AGE_DAYS",
      String(DEFAULT_BUSINESS_UNIT_DONE_CACHE_MAX_AGE_DAYS)
    ),
    DEFAULT_BUSINESS_UNIT_DONE_CACHE_MAX_AGE_DAYS
  );
  const forceDoneCacheRebuild = parseBooleanLike(
    envValue("BUSINESS_UNIT_DONE_REBUILD_ALL", "false"),
    false
  );

  const fields = [
    "priority",
    "created",
    "status",
    "updated",
    ...(facilityFieldId ? [facilityFieldId] : []),
    ...(businessUnitFieldId ? [businessUnitFieldId] : [])
  ];
  const nowIso = new Date().toISOString();
  const runStartedAt = nowIso;
  const computeIssueRow = async (issue) => {
    const issueKey = String(issue?.key || "").trim();
    if (!issueKey) return null;
    const changelog = await fetchIssueChangelog(site, email, token, issueKey);
    const metrics = computeIssueFlowMetrics(issue, changelog, {
      devStatuses,
      uatStatuses,
      doneStatuses,
      nowIso
    });
    return buildBusinessUnitIssueFlowRow(issue, metrics, {
      facilityFieldId,
      businessUnitFieldId
    });
  };

  const ongoingIssues = await searchJiraIssues(
    site,
    email,
    token,
    buildBusinessUnitCurrentUatJql({
      project,
      issueType,
      label,
      uatStatuses
    }),
    fields
  );
  logger.log(`Fetched ${ongoingIssues.length} current UAT issues (${project}, label=${label}).`);

  const ongoingRows = (
    await mapWithConcurrency(ongoingIssues, changelogConcurrency, computeIssueRow)
  )
    .filter(Boolean)
    .filter(
      (row) =>
        row?.metrics?.is_currently_in_uat === true && !String(row?.metrics?.done_at || "").trim()
    );

  const existingDoneCache = await readJsonFile(BUSINESS_UNIT_DONE_CACHE_PATH);
  const shouldRebuildDoneCache =
    forceDoneCacheRebuild ||
    !existingDoneCache ||
    !isDoneCacheSourceMatch(existingDoneCache, {
      project,
      issueType,
      label,
      doneStatuses
    }) ||
    snapshotAgeInDays(existingDoneCache?.updatedAt) > doneCacheMaxAgeDays;
  const doneCacheSource = {
    project,
    issueType,
    label,
    doneStatuses
  };
  const doneCacheRowsByKey = new Map(
    shouldRebuildDoneCache
      ? []
      : (Array.isArray(existingDoneCache?.rows) ? existingDoneCache.rows : []).map((row) => [
          String(row?.key || "").trim(),
          row
        ])
  );
  const doneRefreshJql = shouldRebuildDoneCache
    ? buildBusinessUnitDoneRebuildJql({
        project,
        issueType,
        label,
        doneStatuses
      })
    : buildBusinessUnitIncrementalJql({
        project,
        issueType,
        label,
        updatedSince: shiftIsoDateTime(
          existingDoneCache?.watermarkUpdatedSince || existingDoneCache?.updatedAt,
          -doneCacheOverlapDays
        )
      });
  const doneRefreshIssues = await searchJiraIssues(site, email, token, doneRefreshJql, fields);
  logger.log(
    `Fetched ${doneRefreshIssues.length} ${shouldRebuildDoneCache ? "done-after-UAT rebuild" : "incremental Broadcast update"} issues (${project}, label=${label}).`
  );

  const refreshedDoneRows = (
    await mapWithConcurrency(doneRefreshIssues, changelogConcurrency, computeIssueRow)
  ).filter(Boolean);
  let doneCacheUpserts = 0;
  let doneCacheRemovals = 0;
  for (const row of refreshedDoneRows) {
    const issueKey = String(row?.key || "").trim();
    if (!issueKey) continue;
    if (shouldKeepDoneCacheRow(row)) {
      doneCacheRowsByKey.set(issueKey, createDoneCacheEntry(row));
      doneCacheUpserts += 1;
      continue;
    }
    if (doneCacheRowsByKey.delete(issueKey)) {
      doneCacheRemovals += 1;
    }
  }
  const doneCacheRows = [...doneCacheRowsByKey.values()].filter(shouldKeepDoneCacheRow);
  const doneCache = buildDoneCacheValue({
    rows: doneCacheRows,
    refreshedAt: nowIso,
    watermarkUpdatedSince: runStartedAt,
    source: doneCacheSource
  });
  await writeJsonAtomic(
    BUSINESS_UNIT_DONE_CACHE_PATH,
    BUSINESS_UNIT_DONE_CACHE_TMP_PATH,
    doneCache
  );

  const doneRows = doneCacheRows;
  const ongoingByBusinessUnit = buildBusinessUnitRows(buildFlowByBusinessUnit(ongoingRows));
  const doneByBusinessUnit = buildBusinessUnitRows(buildFlowByBusinessUnit(doneRows));

  logger.log(
    `Computed Business Unit UAT chart data (${ongoingByBusinessUnit.reduce((sum, row) => sum + toCount(row.sampleCount), 0)} ongoing issues, ${doneByBusinessUnit.reduce((sum, row) => sum + toCount(row.sampleCount), 0)} done-after-UAT issues${shouldRebuildDoneCache ? "; rebuilt full done cache" : `; refreshed ${refreshedDoneRows.length} changed issues, upserts ${doneCacheUpserts}, removals ${doneCacheRemovals}`}).`
  );

  return {
    managementBusinessUnit: {
      scopeLabel: label,
      byScope: {
        ongoing: {
          rows: ongoingByBusinessUnit
        },
        done: {
          rows: doneByBusinessUnit
        }
      }
    }
  };
}

function extractStringTokens(value, out = []) {
  if (value == null) return out;
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) extractStringTokens(item, out);
    return out;
  }
  if (typeof value === "object") {
    let foundPreferred = false;
    for (const key of ["value", "name", "displayName", "label", "title"]) {
      if (typeof value[key] === "string") {
        out.push(value[key]);
        foundPreferred = true;
      }
    }
    if (!foundPreferred) {
      for (const nestedKey of ["values", "items", "content", "results", "children", "nodes"]) {
        if (nestedKey in value) {
          extractStringTokens(value[nestedKey], out);
        }
      }
    }
  }
  return out;
}

function mapProductCycleTeams({ teamFieldValue, labels }) {
  const tokens = [
    ...new Set([
      ...extractStringTokens(teamFieldValue).map((item) => normalizeText(item)),
      ...(Array.isArray(labels) ? labels : []).map((label) => normalizeText(label))
    ])
  ];
  const matches = new Set();
  for (const token of tokens) {
    if (!token) continue;
    for (const [team, marker] of PRODUCT_CYCLE_TEAM_MATCHERS) {
      if (token.includes(marker)) matches.add(team);
    }
  }
  const teams = PRODUCT_CYCLE_TEAM_ORDER.filter((team) => matches.has(team));
  return {
    teams,
    primaryTeam: teams[0] || ""
  };
}

function lifecycleStageFromStatus(statusName) {
  const normalized = normalizeText(statusName);
  if (!normalized) return "";
  for (const [stage, aliases] of Object.entries(PRODUCT_CYCLE_STAGE_ALIASES)) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      return stage;
    }
  }
  return "";
}

function applyProductCycleIdeaOverride(issueKey, teamMapping) {
  const override = PRODUCT_CYCLE_IDEA_OVERRIDES[String(issueKey || "").trim()] || null;
  if (!override) {
    return {
      exclude: false,
      teams: teamMapping.teams,
      primaryTeam: teamMapping.primaryTeam
    };
  }
  if (override.exclude) {
    return {
      exclude: true,
      teams: [],
      primaryTeam: ""
    };
  }
  const explicitPrimaryTeam = String(override.primaryTeam || "").trim();
  return {
    exclude: false,
    teams: explicitPrimaryTeam ? [explicitPrimaryTeam] : teamMapping.teams,
    primaryTeam: explicitPrimaryTeam || teamMapping.primaryTeam
  };
}

function archivedAtFromChangelog(changelogHistories) {
  let archivedAt = "";
  let archived = false;

  for (const history of sortHistoriesByCreated(changelogHistories)) {
    const historyAt = asIsoDateTime(history?.created);
    for (const item of history?.items || []) {
      const fieldName = normalizeText(item?.field);
      if (!fieldName.startsWith("idea archived")) continue;
      if (fieldName === "idea archived on") {
        const nextArchivedAt = asIsoDateTime(item?.to) || asIsoDateTime(item?.toString);
        archivedAt = nextArchivedAt || archivedAt || historyAt || "";
        archived = Boolean(archivedAt);
        if (
          !nextArchivedAt &&
          !String(item?.toString || "").trim() &&
          !String(item?.to || "").trim()
        ) {
          archived = false;
          archivedAt = "";
        }
        continue;
      }
      const toValue = normalizeText(item?.toString || item?.to);
      if (!toValue || toValue === "no" || toValue === "false") {
        archived = false;
        archivedAt = "";
        continue;
      }
      archived = true;
      if (!archivedAt) archivedAt = historyAt || "";
    }
  }

  return archived ? archivedAt || null : null;
}

function chooseMostPopulatedFieldId(candidates, issues) {
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  let best = "";
  let bestPopulation = -1;
  let bestCustomId = -1;

  for (const candidate of candidates) {
    let population = 0;
    for (const issue of issues) {
      const tokens = extractStringTokens(issue?.fields?.[candidate.id]).map((value) =>
        normalizeText(value)
      );
      if (tokens.some(Boolean)) population += 1;
    }
    if (
      population > bestPopulation ||
      (population === bestPopulation && Number(candidate.customId) > bestCustomId)
    ) {
      best = String(candidate.id || "");
      bestPopulation = population;
      bestCustomId = Number(candidate.customId) || -1;
    }
  }

  return best;
}

function buildProductCycleIdeaRow(issue, teamsFieldId, changelogHistories) {
  const issueKey = String(issue?.key || "").trim();
  const fields = issue?.fields || {};
  const createdAt = asIsoDateTime(fields?.created);
  const labels = Array.isArray(fields?.labels) ? fields.labels : [];
  const teamMapping = mapProductCycleTeams({
    teamFieldValue: teamsFieldId ? fields?.[teamsFieldId] : null,
    labels
  });
  const teamOverride = applyProductCycleIdeaOverride(issueKey, teamMapping);
  const { lifecycleEvents, enteredAt } = buildLifecycleEventData(changelogHistories);

  const currentStage = lifecycleStageFromStatus(fields?.status?.name);
  if (currentStage && !enteredAt[currentStage]) {
    enteredAt[currentStage] =
      currentStage === "done"
        ? asIsoDateTime(fields?.resolutiondate) || asIsoDateTime(fields?.updated) || createdAt
        : createdAt || asIsoDateTime(fields?.updated);
  }

  const firstLifecycleEvent = lifecycleEvents[0] || null;
  if (
    createdAt &&
    firstLifecycleEvent &&
    firstLifecycleEvent.fromStage === "parking_lot" &&
    enteredAt.parking_lot &&
    enteredAt.parking_lot === firstLifecycleEvent.at
  ) {
    const createdAtMs = new Date(createdAt).getTime();
    const firstEventMs = new Date(firstLifecycleEvent.at).getTime();
    if (
      Number.isFinite(createdAtMs) &&
      Number.isFinite(firstEventMs) &&
      createdAtMs < firstEventMs
    ) {
      enteredAt.parking_lot = createdAt;
    }
  }

  const productAreaField = fields?.[DEFAULT_PRODUCT_CYCLE_PRODUCT_AREA_FIELD];
  const productAreaLabel = Array.isArray(productAreaField)
    ? String(productAreaField[0]?.value || productAreaField[0]?.name || "").trim()
    : String(productAreaField?.value || productAreaField?.name || "").trim();

  return {
    issueKey,
    summary: String(fields?.summary || "").trim(),
    productAreaLabel,
    excludedFromTracking: teamOverride.exclude,
    teams: teamOverride.teams,
    primaryTeam:
      teamOverride.teams.length > 1
        ? PRODUCT_CYCLE_MULTI_TEAM_LABEL
        : teamOverride.primaryTeam || teamMapping.primaryTeam,
    archivedAt: archivedAtFromChangelog(changelogHistories),
    currentStage: currentStage || "",
    lifecycleEvents,
    entered_parking_lot: enteredAt.parking_lot || "",
    entered_design: enteredAt.design || "",
    entered_ready_for_development: enteredAt.ready_for_development || "",
    entered_in_development: enteredAt.in_development || "",
    entered_feedback: enteredAt.feedback || "",
    entered_done: enteredAt.done || ""
  };
}

async function buildProductCycleIdeaRows({
  issues,
  site,
  email,
  token,
  teamsFieldId,
  fetchIssueChangelog,
  mapWithConcurrency,
  changelogConcurrency,
  logger
}) {
  const rows = await mapWithConcurrency(
    Array.isArray(issues) ? issues : [],
    changelogConcurrency,
    async (issue, index) => {
      const issueKey = String(issue?.key || "").trim();
      if (!issueKey) return null;
      if (index === 0 || index === issues.length - 1 || (index + 1) % 25 === 0) {
        logger.log(
          `Product cycle: fetching changelog ${index + 1}/${issues.length} (${issueKey}).`
        );
      }
      const changelog = await fetchIssueChangelog(site, email, token, issueKey);
      return buildProductCycleIdeaRow(
        issue,
        teamsFieldId,
        Array.isArray(changelog?.histories) ? changelog.histories : []
      );
    }
  );
  return rows.filter(Boolean);
}

function sumPhaseDays(phaseTotals, phases) {
  const values = (Array.isArray(phases) ? phases : [])
    .map((phase) => Number(phaseTotals?.[phase]))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return null;
  return round2(values.reduce((sum, value) => sum + value, 0));
}

function computeLifecyclePhaseSpentDays(
  idea,
  phases,
  { includeOpenTail = false, nowIso = "" } = {}
) {
  const phaseSet = new Set(Array.isArray(phases) ? phases : []);
  const totals = Object.fromEntries([...phaseSet].map((phase) => [phase, 0]));
  const safeNowIso = String(nowIso || new Date().toISOString());
  const events = (Array.isArray(idea?.lifecycleEvents) ? idea.lifecycleEvents : [])
    .filter((event) => event && event.at)
    .slice()
    .sort(
      (left, right) => new Date(String(left.at)).getTime() - new Date(String(right.at)).getTime()
    );

  if (events.length === 0) {
    const enteredByPhase = Object.fromEntries(
      [...phaseSet].map((phase) => [phase, String(idea?.[`entered_${phase}`] || "").trim()])
    );
    const timelineEndAt = String(idea?.entered_done || (includeOpenTail ? safeNowIso : "")).trim();
    const orderedPhases = Array.isArray(phases) ? phases : [];
    for (let index = 0; index < orderedPhases.length; index += 1) {
      const phase = orderedPhases[index];
      const startAt = enteredByPhase[phase];
      if (!startAt) continue;
      let endAt = timelineEndAt;
      for (let nextIndex = index + 1; nextIndex < orderedPhases.length; nextIndex += 1) {
        const candidate = enteredByPhase[orderedPhases[nextIndex]];
        if (candidate) {
          endAt = candidate;
          break;
        }
      }
      const delta = diffDays(startAt, endAt);
      if (typeof delta === "number") totals[phase] += delta;
    }
    for (const phase of Object.keys(totals)) totals[phase] = round2(totals[phase]);
    return totals;
  }

  let currentStage = "";
  let currentAt = "";
  const firstEvent = events[0];
  if (phaseSet.has(String(firstEvent?.fromStage || "").trim())) {
    currentStage = String(firstEvent.fromStage || "").trim();
    const enteredAt = String(idea?.[`entered_${currentStage}`] || "").trim();
    const fallbackAt = String(firstEvent?.at || "").trim();
    const enteredAtMs = new Date(enteredAt).getTime();
    const fallbackMs = new Date(fallbackAt).getTime();
    currentAt =
      enteredAt &&
      Number.isFinite(enteredAtMs) &&
      Number.isFinite(fallbackMs) &&
      enteredAtMs <= fallbackMs
        ? enteredAt
        : fallbackAt;
  } else if (phaseSet.has(String(firstEvent?.toStage || "").trim())) {
    currentStage = String(firstEvent.toStage || "").trim();
    currentAt = String(firstEvent?.at || "").trim();
  }

  for (const event of events) {
    const eventAt = String(event?.at || "").trim();
    const delta = diffDays(currentAt, eventAt);
    if (currentStage && phaseSet.has(currentStage) && typeof delta === "number") {
      totals[currentStage] += delta;
    }
    const nextStage = String(event?.toStage || "").trim();
    currentAt = eventAt;
    if (nextStage) currentStage = nextStage;
  }

  const timelineEndAt = String(idea?.entered_done || (includeOpenTail ? safeNowIso : "")).trim();
  const tailDelta = diffDays(currentAt, timelineEndAt);
  if (currentStage && phaseSet.has(currentStage) && typeof tailDelta === "number") {
    totals[currentStage] += tailDelta;
  }

  for (const phase of Object.keys(totals)) totals[phase] = round2(totals[phase]);
  return totals;
}

function resolveOrderedProductCycleTeams(ideas) {
  const includeMultiTeam = (Array.isArray(ideas) ? ideas : []).some((idea) => {
    const primaryTeam = String(idea?.primaryTeam || "").trim();
    const matchedTeams = Array.isArray(idea?.teams) ? idea.teams : [];
    return (
      primaryTeam === PRODUCT_CYCLE_MULTI_TEAM_LABEL ||
      matchedTeams.length > 1 ||
      matchedTeams.includes(PRODUCT_CYCLE_MULTI_TEAM_LABEL)
    );
  });
  const includeUnmapped = (Array.isArray(ideas) ? ideas : []).some((idea) => {
    const primaryTeam = String(idea?.primaryTeam || "").trim();
    return (
      !primaryTeam ||
      (!PRODUCT_CYCLE_TEAM_ORDER.includes(primaryTeam) &&
        primaryTeam !== PRODUCT_CYCLE_MULTI_TEAM_LABEL)
    );
  });
  const orderedTeams = PRODUCT_CYCLE_TEAM_ORDER.slice();
  if (!includeMultiTeam) {
    const multiTeamIndex = orderedTeams.indexOf(PRODUCT_CYCLE_MULTI_TEAM_LABEL);
    if (multiTeamIndex !== -1) orderedTeams.splice(multiTeamIndex, 1);
  }
  return includeUnmapped ? [...orderedTeams, "UNMAPPED"] : orderedTeams;
}

function getIdeaPrimaryMappedTeam(idea, teams) {
  const primaryTeam = String(idea?.primaryTeam || "").trim();
  if (primaryTeam === PRODUCT_CYCLE_MULTI_TEAM_LABEL && teams.includes(primaryTeam)) {
    return primaryTeam;
  }
  if (primaryTeam && teams.includes(primaryTeam)) return primaryTeam;
  return teams.includes("UNMAPPED") ? "UNMAPPED" : "";
}

function buildProductCycleScopeSnapshot(ideas, teams, nowIso) {
  const metricsByTeam = new Map(
    teams.map((team) => [
      team,
      {
        cycleValues: [],
        cycleDoneCount: 0,
        cycleOngoingCount: 0
      }
    ])
  );
  let cycleSampleCount = 0;

  for (const idea of Array.isArray(ideas) ? ideas : []) {
    const phaseTotals = computeLifecyclePhaseSpentDays(idea, PRODUCT_CYCLE_PHASE_KEYS, {
      includeOpenTail: true,
      nowIso
    });
    const cycleDays = sumPhaseDays(phaseTotals, ["in_development", "feedback"]);
    if (!(typeof cycleDays === "number" && cycleDays > 0)) continue;
    const team = getIdeaPrimaryMappedTeam(idea, teams);
    if (!team) continue;
    cycleSampleCount += 1;
    const teamNode = metricsByTeam.get(team);
    teamNode.cycleValues.push(cycleDays);
    if (String(idea?.entered_done || "").trim()) teamNode.cycleDoneCount += 1;
    else teamNode.cycleOngoingCount += 1;
  }

  const rows = teams.map((team) => {
    const metrics = metricsByTeam.get(team) || {
      cycleValues: [],
      cycleDoneCount: 0,
      cycleOngoingCount: 0
    };
    const stats = buildStats(metrics.cycleValues);
    return {
      team,
      cycle: round2(stats.average || 0),
      cycleDoneCount: toCount(metrics.cycleDoneCount),
      cycleOngoingCount: toCount(metrics.cycleOngoingCount),
      meta_cycle: {
        n: toCount(stats.n)
      }
    };
  });

  return {
    scopeLabel: PRODUCT_CYCLE_SCOPE_LABEL,
    sampleCount: cycleSampleCount,
    cycleSampleCount,
    rows
  };
}

function startOfIsoMonth(value) {
  const safeValue = String(value || "").trim();
  if (!safeValue) return "";
  const parsedAt = new Date(safeValue).getTime();
  if (!Number.isFinite(parsedAt)) return "";
  const parsed = new Date(parsedAt);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function startOfCalendarYearIso(value) {
  const safeValue = String(value || "").trim();
  if (!safeValue) return "";
  const parsedAt = new Date(safeValue).getTime();
  if (!Number.isFinite(parsedAt)) return "";
  const parsed = new Date(parsedAt);
  return new Date(Date.UTC(parsed.getUTCFullYear(), PRODUCT_CYCLE_SHIPPED_TIMELINE_START_MONTH, 1))
    .toISOString()
    .slice(0, 10);
}

function addUtcMonths(isoDate, deltaMonths) {
  const safeValue = String(isoDate || "").trim();
  if (!safeValue) return "";
  const parsedAt = new Date(`${safeValue}T00:00:00Z`).getTime();
  if (!Number.isFinite(parsedAt)) return "";
  const parsed = new Date(parsedAt);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + deltaMonths, 1))
    .toISOString()
    .slice(0, 10);
}

function buildMonthRange(startIso, endIso) {
  const safeStart = String(startIso || "").trim();
  const safeEnd = String(endIso || "").trim();
  if (!safeStart || !safeEnd || safeStart > safeEnd) return [];
  const months = [];
  let cursor = safeStart;
  while (cursor && cursor <= safeEnd) {
    months.push(cursor);
    const next = addUtcMonths(cursor, 1);
    if (!next || next === cursor) break;
    cursor = next;
  }
  return months;
}

function buildProductCycleShippedTimelineSnapshot(ideas, teams, nowIso) {
  const doneMonthStarts = (Array.isArray(ideas) ? ideas : [])
    .filter((idea) => String(idea?.currentStage || "").trim() === "done")
    .map((idea) => startOfIsoMonth(String(idea?.entered_done || "").trim()))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const timelineStart = doneMonthStarts.length > 0 ? doneMonthStarts[0] : startOfCalendarYearIso(nowIso);
  const timelineEnd = doneMonthStarts.length > 0 ? doneMonthStarts[doneMonthStarts.length - 1] : startOfIsoMonth(nowIso);
  const monthStarts = buildMonthRange(timelineStart, timelineEnd);
  const buckets = new Map(
    monthStarts.map((monthStart) => [
      monthStart,
      {
        monthStart,
        monthKey: monthStart.slice(0, 7),
        totalShipped: 0,
        teams: []
      }
    ])
  );

  for (const idea of Array.isArray(ideas) ? ideas : []) {
    if (String(idea?.currentStage || "").trim() !== "done") continue;
    const enteredDoneAt = String(idea?.entered_done || "").trim();
    const monthStart = startOfIsoMonth(enteredDoneAt);
    if (!monthStart || !buckets.has(monthStart)) continue;
    const bucket = buckets.get(monthStart);
    const team = getIdeaPrimaryMappedTeam(idea, teams) || "UNMAPPED";
    let teamBucket = bucket.teams.find((row) => String(row?.team || "").trim() === team);
    if (!teamBucket) {
      teamBucket = {
        team,
        shippedCount: 0,
        ideas: []
      };
      bucket.teams.push(teamBucket);
    }
    teamBucket.shippedCount += 1;
    teamBucket.ideas.push({
      issueKey: String(idea?.issueKey || "").trim(),
      productAreaLabel: String(idea?.productAreaLabel || "").trim(),
      summary: String(idea?.summary || "").trim(),
      shippedAt: enteredDoneAt
    });
    bucket.totalShipped += 1;
  }

  const months = monthStarts.map((monthStart) => {
    const bucket = buckets.get(monthStart) || {
      monthStart,
      monthKey: monthStart.slice(0, 7),
      totalShipped: 0,
      teams: []
    };
    const includedTeams = [
      ...teams.filter((team) =>
        bucket.teams.some((teamRow) => String(teamRow?.team || "").trim() === team)
      ),
      ...bucket.teams
        .map((teamRow) => String(teamRow?.team || "").trim())
        .filter(Boolean)
        .filter((team) => !teams.includes(team))
    ];
    const orderedTeamRows = includedTeams
      .map((team) => {
        const teamBucket = bucket.teams.find((row) => String(row?.team || "").trim() === team) || {
          team,
          shippedCount: 0,
          ideas: []
        };
        return {
          team,
          shippedCount: toCount(teamBucket.shippedCount),
          ideas: (Array.isArray(teamBucket.ideas) ? teamBucket.ideas : [])
            .slice()
            .sort((left, right) => {
              const leftAt = String(left?.shippedAt || "").trim();
              const rightAt = String(right?.shippedAt || "").trim();
              if (leftAt !== rightAt) return leftAt.localeCompare(rightAt);
              return String(left?.summary || "").localeCompare(String(right?.summary || ""));
            })
        };
      })
      .filter((teamRow) => teamRow.shippedCount > 0);

    return {
      monthStart,
      monthKey: bucket.monthKey,
      totalShipped: toCount(bucket.totalShipped),
      teamCount: toCount(orderedTeamRows.length),
      teams: orderedTeamRows
    };
  });

  return {
    timelineStart,
    timelineEnd,
    totalShipped: months.reduce((sum, month) => sum + toCount(month?.totalShipped), 0),
    months
  };
}

function resolveCurrentStageTiming(idea) {
  const events = Array.isArray(idea?.lifecycleEvents) ? idea.lifecycleEvents : [];
  const findLatestEntryAt = (stageKey) => {
    const targetStage = String(stageKey || "").trim();
    if (!targetStage) return "";
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (String(event?.toStage || "").trim() === targetStage && String(event?.at || "").trim()) {
        return String(event.at || "").trim();
      }
    }
    return String(idea?.[`entered_${targetStage}`] || "").trim();
  };

  const explicitCurrentStage = String(idea?.currentStage || "").trim();
  if (explicitCurrentStage) {
    const currentStage = explicitCurrentStage === "done" ? "" : explicitCurrentStage;
    return { currentStage, enteredAt: currentStage ? findLatestEntryAt(currentStage) : "" };
  }
  if (String(idea?.entered_done || "").trim()) return { currentStage: "", enteredAt: "" };

  const lastStage = String(events[events.length - 1]?.toStage || "").trim();
  if (lastStage) {
    const currentStage = lastStage === "done" ? "" : lastStage;
    return { currentStage, enteredAt: currentStage ? findLatestEntryAt(currentStage) : "" };
  }

  for (const stage of PRODUCT_CYCLE_PHASE_KEYS.slice().reverse()) {
    const enteredAt = String(idea?.[`entered_${stage}`] || "").trim();
    if (enteredAt) return { currentStage: stage, enteredAt };
  }

  return { currentStage: "", enteredAt: "" };
}

function buildCurrentStageSnapshot(ideas, teams, nowIso) {
  const stageDurationsByTeam = createStageDurationBuckets(PRODUCT_CYCLE_STAGE_DEFS, teams);
  const stageCounts = Object.fromEntries(
    PRODUCT_CYCLE_STAGE_DEFS.map((stageDef) => [stageDef.label, 0])
  );
  let sampleSize = 0;
  const safeNowIso = String(nowIso || new Date().toISOString());

  for (const idea of Array.isArray(ideas) ? ideas : []) {
    if (String(idea?.archivedAt || "").trim()) continue;
    const { currentStage, enteredAt } = resolveCurrentStageTiming(idea);
    const stageDef = PRODUCT_CYCLE_STAGE_DEFS.find((candidate) => candidate.key === currentStage);
    if (!stageDef) continue;
    stageCounts[stageDef.label] += 1;
    sampleSize += 1;
    const team = getIdeaPrimaryMappedTeam(idea, teams);
    if (!team) continue;
    const ageDays = diffDays(enteredAt, safeNowIso);
    if (!(typeof ageDays === "number" && ageDays >= 0)) continue;
    stageDurationsByTeam.get(stageDef.label)[team].push(ageDays);
  }
  const { teamDefs, rows, yUpper } = buildCurrentStageRows(stageDurationsByTeam, teams);

  return {
    yUpper,
    categorySecondaryLabels: Object.fromEntries(
      PRODUCT_CYCLE_STAGE_DEFS.map((stageDef) => [
        stageDef.label,
        `n=${toCount(stageCounts[stageDef.label])}`
      ])
    ),
    teamDefs,
    rows,
    sampleSize
  };
}

export async function refreshProductCycleSnapshot(options = {}) {
  const logger = options.logger || console;
  const envValue = options.envValue || ((_, fallback = "") => fallback);
  const site = String(options.site || "").trim();
  const email = String(options.email || "").trim();
  const token = String(options.token || "").trim();
  const jiraRequest = options.jiraRequest;
  const searchJiraIssues = options.searchJiraIssues;
  const fetchIssueChangelog = options.fetchIssueChangelog;
  const mapWithConcurrency = options.mapWithConcurrency;

  if (typeof jiraRequest !== "function") {
    throw new Error("refreshProductCycleSnapshot requires jiraRequest.");
  }
  if (typeof searchJiraIssues !== "function") {
    throw new Error("refreshProductCycleSnapshot requires searchJiraIssues.");
  }
  if (typeof fetchIssueChangelog !== "function") {
    throw new Error("refreshProductCycleSnapshot requires fetchIssueChangelog.");
  }
  if (typeof mapWithConcurrency !== "function") {
    throw new Error("refreshProductCycleSnapshot requires mapWithConcurrency.");
  }

  const projectKey = String(
    envValue("PRODUCT_CYCLE_PROJECT_KEY", DEFAULT_PRODUCT_CYCLE_PROJECT_KEY) || ""
  ).trim();
  const configuredJql = String(envValue("PRODUCT_CYCLE_JQL", "") || "").trim();
  const configuredTeamsFieldId = String(envValue("PRODUCT_CYCLE_TEAMS_FIELD", "") || "").trim();
  const jql = configuredJql || `project = ${quoteJqlValue(projectKey)} ORDER BY updated DESC`;
  const changelogConcurrency = parsePositiveIntLike(
    envValue(
      "PRODUCT_CYCLE_CHANGELOG_CONCURRENCY",
      String(DEFAULT_PRODUCT_CYCLE_CHANGELOG_CONCURRENCY)
    ),
    DEFAULT_PRODUCT_CYCLE_CHANGELOG_CONCURRENCY
  );

  logger.log("Resolving product-cycle Jira fields.");
  const allFields = await jiraRequest(site, email, token, `https://${site}/rest/api/3/field`);
  const configuredTeamsField = (Array.isArray(allFields) ? allFields : []).find(
    (field) => String(field?.id || "").trim() === configuredTeamsFieldId
  );
  const teamsCandidates = (Array.isArray(allFields) ? allFields : [])
    .filter((field) => normalizeText(field?.name) === "teams")
    .map((field) => ({
      id: String(field?.id || ""),
      customId: Number.isFinite(Number(field?.schema?.customId))
        ? Number(field.schema.customId)
        : -1
    }))
    .filter((candidate) => candidate.id);
  const searchTeamFieldIds = uniqueSorted([
    ...teamsCandidates.map((candidate) => candidate.id),
    ...(configuredTeamsField ? [configuredTeamsFieldId] : [])
  ]);
  const searchFields = [
    "summary",
    "status",
    "labels",
    "created",
    "updated",
    "resolutiondate",
    DEFAULT_PRODUCT_CYCLE_PRODUCT_AREA_FIELD,
    ...searchTeamFieldIds
  ];

  logger.log("Fetching product-cycle issues.");
  const issues = await searchJiraIssues(site, email, token, jql, searchFields);
  if (configuredTeamsFieldId && !configuredTeamsField) {
    logger.warn(
      `Product cycle: PRODUCT_CYCLE_TEAMS_FIELD=${configuredTeamsFieldId} was not found in Jira field metadata; falling back to auto-detect.`
    );
  }
  const teamsFieldId =
    configuredTeamsFieldId && configuredTeamsField
      ? configuredTeamsFieldId
      : chooseMostPopulatedFieldId(teamsCandidates, issues);
  logger.log(
    `Fetched ${issues.length} product-cycle issues${teamsFieldId ? ` (teams field ${teamsFieldId})` : ""}.`
  );

  const ideaRows = await buildProductCycleIdeaRows({
    issues,
    site,
    email,
    token,
    teamsFieldId,
    fetchIssueChangelog,
    mapWithConcurrency,
    changelogConcurrency,
    logger
  });
  const trackedIdeaRows = ideaRows.filter((row) => !row.excludedFromTracking);
  const teams = resolveOrderedProductCycleTeams(trackedIdeaRows);
  const nowIso = new Date().toISOString();
  const leadCycleScope = buildProductCycleScopeSnapshot(trackedIdeaRows, teams, nowIso);
  const currentStageSnapshot = buildCurrentStageSnapshot(trackedIdeaRows, teams, nowIso);
  const shippedTimeline = buildProductCycleShippedTimelineSnapshot(trackedIdeaRows, teams, nowIso);

  logger.log(
    `Computed product-cycle snapshot (${leadCycleScope.cycleSampleCount} ideas with cycle data from ${issues.length} fetched ideas).`
  );

  return {
    generatedAt: nowIso,
    source: {
      projectKey,
      jql,
      fields: {
        teams: teamsFieldId || null
      }
    },
    quality: {
      excluded_idea_count: ideaRows.length - trackedIdeaRows.length,
      missing_team_label_count: trackedIdeaRows.filter(
        (row) => !String(row?.primaryTeam || "").trim()
      ).length
    },
    chartData: {
      fetchedCount: issues.length,
      leadCycleByScope: {
        [PRODUCT_CYCLE_SCOPE_KEY]: leadCycleScope
      },
      currentStageSnapshot
    },
    detailData: {
      shippedTimeline
    }
  };
}
