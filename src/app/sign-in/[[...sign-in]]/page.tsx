import { SignIn } from "@clerk/nextjs";
import { Logo } from "@/components/shell/logo";

export const metadata = { title: "sign in" };

export default function SignInPage() {
  return (
    <div className="bg-grid flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center gap-6 px-3 py-10">
      <Logo className="scale-150" />
      <SignIn />
    </div>
  );
}
