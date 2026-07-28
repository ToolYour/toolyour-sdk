#!/usr/bin/env node
/**
 * Copy OpenAPI route registry + MCP manifest from the ToolYour platform monorepo
 * into this SDK repo so CI and npm consumers stay aligned.
 *
 * Run from toolyour-sdk/: npm run sync
 *
 * Expected monorepo layout (sibling packages):
 *   ../docs/openapi/tool-routes.registry.mjs
 *   ../toolyour-mcp/registry/manifest.json
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = path.join(__dirname, "..");
const MONO_ROOT = path.join(SDK_ROOT, "..");

const SOURCES = {
  registry: path.join(MONO_ROOT, "docs", "openapi", "tool-routes.registry.mjs"),
  mcpManifest: path.join(MONO_ROOT, "toolyour-mcp", "registry", "manifest.json"),
};

const DEST = {
  registry: path.join(SDK_ROOT, "openapi", "tool-routes.registry.mjs"),
  mcpManifest: path.join(SDK_ROOT, "openapi", "mcp-manifest.json"),
  lock: path.join(SDK_ROOT, "openapi", "sync.lock.json"),
};

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function copyRequired(src, dest, label) {
  if (!fs.existsSync(src)) {
    console.error(`Missing ${label}: ${src}`);
    console.error("Run from ToolYour monorepo with docs + toolyour-mcp checked out.");
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copied ${label} → ${path.relative(SDK_ROOT, dest)}`);
  return sha256File(dest);
}

function main() {
  console.log("ToolYour SDK — sync from platform\n");

  const registryHash = copyRequired(SOURCES.registry, DEST.registry, "tool-routes.registry.mjs");
  let mcpHash = null;
  if (fs.existsSync(SOURCES.mcpManifest)) {
    mcpHash = copyRequired(SOURCES.mcpManifest, DEST.mcpManifest, "mcp-manifest.json");
  } else {
    console.warn("WARN: MCP manifest not found — skipping (optional for REST-only SDK)");
  }

  const lock = {
    syncedAt: new Date().toISOString(),
    registrySha256: registryHash,
    mcpManifestSha256: mcpHash,
    platformPaths: {
      registry: path.relative(MONO_ROOT, SOURCES.registry).replace(/\\/g, "/"),
      mcpManifest: path.relative(MONO_ROOT, SOURCES.mcpManifest).replace(/\\/g, "/"),
    },
  };

  fs.writeFileSync(DEST.lock, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`Wrote ${path.relative(SDK_ROOT, DEST.lock)}`);
  console.log("\nNext: npm run generate");
}

main();
