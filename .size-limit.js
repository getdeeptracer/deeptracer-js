/**
 * Bundle size budgets for browser-facing packages.
 * Run: npm run size
 * @see https://github.com/ai/size-limit
 */
module.exports = [
  {
    name: "@deeptracer/browser (ESM, gzip)",
    path: "packages/browser/dist/index.js",
    import: "*",
    limit: "8 KB",
  },
  {
    name: "@deeptracer/react (ESM, gzip)",
    path: "packages/react/dist/index.js",
    import: "*",
    limit: "12 KB",
    ignore: ["react", "react-dom"],
  },
  {
    name: "@deeptracer/nextjs/client (ESM, gzip)",
    path: "packages/nextjs/dist/client.js",
    import: "*",
    limit: "12 KB",
    ignore: ["react", "react-dom", "next"],
  },
]
