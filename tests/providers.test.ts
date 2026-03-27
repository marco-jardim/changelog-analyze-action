/**
 * Tests for provider selection, request format, and HTTP mocking.
 */

import { createProvider, FireworksProvider, OpenAIProvider, AnthropicProvider, OllamaProvider } from "../src/providers/index.js";
import { extractJson, buildInsightsFromLLMResponse } from "../src/providers/BaseProvider.js";
import {
  SIMPLE_CHANGESET,
  DEFAULT_ANALYZE_OPTIONS,
  SAMPLE_LLM_JSON_RESPONSE,
} from "./fixtures.js";
import type { AnalyzeOptions } from "../src/types.js";

// ─── createProvider factory ───────────────────────────────────────────────────

describe("createProvider", () => {
  test("returns FireworksProvider for 'fireworks'", () => {
    expect(createProvider("fireworks")).toBeInstanceOf(FireworksProvider);
  });

  test("returns OpenAIProvider for 'openai'", () => {
    expect(createProvider("openai")).toBeInstanceOf(OpenAIProvider);
  });

  test("returns AnthropicProvider for 'anthropic'", () => {
    expect(createProvider("anthropic")).toBeInstanceOf(AnthropicProvider);
  });

  test("returns OllamaProvider for 'ollama'", () => {
    expect(createProvider("ollama")).toBeInstanceOf(OllamaProvider);
  });

  test("throws on unknown provider", () => {
    expect(() => createProvider("unknown" as "fireworks")).toThrow();
  });
});

// ─── extractJson helper ───────────────────────────────────────────────────────

describe("extractJson", () => {
  test("returns clean JSON when no wrapping", () => {
    const raw = '{"foo": "bar"}';
    expect(extractJson(raw)).toBe('{"foo": "bar"}');
  });

  test("strips markdown code fences", () => {
    const raw = "```json\n{\"foo\": \"bar\"}\n```";
    expect(extractJson(raw)).toBe('{"foo": "bar"}');
  });

  test("strips markdown fences without language tag", () => {
    const raw = "```\n{\"foo\": \"bar\"}\n```";
    expect(extractJson(raw)).toBe('{"foo": "bar"}');
  });

  test("extracts JSON from surrounding prose", () => {
    const raw = 'Here is the result: {"foo": "bar"} and some trailing text.';
    const extracted = extractJson(raw);
    expect(JSON.parse(extracted)).toEqual({ foo: "bar" });
  });
});

// ─── buildInsightsFromLLMResponse ─────────────────────────────────────────────

describe("buildInsightsFromLLMResponse", () => {
  test("builds complete InsightsV1 from LLM response", () => {
    const result = buildInsightsFromLLMResponse(
      SAMPLE_LLM_JSON_RESPONSE,
      SIMPLE_CHANGESET,
      DEFAULT_ANALYZE_OPTIONS,
      "fireworks"
    );

    expect(result.schema_version).toBe("1");
    expect(result.fallback_used).toBe(false);
    expect(result.repo).toBe("acme/my-service");
    expect(result.highlights).toEqual(SAMPLE_LLM_JSON_RESPONSE.highlights);
    expect(result.provider).toBe("fireworks");
    expect(result.model).toBe(DEFAULT_ANALYZE_OPTIONS.model);
  });

  test("handles missing fields gracefully", () => {
    const sparse = { highlights: ["one thing"] };
    const result = buildInsightsFromLLMResponse(
      sparse,
      SIMPLE_CHANGESET,
      DEFAULT_ANALYZE_OPTIONS,
      "openai"
    );
    expect(result.what_changed).toBe("");
    expect(result.operational_risks).toEqual([]);
    expect(result.notable_files).toEqual([]);
  });

  test("filters non-string items from string arrays", () => {
    const mixed = {
      ...SAMPLE_LLM_JSON_RESPONSE,
      highlights: ["good string", 42, null, "another string"],
    };
    const result = buildInsightsFromLLMResponse(
      mixed,
      SIMPLE_CHANGESET,
      DEFAULT_ANALYZE_OPTIONS,
      "fireworks"
    );
    expect(result.highlights).toEqual(["good string", "another string"]);
  });
});

// ─── Provider HTTP mocking ────────────────────────────────────────────────────

const MOCK_OPENAI_RESPONSE = {
  choices: [{ message: { content: JSON.stringify(SAMPLE_LLM_JSON_RESPONSE) } }],
};

const MOCK_ANTHROPIC_RESPONSE = {
  content: [{ type: "text", text: JSON.stringify(SAMPLE_LLM_JSON_RESPONSE) }],
};

const MOCK_OLLAMA_RESPONSE = {
  message: { content: JSON.stringify(SAMPLE_LLM_JSON_RESPONSE) },
  done: true,
};

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockClear();
});

function makeFetchMock(body: unknown, status = 200): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe("FireworksProvider HTTP request", () => {
  test("sends correct headers and body", async () => {
    mockFetch.mockImplementation(makeFetchMock(MOCK_OPENAI_RESPONSE));
    const provider = new FireworksProvider();
    await provider.analyze(SIMPLE_CHANGESET, DEFAULT_ANALYZE_OPTIONS);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.fireworks.ai");
    expect(url).toContain("chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-api-key");
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.model).toBe(DEFAULT_ANALYZE_OPTIONS.model);
    expect(sentBody.messages).toHaveLength(2);
  });

  test("throws on non-200 response", async () => {
    mockFetch.mockImplementation(makeFetchMock({ error: "rate limited" }, 429));
    const provider = new FireworksProvider();
    await expect(provider.analyze(SIMPLE_CHANGESET, DEFAULT_ANALYZE_OPTIONS)).rejects.toThrow(
      /Fireworks API error 429/
    );
  });
});

describe("OpenAIProvider HTTP request", () => {
  test("sends correct URL and auth header", async () => {
    mockFetch.mockImplementation(makeFetchMock(MOCK_OPENAI_RESPONSE));
    const provider = new OpenAIProvider();
    const opts: AnalyzeOptions = { ...DEFAULT_ANALYZE_OPTIONS, provider: "openai", model: "gpt-4o-mini" };
    await provider.analyze(SIMPLE_CHANGESET, opts);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.openai.com");
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toContain("Bearer");
  });
});

describe("AnthropicProvider HTTP request", () => {
  test("sends x-api-key and anthropic-version headers", async () => {
    mockFetch.mockImplementation(makeFetchMock(MOCK_ANTHROPIC_RESPONSE));
    const provider = new AnthropicProvider();
    const opts: AnalyzeOptions = { ...DEFAULT_ANALYZE_OPTIONS, provider: "anthropic", model: "claude-3-5-haiku-20241022" };
    await provider.analyze(SIMPLE_CHANGESET, opts);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.anthropic.com");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-api-key");
    expect(headers["anthropic-version"]).toBeDefined();
  });

  test("uses system and user message format (not messages[0].role=system)", async () => {
    mockFetch.mockImplementation(makeFetchMock(MOCK_ANTHROPIC_RESPONSE));
    const provider = new AnthropicProvider();
    const opts: AnalyzeOptions = { ...DEFAULT_ANALYZE_OPTIONS, provider: "anthropic", model: "claude-3-5-haiku-20241022" };
    await provider.analyze(SIMPLE_CHANGESET, opts);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(init.body as string);
    // Anthropic uses top-level `system` field, not a messages[0].role=system
    expect(sentBody.system).toBeDefined();
    expect(sentBody.messages[0].role).toBe("user");
  });
});

describe("OllamaProvider HTTP request", () => {
  test("sends to /api/chat on default localhost URL", async () => {
    mockFetch.mockImplementation(makeFetchMock(MOCK_OLLAMA_RESPONSE));
    const provider = new OllamaProvider();
    const opts: AnalyzeOptions = { ...DEFAULT_ANALYZE_OPTIONS, provider: "ollama", model: "llama3.2" };
    await provider.analyze(SIMPLE_CHANGESET, opts);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("localhost:11434");
    expect(url).toContain("/api/chat");
  });

  test("uses custom base_url when provided", async () => {
    mockFetch.mockImplementation(makeFetchMock(MOCK_OLLAMA_RESPONSE));
    const provider = new OllamaProvider();
    const opts: AnalyzeOptions = {
      ...DEFAULT_ANALYZE_OPTIONS,
      provider: "ollama",
      model: "llama3.2",
      baseUrl: "http://my-gpu-server:11434",
    };
    await provider.analyze(SIMPLE_CHANGESET, opts);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("my-gpu-server:11434");
  });
});
