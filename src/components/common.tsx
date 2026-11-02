import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";

/** shields.io-style key/value badge. */
export function Shield({ k, v, tone = "default", className }: { k: string; v: React.ReactNode; tone?: "default" | "brand" | "add" | "del"; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-stretch text-[10.5px] leading-none", className)}>
      <span className="flex items-center bg-foreground/85 px-1.5 text-background">{k}</span>
      <span
        className={cn(
          "flex items-center px-1.5 tabular",
          tone === "default" && "bg-muted text-foreground hairline",
          tone === "brand" && "bg-brand text-brand-foreground",
          tone === "add" && "bg-add text-background",
          tone === "del" && "bg-del text-background",
        )}
      >
        {v}
      </span>
    </span>
  );
}

/** Deterministic 5×5 identicon so seeded/unknown users still get an avatar. */
export function Identicon({ name, size = 24, className, src }: { name: string; size?: number; className?: string; src?: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className={cn("shrink-0 bg-muted object-cover", className)} style={{ width: size, height: size }} />;
  }
  let h = 2166136261;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const hue = Math.abs(h) % 360;
  const cells: boolean[] = [];
  for (let i = 0; i < 15; i++) cells.push(((h >>> i) & 1) === 1);
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 3; x++) {
      if (!cells[y * 3 + x]) continue;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
      if (x < 2) rects.push(<rect key={`m${x}-${y}`} x={4 - x} y={y} width="1" height="1" />);
    }
  return (
    <svg viewBox="-0.5 -0.5 6 6" width={size} height={size} className={cn("shrink-0 bg-muted", className)} style={{ color: `oklch(0.68 0.14 ${hue})` }} aria-hidden>
      <g fill="currentColor">{rects}</g>
    </svg>
  );
}

export function UserLink({ username, className }: { username: string; className?: string }) {
  return (
    <Link href={`/${username}`} className={cn("hover:text-brand hover:underline", className)}>
      {username}
    </Link>
  );
}

export function Ago({ date, className }: { date: Date | string; className?: string }) {
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString()} className={cn("tabular", className)}>
      {formatDistanceToNowStrict(d, { addSuffix: true })}
    </time>
  );
}

export function SectionTitle({ children, right, className }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3 border-b pb-1.5", className)}>
      <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="text-brand">#</span> {children}
      </h2>
      {right}
    </div>
  );
}

export function Empty({ title, children, className }: { title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-grid flex flex-col items-center justify-center gap-2 border border-dashed px-6 py-14 text-center", className)}>
      <p className="text-sm">{title}</p>
      {children && <div className="max-w-md text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

export function shortSha(id: string) {
  return id.slice(0, 7);
}
