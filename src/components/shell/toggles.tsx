"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SpeakerHighIcon, SpeakerSlashIcon, SunIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSound } from "@/components/providers";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={() => setTheme(dark ? "light" : "dark")} data-cuelume-toggle>
          {mounted ? dark ? <MoonIcon /> : <SunIcon /> : <span className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>theme: {mounted ? resolvedTheme : "…"}</TooltipContent>
    </Tooltip>
  );
}

export function SoundToggle() {
  const { enabled, toggle } = useSound();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Toggle interface sounds" onClick={toggle}>
          {enabled ? <SpeakerHighIcon /> : <SpeakerSlashIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>sounds: {enabled ? "on" : "off"}</TooltipContent>
    </Tooltip>
  );
}
