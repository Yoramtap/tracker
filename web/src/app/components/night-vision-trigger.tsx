"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./night-vision-trigger.module.css";

type Mode = "on" | "off";

const BUFFER_LENGTH = 5;
const TOAST_DURATION_MS = 2200;

export default function NightVisionTrigger({
  children,
}: {
  children: React.ReactNode;
}) {
  const bufferRef = useRef("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mode, setMode] = useState<Mode>("off");
  const [toast, setToast] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);

  useEffect(() => {
    const updateHtmlAttribute = () => {
      document.documentElement.dataset.nightVision = mode;
    };

    updateHtmlAttribute();

    return () => {
      document.documentElement.removeAttribute("data-night-vision");
    };
  }, [mode]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;

      const key = event.key.toLowerCase();
      bufferRef.current = `${bufferRef.current}${key}`.slice(-BUFFER_LENGTH);

      if (bufferRef.current.endsWith("night")) {
        setMode((prev) => (prev === "on" ? "off" : "on"));
        bufferRef.current = "";
        return;
      }

      if (bufferRef.current.endsWith("day")) {
        setMode("off");
        bufferRef.current = "";
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    if (!toast) return;

    setIsToastVisible(true);

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
  }, [toast]);

  useEffect(() => {
    setToast(mode === "on" ? "Night Vision on" : "Night Vision off");
  }, [mode]);

  return (
    <>
      {children}
      <div
        className={`${styles.toast} ${isToastVisible ? styles.visible : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </>
  );
}
