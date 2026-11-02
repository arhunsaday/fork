import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { getViewer } from "@/lib/auth";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { CommandMenu } from "./command-menu";
import { ThemeToggle, SoundToggle } from "./toggles";
import { Button } from "@/components/ui/button";

export async function Header() {
  const viewer = await getViewer().catch(() => null);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-2 px-3 sm:px-5">
        <Link href="/" className="mr-2 shrink-0" data-cuelume-navigate aria-label="fork home">
          <Logo />
        </Link>
        <NavLinks username={viewer?.username ?? null} />
        <div className="ml-auto flex items-center gap-1">
          <CommandMenu username={viewer?.username ?? null} />
          <SoundToggle />
          <ThemeToggle />
          <Show when="signed-in">
            <Button asChild size="sm" className="ml-1 hidden bg-brand text-brand-foreground hover:bg-brand/85 sm:inline-flex" data-cuelume-tap>
              <Link href="/new">+ new recipe</Link>
            </Button>
            <div className="ml-2 flex size-8 items-center justify-center">
              <UserButton appearance={{ elements: { avatarBox: "!rounded-none !size-7" } }} />
            </div>
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button size="sm" variant="outline" className="ml-1" data-cuelume-tap>
                sign in
              </Button>
            </SignInButton>
          </Show>
        </div>
      </div>
    </header>
  );
}
