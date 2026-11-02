import { cn } from "@/lib/utils";

/** GitHub-style contribution heatmap: last 53 weeks of commits + builds. */
export function ContributionGraph({ data }: { data: Record<string, { commits: number; cooks: number }> }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 52 * 7 - today.getUTCDay());
  const weeks: { date: Date; n: number; cooks: number }[][] = [];
  const d = new Date(start);
  while (d <= today) {
    const week: { date: Date; n: number; cooks: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const key = d.toISOString().slice(0, 10);
      const v = data[key];
      week.push({ date: new Date(d), n: v ? v.commits + v.cooks : 0, cooks: v?.cooks ?? 0 });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);
  const cls = ["bg-muted", "bg-brand/30", "bg-brand/55", "bg-brand/80", "bg-brand"];
  const months: { label: string; col: number }[] = [];
  weeks.forEach((w, i) => {
    const m = w[0].date.getUTCMonth();
    if (i === 0 || m !== weeks[i - 1][0].date.getUTCMonth()) months.push({ label: w[0].date.toLocaleString("en", { month: "short", timeZone: "UTC" }), col: i });
  });

  return (
    <div className="overflow-x-auto border bg-card p-3">
      <div className="relative ml-6 h-4 text-[9.5px] text-muted-foreground" style={{ width: weeks.length * 12 }}>
        {months.map((m) => (
          <span key={m.col} className="absolute" style={{ left: m.col * 12 }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="flex gap-0.5">
        <div className="mr-1 flex w-5 flex-col gap-0.5 text-[9px] text-muted-foreground">
          {["", "mon", "", "wed", "", "fri", ""].map((l, i) => (
            <span key={i} className="h-2.5 leading-2.5">
              {l}
            </span>
          ))}
        </div>
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {w.map((day) => (
              <span
                key={day.date.toISOString()}
                title={`${day.date.toISOString().slice(0, 10)}: ${day.n} contribution${day.n === 1 ? "" : "s"}${day.cooks ? ` (${day.cooks} cooked)` : ""}`}
                className={cn("size-2.5", day.date > today ? "opacity-0" : cls[level(day.n)])}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[9.5px] text-muted-foreground">
        less
        {cls.map((c) => (
          <span key={c} className={cn("size-2.5", c)} />
        ))}
        more
      </div>
    </div>
  );
}
