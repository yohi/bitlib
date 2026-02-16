import pLimit from "p-limit";
import type { FileNode } from "../types";
import { shouldIgnore } from "../utils/ignore";
import { fetchDirectoryListing, fetchFileContent } from "./bitbucket";

// Shared concurrency limit for all network requests to avoid rate limits and connection limits
const limit = pLimit(10);

export async function fetchTree(
	workspace: string,
	repo_slug: string,
	commit: string,
	path: string,
	authHeader: string | null,
	ignorePatterns: string[] = [],
): Promise<FileNode[]> {
	// Use limited fetch for directory listing
	const entries = await limit(() =>
		fetchDirectoryListing(workspace, repo_slug, commit, path, authHeader),
	);

	const filteredEntries = entries.filter(
		(entry) => !shouldIgnore(entry.path, ignorePatterns),
	);

	const results: FileNode[] = [];
	const promises: Promise<void>[] = [];

	for (const entry of filteredEntries) {
		if (entry.type === "file") {
			promises.push(
				(async () => {
					try {
						// Use limited fetch for file content
						const content = await limit(() =>
							fetchFileContent(
								workspace,
								repo_slug,
								commit,
								entry.path,
								authHeader,
							),
						);
						results.push({ ...entry, content });
					} catch (err: any) {
						results.push({ ...entry, error: err.message });
					}
				})(),
			);
		} else if (entry.type === "directory") {
			promises.push(
				(async () => {
					try {
						// Recursive call is NOT limited, but its internal network calls are.
						// This avoids deadlock where a limited parent waits for a limited child.
						const children = await fetchTree(
							workspace,
							repo_slug,
							commit,
							entry.path,
							authHeader,
							ignorePatterns,
						);
						results.push({ ...entry, children });
					} catch (err: any) {
						results.push({ ...entry, error: err.message });
					}
				})(),
			);
		}
	}

	await Promise.all(promises);

	// Sort results by path for consistent output
	return results.sort((a, b) => a.path.localeCompare(b.path));
}
