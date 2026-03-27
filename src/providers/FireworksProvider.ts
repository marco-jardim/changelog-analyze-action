// SPDX-License-Identifier: GPL-3.0
/**
 * FireworksProvider — calls Fireworks AI using the OpenAI-compatible chat API.
 * Endpoint: POST https://api.fireworks.ai/inference/v1/chat/completions
 */

import type { AnalyzeOptions, ChangesetV1, InsightsV1, OpenAICompatibleResponse } from "../types.js";
import { DEFAULT_BASE_URLS } from "../types.js";
import { buildPrompt } from "../prompt.js";
import { buildInsightsFromLLMResponse, extractJson } from "./BaseProvider.js";
import type { LLMProvider } from "./LLMProvider.js";

export class FireworksProvider implements LLMProvider {
  async analyze(changeset: ChangesetV1, options: AnalyzeOptions): Promise<InsightsV1> {
    const { systemPrompt, userPrompt } = buildPrompt(
      changeset,
      options.promptProfile,
      options.language
    );

    const baseUrl = options.baseUrl || DEFAULT_BASE_URLS.fireworks;
    const url = `${baseUrl}/chat/completions`;

    const body = {
      model: options.model,
      max_tokens: options.maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: "text" },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Fireworks API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as OpenAICompatibleResponse;
    const raw = data.choices?.[0]?.message?.content ?? "";
    const jsonText = extractJson(raw);
    const parsed: unknown = JSON.parse(jsonText);

    return buildInsightsFromLLMResponse(
      parsed as Record<string, unknown>,
      changeset,
      options,
      "fireworks"
    );
  }
}
