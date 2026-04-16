import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * Runs the i18n key validator as part of the test suite so `npm test`
 * (and CI) fails when a t() key is missing from en.json or fr.json.
 *
 * The actual logic lives in scripts/check-i18n-keys.mjs so it can also
 * be invoked directly: `node scripts/check-i18n-keys.mjs`.
 */
describe("i18n key coverage", () => {
  it("every t() key exists in both en.json and fr.json", () => {
    const script = resolve(__dirname, "../../scripts/check-i18n-keys.mjs");
    try {
      const output = execSync(`node ${script}`, { encoding: "utf8", stdio: "pipe" });
      expect(output).toContain("All t() keys are present");
    } catch (err: any) {
      // Surface the script's stderr/stdout so failures are actionable in CI logs.
      const detail = [err.stdout, err.stderr].filter(Boolean).join("\n");
      throw new Error(`i18n key check failed:\n${detail}`);
    }
  });
});
