import { SignIn } from "@clerk/nextjs";
import { Logo } from "@/components/shell/logo";
import { authEnabled } from "@/lib/config";

export const metadata = { title: "sign in" };

export default function SignInPage() {
  return (
    <div className="bg-grid flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center gap-6 px-3 py-10">
      <Logo className="scale-150" />
      {authEnabled ? (
        <SignIn />
      ) : (
        <p className="max-w-sm border border-dashed bg-background p-4 text-center text-xs text-muted-foreground">
          This deployment is a <span className="text-brand">read-only preview</span>: sign-in is disabled until Clerk keys are configured.
        </p>
      )}
    </div>
  );
}
