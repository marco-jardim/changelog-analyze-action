/**
 * Shared test fixtures for changelog-analyze-action tests.
 */

import type { AnalyzeOptions, ChangesetV1, InsightsV1 } from "../src/types.js";

export const MINIMAL_CHANGESET: ChangesetV1 = {
  schema_version: "1",
  idempotency_key: "abc123-def456",
  repo: "acme/my-service",
  from_sha: "abc1234567890",
  to_sha: "def4567890abc",
  collected_at: "2026-03-27T00:00:00Z",
  commits: [],
  total_stats: {
    commits: 0,
    additions: 0,
    deletions: 0,
    files_changed: 0,
  },
};

export const SIMPLE_CHANGESET: ChangesetV1 = {
  schema_version: "1",
  idempotency_key: "test-key-001",
  repo: "acme/my-service",
  from_sha: "aaa0000000000",
  to_sha: "bbb1111111111",
  collected_at: "2026-03-27T00:00:00Z",
  commits: [
    {
      sha: "aaa000000000000000000000000000000000000",
      short_sha: "aaa0000",
      message: "feat(auth): add OAuth2 support",
      author: "Alice",
      authored_at: "2026-03-27T00:00:00Z",
      files_changed: [
        {
          path: "src/auth/oauth.ts",
          additions: 150,
          deletions: 10,
          change_type: "added",
        },
        {
          path: "src/auth/index.ts",
          additions: 30,
          deletions: 5,
          change_type: "modified",
        },
      ],
      stats: { additions: 180, deletions: 15, files_changed: 2 },
    },
    {
      sha: "bbb111111111111111111111111111111111111",
      short_sha: "bbb1111",
      message: "fix(db): prevent connection leak on timeout",
      author: "Bob",
      authored_at: "2026-03-27T01:00:00Z",
      files_changed: [
        {
          path: "src/db/pool.ts",
          additions: 25,
          deletions: 8,
          change_type: "modified",
        },
      ],
      stats: { additions: 25, deletions: 8, files_changed: 1 },
    },
    {
      sha: "ccc222222222222222222222222222222222222",
      short_sha: "ccc2222",
      message: "chore: update dependencies",
      author: "Carol",
      authored_at: "2026-03-27T02:00:00Z",
      files_changed: [
        {
          path: "package.json",
          additions: 5,
          deletions: 5,
          change_type: "modified",
        },
      ],
      stats: { additions: 5, deletions: 5, files_changed: 1 },
    },
  ],
  total_stats: {
    commits: 3,
    additions: 210,
    deletions: 28,
    files_changed: 4,
  },
};

export const BREAKING_CHANGESET: ChangesetV1 = {
  ...SIMPLE_CHANGESET,
  idempotency_key: "breaking-key-002",
  commits: [
    {
      sha: "ddd333333333333333333333333333333333333",
      short_sha: "ddd3333",
      message: "feat!: remove legacy REST API endpoints",
      author: "Dave",
      authored_at: "2026-03-27T00:00:00Z",
      files_changed: [
        {
          path: "src/api/v1/users.ts",
          additions: 0,
          deletions: 300,
          change_type: "deleted",
        },
      ],
      stats: { additions: 0, deletions: 300, files_changed: 1 },
    },
  ],
  total_stats: { commits: 1, additions: 0, deletions: 300, files_changed: 1 },
};

export const DEFAULT_ANALYZE_OPTIONS: AnalyzeOptions = {
  provider: "fireworks",
  model: "accounts/fireworks/models/llama-v3p1-70b-instruct",
  apiKey: "test-api-key",
  baseUrl: "",
  maxTokens: 2000,
  promptProfile: "executive",
  language: "en",
  fallbackOnError: true,
};

export const SAMPLE_LLM_JSON_RESPONSE = {
  highlights: ["OAuth2 authentication added", "DB connection leak fixed"],
  what_changed: "Two main changes: OAuth2 support was added and a database connection leak was fixed.",
  business_impact: "Users can now log in via OAuth2. The DB fix improves reliability.",
  engineering_evolution: "Auth module expanded; DB pool refactored for safer cleanup.",
  operational_risks: ["OAuth2 integration requires new environment variables"],
  mitigations: ["Document required OAuth2 env vars in runbook"],
  notable_files: [
    { path: "src/auth/oauth.ts", reason: "New OAuth2 implementation" },
    { path: "src/db/pool.ts", reason: "Connection leak fix" },
  ],
};

export function makeMockInsights(overrides?: Partial<InsightsV1>): InsightsV1 {
  return {
    schema_version: "1",
    idempotency_key: "test-key-001",
    repo: "acme/my-service",
    from_sha: "aaa0000000000",
    to_sha: "bbb1111111111",
    generated_at: "2026-03-27T00:00:00Z",
    provider: "fireworks",
    model: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    prompt_profile: "executive",
    language: "en",
    highlights: ["Feature added", "Bug fixed"],
    what_changed: "Some changes were made.",
    business_impact: "Positive impact.",
    engineering_evolution: "Architecture improved.",
    operational_risks: [],
    mitigations: [],
    notable_files: [],
    fallback_used: false,
    ...overrides,
  };
}
