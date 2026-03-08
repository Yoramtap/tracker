"use strict";

(function initLocalAgentation() {
  function isLocalhost() {
    const host = String(window.location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function prefersCoarsePointer() {
    return (
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches
    );
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

  function loadAgentationScript(onReady, onError) {
    const previousRequire = window.require;
    const previousModule = window.module;
    const previousExports = window.exports;
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
    }

    window.require = function require(specifier) {
      if (specifier === "react") return React;
      if (specifier === "react-dom") return ReactDOM;
      if (specifier === "react/jsx-runtime") return jsxRuntime;
      throw new Error(`Unsupported Agentation dependency: ${specifier}`);
    };
    window.module = cjsModule;
    window.exports = cjsModule.exports;
    window.process = processShim;

    const script = document.createElement("script");
    script.src = "./node_modules/agentation/dist/index.js";
    script.async = true;
    script.onload = function handleLoad() {
      onReady(cjsModule.exports || {}, restoreGlobals);
    };
    script.onerror = function handleError(event) {
      restoreGlobals();
      onError(event);
    };
    document.head.appendChild(script);
  }

  function mountAgentation(exportsObject, onMounted) {
    const Agentation = exportsObject?.Agentation;
    if (typeof Agentation !== "function") {
      throw new Error("Agentation export not found.");
    }
    const mountNode = document.createElement("div");
    mountNode.id = "agentation-local-root";
    document.body.appendChild(mountNode);
    const root = window.ReactDOM.createRoot(mountNode);
    root.render(window.React.createElement(Agentation));
    if (typeof onMounted === "function") onMounted();
  }

  if (!isLocalhost()) return;
  if (prefersCoarsePointer()) return;
  if (!window.React || !window.ReactDOM || typeof window.ReactDOM.createRoot !== "function") return;
  if (document.getElementById("agentation-local-root")) return;

  loadAgentationScript(
    (exportsObject, restoreGlobals) => {
      try {
        mountAgentation(exportsObject, restoreGlobals);
      } catch (error) {
        restoreGlobals();
        console.warn("Agentation local loader failed to mount.", error);
      }
    },
    (event) => {
      console.warn("Agentation local loader failed to load the package script.", event);
    }
  );
})();
