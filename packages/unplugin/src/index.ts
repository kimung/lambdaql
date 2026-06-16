import { createUnplugin } from "unplugin";
import { transform } from "./transform.js";

const INCLUDE = /\.[cm]?[jt]sx?$/;

const plugin = createUnplugin(() => ({
  name: "gamn9",
  transformInclude(id: string) {
    return INCLUDE.test(id);
  },
  transform(code: string, id: string) {
    return transform(code, id);
  },
}));

export const vitePlugin = plugin.vite;
export const rollupPlugin = plugin.rollup;
export const esbuildPlugin = plugin.esbuild;
export const webpackPlugin = plugin.webpack;
