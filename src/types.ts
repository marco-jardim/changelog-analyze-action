// SPDX-License-Identifier: GPL-3.0
/**
 * Type definitions for changelog-analyze-action.
 * Shared between providers, prompt builder, and main entry.
 */

// ─── Changeset V1 (input from changelog-collect-action) ───────────────────────

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  change_type: "added" | "modified" | "deleted" | "renamed";
  /** Only present on renamed files */
  old_path?: string;
}

export interface CommitStats {
  additions: number;
  deletions: number;
  files_changed: number;
}

export interface CommitEntry {
  sha: string;
  short_sha: string;
  message: string;
  author: string;
  authored_at: string;
  files_changed: FileChange[];
  stats: CommitStats;
}

export interface TotalStats {
  commits: number;
  additions: number;
  deletions: number;
  files_changed: number;
}

export interface ChangesetV1 {
  schema_version: "1";
  idempotency_key: string;
  repo: string;
  from_sha: string;
  to_sha: string;
  collected_at: string;
  commits: CommitEntry[];
  total_stats: TotalStats;
}

// ─── Insights V1 (output) ─────────────────────────────────────────────────────

export interface NotableFile {
  path: string;
  reason: string;
}

export interface InsightsV1 {
  schema_version: "1";
  idempotency_key: string;
  repo: string;
  from_sha: string;
  to_sha: string;
  generated_at: string;
  provider: string;
  model: string;
  prompt_profile: PromptProfile;
  language: string;
  highlights: string[];
  what_changed: string;
  business_impact: string;
  engineering_evolution: string;
  operational_risks: string[];
  mitigations: string[];
  notable_files: NotableFile[];
  fallback_used: boolean;
}

// ─── Provider / action options ────────────────────────────────────────────────

export type SupportedProvider = "fireworks" | "openai" | "anthropic" | "ollama";
export type PromptProfile = "executive" | "technical" | "brief";
export type SupportedLanguage = "en" | "pt-BR";

export interface AnalyzeOptions {
  provider: SupportedProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  promptProfile: PromptProfile;
  language: SupportedLanguage;
  fallbackOnError: boolean;
}

// ─── LLM wire types ───────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Generic response surface shared by OpenAI-compatible providers */
export interface OpenAICompatibleResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/** Anthropic-specific response */
export interface AnthropicResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

/** Ollama-specific response */
export interface OllamaResponse {
  message: {
    content: string;
  };
  done: boolean;
}

// ─── Default models per provider ─────────────────────────────────────────────

export const DEFAULT_MODELS: Record<SupportedProvider, string> = {
  fireworks: "accounts/fireworks/models/llama-v3p1-70b-instruct",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  ollama: "llama3.2",
};

export const DEFAULT_BASE_URLS: Record<SupportedProvider, string> = {
  fireworks: "https://api.fireworks.ai/inference/v1",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  ollama: "http://localhost:11434",
};
