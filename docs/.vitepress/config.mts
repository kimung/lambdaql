import { defineConfig } from "vitepress";

export default defineConfig({
  title: "LambdaQL",
  description: "Type-safe SQL query builder using TypeScript lambda expressions",
  base: "/lambdaql/",

  head: [["link", { rel: "icon", href: "/lambdaql/favicon.svg" }]],

  themeConfig: {
    logo: "/logo.svg",

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/queryable" },
      { text: "Integrations", link: "/integrations/pg" },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "AOT Compiler", link: "/guide/aot-compiler" },
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "Queryable<T>", link: "/api/queryable" },
          { text: "DML Helpers", link: "/api/dml" },
        ],
      },
      {
        text: "Integrations",
        items: [
          { text: "PostgreSQL", link: "/integrations/pg" },
          { text: "SQLite", link: "/integrations/sqlite" },
          { text: "MikroORM", link: "/integrations/mikro-orm" },
          { text: "Vite / esbuild / Rollup / webpack", link: "/integrations/unplugin" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/kimung/lambdaql" }],

    search: { provider: "local" },

    footer: {
      message: "Released under the MIT License.",
    },
  },
});
