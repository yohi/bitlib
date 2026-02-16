import { describe, expect, it } from "vitest";
import { shouldIgnore } from "../src/utils/ignore";

describe("shouldIgnore", () => {
  it("ignores standard binaries", () => {
    expect(shouldIgnore("foo.png")).toBe(true);
    expect(shouldIgnore("images/foo.jpg")).toBe(true);
    expect(shouldIgnore("docs/manual.pdf")).toBe(true);
    expect(shouldIgnore("archive.zip")).toBe(true);
  });

  it("ignores standard folders", () => {
    expect(shouldIgnore("node_modules/foo")).toBe(true);
    expect(shouldIgnore(".git/config")).toBe(true);
    expect(shouldIgnore("dist/bundle.js")).toBe(true);
    expect(shouldIgnore("build/output.css")).toBe(true);
  });

  it("does not ignore source files", () => {
    expect(shouldIgnore("src/index.ts")).toBe(false);
    expect(shouldIgnore("README.md")).toBe(false);
    expect(shouldIgnore("package.json")).toBe(false);
  });

  it("respects custom patterns", () => {
    expect(shouldIgnore("secret.txt", ["*.txt"])).toBe(true);
    expect(shouldIgnore("src/index.ts", ["*.ts"])).toBe(true);
    expect(shouldIgnore("foo.bar", ["foo.*"])).toBe(true);
  });

  it("handles dotfiles correctly", () => {
    expect(shouldIgnore(".env")).toBe(true);
    expect(shouldIgnore(".env.local")).toBe(true);
    expect(shouldIgnore(".DS_Store")).toBe(true);
  });
});
