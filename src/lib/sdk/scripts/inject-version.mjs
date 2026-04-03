import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sdkRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(sdkRoot, "package.json");
const versionFilePath = path.join(sdkRoot, "version.ts");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";

const output = `export const SDK_VERSION = ${JSON.stringify(version)};\n`;
fs.writeFileSync(versionFilePath, output, "utf8");
