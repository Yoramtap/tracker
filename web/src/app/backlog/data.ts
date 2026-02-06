export type BugIssue = {
  key: string;
  summary: string;
  status: "To Do" | "In Progress" | "Blocked" | "Done";
  statusLabel: string;
  priority: "Highest" | "High" | "Medium" | "Low";
  createdAt: string;
  jiraUrl: string;
};

type BoardConfig = {
  boardId: number;
  boardName: string;
  backlogUrl: string;
  jql?: string;
  bugs: BugIssue[];
  trend?: TrendPoint[];
};

export type CountRow = {
  label: string;
  count: number;
  percent: number;
};

export type BoardBacklogReport = {
  boardId: number;
  boardName: string;
  backlogUrl: string;
  jql?: string;
  bugs: BugIssue[];
  trend?: TrendPoint[];
  statusRows: CountRow[];
  priorityRows: CountRow[];
  agingRows: CountRow[];
  totals: {
    total: number;
    open: number;
    blocked: number;
    olderThan30: number;
  };
};

export type TrendPoint = {
  date: string;
  highest: number;
  high: number;
  medium: number;
  low: number;
  lowest: number;
};

export const backlogSource = {
  mode: "mcp_snapshot",
  syncedAt: "2026-02-06T18:46:00.748Z",
  note: "Backlog trends are generated from Jira historical JQL snapshots (status and priority as-of each date).",
};

const SHARED_BOARD_JQL =
  "project IN (TFC) AND type IN (Bug) AND labels = Frontend AND status NOT IN (Done, \"Won't Fix\") AND priority IN (Highest, High, Medium, Low, Lowest) ORDER BY priority DESC";
const BOARD_46_JQL =
  "project IN (TFC) AND type IN (Bug) AND labels = NewFrontend AND status NOT IN (Done, \"Won't Fix\") AND priority IN (Highest, High, Medium) ORDER BY priority DESC";
const BOARD_38_JQL =
  "project IN (TFC) AND type IN (Bug) AND labels = API AND status NOT IN (Done, \"Won't Fix\", Duplicate) AND priority IN (Highest, High, Medium, Low, Lowest) ORDER BY created DESC";

const BOARD_46_BUGS: BugIssue[] = [
  {
    key: "TFC-15536",
    summary: "Fix `assignTagToProduction.cy` e2e test case issue",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Medium",
    createdAt: "2025-12-02",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-15536",
  },
  {
    key: "TFC-15106",
    summary: "Device UI - The steal popup should not appear when assigning a blind tag",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Medium",
    createdAt: "2025-10-23",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-15106",
  },
  {
    key: "TFC-13384",
    summary: "Async autocomplete - Assigning items with special charaters not working as expected",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Medium",
    createdAt: "2025-02-19",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-13384",
  },
];

const BOARD_39_BUGS: BugIssue[] = [
  {
    key: "TFC-14817",
    summary: "Legacy - Incorrect tag assigned to flow in device setup page",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Medium",
    createdAt: "2025-09-24",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-14817",
  },
  {
    key: "TFC-13638",
    summary: "(SD) Panels - Tooltip for Head buttons just says head instead of displaying info",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2025-03-21",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-13638",
  },
  {
    key: "TFC-13584",
    summary: "(SD) Panel Multi-targets deselect",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2025-03-12",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-13584",
  },
  {
    key: "TFC-12487",
    summary: "Panel UI - Parameter section element update not working",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-09-17",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-12487",
  },
  {
    key: "TFC-12419",
    summary: "Panel UI - Target tracking button spill concept issue",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-09-04",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-12419",
  },
  {
    key: "TFC-12296",
    summary: "Panel UI - Newly created software section element was added wrongly",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-08-25",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-12296",
  },
  {
    key: "TFC-12292",
    summary: "Panel UI - Hide heading tooltip text change",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-08-23",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-12292",
  },
  {
    key: "TFC-12291",
    summary: "Public panel - Category button edit context menu issue",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-08-23",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-12291",
  },
  {
    key: "TFC-12230",
    summary: "Panel UI - EDIT Mode - R/C section jumped buttons not updating corrrectly",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-08-07",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-12230",
  },
  {
    key: "TFC-12180",
    summary: "Panel UI - Layout button was not reordering in layout container",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-07-31",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-12180",
  },
  {
    key: "TFC-12175",
    summary: "Panel UI - MV container edit showing error loading swal",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-07-30",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-12175",
  },
  {
    key: "TFC-12153",
    summary: "Panel UI - Section duplicate is missing Route and Tally button name",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-07-29",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-12153",
  },
  {
    key: "TFC-12026",
    summary: "Panel UI - Tally lamp tooltips not showing on tags",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-07-15",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-12026",
  },
  {
    key: "TFC-11991",
    summary: "Panel UI - Multi source badge remove issue",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-07-10",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-11991",
  },
  {
    key: "TFC-11978",
    summary: "Panel UI - Section lock issue while duplicating",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-07-09",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-11978",
  },
  {
    key: "TFC-11848",
    summary: "Panel UI - We should not add buttons in spilled sections based on WS trigger",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-06-21",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-11848",
  },
  {
    key: "TFC-11799",
    summary: "Panel UI - Take should not blink with active tally button",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-06-17",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-11799",
  },
  {
    key: "TFC-11774",
    summary: "Panel UI - After edited MV container duplicate not working",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-06-13",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-11774",
  },
  {
    key: "TFC-11698",
    summary: "Panel UI - Section jump from Add More button not working sometimes",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-06-04",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-11698",
  },
  {
    key: "TFC-11570",
    summary: "Panel UI - Should not allow drop SW section buttons in tracking and GPIO sections",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2024-05-16",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-11570",
  },
];

const BOARD_38_BUGS: BugIssue[] = [
  {
    key: "TFC-15956",
    summary: "uSVC Bundle: Fix default header inheritance in AbstractControllerTest",
    status: "In Progress",
    statusLabel: "In Review",
    priority: "Medium",
    createdAt: "2026-02-07",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-15956",
  },
  {
    key: "TFC-15953",
    summary: "Auth: prevent user from promoting own role",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "High",
    createdAt: "2026-02-06",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-15953",
  },
  {
    key: "TFC-15915",
    summary: "API Golang SDK: Stop using mcache",
    status: "In Progress",
    statusLabel: "QA / Lab Testing",
    priority: "Medium",
    createdAt: "2026-01-30",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-15915",
  },
  {
    key: "TFC-15800",
    summary: "Savestate uSVC: Test fails randomly",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Medium",
    createdAt: "2026-01-13",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-15800",
  },
  {
    key: "TFC-15674",
    summary: "Saved states loading tags onto devices not checked into production",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Medium",
    createdAt: "2025-12-19",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-15674",
  },
  {
    key: "TFC-15312",
    summary: "Recalling a stream/tag savestate will clear all tag associations",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Medium",
    createdAt: "2025-11-14",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-15312",
  },
  {
    key: "TFC-15258",
    summary: "Savestate uSVC: Avoid error when creating a very large entity",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2025-11-07",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-15258",
  },
  {
    key: "TFC-15198",
    summary: "Tag uSVC: update routestate failed: source has no flow with level audio1",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2025-11-03",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-15198",
  },
  {
    key: "TFC-15151",
    summary: "Configuration Usvc: Add tfc-backup-restore-listener-bundle dependency",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2025-10-28",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-15151",
  },
  {
    key: "TFC-13406",
    summary: "TFC UI/Savestate Processor - Recall all incorrectly loading tag attributes",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2025-02-22",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-13406",
  },
  {
    key: "TFC-13360",
    summary: "Api Gateway: Investigate authentication on POST /images",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Low",
    createdAt: "2025-02-15",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-13360",
  },
  {
    key: "TFC-11030",
    summary: "Savestate Processor - Recalling Audio level also recalls all breakaway routes",
    status: "To Do",
    statusLabel: "Backlog",
    priority: "Medium",
    createdAt: "2024-03-12",
    jiraUrl: "https://nepgroup.atlassian.net/browse/TFC-11030",
  },
];

const BOARD_38_TREND: TrendPoint[] = [
  { date: "2025-06-23", highest: 0, high: 1, medium: 9, low: 2, lowest: 0 },
  { date: "2025-07-07", highest: 0, high: 1, medium: 7, low: 2, lowest: 0 },
  { date: "2025-08-04", highest: 0, high: 2, medium: 5, low: 2, lowest: 0 },
  { date: "2025-08-18", highest: 0, high: 2, medium: 8, low: 2, lowest: 0 },
  { date: "2025-09-01", highest: 0, high: 2, medium: 8, low: 2, lowest: 0 },
  { date: "2025-09-15", highest: 0, high: 3, medium: 6, low: 2, lowest: 0 },
  { date: "2025-09-30", highest: 1, high: 2, medium: 7, low: 2, lowest: 0 },
  { date: "2025-10-13", highest: 1, high: 2, medium: 4, low: 2, lowest: 0 },
  { date: "2025-10-27", highest: 0, high: 2, medium: 4, low: 2, lowest: 0 },
  { date: "2025-11-10", highest: 0, high: 0, medium: 4, low: 5, lowest: 0 },
  { date: "2025-11-24", highest: 0, high: 0, medium: 4, low: 5, lowest: 0 },
  { date: "2025-12-08", highest: 0, high: 0, medium: 5, low: 5, lowest: 0 },
  { date: "2026-01-19", highest: 0, high: 0, medium: 6, low: 5, lowest: 0 },
  { date: "2026-02-02", highest: 0, high: 0, medium: 6, low: 5, lowest: 0 },
];

const BOARD_46_TREND: TrendPoint[] = [
  { date: "2025-06-23", highest: 0, high: 0, medium: 1, low: 0, lowest: 0 },
  { date: "2025-07-07", highest: 0, high: 0, medium: 1, low: 0, lowest: 0 },
  { date: "2025-08-04", highest: 0, high: 0, medium: 1, low: 0, lowest: 0 },
  { date: "2025-08-18", highest: 0, high: 0, medium: 1, low: 0, lowest: 0 },
  { date: "2025-09-01", highest: 0, high: 0, medium: 1, low: 0, lowest: 0 },
  { date: "2025-09-15", highest: 0, high: 0, medium: 1, low: 0, lowest: 0 },
  { date: "2025-09-30", highest: 0, high: 0, medium: 1, low: 0, lowest: 0 },
  { date: "2025-10-13", highest: 0, high: 0, medium: 2, low: 0, lowest: 0 },
  { date: "2025-10-27", highest: 0, high: 0, medium: 4, low: 0, lowest: 0 },
  { date: "2025-11-10", highest: 0, high: 1, medium: 6, low: 0, lowest: 0 },
  { date: "2025-11-24", highest: 0, high: 0, medium: 5, low: 0, lowest: 0 },
  { date: "2025-12-08", highest: 0, high: 0, medium: 8, low: 0, lowest: 0 },
  { date: "2026-01-19", highest: 0, high: 0, medium: 3, low: 0, lowest: 0 },
  { date: "2026-02-02", highest: 0, high: 0, medium: 3, low: 0, lowest: 0 },
];

const BOARD_39_TREND: TrendPoint[] = [
  { date: "2025-06-23", highest: 0, high: 2, medium: 33, low: 56, lowest: 3 },
  { date: "2025-07-07", highest: 0, high: 2, medium: 34, low: 56, lowest: 3 },
  { date: "2025-08-04", highest: 0, high: 1, medium: 31, low: 55, lowest: 3 },
  { date: "2025-08-18", highest: 0, high: 1, medium: 24, low: 57, lowest: 3 },
  { date: "2025-09-01", highest: 0, high: 1, medium: 11, low: 48, lowest: 2 },
  { date: "2025-09-15", highest: 0, high: 2, medium: 9, low: 46, lowest: 2 },
  { date: "2025-09-30", highest: 0, high: 2, medium: 10, low: 45, lowest: 2 },
  { date: "2025-10-13", highest: 0, high: 1, medium: 12, low: 45, lowest: 2 },
  { date: "2025-10-27", highest: 0, high: 1, medium: 12, low: 45, lowest: 2 },
  { date: "2025-11-10", highest: 0, high: 1, medium: 12, low: 45, lowest: 2 },
  { date: "2025-11-24", highest: 0, high: 1, medium: 9, low: 46, lowest: 2 },
  { date: "2025-12-08", highest: 0, high: 1, medium: 8, low: 47, lowest: 2 },
  { date: "2026-01-19", highest: 0, high: 1, medium: 6, low: 47, lowest: 2 },
  { date: "2026-02-02", highest: 0, high: 1, medium: 4, low: 35, lowest: 0 },
];

const BOARD_CONFIGS: BoardConfig[] = [
  {
    boardId: 46,
    boardName: "TFC React FE",
    backlogUrl: "https://nepgroup.atlassian.net/jira/software/c/projects/TFC/boards/46/backlog",
    jql: BOARD_46_JQL,
    bugs: BOARD_46_BUGS,
    trend: BOARD_46_TREND,
  },
  {
    boardId: 39,
    boardName: "TFC Legacy FE",
    backlogUrl: "https://nepgroup.atlassian.net/jira/software/c/projects/TFC/boards/39/backlog",
    jql: SHARED_BOARD_JQL,
    bugs: BOARD_39_BUGS,
    trend: BOARD_39_TREND,
  },
  {
    boardId: 38,
    boardName: "TFC API",
    backlogUrl: "https://nepgroup.atlassian.net/jira/software/c/projects/TFC/boards/38/backlog",
    jql: BOARD_38_JQL,
    bugs: BOARD_38_BUGS,
    trend: BOARD_38_TREND,
  },
];

const statusOrder: BugIssue["status"][] = ["Blocked", "In Progress", "To Do", "Done"];
const priorityOrder: BugIssue["priority"][] = ["Highest", "High", "Medium", "Low"];

function buildRows<T extends string>(labels: T[], values: T[]) {
  const total = values.length || 1;
  return labels.map((label) => {
    const count = values.filter((value) => value === label).length;
    return {
      label,
      count,
      percent: Math.round((count / total) * 100),
    };
  });
}

function getAgingBucket(createdAt: string) {
  const created = new Date(`${createdAt}T00:00:00Z`);
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const ageDays = Math.floor((now.getTime() - created.getTime()) / msPerDay);

  if (ageDays <= 7) {
    return "0-7 days";
  }
  if (ageDays <= 14) {
    return "8-14 days";
  }
  if (ageDays <= 30) {
    return "15-30 days";
  }
  return "31+ days";
}

function buildBoardReport(config: BoardConfig): BoardBacklogReport {
  const bugs = [...config.bugs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const statusRows = buildRows(
    statusOrder,
    bugs.map((bug) => bug.status),
  );
  const priorityRows = buildRows(
    priorityOrder,
    bugs.map((bug) => bug.priority),
  );
  const agingRows = buildRows(
    ["0-7 days", "8-14 days", "15-30 days", "31+ days"],
    bugs.map((bug) => getAgingBucket(bug.createdAt)),
  );

  const openCount = bugs.filter((bug) => bug.status !== "Done").length;
  const blockedCount = bugs.filter((bug) => bug.status === "Blocked").length;
  const olderThan30Count = bugs.filter((bug) => getAgingBucket(bug.createdAt) === "31+ days").length;

  return {
    boardId: config.boardId,
    boardName: config.boardName,
    backlogUrl: config.backlogUrl,
    jql: config.jql,
    bugs,
    trend: config.trend,
    statusRows,
    priorityRows,
    agingRows,
    totals: {
      total: bugs.length,
      open: openCount,
      blocked: blockedCount,
      olderThan30: olderThan30Count,
    },
  };
}

export function getBoardBacklogReports() {
  return BOARD_CONFIGS.map((config) => buildBoardReport(config));
}
