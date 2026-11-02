// End-to-end smoke test: node e2e/smoke.mjs (dev server on :3000, Clerk dev keys in .env.local)
// Needs an existing Clerk user with E2E_EMAIL (create one in the Clerk dashboard or via the Backend API).
import { createRequire } from "node:module";
// Uses the globally installed Playwright (resolved via NODE_PATH) or a local one.
const { chromium } = createRequire(import.meta.url)("playwright");
import { clerkSetup, clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.SHOTS ?? "e2e/shots";
const email = process.env.E2E_EMAIL ?? "chef+clerk_test@example.com";

process.env.CLERK_PUBLISHABLE_KEY ??= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
await clerkSetup();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = async (name, fn) => {
  process.stdout.write(`• ${name} … `);
  try {
    await fn();
    console.log("ok");
  } catch (e) {
    console.log("FAIL\n  " + e.message.split("\n")[0]);
    await page.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, "-")}.png` });
    process.exitCode = 1;
  }
};
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });

await setupClerkTestingToken({ page });
await page.goto(BASE + "/explore");
await step("sign in", async () => {
  await clerk.signIn({ page, emailAddress: email }); // sign-in token via CLERK_SECRET_KEY
  await page.goto(BASE + "/");
  await page.waitForSelector("text=+ new recipe", { timeout: 20000 });
});

let forkPath = "";
await step("fork a recipe", async () => {
  await page.goto(BASE + "/sous_vide_sam/country-sourdough");
  await page.getByRole("button", { name: /^fork/ }).click();
  await page.waitForURL(/\/test_chef\/country-sourdough/, { timeout: 20000 });
  forkPath = new URL(page.url()).pathname;
  await page.waitForSelector("text=forked from");
});

await step("edit + commit", async () => {
  await page.goto(BASE + forkPath + "/edit");
  const qty = page.locator('input[inputmode="decimal"]').first();
  await qty.fill("475");
  await page.getByPlaceholder(/commit message/).fill("+25 g bread flour for a stiffer dough");
  await shot("editor");
  await page.getByRole("button", { name: /commit to main/ }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/edit"), { timeout: 20000 });
  await page.goto(BASE + forkPath + "/history");
  await page.waitForSelector("text=+25 g bread flour");
  await shot("history-after-commit");
});

await step("pantry presets", async () => {
  await page.goto(BASE + "/pantry");
  await page.getByRole("button", { name: "+ baking basics" }).click();
  await page.waitForSelector("text=vanilla extract", { timeout: 15000 });
  await page.getByRole("button", { name: "+ kitchen kit" }).click();
  await page.waitForSelector("text=loaf pan", { timeout: 15000 });
  await shot("pantry");
});

await step("recipe → shopping list", async () => {
  await page.goto(BASE + "/ada_bakes/banana-nut-bread?view=steps");
  await page.waitForSelector("text=pantry match");
  await shot("recipe-steps-signed-in");
  await page.getByRole("button", { name: /add missing/ }).click();
  await page.waitForSelector("text=shopping list", { timeout: 15000 });
  await page.goto(BASE + "/weeknight-chili".replace("/", "/kernel_cook/"));
  await page.getByRole("button", { name: /add all/ }).click();
  await page.waitForTimeout(1500);
  await page.goto(BASE + "/shopping");
  await page.waitForSelector("text=walnuts");
  await page.locator('button[role="checkbox"]').first().click();
  await shot("shopping");
});

await step("star + log build", async () => {
  await page.goto(BASE + "/fork/pate-a-choux");
  await page.getByRole("button", { name: /^star/ }).click();
  await page.waitForSelector("text=starred");
  await page.getByRole("button", { name: /cooked it/ }).click();
  await page.getByPlaceholder(/notes:/).fill("Hollow and crisp. 235 g egg.");
  await page.getByRole("button", { name: "log build" }).click();
  await page.waitForSelector("text=Build logged", { timeout: 15000 });
});

await step("import pasted text", async () => {
  await page.goto(BASE + "/new?tab=text");
  await page.locator("textarea").fill(
    "Lemon Curd\nBright, tart, silky.\nMakes 300 ml\n\nIngredients\n3 eggs\n150 g sugar\n2 lemons, zested and juiced\n80 g butter, cubed\n\nMethod\n1. Whisk the eggs, sugar, lemon zest and juice in a saucepan.\n2. Cook over low heat, stirring constantly, for 8 minutes until thick.\n3. Remove from heat and whisk in the butter.\n4. Strain and chill for 2 hours.",
  );
  await page.getByRole("button", { name: /convert|offline/ }).first().click();
  await page.waitForSelector("text=imported", { timeout: 30000 });
  await shot("import-review");
  await page.getByRole("button", { name: /create recipe/ }).click();
  await page.waitForURL(/\/test_chef\/lemon-curd/, { timeout: 20000 });
  await shot("imported-recipe");
});

await step("cook mode", async () => {
  await page.goto(BASE + "/ada_bakes/banana-nut-bread/cook");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
  await shot("cook-mode");
});

await step("sous-chef offline state", async () => {
  await page.goto(BASE + "/ada_bakes/banana-nut-bread");
  await page.getByRole("button", { name: /sous-chef/ }).click();
  await page.waitForSelector("text=/AI is offline|I've read the recipe/", { timeout: 10000 });
  await shot("sous-chef");
});

await step("profile", async () => {
  await page.goto(BASE + "/test_chef");
  await page.waitForSelector("text=lemon-curd");
  await shot("my-profile");
});

console.log(errors.length ? `page errors:\n  ${[...new Set(errors)].join("\n  ")}` : "no page errors");
await browser.close();
