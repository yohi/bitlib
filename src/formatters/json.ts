import type { FileNode } from "../types";

export function formatJson(nodes: FileNode[]): string {
	return JSON.stringify(nodes, null, 2);
}
