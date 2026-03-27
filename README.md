# changelog-analyze-action

[![CI](https://github.com/marco-jardim/changelog-analyze-action/actions/workflows/ci.yml/badge.svg)](https://github.com/marco-jardim/changelog-analyze-action/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

> **Action 2/4** in the modular changelog pipeline.  
> Reads `changeset.v1.json` → calls an LLM → produces `insights.v1.json` with executive-friendly analysis.

---

## Overview

`changelog-analyze-action` takes the structured commit data produced by [`changelog-collect-action`](https://github.com/marco-jardim/changelog-collect-action) and uses a Large Language Model (Fireworks AI, OpenAI, Anthropic, or a local Ollama instance) to generate an executive-friendly analysis including:

- **Highlights** — crisp one-liners for a slide deck or release notes
- **What changed** — narrative paragraph
- **Business impact** — user/revenue/product perspective
- **Engineering evolution** — architecture and technical perspective
- **Operational risks** — what might break in production
- **Mitigations** — how to address the risks
- **Notable files** — which files deserve attention

When the LLM call fails, the action falls back to a heuristic analysis derived from commit messages and file stats, ensuring the pipeline never silently breaks.

---

## Pipeline Position

```
changelog-collect-action  →  changelog-analyze-action  →  changelog-render-action  →  changelog-publish-*
       (changeset.v1.json)         (insights.v1.json)
```

---

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `changeset_path` | **Yes** | — | Path to `changeset.v1.json` (from `changelog-collect-action`) |
| `provider` | **Yes** | — | LLM provider: `fireworks`, `openai`, `anthropic`, or `ollama` |
| `model` | No | *(per provider)* | Model ID. See [Provider Defaults](#provider-defaults) |
| `api_key` | No | — | API key. Not needed for `ollama` |
| `base_url` | No | *(per provider)* | Override base URL (useful for Ollama or custom proxies) |
| `max_tokens` | No | `2000` | Max tokens for LLM response |
| `prompt_profile` | No | `executive` | `executive`, `technical`, or `brief` |
| `language` | No | `en` | Output language: `en` or `pt-BR` |
| `fallback_on_error` | No | `true` | Fall back to heuristic analysis if LLM fails |
| `output_path` | No | `insights.v1.json` | Where to write the output file |

### Provider Defaults

| Provider | Default Model |
|----------|--------------|
| `fireworks` | `accounts/fireworks/models/llama-v3p1-70b-instruct` |
| `openai` | `gpt-4o-mini` |
| `anthropic` | `claude-3-5-haiku-20241022` |
| `ollama` | `llama3.2` |

---

## Outputs

| Output | Description |
|--------|-------------|
| `insights_path` | Absolute path to the generated `insights.v1.json` |
| `provider_used` | Provider that generated the insights |
| `model_used` | Model that was used |
| `fallback_used` | `"true"` if heuristic fallback was used instead of LLM |

---

## Usage

### Fireworks AI (recommended)

```yaml
- name: Collect changeset
  uses: marco-jardim/changelog-collect-action@v1
  id: collect

- name: Analyze changeset
  uses: marco-jardim/changelog-analyze-action@v1
  id: analyze
  with:
    changeset_path: ${{ steps.collect.outputs.changeset_path }}
    provider: fireworks
    api_key: ${{ secrets.FIREWORKS_API_KEY }}
    prompt_profile: executive
    language: en

- name: Use insights
  run: echo "Insights at ${{ steps.analyze.outputs.insights_path }}"
```

### OpenAI

```yaml
- uses: marco-jardim/changelog-analyze-action@v1
  with:
    changeset_path: changeset.v1.json
    provider: openai
    model: gpt-4o
    api_key: ${{ secrets.OPENAI_API_KEY }}
    prompt_profile: technical
```

### Anthropic

```yaml
- uses: marco-jardim/changelog-analyze-action@v1
  with:
    changeset_path: changeset.v1.json
    provider: anthropic
    model: claude-3-5-sonnet-20241022
    api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt_profile: executive
    language: pt-BR
```

### Ollama (self-hosted, no API key)

```yaml
- uses: marco-jardim/changelog-analyze-action@v1
  with:
    changeset_path: changeset.v1.json
    provider: ollama
    model: llama3.2
    base_url: http://localhost:11434
    fallback_on_error: "true"
```

---

## Provider Configuration Guide

### Fireworks AI

1. Sign up at [fireworks.ai](https://fireworks.ai)
2. Create an API key in your account settings
3. Add it as a GitHub secret: `Settings → Secrets → FIREWORKS_API_KEY`

```yaml
api_key: ${{ secrets.FIREWORKS_API_KEY }}
```

Available models: browse at [fireworks.ai/models](https://fireworks.ai/models)

### OpenAI

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Create an API key under `API Keys`
3. Add as `OPENAI_API_KEY` secret

```yaml
api_key: ${{ secrets.OPENAI_API_KEY }}
```

### Anthropic

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Add as `ANTHROPIC_API_KEY` secret

```yaml
api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Ollama (local)

For self-hosted runners with a local Ollama instance:

```yaml
provider: ollama
base_url: http://localhost:11434   # or your Ollama host
model: llama3.2                    # or any model you've pulled
```

No API key needed. Ensure Ollama is running before the action executes.

---

## Prompt Profiles

| Profile | Audience | Focus |
|---------|----------|-------|
| `executive` | C-suite, PMs | Business impact, risks, user-facing changes |
| `technical` | Engineers | Architecture, performance, API changes, test coverage |
| `brief` | Anyone | Ultra-short summary (3 highlights, 2-sentence paragraphs) |

---

## `insights.v1.json` Schema

```json
{
  "schema_version": "1",
  "idempotency_key": "abc123-def456",
  "repo": "owner/name",
  "from_sha": "abc1234",
  "to_sha": "def4567",
  "generated_at": "2026-03-27T00:00:00Z",
  "provider": "fireworks",
  "model": "accounts/fireworks/models/llama-v3p1-70b-instruct",
  "prompt_profile": "executive",
  "language": "en",
  "highlights": [
    "OAuth2 login added",
    "DB connection leak resolved"
  ],
  "what_changed": "This release introduces OAuth2 authentication and resolves a database connection leak.",
  "business_impact": "Users can now log in via Google/GitHub. The DB fix improves service reliability.",
  "engineering_evolution": "New auth module added; connection pool refactored with proper cleanup hooks.",
  "operational_risks": [
    "New OAuth2 env vars required",
    "DB pool change may affect high-concurrency behaviour"
  ],
  "mitigations": [
    "Document required env vars in runbook",
    "Run load tests before deploying to production"
  ],
  "notable_files": [
    { "path": "src/auth/oauth.ts", "reason": "New OAuth2 implementation" },
    { "path": "src/db/pool.ts", "reason": "Connection leak fix" }
  ],
  "fallback_used": false
}
```

---

## Fallback Behaviour

When `fallback_on_error: true` (default) and the LLM call fails:

- A heuristic analysis is generated from commit messages and file stats
- No external API calls are made
- `fallback_used` is set to `true` in the output
- The action exits **successfully** (not as a failure)

When `fallback_on_error: false` and the LLM fails, the action exits with a failure.

---

## Security Notes

- Raw git diffs are **never** sent to the LLM — only commit messages and file-change summaries
- API keys are consumed from secrets and never logged
- The `api_key` input is marked as non-required and defaults to empty string (safe for ollama)

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-improvement`
3. Make changes in `src/`
4. Run tests: `npm test`
5. Build: `npm run build`
6. Commit the updated `dist/` folder
7. Open a pull request

### Development Setup

```bash
git clone https://github.com/marco-jardim/changelog-analyze-action.git
cd changelog-analyze-action
npm install
npm test
npm run build
```

---

## License

[GPL-3.0](LICENSE) © marco-jardim
