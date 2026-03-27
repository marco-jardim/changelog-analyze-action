// SPDX-License-Identifier: GPL-3.0
/**
 * Prompt construction for different profiles and languages.
 * Builds structured prompts that instruct the LLM to produce
 * JSON matching the InsightsV1 schema.
 *
 * IMPORTANT: We never include raw diffs — only commit messages and
 * file-change summaries to keep token usage efficient and secure.
 */

import type {
  ChangesetV1,
  CommitEntry,
  FileChange,
  PromptProfile,
  SupportedLanguage,
} from "./types.js";

// ─── Token-budget helpers ────────────────────────────────────────────────────

/** Hard limit on commit entries we include verbatim before summarising */
const MAX_COMMITS_VERBATIM = 40;
/** Hard limit on notable-files entries we list per commit */
const MAX_FILES_PER_COMMIT = 8;

function summariseFileChanges(files: FileChange[]): string {
  if (files.length === 0) return "no files tracked";
  const shown = files.slice(0, MAX_FILES_PER_COMMIT);
  const extra = files.length - shown.length;
  const lines = shown.map(
    (f) =>
      `  ${f.change_type.toUpperCase().padEnd(8)} ${f.path} (+${f.additions}/-${f.deletions})`
  );
  if (extra > 0) lines.push(`  …and ${extra} more file(s)`);
  return lines.join("\n");
}

function formatCommitBlock(commit: CommitEntry): string {
  return [
    `SHA: ${commit.short_sha}`,
    `Author: ${commit.author}`,
    `Date: ${commit.authored_at}`,
    `Message: ${commit.message}`,
    `Stats: +${commit.stats.additions}/-${commit.stats.deletions} across ${commit.stats.files_changed} file(s)`,
    `Files:\n${summariseFileChanges(commit.files_changed)}`,
  ].join("\n");
}

function buildChangesetSummary(changeset: ChangesetV1): string {
  const { commits, total_stats, repo, from_sha, to_sha } = changeset;

  const header = [
    `Repository: ${repo}`,
    `Range: ${from_sha.slice(0, 7)}..${to_sha.slice(0, 7)}`,
    `Total: ${total_stats.commits} commit(s), +${total_stats.additions}/-${total_stats.deletions} lines, ${total_stats.files_changed} file(s) changed`,
  ].join("\n");

  if (commits.length === 0) {
    return `${header}\n\n(No commits in range)`;
  }

  const verbatim = commits.slice(0, MAX_COMMITS_VERBATIM);
  const skipped = commits.length - verbatim.length;

  const commitBlocks = verbatim
    .map((c, i) => `--- Commit ${i + 1} ---\n${formatCommitBlock(c)}`)
    .join("\n\n");

  const suffix =
    skipped > 0
      ? `\n\n[${skipped} additional commit(s) omitted to stay within token budget. Summary stats above reflect all commits.]`
      : "";

  return `${header}\n\n${commitBlocks}${suffix}`;
}

// ─── JSON schema description ──────────────────────────────────────────────────

const INSIGHTS_SCHEMA_DESCRIPTION = `{
  "highlights": ["string", "..."],          // 3–7 crisp one-liners for a slide deck
  "what_changed": "string",                 // narrative paragraph
  "business_impact": "string",              // paragraph on user/revenue/product impact
  "engineering_evolution": "string",        // paragraph on tech/architecture changes
  "operational_risks": ["string", "..."],   // 1–5 risks introduced
  "mitigations": ["string", "..."],         // suggested mitigations (may be empty)
  "notable_files": [                        // up to 5 files worth calling out
    { "path": "string", "reason": "string" }
  ]
}`;

// ─── Profile-specific instructions ───────────────────────────────────────────

const PROFILE_INSTRUCTIONS: Record<PromptProfile, string> = {
  executive: `You are preparing a report for a C-suite executive who needs to understand
the business significance of this release. Focus on:
- User-facing changes and feature launches
- Revenue / retention risks or opportunities
- Compliance, security, or availability concerns
- High-level what changed and why it matters
Avoid deep technical jargon. Keep language clear and concise.`,

  technical: `You are preparing a technical report for the engineering team. Focus on:
- Architecture decisions, design patterns introduced or removed
- Performance implications
- API / interface changes that affect other services
- Dependency upgrades or removals
- Test coverage or quality signals
Be precise and use technical terminology where appropriate.`,

  brief: `You are preparing a very short summary for a busy stakeholder.
Produce the most compact possible analysis:
- highlights: exactly 3 items
- all paragraphs: max 2 sentences each
- operational_risks: max 2 items
- mitigations: max 1 item
- notable_files: max 2 items
Be ruthlessly concise.`,
};

// ─── Language-specific system suffix ─────────────────────────────────────────

const LANGUAGE_INSTRUCTIONS: Record<SupportedLanguage, string> = {
  en: "Write all narrative fields in English.",
  "pt-BR":
    "Escreva todos os campos narrativos em Português Brasileiro (pt-BR). Mantenha os nomes de arquivos e SHAs no formato original.",
};

// ─── Main prompt builder ─────────────────────────────────────────────────────

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export function buildPrompt(
  changeset: ChangesetV1,
  profile: PromptProfile,
  language: SupportedLanguage
): BuiltPrompt {
  const changesetSummary = buildChangesetSummary(changeset);

  const systemPrompt = [
    PROFILE_INSTRUCTIONS[profile],
    "",
    LANGUAGE_INSTRUCTIONS[language],
    "",
    "CRITICAL RULES:",
    "1. Only make claims that are directly supported by the commit messages and file-change data provided.",
    "2. Do NOT hallucinate features, bugs, or decisions not mentioned in the data.",
    "3. Respond ONLY with a valid JSON object matching the schema below — no markdown fences, no commentary.",
    "4. If a field has no meaningful content, use an empty array [] or an empty string ''. Never omit a field.",
    "",
    "Response JSON schema:",
    INSIGHTS_SCHEMA_DESCRIPTION,
  ].join("\n");

  const userPrompt = [
    "Analyze the following changeset and produce the JSON report.",
    "",
    "=== CHANGESET DATA ===",
    changesetSummary,
    "=== END CHANGESET DATA ===",
    "",
    "Return only the JSON object.",
  ].join("\n");

  return { systemPrompt, userPrompt };
}
