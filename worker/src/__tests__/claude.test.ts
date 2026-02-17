import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: vi.fn() },
    })),
  };
});

describe("claude client", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should throw when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const { getClaudeClient } = await import("../claude");

    expect(() => getClaudeClient()).toThrow("ANTHROPIC_API_KEY environment variable is required");
  });

  it("should create client when ANTHROPIC_API_KEY is set", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    const { getClaudeClient } = await import("../claude");

    const client = getClaudeClient();
    expect(client).toBeDefined();
    expect(client.messages).toBeDefined();
  });

  it("should return the same client instance on repeated calls", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    const { getClaudeClient } = await import("../claude");

    const client1 = getClaudeClient();
    const client2 = getClaudeClient();
    expect(client1).toBe(client2);
  });

  it("should create a new client after reset", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    const { getClaudeClient, resetClaudeClient } = await import("../claude");

    const client1 = getClaudeClient();
    resetClaudeClient();
    const client2 = getClaudeClient();
    expect(client1).not.toBe(client2);
  });
});
