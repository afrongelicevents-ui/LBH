import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Messages = Record<string, unknown>;

function load(locale: string): Messages {
  return JSON.parse(
    readFileSync(join(__dirname, "..", "messages", `${locale}.json`), "utf8")
  );
}

function keysOf(obj: Messages, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v)
      ? keysOf(v as Messages, path)
      : [path];
  });
}

const en = load("en");
const locales = ["sn", "nd"] as const;

describe("translation files", () => {
  // Never hard-code text (brief §9): every locale must carry every key.
  for (const locale of locales) {
    it(`${locale}.json has exactly the same keys as en.json`, () => {
      const skipMeta = (k: string) => !k.startsWith("_meta.");
      const enKeys = keysOf(en).filter(skipMeta).sort();
      const other = keysOf(load(locale)).filter(skipMeta).sort();
      expect(other).toEqual(enKeys);
    });

    it(`${locale}.json is marked needs_review until native-speaker sign-off`, () => {
      const meta = load(locale)._meta as { needs_review: boolean };
      expect(meta.needs_review).toBe(true);
    });
  }

  it("public copy contains no USD amounts (no prices on the public site)", () => {
    for (const locale of ["en", ...locales]) {
      const text = JSON.stringify(load(locale));
      expect(text).not.toMatch(/\$\s?\d/);
      expect(text).not.toMatch(/USD\s?\d/);
    }
  });
});
