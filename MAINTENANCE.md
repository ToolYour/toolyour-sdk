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

Tag, GitHub Release, and npm (linked):

1. Bump `package.json` version (or `npm version patch|minor|major` — creates git tag `v0.1.2`).
2. Commit generated files if `sync:generate` changed anything.
3. Push branch **and** tag:

```powershell
git push origin main
git push origin v0.1.1
```

4. GitHub Actions **Release** workflow (`.github/workflows/release.yml`) runs on `v*` tags:
   - publishes `@toolyour/sdk@<version>` to npm with **provenance** (links tarball → GitHub commit)
   - creates a **GitHub Release** from the same tag with auto-generated notes

**One-time setup:** add repo secret `NPM_TOKEN` — npm granular token with **Publish** on `@toolyour/sdk` and **Bypass 2FA** if your org requires it. npm package page → **Repository** links to GitHub when `package.json` `repository.url` matches.

Manual fallback (local):

```powershell
npm publish --access public --provenance
```

After publish, verify: `npm view @toolyour/sdk version` · [npm package](https://www.npmjs.com/package/@toolyour/sdk) · [GitHub Releases](https://github.com/ToolYour/toolyour-sdk/releases).

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
