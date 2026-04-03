"use strict";

(function initLocalAgentation() {
  function isLocalhost() {
    const host = String(window.location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function createJsxRuntime(React) {
    const createElement = React.createElement.bind(React);
    const Fragment = React.Fragment;

    function normalizeProps(props, key) {
      if (!props || typeof props !== "object") {
        return key === undefined ? props : { children: props, key };
      }
      if (key === undefined) return props;
      return { ...props, key };
    }

    return {
      Fragment,
      jsx(type, props, key) {
        return createElement(type, normalizeProps(props, key));
      },
      jsxs(type, props, key) {
        return createElement(type, normalizeProps(props, key));
      }
    };
  }

  function resetLocalAgentationState() {
    try {
      window.sessionStorage.removeItem("feedback-toolbar-hidden");
    } catch {}

    try {
      window.localStorage.removeItem("feedback-toolbar-position");
    } catch {}
  }

  function showAgentationDebug(message) {
    const existing = document.getElementById("agentation-local-debug");
    if (existing) existing.remove();
    const debugNode = document.createElement("pre");
    debugNode.id = "agentation-local-debug";
    debugNode.textContent = String(message || "Unknown Agentation error");
    debugNode.style.position = "fixed";
    debugNode.style.right = "12px";
    debugNode.style.bottom = "12px";
    debugNode.style.zIndex = "2147483647";
    debugNode.style.maxWidth = "min(560px, calc(100vw - 24px))";
    debugNode.style.maxHeight = "40vh";
    debugNode.style.overflow = "auto";
    debugNode.style.margin = "0";
    debugNode.style.padding = "10px 12px";
    debugNode.style.borderRadius = "10px";
    debugNode.style.background = "rgba(20,20,20,0.94)";
    debugNode.style.color = "#fff";
    debugNode.style.font = "12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace";
    debugNode.style.whiteSpace = "pre-wrap";
    debugNode.style.boxShadow = "0 12px 32px rgba(0,0,0,0.28)";
    document.body.appendChild(debugNode);
  }

  function showAgentationStatus(message) {
    let node = document.getElementById("agentation-local-status");
    if (!node) {
      node = document.createElement("div");
      node.id = "agentation-local-status";
      node.style.position = "fixed";
      node.style.left = "12px";
      node.style.bottom = "12px";
      node.style.zIndex = "2147483646";
      node.style.padding = "6px 10px";
      node.style.borderRadius = "999px";
      node.style.background = "rgba(20,20,20,0.88)";
      node.style.color = "#fff";
      node.style.font = "12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace";
      document.body.appendChild(node);
    }
    node.textContent = String(message || "");
  }

  function updateAgentationMountStatus() {
    window.requestAnimationFrame(() => {
      const rootNode = document.getElementById("agentation-local-root");
      const toolbarCount = document.querySelectorAll("[data-feedback-toolbar]").length;
      const childCount = rootNode ? rootNode.childElementCount : 0;
      showAgentationStatus(`agentation: mounted root=${childCount} toolbar=${toolbarCount}`);
    });
  }

  function forceVisibleLocalToolbar() {
    let attempts = 0;
    const intervalId = window.setInterval(() => {
      attempts += 1;
      const toolbarShell = document.querySelector('[data-feedback-toolbar][class*="toolbar"]');
      const toolbarContainer = document.querySelector(
        '[data-feedback-toolbar] [class*="toolbarContainer"]'
      );
      if (toolbarShell instanceof HTMLElement) {
        toolbarShell.style.right = "20px";
        toolbarShell.style.bottom = "20px";
        toolbarShell.style.left = "auto";
        toolbarShell.style.top = "auto";
        toolbarShell.style.opacity = "1";
        toolbarShell.style.visibility = "visible";
        toolbarShell.style.pointerEvents = "auto";
        toolbarShell.style.zIndex = "2147483645";
      }
      if (toolbarContainer instanceof HTMLElement) {
        toolbarContainer.style.opacity = "1";
        toolbarContainer.style.visibility = "visible";
        toolbarContainer.style.pointerEvents = "auto";
        toolbarContainer.style.minWidth = "44px";
        toolbarContainer.style.minHeight = "44px";
      }
      if ((toolbarShell && toolbarContainer) || attempts >= 20) {
        window.clearInterval(intervalId);
      }
    }, 100);
  }

  function loadAgentationScript(onReady, onError) {
    const previousRequire = window.require;
    const previousModule = window.module;
    const previousExports = window.exports;
    const previousProcess = window.process;
    const cjsModule = { exports: {} };
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    const jsxRuntime = createJsxRuntime(React);
    const processShim =
      window.process && typeof window.process === "object"
        ? {
            ...window.process,
            env: {
              ...(window.process.env && typeof window.process.env === "object"
                ? window.process.env
                : {}),
              NODE_ENV: "development"
            }
          }
        : { env: { NODE_ENV: "development" } };
    function restoreGlobals() {
      if (previousRequire === undefined) delete window.require;
      else window.require = previousRequire;

      if (previousModule === undefined) delete window.module;
      else window.module = previousModule;

      if (previousExports === undefined) delete window.exports;
      else window.exports = previousExports;

      if (previousProcess === undefined) window.process = processShim;
      else window.process = previousProcess;
    }
    const localRequire = function require(specifier) {
      if (specifier === "react") return React;
      if (specifier === "react-dom") return ReactDOM;
      if (specifier === "react/jsx-runtime") return jsxRuntime;
      throw new Error(`Unsupported Agentation dependency: ${specifier}`);
    };
    window.require = localRequire;
    window.module = cjsModule;
    window.exports = cjsModule.exports;
    window.process = processShim;

    const script = document.createElement("script");
    script.src = "./node_modules/agentation/dist/index.js";
    script.async = true;
    script.onload = function handleLoad() {
      showAgentationStatus("agentation: exports ready");
      onReady(cjsModule.exports || {}, restoreGlobals);
    };
    script.onerror = function handleError(event) {
      restoreGlobals();
      onError(event);
    };
    document.head.appendChild(script);
  }

  function mountAgentation(exportsObject) {
    const Agentation = exportsObject?.Agentation;
    if (typeof Agentation !== "function") {
      throw new Error("Agentation export not found.");
    }
    showAgentationStatus("agentation: mounting");
    class AgentationErrorBoundary extends window.React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }

      componentDidCatch(error) {
        this.setState({ error });
      }

      render() {
        if (this.state.error) {
          showAgentationDebug(
            this.state.error?.stack || this.state.error?.message || String(this.state.error)
          );
          return null;
        }
        return this.props.children;
      }
    }
    const mountNode = document.createElement("div");
    mountNode.id = "agentation-local-root";
    document.body.appendChild(mountNode);
    const root = window.ReactDOM.createRoot(mountNode);
    root.render(
      window.React.createElement(
        AgentationErrorBoundary,
        null,
        window.React.createElement(Agentation)
      )
    );
    updateAgentationMountStatus();
    forceVisibleLocalToolbar();
  }

  if (!isLocalhost()) return;
  if (!window.React || !window.ReactDOM || typeof window.ReactDOM.createRoot !== "function") return;
  if (document.getElementById("agentation-local-root")) return;

  showAgentationStatus("agentation: booting");
  resetLocalAgentationState();

  loadAgentationScript(
    (exportsObject, restoreGlobals) => {
      try {
        mountAgentation(exportsObject);
        restoreGlobals();
      } catch (error) {
        restoreGlobals();
        showAgentationDebug(error?.stack || error?.message || String(error));
        console.warn("Agentation local loader failed to mount.", error);
      }
    },
    (error) => {
      showAgentationDebug(error?.stack || error?.message || String(error));
      console.warn("Agentation local loader failed to load the package script.", error);
    }
  );
})();
