import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WASM/data files relative to its own module URL.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Preview mode runs PGlite inside serverless functions: ship its WASM/data files and our SQL migrations.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*", "./node_modules/@electric-sql/pglite/dist/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
