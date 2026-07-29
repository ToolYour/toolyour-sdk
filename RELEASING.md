# Releasing @toolyour/sdk

One-time setup, then every release is tag-only.

## One-time: choose auth method (pick one)

### Option A — Trusted Publisher (recommended, no stored token)

1. Sign in at [npmjs.com](https://www.npmjs.com) as the `@toolyour` org maintainer.
2. Open **@toolyour/sdk** → **Settings** → **Trusted Publisher** → **GitHub Actions**.
3. Set:
   - **Organization or user:** `ToolYour`
   - **Repository:** `toolyour-sdk`
   - **Workflow filename:** `release.yml` (filename only)
   - **Environment:** leave blank
   - **Allowed actions:** `npm publish`
4. Save.

The Release workflow uses OIDC (`id-token: write`) — no `NPM_TOKEN` secret needed.

### Option B — GitHub secret (classic CI token)

1. npm → **Access Tokens** → **Generate New Token** → **Granular**
   - Packages: **Read and write** on `@toolyour/sdk`
   - Enable **Bypass 2FA for automation** if required
2. GitHub → **ToolYour/toolyour-sdk** → **Settings → Secrets and variables → Actions**
3. New secret: `NPM_TOKEN` = the token (never commit or paste in chat)
4. Re-run the failed Release workflow or re-push the tag.

---

## Publish a new version

From `toolyour-sdk/` after `npm run sync:generate` if the platform registry changed:

```powershell
npm version patch   # or minor / major
git push origin main
git push origin v0.1.2
```

What happens automatically:

1. Git tag `v*` triggers `.github/workflows/release.yml`
2. CI runs typecheck, tests, build
3. **npm** publishes `@toolyour/sdk@<version>` (with provenance when OIDC is configured)
4. **GitHub Release** is created from the same tag with auto-generated notes

Verify:

```powershell
npm view @toolyour/sdk version
```

- npm: https://www.npmjs.com/package/@toolyour/sdk
- Releases: https://github.com/ToolYour/toolyour-sdk/releases

## Link npm ↔ GitHub (how it stays connected)

| Link | Mechanism |
|------|-----------|
| npm **Repository** tab | `package.json` → `"repository": "git+https://github.com/ToolYour/toolyour-sdk.git"` |
| npm **Provenance** | `npm publish --provenance` (OIDC or token publish from GitHub Actions) |
| GitHub **Release** | `softprops/action-gh-release` on successful publish job |
| Same version | `package.json` version = git tag `vX.Y.Z` = npm dist-tag `latest` |

## Troubleshooting

| Error | Fix |
|-------|-----|
| `403` / need auth on publish | Complete **Option A** or **Option B** above |
| Trusted publisher mismatch | Workflow filename must be exactly `release.yml`; repo must be `ToolYour/toolyour-sdk` |
| `NPM_TOKEN` set but OIDC preferred | Remove `NPM_TOKEN` secret after trusted publisher works |
| Publish OK, no GitHub Release | Re-run workflow; release job runs after publish |
