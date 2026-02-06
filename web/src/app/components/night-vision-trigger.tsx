"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import styles from "./night-vision-trigger.module.css";

type Mode = "on" | "off";

const BUFFER_LENGTH = 5;
const TOAST_DURATION_MS = 2200;
const STORAGE_KEY = "night-vision-mode";

type NightVisionContextValue = {
  mode: Mode;
  setMode: (mode: Mode) => void;
};

const NightVisionContext = createContext<NightVisionContextValue | null>(null);

export const useNightVision = () => {
  const ctx = useContext(NightVisionContext);
  if (!ctx) {
    throw new Error("useNightVision must be used within NightVisionTrigger");
  }
  return ctx;
};

export default function NightVisionTrigger({
  children,
}: {
  children: React.ReactNode;
}) {
  const bufferRef = useRef("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mode, setMode] = useState<Mode>("on");
  const [isHydrated, setIsHydrated] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastTick, setToastTick] = useState(0);
  const [isToastVisible, setIsToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastTick((prev) => prev + 1);
    setIsToastVisible(true);
  };

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "on" || stored === "off") {
      setMode(stored);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const updateHtmlAttribute = () => {
      document.documentElement.dataset.nightVision = mode;
    };

    updateHtmlAttribute();
    if (isHydrated) {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }

    return () => {
      document.documentElement.removeAttribute("data-night-vision");
    };
  }, [mode, isHydrated]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;

      const key = event.key.toLowerCase();
      bufferRef.current = `${bufferRef.current}${key}`.slice(-BUFFER_LENGTH);

      if (bufferRef.current.endsWith("night")) {
        setMode((prev) => {
          const next = prev === "on" ? "off" : "on";
          showToast(next === "on" ? "Night Vision on" : "Night Vision off");
          return next;
        });
        bufferRef.current = "";
        return;
      }

      if (bufferRef.current.endsWith("day")) {
        setMode("off");
        showToast("Night Vision off");
        bufferRef.current = "";
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsToastVisible(false);
      timeoutRef.current = null;
    }, TOAST_DURATION_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [toastMessage, toastTick]);

  return (
    <NightVisionContext.Provider value={{ mode, setMode }}>
      {children}
      <div
        className={`${styles.toast} ${isToastVisible ? styles.visible : ""}`}
        role="status"
        aria-live="polite"
      >
        {toastMessage}
      </div>
    </NightVisionContext.Provider>
  );
}
