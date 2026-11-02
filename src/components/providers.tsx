"use client";

import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/* ───────────── Sound (Cuelume) ───────────── */

type SoundName = import("cuelume").SoundName;
type SoundCtx = { enabled: boolean; toggle: () => void; play: (s: SoundName, o?: { emphasis?: "subtle" | "strong" }) => void };
const SoundContext = React.createContext<SoundCtx>({ enabled: false, toggle: () => {}, play: () => {} });
export const useSound = () => React.useContext(SoundContext);

function SoundProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = React.useState(false);
  const lib = React.useRef<typeof import("cuelume") | null>(null);

  React.useEffect(() => {
    let stored = true;
    try {
      stored = localStorage.getItem("fork:sound") !== "off";
    } catch {}
    import("cuelume").then((m) => {
      lib.current = m;
      m.bind();
      m.setVolume(0.55);
      m.setEnabled(stored);
      setEnabledState(stored);
    });
  }, []);

  const value = React.useMemo<SoundCtx>(
    () => ({
      enabled,
      toggle: () => {
        const next = !enabled;
        setEnabledState(next);
        lib.current?.setEnabled(next);
        if (next) lib.current?.play("toggle");
        try {
          localStorage.setItem("fork:sound", next ? "on" : "off");
        } catch {}
      },
      play: (s, o) => lib.current?.play(s, o as never),
    }),
    [enabled],
  );
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={(resolvedTheme as "light" | "dark") ?? "system"}
      position="bottom-right"
      toastOptions={{ classNames: { toast: "!rounded-none !font-mono !text-xs !border-border" } }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <NuqsAdapter>
        <TooltipProvider delayDuration={250}>
          <SoundProvider>
            {children}
            <ThemedToaster />
          </SoundProvider>
        </TooltipProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
