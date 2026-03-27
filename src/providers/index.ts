// SPDX-License-Identifier: GPL-3.0
/**
 * Provider factory — returns the correct LLMProvider implementation
 * based on the `provider` action input.
 */

import type { SupportedProvider } from "../types.js";
import { AnthropicProvider } from "./AnthropicProvider.js";
import { FireworksProvider } from "./FireworksProvider.js";
import type { LLMProvider } from "./LLMProvider.js";
import { OllamaProvider } from "./OllamaProvider.js";
import { OpenAIProvider } from "./OpenAIProvider.js";

export { AnthropicProvider, FireworksProvider, OllamaProvider, OpenAIProvider };
export type { LLMProvider };

/**
 * Returns the LLMProvider instance for the given provider name.
 * Throws if the provider name is unrecognised.
 */
export function createProvider(provider: SupportedProvider): LLMProvider {
  switch (provider) {
    case "fireworks":
      return new FireworksProvider();
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
    case "ollama":
      return new OllamaProvider();
    default: {
      // Exhaustive check — TypeScript will error if a case is missing
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}
