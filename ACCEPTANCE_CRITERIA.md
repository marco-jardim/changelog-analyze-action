# Acceptance Criteria

Checklist of requirements that must be satisfied for `changelog-analyze-action` to be considered production-ready.

## Inputs & Configuration

- [x] `changeset_path` input (required) reads `changeset.v1.json`
- [x] `provider` input accepts `fireworks`, `openai`, `anthropic`, `ollama`
- [x] `model` input with per-provider defaults
- [x] `api_key` input (optional, not needed for ollama)
- [x] `base_url` input for ollama and custom endpoints
- [x] `max_tokens` input (default `2000`)
- [x] `prompt_profile` input: `executive`, `technical`, `brief` (default `executive`)
- [x] `language` input: `en`, `pt-BR` (default `en`)
- [x] `fallback_on_error` input (default `true`)
- [x] `output_path` input (default `insights.v1.json`)

## Outputs

- [x] `insights_path` output: absolute path to generated file
- [x] `provider_used` output
- [x] `model_used` output
- [x] `fallback_used` output

## insights.v1.json Schema

- [x] `schema_version: "1"`
- [x] `idempotency_key` matches input changeset
- [x] `repo` matches input changeset
- [x] `from_sha` / `to_sha` match input changeset
- [x] `generated_at` ISO 8601 timestamp
- [x] `provider` and `model` recorded
- [x] `prompt_profile` and `language` recorded
- [x] `highlights` array of strings
- [x] `what_changed` narrative paragraph
- [x] `business_impact` paragraph
- [x] `engineering_evolution` paragraph
- [x] `operational_risks` array of strings
- [x] `mitigations` array of strings
- [x] `notable_files` array of `{ path, reason }` objects
- [x] `fallback_used` boolean

## Provider Implementations

- [x] `FireworksProvider` — POST to `https://api.fireworks.ai/inference/v1/chat/completions`
- [x] `OpenAIProvider` — POST to `https://api.openai.com/v1/chat/completions`
- [x] `AnthropicProvider` — POST to `https://api.anthropic.com/v1/messages` (with `x-api-key` + `anthropic-version` headers)
- [x] `OllamaProvider` — POST to `<base_url>/api/chat`
- [x] All implement common `LLMProvider` interface

## Prompt Design

- [x] Sends commit messages and file-change summaries (no raw diffs)
- [x] Instructs model to produce JSON matching insights schema
- [x] Instructs model not to hallucinate
- [x] Handles token limits by truncating large changesets
- [x] Profile-specific instructions (executive / technical / brief)
- [x] Language-specific instructions (en / pt-BR)

## Fallback Heuristic

- [x] Activated when LLM call fails and `fallback_on_error=true`
- [x] Generates `insights.v1.json` from commit messages only
- [x] Sets `fallback_used: true`
- [x] Detects conventional-commit feat/fix/breaking/security prefixes
- [x] Identifies high-churn files as operational risks

## Tests

- [x] ≥ 12 Vitest tests
- [x] Schema validation tests
- [x] Provider selection logic tests
- [x] Fallback behavior tests
- [x] Prompt construction snapshot tests
- [x] Per-provider HTTP mock tests
- [x] Language handling tests (en vs pt-BR)
- [x] Empty changeset edge case

## Documentation & Licensing

- [x] `README.md` with overview, inputs/outputs, usage, provider guide, schema docs
- [x] `LICENSE` — GPL-3.0 full text
- [x] `ACCEPTANCE_CRITERIA.md` (this file)
- [x] `DEFINITION_OF_DONE.md`

## Build & CI

- [x] TypeScript compiled to `dist/index.js` via `esbuild`
- [x] `.github/workflows/ci.yml` runs tests + build on push/PR
- [x] `npm test` passes
- [x] `npm run build` produces `dist/index.js`

## Publishing

- [x] GitHub repo `marco-jardim/changelog-analyze-action` created and pushed
- [x] `v1.0.0` release created
