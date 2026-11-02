import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRecipe } from "@/lib/queries";
import { getViewer } from "@/lib/auth";
import { RecipeEditor } from "@/components/editor/recipe-editor";

export const metadata = { title: "edit" };

export default async function EditPage({ params }: PageProps<"/[user]/[slug]/edit">) {
  const { user, slug } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const r = await getRecipe(user, slug);
  if (!r) notFound();
  if (r.recipe.ownerId !== viewer.id) redirect(`/${user}/${slug}`);
  return (
    <div className="mx-auto max-w-[1400px] px-3 pt-5 sm:px-5">
      <p className="mb-4 text-sm">
        <Link href={`/${user}/${slug}`} className="text-muted-foreground hover:text-brand">
          {user}/{slug}
        </Link>
        <span className="text-faint"> / </span>
        <span className="font-semibold">edit</span>
        <span className="ml-3 text-[11px] text-muted-foreground">
          editing on <span className="text-brand">main</span> · every save is a commit
        </span>
      </p>
      <RecipeEditor mode="commit" initial={r.head.data} base={r.head.data} recipeId={r.recipe.id} />
    </div>
  );
}
