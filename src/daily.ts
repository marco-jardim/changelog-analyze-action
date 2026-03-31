// SPDX-License-Identifier: GPL-3.0
/**
 * Per-day LLM analysis.
 *
 * Groups changeset commits by calendar date, calls the LLM once per date group
 * with a focused prompt, and returns DailyInsight[] sorted newest date first.
 */

import type { AnalyzeOptions, ChangesetV1, CommitEntry, DailyInsight, InsightsCommit } from "./types.js";
import type { LLMProvider } from "./providers/LLMProvider.js";
import { extractJson } from "./providers/BaseProvider.js";

// ─── Grouping ─────────────────────────────────────────────────────────────────

/** Group commits by YYYY-MM-DD date key derived from commit timestamp. */
export function groupCommitsByDate(commits: CommitEntry[]): Map<string, CommitEntry[]> {
  const map = new Map<string, CommitEntry[]>();
  for (const c of commits) {
    const key = c.timestamp ? c.timestamp.slice(0, 10) : "unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return map;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/** Build a per-day prompt that's much more concise than the full changeset prompt. */
function buildDailyPrompt(
  date: string,
  commits: CommitEntry[],
  repo: string,
  language: string,
): { system: string; user: string } {
  const langInstruction =
    language === "pt-BR"
      ? "Escreva em Português Brasileiro."
      : "Write in English.";

  const system = `You are generating a concise daily changelog summary for ${date}.
${langInstruction}

RULES:
1. Only reference what the commits actually contain — do not invent or speculate.
2. Respond ONLY with valid JSON, no markdown fences, no commentary.
3. Be concise: this should read as a quick daily digest (~3-5 sentences total).

JSON schema:
{
  "highlights": ["string", "..."],     // 1-3 key takeaways for this day
  "summary": "string",                 // 2-4 sentence narrative of the day's work
  "operational_risks": ["string", ...] // 0-2 risks (empty array if none)
}`;

  const commitBlocks = commits
    .slice(0, 20)
    .map((c, i) => {
      const files = c.diff_summary.hunks
        .slice(0, 5)
        .map((h) => `  ${h.filename} (+${h.additions}/-${h.deletions})`)
        .join("\n");
      return `--- Commit ${i + 1} ---
SHA: ${c.short_sha}
Author: ${c.author}
Message: ${c.message}
Stats: +${c.diff_summary.additions}/-${c.diff_summary.deletions} across ${c.diff_summary.files_changed} file(s)
Files:
${files}`;
    })
    .join("\n\n");

  const user = `Repository: ${repo}
Date: ${date}
Commits: ${commits.length}

=== COMMITS ===
${commitBlocks}
=== END ===

Return only the JSON object.`;

  return { system, user };
}

// ─── Response parsing ─────────────────────────────────────────────────────────

/** Parse LLM response for a daily insight. */
function parseDailyResponse(raw: string, date: string, commits: CommitEntry[]): DailyInsight {
  const jsonText = extractJson(raw);
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;

  const ensureStrArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const ensureStr = (v: unknown): string => (typeof v === "string" ? v : "");

  return {
    date,
    commit_count: commits.length,
    highlights: ensureStrArr(parsed["highlights"]),
    summary: ensureStr(parsed["summary"]),
    operational_risks: ensureStrArr(parsed["operational_risks"]),
    commits: commits.map(
      (c): InsightsCommit => ({
        sha: c.sha,
        message: c.message.split("\n")[0]?.trim() ?? c.short_sha,
        author: c.author,
        date: c.timestamp,
      }),
    ),
  };
}

// ─── Fallback for a single day ────────────────────────────────────────────────

/** Fallback for a single day when LLM fails or group_by_date is used with fallback insights. */
export function fallbackDailyInsight(date: string, commits: CommitEntry[]): DailyInsight {
  const msgs = commits.slice(0, 5).map((c) => c.message.split("\n")[0]?.trim() ?? c.short_sha);
  return {
    date,
    commit_count: commits.length,
    highlights: msgs.slice(0, 3),
    summary: `${commits.length} commit(s): ${msgs.join("; ")}.`,
    operational_risks: [],
    commits: commits.map(
      (c): InsightsCommit => ({
        sha: c.sha,
        message: c.message.split("\n")[0]?.trim() ?? c.short_sha,
        author: c.author,
        date: c.timestamp,
      }),
    ),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate per-day insights by calling the LLM once per date group.
 * Days are processed sequentially to avoid rate limits.
 * Returns DailyInsight[] sorted newest first.
 */
export async function generateDailyInsights(
  changeset: ChangesetV1,
  provider: LLMProvider,
  options: AnalyzeOptions,
  log: (msg: string) => void = () => {},
): Promise<DailyInsight[]> {
  const dateGroups = groupCommitsByDate(changeset.commits);
  const sortedDates = [...dateGroups.keys()].sort((a, b) => b.localeCompare(a)); // newest first

  const results: DailyInsight[] = [];

  for (const date of sortedDates) {
    const commits = dateGroups.get(date)!;
    log(`Analyzing ${date} (${commits.length} commit${commits.length === 1 ? "" : "s"})…`);

    try {
      const { system, user } = buildDailyPrompt(date, commits, changeset.repo, options.language);
      const raw = await callProviderChat(provider, system, user, options);
      results.push(parseDailyResponse(raw, date, commits));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  Daily LLM failed for ${date}: ${msg} — using fallback`);
      results.push(fallbackDailyInsight(date, commits));
    }
  }

  return results;
}

// ─── Low-level HTTP chat call ─────────────────────────────────────────────────

/**
 * Low-level chat call that works with any supported provider.
 * We bypass the provider's analyze() method since that expects a full changeset
 * and returns InsightsV1. Instead we call the HTTP endpoint directly.
 */
async function callProviderChat(
  _provider: LLMProvider,
  systemPrompt: string,
  userPrompt: string,
  options: AnalyzeOptions,
): Promise<string> {
  const baseUrls: Record<string, string> = {
    fireworks: "https://api.fireworks.ai/inference/v1",
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    ollama: "http://localhost:11434",
  };
  const baseUrl = options.baseUrl || baseUrls[options.provider] || baseUrls["fireworks"]!;

  if (options.provider === "anthropic") {
    const url = `${baseUrl}/messages`;
    const body = {
      model: options.model,
      max_tokens: Math.min(options.maxTokens, 800),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.2,
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": options.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
      const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
      return data.content?.find((b) => b.type === "text")?.text ?? "";
    } finally {
      clearTimeout(timeoutId);
    }
  } else if (options.provider === "ollama") {
    const url = `${baseUrl}/api/chat`;
    const body = {
      model: options.model,
      stream: false,
      options: { num_predict: Math.min(options.maxTokens, 800), temperature: 0.2 },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text()}`);
      const data = (await response.json()) as { message: { content: string } };
      return data.message?.content ?? "";
    } finally {
      clearTimeout(timeoutId);
    }
  } else {
    // OpenAI-compatible: fireworks, openai
    const url = `${baseUrl}/chat/completions`;
    const body = {
      model: options.model,
      max_tokens: Math.min(options.maxTokens, 800),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(`${options.provider} ${response.status}: ${await response.text()}`);
      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return data.choices?.[0]?.message?.content ?? "";
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
