import type { V3Options } from "@browserbasehq/stagehand";

const config: V3Options = {
  env: "LOCAL",
  verbose: 1,
  model: {
    modelName: "claude-sonnet-4-20250514",
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
};

export default config;
