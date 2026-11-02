import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-grid flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-3 text-center">
      <pre className="text-xs text-muted-foreground">
        <span className="text-del">fatal:</span> repository not found{"\n"}
        <span className="text-faint">error: 404 — no recipe at this path</span>
      </pre>
      <div className="flex gap-3 text-xs">
        <Link href="/" className="text-brand hover:underline">
          cd ~
        </Link>
        <Link href="/explore" className="hover:text-brand">
          explore
        </Link>
      </div>
    </div>
  );
}
