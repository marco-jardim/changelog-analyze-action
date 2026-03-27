/**
 * Tests for heuristic fallback analysis.
 */

import { generateFallbackInsights } from "../src/fallback.js";
import {
  MINIMAL_CHANGESET,
  SIMPLE_CHANGESET,
  BREAKING_CHANGESET,
  DEFAULT_ANALYZE_OPTIONS,
} from "./fixtures.js";
import { validateInsightsV1 } from "../src/schema.js";

describe("generateFallbackInsights – output schema", () => {
  test("produces a schema-valid InsightsV1", () => {
    const insights = generateFallbackInsights(SIMPLE_CHANGESET, DEFAULT_ANALYZE_OPTIONS);
    const result = validateInsightsV1(insights);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("always sets fallback_used to true", () => {
    const insights = generateFallbackInsights(SIMPLE_CHANGESET, DEFAULT_ANALYZE_OPTIONS);
    expect(insights.fallback_used).toBe(true);
  });

  test("preserves changeset metadata", () => {
    const insights = generateFallbackInsights(SIMPLE_CHANGESET, DEFAULT_ANALYZE_OPTIONS);
    expect(insights.idempotency_key).toBe(SIMPLE_CHANGESET.idempotency_key);
    expect(insights.repo).toBe(SIMPLE_CHANGESET.repo);
    expect(insights.from_sha).toBe(SIMPLE_CHANGESET.from_sha);
    expect(insights.to_sha).toBe(SIMPLE_CHANGESET.to_sha);
  });
});

describe("generateFallbackInsights – empty changeset", () => {
  test("handles empty commits without throwing", () => {
    expect(() =>
      generateFallbackInsights(MINIMAL_CHANGESET, DEFAULT_ANALYZE_OPTIONS)
    ).not.toThrow();
  });

  test("what_changed notes no commits when empty", () => {
    const insights = generateFallbackInsights(MINIMAL_CHANGESET, DEFAULT_ANALYZE_OPTIONS);
    expect(insights.what_changed).toMatch(/No commits/i);
  });

  test("produces empty highlights array for empty changeset", () => {
    const insights = generateFallbackInsights(MINIMAL_CHANGESET, DEFAULT_ANALYZE_OPTIONS);
    expect(Array.isArray(insights.highlights)).toBe(true);
  });
});

describe("generateFallbackInsights – commit analysis", () => {
  test("detects feat commits in highlights", () => {
    const insights = generateFallbackInsights(SIMPLE_CHANGESET, DEFAULT_ANALYZE_OPTIONS);
    const allText = JSON.stringify(insights);
    expect(allText).toMatch(/feature/i);
  });

  test("detects breaking changes as operational risk", () => {
    const insights = generateFallbackInsights(BREAKING_CHANGESET, DEFAULT_ANALYZE_OPTIONS);
    expect(insights.operational_risks.length).toBeGreaterThan(0);
    expect(insights.operational_risks.some((r) => /breaking/i.test(r))).toBe(true);
  });

  test("produces mitigations when there are risks", () => {
    const insights = generateFallbackInsights(BREAKING_CHANGESET, DEFAULT_ANALYZE_OPTIONS);
    expect(insights.mitigations.length).toBeGreaterThan(0);
  });

  test("notable_files contains most-changed files", () => {
    const insights = generateFallbackInsights(SIMPLE_CHANGESET, DEFAULT_ANALYZE_OPTIONS);
    expect(Array.isArray(insights.notable_files)).toBe(true);
    if (insights.notable_files.length > 0) {
      expect(typeof insights.notable_files[0]?.path).toBe("string");
      expect(typeof insights.notable_files[0]?.reason).toBe("string");
    }
  });
});
