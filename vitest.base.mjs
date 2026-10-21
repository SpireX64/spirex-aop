// @ts-check

/** @returns {import('vitest/config').ViteUserConfig['test']} */
export default function makeVitestConfig(/** @type {string} */ packageName) {
    return {
        name: packageName,
        root: "./src",
        exclude: [
            "**/node_modules/**",
            "**/{dist,build,coverage}/**",
            "**/.{idea,git,cache,output,temp}/**",
            "**/{rollup,vitest,eslint,prettier}.config.*",
            "**/__test__/*.{test,spec}.ts",
        ],
        coverage: {
            provider: "istanbul",
            reporter: ["text", "lcov", "html"],
            reportsDirectory: "./coverage",
        },
        clearMocks: true,
    };
}