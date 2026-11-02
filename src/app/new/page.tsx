import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { NewRecipe } from "@/components/editor/new-recipe";

export const metadata = { title: "new recipe" };

export default async function NewPage({ searchParams }: PageProps<"/new">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?redirect_url=/new");
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "url";
  return (
    <div className="mx-auto max-w-[1400px] px-3 pt-6 sm:px-5">
      <NewRecipe ai={aiEnabled()} initialTab={tab} username={viewer.username} />
    </div>
  );
}
