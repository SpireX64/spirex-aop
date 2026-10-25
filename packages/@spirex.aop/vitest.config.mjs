import { defineConfig } from "rollup";
import makeVitestConfig from "../../vitest.base.mjs";

var test = makeVitestConfig("@spirex/aop");
test.coverage.thresholds = {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100,
};

export default defineConfig({ test });
