"use client";

import * as React from "react";
import { useClerk } from "@clerk/nextjs";
import { toast } from "sonner";

/**
 * Thin abstraction over Clerk for client components, so they keep working in
 * preview mode (no Clerk keys → no ClerkProvider → useClerk would throw).
 */
type AuthUI = { enabled: boolean; openSignIn: () => void };

const AuthUIContext = React.createContext<AuthUI>({
  enabled: false,
  openSignIn: () => toast("Preview mode", { description: "Sign-in is disabled on this deployment (Clerk isn't configured yet)." }),
});

export const useAuthUI = () => React.useContext(AuthUIContext);

/** Mounted inside <ClerkProvider> when auth is enabled. */
export function ClerkBridge({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();
  const value = React.useMemo<AuthUI>(() => ({ enabled: true, openSignIn: () => clerk.openSignIn() }), [clerk]);
  return <AuthUIContext.Provider value={value}>{children}</AuthUIContext.Provider>;
}
