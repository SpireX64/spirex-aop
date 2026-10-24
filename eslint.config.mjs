import js from "@eslint/js";
import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        files: ["packages/*/src/**/*.{js,mjs,cjs,jsx}"],
        plugins: { js },
        extends: ["js/recommended"],
        rules: {
            "no-var": "off",
        },
    },
]);