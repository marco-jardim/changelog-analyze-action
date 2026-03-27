/**
 * Tests for prompt building — structure, content, and language handling.
 */

import { buildPrompt } from "../src/prompt.js";
import { MINIMAL_CHANGESET, SIMPLE_CHANGESET } from "./fixtures.js";

describe("buildPrompt – structure", () => {
  test("returns systemPrompt and userPrompt strings", () => {
    const { systemPrompt, userPrompt } = buildPrompt(SIMPLE_CHANGESET, "executive", "en");
    expect(typeof systemPrompt).toBe("string");
    expect(typeof userPrompt).toBe("string");
    expect(systemPrompt.length).toBeGreaterThan(50);
    expect(userPrompt.length).toBeGreaterThan(50);
  });

  test("systemPrompt includes schema description", () => {
    const { systemPrompt } = buildPrompt(SIMPLE_CHANGESET, "executive", "en");
    expect(systemPrompt).toContain("highlights");
    expect(systemPrompt).toContain("what_changed");
    expect(systemPrompt).toContain("business_impact");
    expect(systemPrompt).toContain("operational_risks");
  });

  test("systemPrompt instructs against hallucination", () => {
    const { systemPrompt } = buildPrompt(SIMPLE_CHANGESET, "executive", "en");
    expect(systemPrompt).toMatch(/hallucinate|only make claims/i);
  });

  test("userPrompt includes repo name", () => {
    const { userPrompt } = buildPrompt(SIMPLE_CHANGESET, "executive", "en");
    expect(userPrompt).toContain("acme/my-service");
  });

  test("userPrompt includes commit messages", () => {
    const { userPrompt } = buildPrompt(SIMPLE_CHANGESET, "executive", "en");
    expect(userPrompt).toContain("feat(auth): add OAuth2 support");
  });

  test("userPrompt does NOT include raw patch/diff content", () => {
    const { userPrompt } = buildPrompt(SIMPLE_CHANGESET, "executive", "en");
    // Our prompt only has summaries — no @@ hunk markers
    expect(userPrompt).not.toContain("@@");
    expect(userPrompt).not.toContain("diff --git");
  });
});

describe("buildPrompt – profile variations", () => {
  test("executive profile mentions C-suite/business focus", () => {
    const { systemPrompt } = buildPrompt(SIMPLE_CHANGESET, "executive", "en");
    expect(systemPrompt).toMatch(/executive|business|C-suite/i);
  });

  test("technical profile mentions engineering/architecture", () => {
    const { systemPrompt } = buildPrompt(SIMPLE_CHANGESET, "technical", "en");
    expect(systemPrompt).toMatch(/technical|architecture|engineering/i);
  });

  test("brief profile enforces short output", () => {
    const { systemPrompt } = buildPrompt(SIMPLE_CHANGESET, "brief", "en");
    expect(systemPrompt).toMatch(/compact|concise|short/i);
  });
});

describe("buildPrompt – language handling", () => {
  test("en profile instructs English output", () => {
    const { systemPrompt } = buildPrompt(SIMPLE_CHANGESET, "executive", "en");
    expect(systemPrompt).toContain("English");
  });

  test("pt-BR profile instructs Portuguese output", () => {
    const { systemPrompt } = buildPrompt(SIMPLE_CHANGESET, "executive", "pt-BR");
    expect(systemPrompt).toContain("Português Brasileiro");
  });
});

describe("buildPrompt – edge cases", () => {
  test("handles empty changeset without throwing", () => {
    expect(() => buildPrompt(MINIMAL_CHANGESET, "executive", "en")).not.toThrow();
  });

  test("empty changeset userPrompt notes no commits", () => {
    const { userPrompt } = buildPrompt(MINIMAL_CHANGESET, "executive", "en");
    expect(userPrompt).toContain("No commits");
  });

  test("snapshot: executive/en prompt shape is stable", () => {
    const { systemPrompt, userPrompt } = buildPrompt(SIMPLE_CHANGESET, "executive", "en");
    // Snapshot test — ensures the prompt structure doesn't drift silently
    expect(systemPrompt).toMatchSnapshot();
    expect(userPrompt).toMatchSnapshot();
  });
});
