// SPDX-License-Identifier: GPL-3.0
/**
 * OpenAIProvider — calls OpenAI chat completions API.
 * Endpoint: POST https://api.openai.com/v1/chat/completions
 */

import type { AnalyzeOptions, ChangesetV1, InsightsV1, OpenAICompatibleResponse } from "../types.js";
import { DEFAULT_BASE_URLS } from "../types.js";
import { buildPrompt } from "../prompt.js";
import { buildInsightsFromLLMResponse, extractJson } from "./BaseProvider.js";
import type { LLMProvider } from "./LLMProvider.js";

export class OpenAIProvider implements LLMProvider {
  async analyze(changeset: ChangesetV1, options: AnalyzeOptions): Promise<InsightsV1> {
    const { systemPrompt, userPrompt } = buildPrompt(
      changeset,
      options.promptProfile,
      options.language
    );

    const baseUrl = options.baseUrl || DEFAULT_BASE_URLS.openai;
    const url = `${baseUrl}/chat/completions`;

    const body = {
      model: options.model,
      max_tokens: options.maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${text}`);
      }

      const data = (await response.json()) as OpenAICompatibleResponse;
      const raw = data.choices?.[0]?.message?.content ?? "";
      const jsonText = extractJson(raw);
      const parsed: unknown = JSON.parse(jsonText);

      return buildInsightsFromLLMResponse(
        parsed as Record<string, unknown>,
        changeset,
        options,
        "openai"
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
