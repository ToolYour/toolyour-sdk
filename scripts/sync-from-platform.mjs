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
 *   ../toolyour-mcp/registry/workflows.json
 *   ../toolyour-mcp/skills/*.md
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
  mcpWorkflows: path.join(MONO_ROOT, "toolyour-mcp", "registry", "workflows.json"),
  mcpSkillsDir: path.join(MONO_ROOT, "toolyour-mcp", "skills"),
};

const DEST = {
  registry: path.join(SDK_ROOT, "openapi", "tool-routes.registry.mjs"),
  mcpManifest: path.join(SDK_ROOT, "openapi", "mcp-manifest.json"),
  mcpWorkflows: path.join(SDK_ROOT, "openapi", "mcp-workflows.json"),
  mcpSkills: path.join(SDK_ROOT, "openapi", "mcp-skills.json"),
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

/** @param {string} content */
function parseSkillFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  /** @type {Record<string, string | string[]>} */
  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(\w+):\s*(.+)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim();
    if (key === "operationIds") {
      fm.operationIds = value.split(",").map((s) => s.trim());
    } else {
      fm[key] = value;
    }
  }
  if (!fm.id) return null;
  return {
    id: String(fm.id),
    title: String(fm.title ?? fm.id),
    category: String(fm.category ?? "general"),
    description: String(fm.description ?? ""),
    operationIds: Array.isArray(fm.operationIds) ? fm.operationIds : [],
  };
}

function syncSkillsIndex() {
  if (!fs.existsSync(SOURCES.mcpSkillsDir)) {
    console.warn("WARN: MCP skills dir not found — skipping mcp-skills.json");
    return null;
  }
  /** @type {ReturnType<typeof parseSkillFrontmatter>[]} */
  const skills = [];
  for (const file of fs.readdirSync(SOURCES.mcpSkillsDir).sort()) {
    if (!file.endsWith(".md")) continue;
    const parsed = parseSkillFrontmatter(
      fs.readFileSync(path.join(SOURCES.mcpSkillsDir, file), "utf8")
    );
    if (parsed) skills.push(parsed);
  }
  fs.mkdirSync(path.dirname(DEST.mcpSkills), { recursive: true });
  fs.writeFileSync(DEST.mcpSkills, `${JSON.stringify({ skills }, null, 2)}\n`);
  console.log(`Wrote ${skills.length} skills → ${path.relative(SDK_ROOT, DEST.mcpSkills)}`);
  return sha256File(DEST.mcpSkills);
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

  let workflowsHash = null;
  if (fs.existsSync(SOURCES.mcpWorkflows)) {
    workflowsHash = copyRequired(
      SOURCES.mcpWorkflows,
      DEST.mcpWorkflows,
      "mcp-workflows.json"
    );
  } else {
    console.warn("WARN: MCP workflows.json not found — skipping");
  }

  const skillsHash = syncSkillsIndex();

  const lock = {
    syncedAt: new Date().toISOString(),
    registrySha256: registryHash,
    mcpManifestSha256: mcpHash,
    mcpWorkflowsSha256: workflowsHash,
    mcpSkillsSha256: skillsHash,
    platformPaths: {
      registry: path.relative(MONO_ROOT, SOURCES.registry).replace(/\\/g, "/"),
      mcpManifest: path.relative(MONO_ROOT, SOURCES.mcpManifest).replace(/\\/g, "/"),
      mcpWorkflows: path.relative(MONO_ROOT, SOURCES.mcpWorkflows).replace(/\\/g, "/"),
      mcpSkillsDir: path.relative(MONO_ROOT, SOURCES.mcpSkillsDir).replace(/\\/g, "/"),
    },
  };

  fs.writeFileSync(DEST.lock, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`Wrote ${path.relative(SDK_ROOT, DEST.lock)}`);
  console.log("\nNext: npm run generate");
}

main();
