import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getViewer } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { ShoppingList } from "@/components/shopping/shopping-list";

export const metadata = { title: "shopping list" };

export default async function ShoppingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?redirect_url=/shopping");
  const db = await getDb();
  const items = await db.select().from(schema.shoppingItems).where(eq(schema.shoppingItems.userId, viewer.id)).orderBy(asc(schema.shoppingItems.createdAt));
  return (
    <div className="mx-auto max-w-3xl px-3 pt-6 sm:px-5">
      <ShoppingList
        items={items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, unit: i.unit, aisle: i.aisle, checked: i.checked, recipeTitle: i.recipeTitle }))}
      />
    </div>
  );
}
