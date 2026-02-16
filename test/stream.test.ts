import { afterEach, describe, expect, it, vi } from "vitest";
import { BitbucketClient } from "../src/services/bitbucket";
import type { FileNode } from "../src/types";

function file(path: string): FileNode {
  return { path, type: "file" };
}

function directory(path: string): FileNode {
  return { path, type: "directory" };
}

async function collectStream(
  client: BitbucketClient,
  path: string,
  ignorePatterns: string[] = [],
): Promise<string> {
  let output = "";
  for await (const chunk of client.streamTextTree(path, ignorePatterns)) {
    output += chunk;
  }
  return output;
}

describe("BitbucketClient.streamTextTree", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("streams sorted file output with headers and content", async () => {
    const client = new BitbucketClient("workspace", "repo", "commit", null);
    const directoryMap: Record<string, FileNode[]> = {
      "": [file("src/zeta.ts"), file("src/alpha.ts")],
    };

    const contentMap: Record<string, string> = {
      "src/alpha.ts": "alpha content",
      "src/zeta.ts": "zeta content",
    };

    const listingSpy = vi
      .spyOn(BitbucketClient.prototype, "fetchDirectoryListing")
      .mockImplementation(async (path) => directoryMap[path] ?? []);

    const contentSpy = vi
      .spyOn(BitbucketClient.prototype, "fetchFileContent")
      .mockImplementation(async (path) => contentMap[path]);

    const output = await collectStream(client, "");

    expect(output).toBe(
      "\n\nFile: src/alpha.ts\n================================================================\nalpha content" +
        "\n\nFile: src/zeta.ts\n================================================================\nzeta content",
    );
    expect(listingSpy).toHaveBeenCalledWith("");
    expect(contentSpy).toHaveBeenCalledTimes(2);
    expect(contentSpy.mock.calls.map(([path]) => path).sort()).toEqual([
      "src/alpha.ts",
      "src/zeta.ts",
    ]);
  });

  it("traverses nested directories recursively", async () => {
    const client = new BitbucketClient("workspace", "repo", "commit", null);
    const directoryMap: Record<string, FileNode[]> = {
      "": [file("z-root.txt"), directory("dir-a")],
      "dir-a": [file("dir-a/nested.txt")],
    };

    const contentMap: Record<string, string> = {
      "dir-a/nested.txt": "nested content",
      "z-root.txt": "root content",
    };

    const listingSpy = vi
      .spyOn(BitbucketClient.prototype, "fetchDirectoryListing")
      .mockImplementation(async (path) => directoryMap[path] ?? []);

    vi.spyOn(BitbucketClient.prototype, "fetchFileContent").mockImplementation(
      async (path) => contentMap[path],
    );

    const output = await collectStream(client, "");

    expect(output).toBe(
      "\n\nFile: dir-a/nested.txt\n================================================================\nnested content" +
        "\n\nFile: z-root.txt\n================================================================\nroot content",
    );
    expect(listingSpy).toHaveBeenCalledTimes(2);
    expect(listingSpy.mock.calls.map(([path]) => path)).toEqual(["", "dir-a"]);
  });

  it("skips files matching ignore patterns", async () => {
    const client = new BitbucketClient("workspace", "repo", "commit", null);
    const directoryMap: Record<string, FileNode[]> = {
      "": [file("keep.ts"), file("secret.txt")],
    };

    const contentMap: Record<string, string> = {
      "keep.ts": "keep content",
      "secret.txt": "secret content",
    };

    vi.spyOn(BitbucketClient.prototype, "fetchDirectoryListing").mockImplementation(
      async (path) => directoryMap[path] ?? [],
    );

    const contentSpy = vi
      .spyOn(BitbucketClient.prototype, "fetchFileContent")
      .mockImplementation(async (path) => contentMap[path]);

    const output = await collectStream(client, "", ["*.txt"]);

    expect(output).toBe(
      "\n\nFile: keep.ts\n================================================================\nkeep content",
    );
    expect(contentSpy).toHaveBeenCalledTimes(1);
    expect(contentSpy).toHaveBeenCalledWith("keep.ts");
  });

  it("prints file fetch errors and continues streaming other files", async () => {
    const client = new BitbucketClient("workspace", "repo", "commit", null);
    const directoryMap: Record<string, FileNode[]> = {
      "": [file("b-ok.txt"), file("a-fail.txt")],
    };

    vi.spyOn(BitbucketClient.prototype, "fetchDirectoryListing").mockImplementation(
      async (path) => directoryMap[path] ?? [],
    );

    vi.spyOn(BitbucketClient.prototype, "fetchFileContent").mockImplementation(async (path) => {
      if (path === "a-fail.txt") {
        throw new Error("network down");
      }
      return "ok content";
    });

    const output = await collectStream(client, "");

    expect(output).toBe(
      "\n\nFile: a-fail.txt\n================================================================\nError: network down" +
        "\n\nFile: b-ok.txt\n================================================================\nok content",
    );
  });
});
