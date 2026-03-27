// SPDX-License-Identifier: GPL-3.0
/**
 * AnthropicProvider — calls Anthropic Messages API.
 * Endpoint: POST https://api.anthropic.com/v1/messages
 * Uses Anthropic's own request/response format (different from OpenAI).
 */

import type { AnalyzeOptions, AnthropicResponse, ChangesetV1, InsightsV1 } from "../types.js";
import { DEFAULT_BASE_URLS } from "../types.js";
import { buildPrompt } from "../prompt.js";
import { buildInsightsFromLLMResponse, extractJson } from "./BaseProvider.js";
import type { LLMProvider } from "./LLMProvider.js";

/** Anthropic API version header value */
const ANTHROPIC_API_VERSION = "2023-06-01";

export class AnthropicProvider implements LLMProvider {
  async analyze(changeset: ChangesetV1, options: AnalyzeOptions): Promise<InsightsV1> {
    const { systemPrompt, userPrompt } = buildPrompt(
      changeset,
      options.promptProfile,
      options.language
    );

    const baseUrl = options.baseUrl || DEFAULT_BASE_URLS.anthropic;
    const url = `${baseUrl}/messages`;

    const body = {
      model: options.model,
      max_tokens: options.maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.2,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": options.apiKey,
          "anthropic-version": ANTHROPIC_API_VERSION,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${text}`);
      }

      const data = (await response.json()) as AnthropicResponse;
      const textBlock = data.content?.find((b) => b.type === "text");
      const raw = textBlock?.text ?? "";
      const jsonText = extractJson(raw);
      const parsed: unknown = JSON.parse(jsonText);

      return buildInsightsFromLLMResponse(
        parsed as Record<string, unknown>,
        changeset,
        options,
        "anthropic"
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
