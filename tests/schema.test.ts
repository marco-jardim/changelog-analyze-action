/**
 * Tests for schema validation (validateChangesetV1, validateInsightsV1,
 * parseAndValidateChangeset).
 */

import { validateChangesetV1, validateInsightsV1, parseAndValidateChangeset } from "../src/schema.js";
import { SIMPLE_CHANGESET, makeMockInsights } from "./fixtures.js";

describe("validateChangesetV1", () => {
  test("accepts a valid changeset", () => {
    const result = validateChangesetV1(SIMPLE_CHANGESET);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects non-object input", () => {
    const result = validateChangesetV1("not an object");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/not a JSON object/i);
  });

  test("rejects wrong schema_version", () => {
    const result = validateChangesetV1({ ...SIMPLE_CHANGESET, schema_version: "2" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("schema_version"))).toBe(true);
  });

  test("rejects missing commits array", () => {
    const { commits: _commits, ...rest } = SIMPLE_CHANGESET;
    const result = validateChangesetV1({ ...rest, commits: "not-array" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("commits"))).toBe(true);
  });

  test("rejects missing idempotency_key", () => {
    const result = validateChangesetV1({ ...SIMPLE_CHANGESET, idempotency_key: 123 });
    expect(result.valid).toBe(false);
  });

  test("accepts empty commits array (valid for empty ranges)", () => {
    const result = validateChangesetV1({ ...SIMPLE_CHANGESET, commits: [] });
    expect(result.valid).toBe(true);
  });
});

describe("validateInsightsV1", () => {
  test("accepts a valid insights object", () => {
    const insights = makeMockInsights();
    const result = validateInsightsV1(insights);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects missing highlights array", () => {
    const insights = makeMockInsights();
    const asRec = (insights as unknown) as Record<string, unknown>;
    asRec["highlights"] = "not an array";
    const result = validateInsightsV1(asRec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("highlights"))).toBe(true);
  });

  test("rejects non-boolean fallback_used", () => {
    const insights = makeMockInsights();
    const asRec = (insights as unknown) as Record<string, unknown>;
    asRec["fallback_used"] = "yes";
    const result = validateInsightsV1(asRec);
    expect(result.valid).toBe(false);
  });
});

describe("parseAndValidateChangeset", () => {
  test("parses and returns valid changeset", () => {
    const cs = parseAndValidateChangeset(JSON.stringify(SIMPLE_CHANGESET));
    expect(cs.repo).toBe("acme/my-service");
    expect(cs.commits).toHaveLength(3);
  });

  test("throws on malformed JSON", () => {
    expect(() => parseAndValidateChangeset("{not valid json}")).toThrow(
      /Failed to parse changeset JSON/
    );
  });

  test("throws on schema violation with descriptive message", () => {
    const bad = { ...SIMPLE_CHANGESET, schema_version: "9" };
    expect(() => parseAndValidateChangeset(JSON.stringify(bad))).toThrow(
      /Invalid changeset\.v1\.json/
    );
  });
});
