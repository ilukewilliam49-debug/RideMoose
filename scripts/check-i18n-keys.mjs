#!/usr/bin/env node
/**
 * CI guard: scans the source tree for `t("key")` / `t('key')` calls and
 * verifies each key exists in BOTH src/i18n/en.json and src/i18n/fr.json.
 *
 * Exit code 1 (fails the build) if any key is missing from either locale.
 *
 * Usage:
 *   node scripts/check-i18n-keys.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "src");
const EN_PATH = join(SRC, "i18n/en.json");
const FR_PATH = join(SRC, "i18n/fr.json");

const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", "i18n"]);

// Match t("..."), t('...'), t(`...`) — first arg only, no template interpolation.
// Captures the key inside quotes/backticks. Allows optional whitespace.
const T_CALL = /\bt\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (SOURCE_EXTS.has(extname(entry))) files.push(full);
  }
  return files;
}

function flatten(obj, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

function extractKeys(content) {
  const keys = new Set();
  let m;
  while ((m = T_CALL.exec(content)) !== null) {
    const key = m[2];
    // Skip dynamic keys (template literals with ${...}) and empty strings
    if (!key || key.includes("${")) continue;
    keys.add(key);
  }
  return keys;
}

const en = JSON.parse(readFileSync(EN_PATH, "utf8"));
const fr = JSON.parse(readFileSync(FR_PATH, "utf8"));
const enKeys = flatten(en);
const frKeys = flatten(fr);

const files = walk(SRC);
const usedKeys = new Set();
const keyToFiles = new Map();

for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const key of extractKeys(content)) {
    usedKeys.add(key);
    if (!keyToFiles.has(key)) keyToFiles.set(key, []);
    keyToFiles.get(key).push(file.replace(ROOT + "/", ""));
  }
}

const missingEn = [];
const missingFr = [];
for (const key of usedKeys) {
  if (!enKeys.has(key)) missingEn.push(key);
  if (!frKeys.has(key)) missingFr.push(key);
}

const fail = missingEn.length > 0 || missingFr.length > 0;

console.log(`\n📊 i18n check: scanned ${files.length} files, found ${usedKeys.size} unique t() keys`);
console.log(`   en.json: ${enKeys.size} keys · fr.json: ${frKeys.size} keys`);

if (missingEn.length) {
  console.error(`\n❌ Missing from en.json (${missingEn.length}):`);
  for (const k of missingEn.sort()) {
    console.error(`   • ${k}  →  ${keyToFiles.get(k)?.[0] ?? "?"}`);
  }
}
if (missingFr.length) {
  console.error(`\n❌ Missing from fr.json (${missingFr.length}):`);
  for (const k of missingFr.sort()) {
    console.error(`   • ${k}  →  ${keyToFiles.get(k)?.[0] ?? "?"}`);
  }
}

if (fail) {
  console.error(`\n💥 i18n check failed. Add the missing keys to the locale files above.\n`);
  process.exit(1);
}

console.log(`\n✅ All t() keys are present in both en.json and fr.json.\n`);
