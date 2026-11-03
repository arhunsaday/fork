"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { PauseIcon, PlayIcon, XIcon } from "@phosphor-icons/react";
import { useSound } from "@/components/providers";
import { cn } from "@/lib/utils";

type Timer = { id: string; label: string; total: number; endsAt: number | null; remaining: number; fired?: boolean };
type Ctx = { timers: Timer[]; start: (id: string, label: string, minutes: number) => void };
const TimersContext = React.createContext<Ctx>({ timers: [], start: () => {} });
export const useTimers = () => React.useContext(TimersContext);

/** Floating dock of kitchen timers started from steps. */
export function TimersProvider({ children }: { children: React.ReactNode }) {
  const [timers, setTimers] = React.useState<Timer[]>([]);
  const [now, setNow] = React.useState(() => Date.now());
  const { play } = useSound();

  React.useEffect(() => {
    if (!timers.some((t) => t.endsAt)) return;
    const id = setInterval(() => {
      const now = Date.now();
      setTimers((ts) =>
        ts.map((t) => {
          if (t.endsAt && !t.fired && t.endsAt <= now) {
            play("attention", { emphasis: "strong" });
            try {
              if ("Notification" in window && Notification.permission === "granted") new Notification(`⏰ ${t.label} — done`);
            } catch {}
            return { ...t, fired: true, remaining: 0 };
          }
          return t;
        }),
      );
      setNow(Date.now());
    }, 500);
    return () => clearInterval(id);
  }, [timers, play]);

  const start = React.useCallback((id: string, label: string, minutes: number) => {
    try {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    } catch {}
    setTimers((ts) => {
      const existing = ts.find((t) => t.id === id);
      const total = minutes * 60000;
      if (existing) return ts.map((t) => (t.id === id ? { ...t, total, endsAt: Date.now() + total, remaining: total, fired: false } : t));
      return [...ts, { id, label, total, endsAt: Date.now() + total, remaining: total }];
    });
  }, []);

  const toggle = (id: string) =>
    setTimers((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        if (t.endsAt) return { ...t, remaining: Math.max(0, t.endsAt - Date.now()), endsAt: null };
        return { ...t, endsAt: Date.now() + t.remaining, fired: false };
      }),
    );
  const remove = (id: string) => setTimers((ts) => ts.filter((t) => t.id !== id));

  return (
    <TimersContext.Provider value={{ timers, start }}>
      {children}
      <div className="fixed right-3 bottom-[5.25rem] z-50 flex flex-col gap-1.5" data-noprint>
        <AnimatePresence>
          {timers.map((t) => {
            const left = t.endsAt ? Math.max(0, t.endsAt - now) : t.remaining;
            const pct = 1 - left / t.total;
            const done = left <= 0;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className={cn("relative w-60 overflow-hidden border bg-popover shadow-lg", done && "border-brand")}
              >
                <div className="absolute inset-y-0 left-0 bg-brand-tint" style={{ width: `${pct * 100}%` }} />
                <div className="relative flex items-center gap-2 px-2.5 py-2 text-xs">
                  <span className={cn("text-base font-bold tabular", done && "animate-pulse text-brand")}>{fmt(left)}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{t.label}</span>
                  {!done && (
                    <button onClick={() => toggle(t.id)} className="p-0.5 hover:text-brand" aria-label={t.endsAt ? "Pause" : "Resume"}>
                      {t.endsAt ? <PauseIcon /> : <PlayIcon />}
                    </button>
                  )}
                  <button onClick={() => remove(t.id)} className="p-0.5 hover:text-brand" aria-label="Dismiss">
                    <XIcon />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </TimersContext.Provider>
  );
}

function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
