import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const PRETEXT_LAYOUT_SOURCE = fs.readFileSync("app/dashboard-pretext-layout.js", "utf8");
const BOOTSTRAP_SOURCE = fs.readFileSync("app/dashboard-bootstrap.js", "utf8");

function loadPretextLayoutWithContainer() {
  const container = { innerHTML: "", hidden: false };
  const context = {
    Element: class Element {},
    URL,
    URLSearchParams,
    document: {
      getElementById(id) {
        return id === "panel" ? container : null;
      },
      fonts: { ready: Promise.resolve() }
    },
    window: {
      location: { search: "", origin: "https://tracker.example.test" },
      DashboardRuntimeContract: {
        getSourcePath() {
          return "/vendor/pretext.mjs";
        }
      }
    }
  };
  context.window.document = context.document;
  vm.runInNewContext(PRETEXT_LAYOUT_SOURCE, context, {
    filename: "app/dashboard-pretext-layout.js"
  });
  return { container, layout: context.window.DashboardPretextLayout };
}

test("utility list rows render safe HTTPS links", () => {
  const { container, layout } = loadPretextLayoutWithContainer();

  layout.renderUtilityListPanel("panel", {
    stats: [],
    rows: [
      {
        label: "Safe Jira",
        href: "https://nepgroup.atlassian.net/issues/?jql=project%20%3D%20TPS",
        valueText: "5 issues",
        width: 50
      }
    ]
  });

  assert.match(container.innerHTML, /href="https:\/\/nepgroup\.atlassian\.net\/issues\//);
  assert.match(container.innerHTML, /target="_blank" rel="noopener noreferrer"/);
});

test("utility list rows do not link unsafe href schemes", () => {
  const { container, layout } = loadPretextLayoutWithContainer();

  layout.renderUtilityListPanel("panel", {
    stats: [],
    rows: [
      {
        label: "Unsafe",
        href: "javascript:alert(1)",
        valueText: "5 issues",
        width: 50
      }
    ]
  });

  assert.doesNotMatch(container.innerHTML, /href=/);
  assert.match(container.innerHTML, />Unsafe</);
});

test("default community background heavy preload suppresses user-facing failure status", () => {
  assert.match(
    BOOTSTRAP_SOURCE,
    /loadHeavyDashboard\("all",\s*DEFAULT_SECTION,\s*\{\s*preloadAllSections:\s*true,\s*suppressStatus:\s*true\s*\}\)/
  );
  assert.match(BOOTSTRAP_SOURCE, /if \(!options\.suppressStatus\)/);
});
