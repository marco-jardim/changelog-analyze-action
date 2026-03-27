// SPDX-License-Identifier: GPL-3.0
/**
 * Runtime schema validation for changeset.v1.json (input) and
 * insights.v1.json (output).
 */

import type { ChangesetV1, InsightsV1 } from "./types.js";

// ─── Validation result ────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── ChangesetV1 validation ───────────────────────────────────────────────────

function validateField(
  errors: string[],
  obj: Record<string, unknown>,
  field: string,
  type: string
): void {
  if (typeof obj[field] !== type) {
    errors.push(`Missing or invalid field '${field}': expected ${type}, got ${typeof obj[field]}`);
  }
}

export function validateChangesetV1(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, errors: ["Input is not a JSON object"] };
  }

  const obj = raw as Record<string, unknown>;

  if (obj["schema_version"] !== "1") {
    errors.push(`schema_version must be "1", got "${String(obj["schema_version"])}"`);
  }
  validateField(errors, obj, "idempotency_key", "string");
  validateField(errors, obj, "repo", "string");
  validateField(errors, obj, "from_sha", "string");
  validateField(errors, obj, "to_sha", "string");
  validateField(errors, obj, "generated_at", "string");

  if (!Array.isArray(obj["commits"])) {
    errors.push("'commits' must be an array");
  }

  if (typeof obj["totals"] !== "object" || obj["totals"] === null) {
    errors.push("'totals' must be an object");
  }

  return { valid: errors.length === 0, errors };
}

// ─── InsightsV1 validation ────────────────────────────────────────────────────

export function validateInsightsV1(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, errors: ["Input is not a JSON object"] };
  }

  const obj = raw as Record<string, unknown>;

  if (obj["schema_version"] !== "1") {
    errors.push(`schema_version must be "1", got "${String(obj["schema_version"])}"`);
  }

  const stringFields: Array<keyof InsightsV1> = [
    "idempotency_key",
    "repo",
    "from_sha",
    "to_sha",
    "generated_at",
    "provider",
    "model",
    "prompt_profile",
    "language",
    "what_changed",
    "business_impact",
    "engineering_evolution",
  ];

  for (const field of stringFields) {
    validateField(errors, obj, field, "string");
  }

  const arrayFields: Array<keyof InsightsV1> = [
    "highlights",
    "operational_risks",
    "mitigations",
    "notable_files",
  ];

  for (const field of arrayFields) {
    if (!Array.isArray(obj[field])) {
      errors.push(`'${field}' must be an array`);
    }
  }

  if (typeof obj["fallback_used"] !== "boolean") {
    errors.push("'fallback_used' must be a boolean");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Convenience parse-and-validate ─────────────────────────────────────────

/**
 * Parse raw JSON string and validate as ChangesetV1.
 * Throws a descriptive error if the content is invalid.
 */
export function parseAndValidateChangeset(jsonText: string): ChangesetV1 {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(
      `Failed to parse changeset JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const result = validateChangesetV1(raw);
  if (!result.valid) {
    throw new Error(
      `Invalid changeset.v1.json:\n  - ${result.errors.join("\n  - ")}`
    );
  }

  return raw as ChangesetV1;
}
