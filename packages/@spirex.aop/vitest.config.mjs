import { defineConfig } from "rollup";
import makeVitestConfig from "../../vitest.base.mjs";

export default defineConfig({ test: makeVitestConfig("@spirex/aop") });
