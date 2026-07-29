# Maintaining @toolyour/sdk (tool sync)

**Published:** [`@toolyour/sdk` on npm](https://www.npmjs.com/package/@toolyour/sdk) · [GitHub](https://github.com/ToolYour/toolyour-sdk)

This SDK stays aligned with the **private ToolYour platform** via a copy-and-generate pipeline. The server implementation stays closed source; the **route registry** is the public contract.

## Source of truth (private monorepo)

| Platform file | Role |
|---------------|------|
| `docs/openapi/tool-routes.registry.mjs` | Every customer tool route (method, path, operationId, multipart, query) |
| `docs/scripts/build-customer-openapi.mjs` | Builds `customer-tools.openapi.yaml` |
| `toolyour-mcp/registry/manifest.json` | MCP tool names + operationIds (`hasApi` tools) |

When you add or change a tool route in `toolyour-apis` / `toolyour-py-apis`:

1. Update `docs/openapi/tool-routes.registry.mjs`
2. Run `cd docs && npm run build:openapi`
3. Update customer MDX if behavior changed (see `api-docs-sync` skill)

## SDK sync workflow (maintainers)

From **`toolyour-sdk/`** (sibling to `docs/`):

```powershell
npm run sync:generate   # copy registry + regenerate src/generated/*
npm run typecheck
npm run test
npm run build
```

Commit:

- `openapi/tool-routes.registry.mjs` (snapshot)
- `openapi/sync.lock.json` (SHA + timestamp)
- `src/generated/routes.ts` + `namespaces.ts`

Tag and publish:

```powershell
npm version patch
git push --follow-tags
npm publish --access public
```

Requires npm **2FA** or a **granular access token with Bypass 2FA** (see npm account settings). After publish, verify: `npm view @toolyour/sdk version`.

## CI drift check (recommended)

In **private `docs` repo CI**, after `build:openapi`:

```powershell
cd ../toolyour-sdk
npm run sync:generate
git diff --exit-code src/generated openapi/sync.lock.json
```

Fail the build if the SDK was not regenerated — prevents shipping API changes without a client update.

## Versioning

| Change | SDK bump |
|--------|----------|
| New tool route (additive) | **minor** (`0.2.0`) |
| Removed / renamed operationId | **major** |
| Request body breaking change | **major** |
| Docs / README only | no release |

## Namespace map

OpenAPI **tags** map to SDK namespaces in `scripts/generate-sdk.mjs` (`TAG_TO_NAMESPACE`). Add a row when introducing a new API module tag.

## MCP vs REST in this SDK

- **`ty.seo.metaTagsAnalyzer()`** → REST (best for Node/apps)
- **`toolYourMcpServerConfig()`** → config for Cursor/Claude remote MCP
- **`invokeMcpTool()`** → REST shim keyed by MCP tool name (same quota)

Do not reimplement the MCP server in this repo.

## Platform coupling

See [`../docs/PLATFORM-COUPLING.md`](../docs/PLATFORM-COUPLING.md) — row: **REST tool route change → regenerate OpenAPI → sync SDK → publish patch**.

## GitHub discovery (legitimate)

- Keep README focused on MCP + SEO/security examples
- `examples/cursor-mcp/` with copy-paste `mcp.json`
- Link from [toolyour.com/developers](https://www.toolyour.com/developers)
- Topics: `mcp-server`, `typescript-sdk`, `seo-api`, `cursor`

Do **not** auto-generate 270 README sections or spam unrelated awesome lists.
