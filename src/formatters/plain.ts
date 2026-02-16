import type { FileNode } from "../types";

export function formatPlain(nodes: FileNode[]): string {
  let output = "";
  for (const node of nodes) {
    if (node.type === "file") {
      output += `\n\nFile: ${node.path}\n`;
      output += "================================================================\n";
      if (node.error) {
        output += `Error: ${node.error}\n`;
      } else {
        output += node.content || "";
      }
    } else if (node.type === "directory" && node.children) {
      output += formatPlain(node.children);
    }
  }
  return output; // Don't trim excessively, but recursive calls will append
}
