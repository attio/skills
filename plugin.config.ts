// The source for every manifest and marketplace file in this repo.
// After changing it, run `pnpm generate` and commit the result.
import { defineConfig } from "./scripts/lib/config.ts";

export default defineConfig({
  version: "0.0.0",
  repository: "attio/skills",
  author: { name: "Attio", url: "https://attio.com" },
  links: {
    website: "https://attio.com",
    documentation: "https://docs.attio.com",
    support: "https://attio.com/help",
    privacyPolicy: "https://attio.com/legal/privacy",
    termsOfService: "https://attio.com/legal/services-agreement",
  },
  marketplace: {
    name: "attio",
    displayName: "Attio",
    description: "Attio plugins for Claude, Claude Code, ChatGPT and Codex.",
  },
  plugins: [
    {
      name: "attio",
      displayName: "Attio",
      description: "Run your sales day in Attio: prep meetings, update deals, review pipeline.",
      keywords: ["attio", "crm", "sales"],
      category: "Productivity",
      mcpServers: { attio: { url: "https://mcp.attio.com/mcp" } },
      listed: true,
      icon: "./assets/icon.png",
      openai: {
        shortDescription: "Run your sales day in Attio",
        longDescription:
          "Connect your Attio workspace to search, create and update records, prepare for meetings and review your pipeline.",
        logo: "./assets/icon.png",
        composerIcon: "./assets/icon.png",
        onboardingSkill: "onboarding",
      },
    },
    {
      name: "attio-dev",
      displayName: "Attio for developers",
      description: "Build and review Attio apps with the App SDK.",
      keywords: ["attio", "app-sdk", "developer-tools"],
      category: "Developer Tools",
      listed: false,
      termsOfService: "https://attio.com/legal/attio-developer-terms",
      openai: {
        shortDescription: "Build Attio apps",
        longDescription: "Build, debug and review Attio apps built with the Attio App SDK.",
      },
    },
  ],
});
