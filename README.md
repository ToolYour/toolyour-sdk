# @toolyour/sdk

Official **TypeScript/JavaScript client** for [ToolYour](https://www.toolyour.com) — call SEO, security, document conversion, text utilities, and 270+ API-backed tools as typed functions instead of hand-written `fetch` URLs.

**One API key** (`ty_...`) · **same quota** as REST and MCP · **Node 18+**

[![npm version](https://img.shields.io/npm/v/@toolyour/sdk.svg)](https://www.npmjs.com/package/@toolyour/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Install

```bash
npm install @toolyour/sdk
```

Get an API key: [toolyour.com/signup](https://www.toolyour.com/signup) → Dashboard → API keys.

## Quick start

```typescript
import { ToolYour } from "@toolyour/sdk";

const ty = ToolYour({
  apiKey: process.env.TOOLYOUR_API_KEY!,
});

// SEO (GET tools — pass { url })
const meta = await ty.seo.metaTagsAnalyzer({
  url: "https://example.com",
});

// Text utilities (POST JSON)
const slug = await ty.text.convertToSlug({ text: "My Blog Post" });

// Security
const headers = await ty.security.securityHeadersAnalyzer({
  url: "https://example.com",
});

// Generic — any of 270+ operationIds
const audit = await ty.invoke("seoAnalyze", { url: "https://example.com" });
```

## MCP (Cursor / Claude)

```typescript
import { toolYourMcpServerConfigJson } from "@toolyour/sdk/mcp";

console.log(
  toolYourMcpServerConfigJson({
    apiKey: process.env.TOOLYOUR_API_KEY!,
  })
);
```

Or call tools from Node via REST (same quota as MCP):

```typescript
import { invokeMcpTool } from "@toolyour/sdk/mcp";

await invokeMcpTool(
  "metaTagsAnalyzer",
  { url: "https://example.com" },
  { apiKey: process.env.TOOLYOUR_API_KEY! }
);
```

Setup guide: [toolyour.com/developers/mcp](https://www.toolyour.com/developers/mcp)

## Namespaces

| Namespace | Examples |
|-----------|----------|
| `seo` | `metaTagsAnalyzer`, `pageSpeedAnalyzer`, `seoAnalyze`, `linkExtractor` |
| `security` | `securityHeadersAnalyzer`, `sslTlsCertificateChecker`, `jwtDecoder` |
| `text` | `convertToSlug`, `textStats`, `compareTexts` |
| `convertors` | `convertToJpg`, `compressImage` |
| `documents` | `docx_to_pdf`, `pdf_to_docx` |
| `calculators` | `gst_calculator`, `emi_calculator` |
| … | See `client.listOperations()` |

All methods are **generated from the platform OpenAPI registry** — see [MAINTENANCE.md](./MAINTENANCE.md).

## Local gateway

```typescript
const ty = ToolYour({
  apiKey: process.env.TOOLYOUR_API_KEY!,
  baseUrl: "http://127.0.0.1:8888",
});
```

## Errors

```typescript
import { ToolYourQuotaError } from "@toolyour/sdk";

try {
  await ty.seo.metaTagsAnalyzer({ url: "https://example.com" });
} catch (err) {
  if (err instanceof ToolYourQuotaError) {
    // 429 — upgrade plan or wait for monthly reset
  }
}
```

## Links

- [Developer docs](https://www.toolyour.com/developers/docs)
- [MCP quickstart](https://www.toolyour.com/developers/docs/mcp-quickstart)
- [Pricing](https://www.toolyour.com/pricing)
- [Report issues](https://github.com/ToolYour/toolyour-sdk/issues)

## License

MIT © [ToolYour](https://www.toolyour.com)
