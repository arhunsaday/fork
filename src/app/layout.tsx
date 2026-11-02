import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/shell/header";
import { StatusBar } from "@/components/shell/status-bar";
import { aiProvider } from "@/lib/ai";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "fork — recipes, version-controlled", template: "%s · fork" },
  description:
    "Fork, diff and improve recipes like code. Cooking-for-engineers tables, precise scaling, baker's percentages, pantry & shopping list, and an AI sous-chef.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#191714" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          borderRadius: "0px",
          fontFamily: "var(--font-mono)",
          colorPrimary: "var(--brand)",
          colorBackground: "var(--popover)",
          colorForeground: "var(--foreground)",
          colorMutedForeground: "var(--muted-foreground)",
          colorInput: "var(--background)",
          colorInputForeground: "var(--foreground)",
          colorBorder: "var(--border)",
          colorNeutral: "var(--foreground)",
        },
      }}
    >
      <html lang="en" className={mono.variable} suppressHydrationWarning>
        <body className="flex min-h-dvh flex-col">
          <Providers>
            <Header />
            <main className="flex-1 pb-10">{children}</main>
            <StatusBar ai={aiProvider()} />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
