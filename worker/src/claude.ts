import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    if (!config.anthropic.apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return client;
}

export function resetClaudeClient(): void {
  client = null;
}
