import { getPackageRollup } from "../../rollup.plugins.mjs";

const release = process.env.NODE_ENV === "production";

export default getPackageRollup({ umdName: "AOP", release });
