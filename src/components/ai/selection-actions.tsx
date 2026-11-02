"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowsLeftRightIcon, ChatCircleIcon, LightbulbIcon } from "@phosphor-icons/react";
import { askSousChef } from "./sous-chef";

/**
 * Highlight any text inside the wrapped region to get quick AI actions
 * (pattern adapted from Beautiful UI's Selection Actions).
 */
export function SelectionActions({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [sel, setSel] = React.useState<{ text: string; x: number; y: number } | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const onUp = () => {
      setTimeout(() => {
        const s = window.getSelection();
        const text = s?.toString().trim() ?? "";
        if (!s || !text || text.length < 2 || text.length > 400 || !ref.current?.contains(s.anchorNode)) return setSel(null);
        const rect = s.getRangeAt(0).getBoundingClientRect();
        setSel({ text, x: rect.left + rect.width / 2, y: rect.top });
      }, 10);
    };
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-selection-actions]")) return;
      setSel(null);
    };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", () => setSel(null), { passive: true });
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("mousedown", onDown);
    };
  }, [enabled]);

  const act = (prompt: string) => {
    askSousChef(prompt);
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div ref={ref}>
      {children}
      {sel &&
        createPortal(
          <div
            data-selection-actions
            className="fixed z-50 flex -translate-x-1/2 -translate-y-full items-stretch border bg-popover text-[11px] shadow-xl animate-in fade-in zoom-in-95"
            style={{ left: sel.x, top: sel.y - 8 }}
          >
            <button className="flex items-center gap-1 px-2 py-1.5 hover:bg-muted" onClick={() => act(`Explain this part of the recipe, including the food science: "${sel.text}"`)}>
              <LightbulbIcon className="text-brand" /> explain
            </button>
            <button className="flex items-center gap-1 border-l px-2 py-1.5 hover:bg-muted" onClick={() => act(`What can I substitute for "${sel.text}" in this recipe? Give 2–3 options with trade-offs, and propose the best one as a change.`)}>
              <ArrowsLeftRightIcon className="text-brand" /> substitute
            </button>
            <button className="flex items-center gap-1 border-l px-2 py-1.5 hover:bg-muted" onClick={() => act(`About "${sel.text}": `)}>
              <ChatCircleIcon className="text-brand" /> ask
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
