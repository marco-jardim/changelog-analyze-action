// SPDX-License-Identifier: GPL-3.0
/**
 * LLMProvider interface that all provider implementations must satisfy.
 */

import type { AnalyzeOptions, ChangesetV1, InsightsV1 } from "../types.js";

export interface LLMProvider {
  /**
   * Analyse a changeset and return structured insights.
   *
   * @param changeset  Parsed changeset.v1.json input
   * @param options    Runtime options (model, tokens, profile, language…)
   * @returns          Fully-populated InsightsV1 object (fallback_used=false)
   * @throws           On network error or unparseable LLM response
   */
  analyze(changeset: ChangesetV1, options: AnalyzeOptions): Promise<InsightsV1>;
}
