import type { FileNode } from "../types";
import type { paths } from "../types/bitbucket-schema";

const API_BASE = "https://api.bitbucket.org/2.0";

// We use 'any' for the response type because the generated types for the src endpoint
// can be complex (union of file, directory, paginated list, etc) and we want to be practical.
// However, strictly it matches the schema.
type SrcResponse =
	paths["/repositories/{workspace}/{repo_slug}/src/{commit}/{path}"]["get"]["responses"]["200"]["content"]["application/json"];

async function fetchWithAuth(
	url: string,
	authHeader: string | null,
): Promise<Response> {
	const headers: HeadersInit = {
		Accept: "application/json",
	};
	if (authHeader) {
		headers["Authorization"] = authHeader;
	}
	return fetch(url, { headers });
}

export async function fetchDirectoryListing(
	workspace: string,
	repo_slug: string,
	commit: string,
	path: string,
	authHeader: string | null,
): Promise<FileNode[]> {
	const cleanPath = path.replace(/^\//, "");
	// Ensure we don't have double slashes if path is empty
	const urlPath = cleanPath ? `/${cleanPath}` : "/";

	let url = `${API_BASE}/repositories/${workspace}/${repo_slug}/src/${commit}${urlPath}`;

	const entries: FileNode[] = [];

	while (url) {
		const res = await fetchWithAuth(url, authHeader);

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

		const data = (await res.json()) as any; // Cast to any to handle paginated structure easier

		// data should be a PaginatedFiles struct with 'values'
		if (data.values && Array.isArray(data.values)) {
			for (const item of data.values) {
				if (item.type === "commit_file") {
					entries.push({
						path: item.path,
						type: "file",
						size: item.size,
						raw_url: item.links?.self?.href,
					});
				} else if (item.type === "commit_directory") {
					entries.push({
						path: item.path,
						type: "directory",
					});
				}
			}

			url = data.next || "";
		} else {
			// Not a paginated list, maybe single file metadata or something else
			break;
		}
	}

	return entries;
}

export async function fetchFileContent(
	workspace: string,
	repo_slug: string,
	commit: string,
	path: string,
	authHeader: string | null,
): Promise<string> {
	const cleanPath = path.replace(/^\//, "");
	const urlPath = cleanPath ? `/${cleanPath}` : "/";
	const url = `${API_BASE}/repositories/${workspace}/${repo_slug}/src/${commit}${urlPath}`;

	const res = await fetchWithAuth(url, authHeader);
	if (!res.ok)
		throw new Error(`Failed to fetch file content: ${res.statusText}`);
	return res.text();
}
