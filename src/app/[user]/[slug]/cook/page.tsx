import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/queries";
import { CookMode } from "@/components/recipe/cook-mode";

export const metadata = { title: "cook mode" };

export default async function CookPage({ params, searchParams }: PageProps<"/[user]/[slug]/cook">) {
  const { user, slug } = await params;
  const sp = await searchParams;
  const r = await getRecipe(user, slug);
  if (!r) notFound();
  const servings = Number(sp.servings) || r.head.data.servings;
  return <CookMode recipe={r.head.data} path={`/${user}/${slug}`} factor={servings / r.head.data.servings} />;
}
