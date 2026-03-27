// SPDX-License-Identifier: GPL-3.0
/**
 * changelog-analyze-action — main entry point.
 *
 * Reads a changeset.v1.json, calls an LLM provider (or falls back to heuristics),
 * and writes insights.v1.json.
 */

import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";

import { generateFallbackInsights } from "./fallback.js";
import { createProvider } from "./providers/index.js";
import { parseAndValidateChangeset } from "./schema.js";
import type { AnalyzeOptions, PromptProfile, SupportedLanguage, SupportedProvider } from "./types.js";
import { DEFAULT_MODELS } from "./types.js";

// ─── Input helpers ────────────────────────────────────────────────────────────

function getProvider(): SupportedProvider {
  const raw = core.getInput("provider", { required: true }).trim().toLowerCase();
  const valid: SupportedProvider[] = ["fireworks", "openai", "anthropic", "ollama"];
  if (!valid.includes(raw as SupportedProvider)) {
    throw new Error(
      `Invalid provider "${raw}". Must be one of: ${valid.join(", ")}`
    );
  }
  return raw as SupportedProvider;
}

function getPromptProfile(): PromptProfile {
  const raw = core.getInput("prompt_profile").trim().toLowerCase() || "executive";
  const valid: PromptProfile[] = ["executive", "technical", "brief"];
  if (!valid.includes(raw as PromptProfile)) {
    throw new Error(
      `Invalid prompt_profile "${raw}". Must be one of: ${valid.join(", ")}`
    );
  }
  return raw as PromptProfile;
}

function getLanguage(): SupportedLanguage {
  const raw = core.getInput("language").trim() || "en";
  const valid: SupportedLanguage[] = ["en", "pt-BR"];
  if (!valid.includes(raw as SupportedLanguage)) {
    core.warning(
      `Unsupported language "${raw}" — falling back to "en". Supported: ${valid.join(", ")}`
    );
    return "en";
  }
  return raw as SupportedLanguage;
}

function getMaxTokens(): number {
  const raw = core.getInput("max_tokens") || "2000";
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 100) {
    core.warning(`max_tokens "${raw}" is invalid — using 2000`);
    return 2000;
  }
  return n;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  try {
    // ── Read & validate inputs ───────────────────────────────────────────────
    const changesetPath = core.getInput("changeset_path", { required: true });
    const resolvedChangesetPath = path.resolve(changesetPath);

    if (!fs.existsSync(resolvedChangesetPath)) {
      throw new Error(`changeset_path "${resolvedChangesetPath}" does not exist`);
    }

    const outputPath = core.getInput("output_path") || "insights.v1.json";
    const resolvedOutputPath = path.resolve(outputPath);

    const provider = getProvider();
    const rawModel = core.getInput("model").trim();
    const model = rawModel || DEFAULT_MODELS[provider];
    const apiKey = core.getInput("api_key");
    const baseUrl = core.getInput("base_url").trim();
    const maxTokens = getMaxTokens();
    const promptProfile = getPromptProfile();
    const language = getLanguage();
    const fallbackOnError = (core.getInput("fallback_on_error") || "true").toLowerCase() !== "false";

    const options: AnalyzeOptions = {
      provider,
      model,
      apiKey,
      baseUrl,
      maxTokens,
      promptProfile,
      language,
      fallbackOnError,
    };

    core.info(`Provider: ${provider}`);
    core.info(`Model: ${model}`);
    core.info(`Prompt profile: ${promptProfile}`);
    core.info(`Language: ${language}`);
    core.info(`Reading changeset from: ${resolvedChangesetPath}`);

    // ── Parse changeset ──────────────────────────────────────────────────────
    const jsonText = fs.readFileSync(resolvedChangesetPath, "utf-8");
    const changeset = parseAndValidateChangeset(jsonText);

    core.info(
      `Changeset: ${changeset.totals.commit_count} commit(s), ` +
      `${changeset.totals.files_changed} file(s) changed`
    );

    // ── Call LLM (or fallback) ───────────────────────────────────────────────
    let insights;
    let usedFallback = false;

    try {
      const llmProvider = createProvider(provider);
      insights = await llmProvider.analyze(changeset, options);
      core.info(`LLM analysis complete using ${provider}/${model}`);
    } catch (llmError) {
      const msg = llmError instanceof Error ? llmError.message : String(llmError);
      core.warning(`LLM call failed: ${msg}`);

      if (!fallbackOnError) {
        throw new Error(`LLM failed and fallback_on_error is false. Original error: ${msg}`);
      }

      core.warning("Falling back to heuristic analysis…");
      insights = generateFallbackInsights(changeset, options);
      usedFallback = true;
    }

    // ── Write output ─────────────────────────────────────────────────────────
    const outputDir = path.dirname(resolvedOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(resolvedOutputPath, JSON.stringify(insights, null, 2), "utf-8");
    core.info(`Insights written to: ${resolvedOutputPath}`);

    // ── Set action outputs ────────────────────────────────────────────────────
    core.setOutput("insights_path", resolvedOutputPath);
    core.setOutput("provider_used", insights.provider);
    core.setOutput("model_used", insights.model);
    core.setOutput("fallback_used", String(usedFallback));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(msg);
  }
}

run();
