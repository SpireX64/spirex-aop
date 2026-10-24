import { getPackageRollup } from "../../rollup.plugins.mjs";

const release = process.env.NODE_ENV === "production";

export default [
    ...getPackageRollup({ umdName: "AOP", release }),
    ...getPackageRollup({
        umdName: "AOPAnnotations",
        name: "annotations",
        entry: "annotations.js",
        release,
    }),
];
