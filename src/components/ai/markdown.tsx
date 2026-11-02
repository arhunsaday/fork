import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-[13px] leading-relaxed [&_a]:text-brand [&_a]:underline [&_code]:bg-muted [&_code]:px-1 [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-foreground [&_table]:w-full [&_table]:text-xs [&_td]:border [&_td]:px-1.5 [&_th]:border [&_th]:px-1.5 [&_th]:text-left [&_ul]:list-['–_'] [&_ul]:pl-4">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
