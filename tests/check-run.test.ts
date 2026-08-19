import { describe, expect, it } from "vitest";
import {
  assertSafeCommand,
  failingNames,
  fingerprint,
  splitCommand,
  submitHmacHex,
  treeHash,
} from "../src/mcp/check-run.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("check-run helpers", () => {
  it("splits commands without a shell", () => {
    expect(splitCommand("node --test tests/add.test.js")).toEqual([
      "node",
      "--test",
      "tests/add.test.js",
    ]);
  });

  it("refuses metacharacters in frozen commands", () => {
    expect(() => assertSafeCommand("node --test foo.js; rm -rf /")).toThrow(
      /unsafe/
    );
    expect(() => assertSafeCommand("node --test tests/add.test.js")).not.toThrow();
  });

  it("fingerprints failing TAP names", () => {
    const out = "not ok 1 - adds two numbers\n";
    expect(fingerprint("fail", 1, out)).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint("pass", 0, out)).toBe("pass");
    expect(failingNames(out)).toEqual(["adds two numbers"]);
  });

  it("fingerprints Playwright list-reporter failures", () => {
    const out =
      "  1) [chromium] › e2e/smoke.spec.ts:4:1 › checkout › pays ────────\n";
    expect(failingNames(out)[0]).toMatch(/smoke\.spec/);
    expect(fingerprint("fail", 1, out)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("treeHash is stable for the same files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ty-tree-"));
    fs.mkdirSync(path.join(dir, "lib"));
    fs.writeFileSync(path.join(dir, "lib", "a.js"), "export const x = 1;\n");
    const a = treeHash(dir);
    const b = treeHash(dir);
    expect(a).toBe(b);
    fs.appendFileSync(path.join(dir, "lib", "a.js"), "//\n");
    expect(treeHash(dir)).not.toBe(a);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("submitHmacHex matches a known algorithm", () => {
    const row = {
      checkId: "chk_test",
      status: "fail",
      exitCode: 1,
      fingerprint: "abc",
    };
    const hex = submitHmacHex("abcdefghijklmnop", "job-1", "nonce", "tree", [
      row,
    ]);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(
      submitHmacHex("abcdefghijklmnop", "job-1", "nonce", "tree", [
        { ...row, fingerprint: "zzz" },
      ])
    ).not.toBe(hex);
  });
});
