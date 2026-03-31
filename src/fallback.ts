// SPDX-License-Identifier: GPL-3.0
/**
 * Heuristic fallback — generates a basic InsightsV1 from commit messages alone,
 * without calling any LLM. Used when the LLM call fails and fallback_on_error=true.
 *
 * The fallback intentionally produces conservative, factual content derived
 * only from commit metadata, never from speculation.
 */

import type { AnalyzeOptions, ChangesetV1, CommitEntry, InsightsCommit, InsightsV1, NotableFile } from "./types.js";
import { fallbackDailyInsight, groupCommitsByDate } from "./daily.js";

/** Conventional-commit type prefixes we recognise */
const FEAT_RE = /^feat(\(.*?\))?[!:]?/i;
const FIX_RE = /^fix(\(.*?\))?[!:]?/i;
const BREAKING_RE = /!:|BREAKING[\s_-]?CHANGE/i;
const SECURITY_RE = /\b(security|cve|vuln|exploit|auth|xss|inject)/i;
const PERF_RE = /^perf(\(.*?\))?[!:]?/i;
const CHORE_RE = /^(chore|ci|build|docs|style|refactor|test)(\(.*?\))?[!:]?/i;

function extractHighlights(commits: CommitEntry[]): string[] {
  const highlights: string[] = [];

  const feats = commits.filter((c) => FEAT_RE.test(c.message));
  const fixes = commits.filter((c) => FIX_RE.test(c.message));
  const breaking = commits.filter((c) => BREAKING_RE.test(c.message));

  if (feats.length > 0) {
    highlights.push(`${feats.length} new feature commit(s) introduced`);
  }
  if (fixes.length > 0) {
    highlights.push(`${fixes.length} bug fix(es) applied`);
  }
  if (breaking.length > 0) {
    highlights.push(`${breaking.length} breaking change(s) detected`);
  }

  // Add top commit messages as highlights (up to 4 total)
  for (const commit of commits.slice(0, 4 - highlights.length)) {
    const msg = commit.message.split("\n")[0]?.trim() ?? "";
    if (msg && !highlights.some((h) => h.includes(msg))) {
      highlights.push(msg);
    }
  }

  return highlights.slice(0, 7);
}

function buildWhatChanged(commits: CommitEntry[], totals: ChangesetV1["totals"]): string {
  if (commits.length === 0) {
    return "No commits were included in this range.";
  }
  const msgList = commits
    .slice(0, 8)
    .map((c) => `"${c.message.split("\n")[0]?.trim() ?? c.short_sha}"`)
    .join(", ");
  return (
    `This release spans ${totals.commit_count} commit(s) by ${new Set(commits.map((c) => c.author)).size} contributor(s), ` +
    `touching ${totals.files_changed} file(s) with +${totals.additions}/-${totals.deletions} line changes. ` +
    `Included commits: ${msgList}${commits.length > 8 ? " and more" : ""}.`
  );
}

function detectRisks(commits: CommitEntry[]): string[] {
  const risks: string[] = [];

  const breaking = commits.filter((c) => BREAKING_RE.test(c.message));
  if (breaking.length > 0) {
    risks.push(`${breaking.length} breaking change(s) may require downstream updates or migrations`);
  }

  const security = commits.filter((c) => SECURITY_RE.test(c.message));
  if (security.length > 0) {
    risks.push("Security-related commits detected — review carefully before deploying");
  }

  const highChurn = commits.filter(
    (c) => c.diff_summary.additions + c.diff_summary.deletions > 200
  );
  if (highChurn.length > 0) {
    risks.push(`${highChurn.length} commit(s) with large diffs (>200 lines) increase regression risk`);
  }

  return risks;
}

function detectNotableFiles(commits: CommitEntry[]): NotableFile[] {
  const fileCounts: Map<string, number> = new Map();
  for (const commit of commits) {
    for (const hunk of commit.diff_summary.hunks) {
      fileCounts.set(hunk.filename, (fileCounts.get(hunk.filename) ?? 0) + 1);
    }
  }
  return [...fileCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([path, count]) => ({
      path,
      reason: `Changed in ${count} commit(s)`,
    }));
}

/**
 * Generate heuristic insights from a changeset without LLM assistance.
 * Always sets `fallback_used: true`.
 */
export function generateFallbackInsights(
  changeset: ChangesetV1,
  options: AnalyzeOptions
): InsightsV1 {
  const { commits, totals } = changeset;

  const featureCommits = commits.filter((c) => FEAT_RE.test(c.message));
  const perfCommits = commits.filter((c) => PERF_RE.test(c.message));
  const choreCommits = commits.filter((c) => CHORE_RE.test(c.message));

  const businessParts: string[] = [];
  if (featureCommits.length > 0) {
    businessParts.push(
      `${featureCommits.length} feature commit(s) suggest new user-facing functionality`
    );
  }
  if (perfCommits.length > 0) {
    businessParts.push(`${perfCommits.length} performance improvement(s) may improve user experience`);
  }
  if (businessParts.length === 0) {
    businessParts.push("No clear user-facing changes identified from commit messages alone");
  }

  const engineeringParts: string[] = [];
  if (choreCommits.length > 0) {
    engineeringParts.push(
      `${choreCommits.length} maintenance commit(s) (chore/ci/docs/refactor) included`
    );
  }
  engineeringParts.push(
    `${totals.files_changed} file(s) modified with a net change of +${totals.additions}/-${totals.deletions} lines`
  );

  return {
    schema_version: "1",
    idempotency_key: changeset.idempotency_key,
    repo: changeset.repo,
    from_sha: changeset.from_sha,
    to_sha: changeset.to_sha,
    generated_at: new Date().toISOString(),
    provider: options.provider,
    model: options.model,
    prompt_profile: options.promptProfile,
    language: options.language,
    highlights: extractHighlights(commits),
    what_changed: buildWhatChanged(commits, totals),
    business_impact: businessParts.join(". ") + ".",
    engineering_evolution: engineeringParts.join(". ") + ".",
    operational_risks: detectRisks(commits),
    mitigations: detectRisks(commits).length > 0
      ? ["Review the flagged commits and run regression tests before deploying to production"]
      : [],
    notable_files: detectNotableFiles(commits),
    fallback_used: true,
    commits: commits.map((c): InsightsCommit => ({
      sha: c.sha,
      message: c.message.split("\n")[0]?.trim() ?? c.short_sha,
      author: c.author,
      date: c.timestamp,
    })),
    total_commits: changeset.totals.commit_count,
    total_files_changed: changeset.totals.files_changed,
    daily_insights: (() => {
      const dateGroups = groupCommitsByDate(commits);
      const sortedDates = [...dateGroups.keys()].sort((a, b) => b.localeCompare(a));
      return sortedDates.map((date) => fallbackDailyInsight(date, dateGroups.get(date)!));
    })(),
  };
}
