// SPDX-License-Identifier: GPL-3.0
/**
 * OllamaProvider — calls a local Ollama instance.
 * Endpoint: POST <base_url>/api/chat
 * Default base_url: http://localhost:11434
 */

import type { AnalyzeOptions, ChangesetV1, InsightsV1, OllamaResponse } from "../types.js";
import { DEFAULT_BASE_URLS } from "../types.js";
import { buildPrompt } from "../prompt.js";
import { buildInsightsFromLLMResponse, extractJson } from "./BaseProvider.js";
import type { LLMProvider } from "./LLMProvider.js";

export class OllamaProvider implements LLMProvider {
  async analyze(changeset: ChangesetV1, options: AnalyzeOptions): Promise<InsightsV1> {
    const { systemPrompt, userPrompt } = buildPrompt(
      changeset,
      options.promptProfile,
      options.language
    );

    const baseUrl = options.baseUrl || DEFAULT_BASE_URLS.ollama;
    const url = `${baseUrl}/api/chat`;

    const body = {
      model: options.model,
      stream: false,
      options: {
        num_predict: options.maxTokens,
        temperature: 0.2,
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama API error ${response.status}: ${text}`);
      }

      const data = (await response.json()) as OllamaResponse;
      const raw = data.message?.content ?? "";
      const jsonText = extractJson(raw);
      const parsed: unknown = JSON.parse(jsonText);

      return buildInsightsFromLLMResponse(
        parsed as Record<string, unknown>,
        changeset,
        options,
        "ollama"
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
