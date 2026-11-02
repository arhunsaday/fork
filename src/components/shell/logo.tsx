import { cn } from "@/lib/utils";

/** fork logo: a git-fork glyph drawn as a whisk-ish branch + wordmark with a blinking cursor. */
export function Logo({ className, cursor = true }: { className?: string; cursor?: boolean }) {
  return (
    <span className={cn("group inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <svg viewBox="0 0 24 24" className="size-5 text-brand transition-transform group-hover:-rotate-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden>
        <circle cx="6" cy="4.5" r="2" />
        <circle cx="18" cy="4.5" r="2" />
        <circle cx="12" cy="19.5" r="2" />
        <path d="M6 6.5v2.5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V6.5M12 12v5.5" />
      </svg>
      <span className="text-[15px]">
        fork
        {cursor && <span className="ml-px inline-block w-[0.55em] animate-blink text-brand">_</span>}
      </span>
    </span>
  );
}
