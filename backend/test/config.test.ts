import { describe, expect, it } from "vitest";
import { DEFAULT_DATABASE_URL, loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("runs on defaults: local database, AI disabled", () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      API_PORT: 3001,
      DATABASE_URL: DEFAULT_DATABASE_URL,
      AI_ENABLED: false,
      CLAUDE_MODEL: "claude-opus-5-5",
    });
    expect(config.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("treats an empty API key as not set", () => {
    expect(loadConfig({ ANTHROPIC_API_KEY: "" }).ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("parses booleans and numbers from environment strings", () => {
    const config = loadConfig({ AI_ENABLED: "true", API_PORT: "4000" });
    expect(config.AI_ENABLED).toBe(true);
    expect(config.API_PORT).toBe(4000);
  });

  it("ignores the generic PORT variable that preview runners and hosts set", () => {
    expect(loadConfig({ PORT: "5173" }).API_PORT).toBe(3001);
  });

  it("names the bad variable when the environment is invalid", () => {
    expect(() => loadConfig({ API_PORT: "not-a-port" })).toThrow(/API_PORT/);
  });
});
