import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getClaudeClient, getModel, resetClaudeClient } from "../src/claude";

describe("claude client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetClaudeClient();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetClaudeClient();
  });

  it("should throw if ANTHROPIC_API_KEY is not set", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => getClaudeClient()).toThrow("ANTHROPIC_API_KEY environment variable is required");
  });

  it("should return a client when API key is set", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const client = getClaudeClient();
    expect(client).toBeDefined();
  });

  it("should return same client instance (singleton)", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const client1 = getClaudeClient();
    const client2 = getClaudeClient();
    expect(client1).toBe(client2);
  });

  it("should return new client after reset", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const client1 = getClaudeClient();
    resetClaudeClient();
    const client2 = getClaudeClient();
    expect(client1).not.toBe(client2);
  });

  it("should return default model", () => {
    expect(getModel()).toBe("claude-sonnet-4-20250514");
  });
});
