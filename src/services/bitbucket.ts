import pLimit from "p-limit";
import type { BitbucketSrcResponse, BitbucketTreeEntry, FileNode } from "../types";
import { shouldIgnore } from "../utils/ignore";

const API_BASE = "https://api.bitbucket.org/2.0";

function isCommitFile(
  entry: BitbucketTreeEntry,
): entry is BitbucketTreeEntry & { type: "commit_file" } {
  return entry.type === "commit_file";
}

function isCommitDirectory(
  entry: BitbucketTreeEntry,
): entry is BitbucketTreeEntry & { type: "commit_directory" } {
  return entry.type === "commit_directory";
}

function getEntryPath(entry: BitbucketTreeEntry): string | null {
  return typeof entry.path === "string" ? entry.path : null;
}

function getFileSize(entry: BitbucketTreeEntry): number | undefined {
  const size = (entry as { size?: unknown }).size;
  return typeof size === "number" ? size : undefined;
}

function getSelfHref(entry: BitbucketTreeEntry): string | undefined {
  const links = (entry as { links?: unknown }).links;
  if (!links || typeof links !== "object") return undefined;

  const self = (links as { self?: unknown }).self;
  if (!self || typeof self !== "object") return undefined;

  const href = (self as { href?: unknown }).href;
  return typeof href === "string" ? href : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Shared concurrency limit for all network requests to avoid rate limits and connection limits
const limit = pLimit(10);

export class BitbucketClient {
  constructor(
    private workspace: string,
    private repo_slug: string,
    private commit: string,
    private authHeader: string | null,
  ) {}

  private async fetchWithAuth(url: string): Promise<Response> {
    const headers: HeadersInit = {
      Accept: "application/json",
    };
    if (this.authHeader) {
      headers.Authorization = this.authHeader;
    }
    return fetch(url, { headers });
  }

  async fetchFileContent(path: string): Promise<string> {
    const cleanPath = path.replace(/^\//, "");
    const urlPath = cleanPath ? `/${cleanPath}` : "/";
    const url = `${API_BASE}/repositories/${this.workspace}/${this.repo_slug}/src/${this.commit}${urlPath}`;

    const res = await this.fetchWithAuth(url);
    if (!res.ok) throw new Error(`Failed to fetch file content: ${res.statusText}`);
    return res.text();
  }

  async fetchDirectoryListing(path: string): Promise<FileNode[]> {
    const cleanPath = path.replace(/^\//, "");
    // Ensure we don't have double slashes if path is empty
    const urlPath = cleanPath ? `/${cleanPath}` : "/";

    let url = `${API_BASE}/repositories/${this.workspace}/${this.repo_slug}/src/${this.commit}${urlPath}`;

    const entries: FileNode[] = [];

    while (url) {
      const res = await this.fetchWithAuth(url);

      if (!res.ok) {
        if (res.status === 404) throw new Error(`Path not found: ${path}`);
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error(`Bitbucket API error: ${res.statusText}`);
      }

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (contentType && !contentType.includes("application/json")) {
        // It's likely raw file content if we requested a file path
        // Return empty array as it's not a directory
        return [];
      }

      const data: BitbucketSrcResponse = await res.json();

      // data should be a PaginatedFiles struct with 'values'
      if (Array.isArray(data.values)) {
        for (const item of data.values) {
          const itemPath = getEntryPath(item);
          if (!itemPath) continue;

          if (isCommitFile(item)) {
            entries.push({
              path: itemPath,
              type: "file",
              size: getFileSize(item),
              raw_url: getSelfHref(item),
            });
          } else if (isCommitDirectory(item)) {
            entries.push({
              path: itemPath,
              type: "directory",
            });
          }
        }

        url = data.next ?? "";
      } else {
        // Not a paginated list, maybe single file metadata or something else
        break;
      }
    }

    return entries;
  }

  async getTree(path: string, ignorePatterns: string[] = []): Promise<FileNode[]> {
    // Use limited fetch for directory listing
    const entries = await limit(() => this.fetchDirectoryListing(path));

    const filteredEntries = entries.filter((entry) => !shouldIgnore(entry.path, ignorePatterns));

    const results: FileNode[] = [];
    const promises: Promise<void>[] = [];

    for (const entry of filteredEntries) {
      if (entry.type === "file") {
        promises.push(
          (async () => {
            try {
              // Use limited fetch for file content
              const content = await limit(() => this.fetchFileContent(entry.path));
              results.push({ ...entry, content });
            } catch (err: unknown) {
              results.push({ ...entry, error: getErrorMessage(err) });
            }
          })(),
        );
      } else if (entry.type === "directory") {
        promises.push(
          (async () => {
            try {
              // Recursive call is NOT limited, but its internal network calls are.
              // This avoids deadlock where a limited parent waits for a limited child.
              const children = await this.getTree(entry.path, ignorePatterns);
              results.push({ ...entry, children });
            } catch (err: unknown) {
              results.push({ ...entry, error: getErrorMessage(err) });
            }
          })(),
        );
      }
    }

    await Promise.all(promises);

    // Sort results by path for consistent output
    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  async *streamTextTree(path: string, ignorePatterns: string[] = []): AsyncGenerator<string> {
    // Use limited fetch for directory listing
    const entries = await limit(() => this.fetchDirectoryListing(path));

    const filteredEntries = entries
      .filter((entry) => !shouldIgnore(entry.path, ignorePatterns))
      .sort((a, b) => a.path.localeCompare(b.path));

    // Parallel fetch for files in current directory
    const filePromiseMap = new Map(
      filteredEntries
        .filter((e) => e.type === "file")
        .map((entry) => [
          entry.path,
          limit(() =>
            this.fetchFileContent(entry.path).catch((e: unknown) => `Error: ${getErrorMessage(e)}`),
          ),
        ]),
    );

    // Iterate over sorted entries
    for (const entry of filteredEntries) {
      if (entry.type === "file") {
        // Find the promise
        const task = filePromiseMap.get(entry.path);
        if (task) {
          const content = await task;
          yield `\n\nFile: ${entry.path}\n`;
          yield "================================================================\n";
          yield content;
        }
      } else if (entry.type === "directory") {
        // Recursive stream (sequential for directories to avoid huge memory usage)
        yield* this.streamTextTree(entry.path, ignorePatterns);
      }
    }
  }
}
