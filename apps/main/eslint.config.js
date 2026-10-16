import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
    { ignores: [".open-next/**", ".wrangler/**", "public/sw.js", "worker.ts"] },
    ...nextJsConfig,
    {
        // One link component: it prefetches a page's shell on intent instead of every link on screen.
        files: ["**/*.{ts,tsx}"],
        ignores: ["components/app-link.tsx"],
        rules: {
            "no-restricted-imports": ["error", { paths: [{ name: "next/link", message: 'Use `import Link from "@/components/app-link"` (prefetches on intent).' }] }],
        },
    },
];
