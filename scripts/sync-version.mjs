/**
 * Sync SDK_VERSION in packages/core/src/version.ts
 * from packages/core/package.json.
 *
 * Run after `changeset version` to keep version.ts in sync.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkg = JSON.parse(
  readFileSync(resolve(root, "packages/core/package.json"), "utf8"),
);
const version = pkg.version;

const versionFile = resolve(root, "packages/core/src/version.ts");
const content = `/** SDK version. Update on each release. */\nexport const SDK_VERSION = "${version}"\nexport const SDK_NAME = "core"\n`;

writeFileSync(versionFile, content);
console.log(`Synced SDK_VERSION to ${version}`);
