// The source for every manifest and marketplace file in this repo.
// After changing it, run `pnpm generate` and commit the result.
import { defineConfig } from "./scripts/lib/config.ts";

const keywords = [
  "attio",
  "crm",
  "sales",
  "pipeline",
  "deals",
  "accounts",
  "meetings",
  "email",
  "revops",
  "customer-success",
];

export default defineConfig({
  version: "0.1.0",
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
    description: "Attio plugins for Claude.",
  },
  plugins: [
    {
      name: "attio",
      displayName: "Attio",
      description: "Build pipeline, advance deals, and grow accounts.",
      keywords,
      category: "Business & Operations",
      claudeCategory: "sales",
      mcpServers: { attio: { url: "https://mcp.attio.com/mcp" } },
      listed: true,
      icon: "./assets/icon.png",
      openai: {
        shortDescription: "Build pipeline, grow accounts",
        longDescription:
          "Connect your Attio workspace to build pipeline, advance deals and grow accounts. Search, create and update records, and prepare for meetings.",
        logo: "./assets/icon.png",
        composerIcon: "./assets/icon.png",
        onboardingSkill: "onboarding",
      },
    },
    {
      name: "attio-dev",
      displayName: "Attio for developers",
      description: "Build and review Attio apps with the App SDK, REST API and MCP.",
      keywords: [...keywords, "app-sdk", "rest-api", "mcp", "developer-tools"],
      category: "Developer Tools",
      listed: false,
      termsOfService: "https://attio.com/legal/attio-developer-terms",
      openai: {
        shortDescription: "Build Attio apps",
        longDescription: "Build, debug and review Attio apps and integrations with the App SDK, REST API and MCP.",
      },
    },
  ],
});
