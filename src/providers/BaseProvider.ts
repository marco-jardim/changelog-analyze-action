// SPDX-License-Identifier: GPL-3.0
/**
 * BaseProvider — shared helpers for building InsightsV1 from an LLM JSON response.
 */

import type {
  AnalyzeOptions,
  ChangesetV1,
  InsightsCommit,
  InsightsV1,
  NotableFile,
  PromptProfile,
} from "../types.js";

/** Shape of the JSON we expect from the LLM */
interface LLMJsonResponse {
  highlights?: unknown;
  what_changed?: unknown;
  business_impact?: unknown;
  engineering_evolution?: unknown;
  operational_risks?: unknown;
  mitigations?: unknown;
  notable_files?: unknown;
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function ensureString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function ensureNotableFiles(value: unknown): NotableFile[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is NotableFile =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as Record<string, unknown>)["path"] === "string" &&
      typeof (v as Record<string, unknown>)["reason"] === "string"
  );
}

/**
 * Extract the JSON payload from an LLM response that may have wrapping text,
 * markdown fences, or leading/trailing whitespace.
 */
export function extractJson(raw: string): string {
  // Strip markdown code fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  // Find the first { and last }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }

  return raw.trim();
}

/**
 * Build a complete InsightsV1 from parsed LLM JSON output.
 */
export function buildInsightsFromLLMResponse(
  parsed: LLMJsonResponse,
  changeset: ChangesetV1,
  options: AnalyzeOptions,
  providerName: string
): InsightsV1 {
  return {
    schema_version: "1",
    idempotency_key: changeset.idempotency_key,
    repo: changeset.repo,
    from_sha: changeset.from_sha,
    to_sha: changeset.to_sha,
    generated_at: new Date().toISOString(),
    provider: providerName,
    model: options.model,
    prompt_profile: options.promptProfile as PromptProfile,
    language: options.language,
    highlights: ensureStringArray(parsed.highlights),
    what_changed: ensureString(parsed.what_changed),
    business_impact: ensureString(parsed.business_impact),
    engineering_evolution: ensureString(parsed.engineering_evolution),
    operational_risks: ensureStringArray(parsed.operational_risks),
    mitigations: ensureStringArray(parsed.mitigations),
    notable_files: ensureNotableFiles(parsed.notable_files),
    fallback_used: false,
    commits: changeset.commits.map((c): InsightsCommit => ({
      sha: c.sha,
      message: c.message.split("\n")[0]?.trim() ?? c.short_sha,
      author: c.author,
      date: c.timestamp,
    })),
    total_commits: changeset.totals.commit_count,
    total_files_changed: changeset.totals.files_changed,
  };
}
