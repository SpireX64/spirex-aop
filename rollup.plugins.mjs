import terser from "@rollup/plugin-terser";
import copy from "rollup-plugin-copy";

export function getPackageRollup(config = {}) {
    const {
        umdName = "Lib",
        name = "index",
        entry = "index.js",
        sourceDir = "./src",
        outDir = "./dist",
        release = false,
    } = config;

    const generatedCode = {
        constBindings: false,
        objectShorthand: true,
        moduleSideEffects: false,
    };

    const terserPlugin =
        release &&
        terser({
            ecma: 2018,
            compress: {
                module: true,
                toplevel: true,
                drop_console: true,
                drop_debugger: true,
            },
        });

    const copyTypes = copy({
        targets: [{ src: `${sourceDir}/${name}.d.ts`, dest: outDir }],
    });

    const sourceFile = `${sourceDir}/${entry}`;
    const outFile = `${outDir}/${name}`;

    return [
        {
            input: sourceFile,
            output: {
                name: umdName,
                format: "umd",
                file: `${outFile}.js`,
                sourcemap: release ? false : "inline",
                generatedCode,
            },
            plugins: [terserPlugin],
        },
        {
            input: sourceFile,
            output: {
                file: `${outFile}.mjs`,
                format: "es",
                generatedCode,
            },
            plugins: [copyTypes, terserPlugin],
        },
        {
            input: sourceFile,
            output: {
                file: `${outFile}.cjs`,
                format: "cjs",
                generatedCode,
            },
            plugins: [terserPlugin],
        },
    ];
}
