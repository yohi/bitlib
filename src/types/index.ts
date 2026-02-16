import type { paths } from "./bitbucket-schema";

export interface FileNode {
  path: string;
  type: "file" | "directory";
  content?: string; // Text content for files
  size?: number;
  children?: FileNode[]; // Only for directories
  raw_url?: string;
  error?: string;
}

export type Variables = {
  authHeader: string | null;
};

export type BitbucketSrcResponse =
  paths["/repositories/{workspace}/{repo_slug}/src/{commit}/{path}"]["get"]["responses"][200]["content"]["application/json"];

export type BitbucketTreeEntry = NonNullable<BitbucketSrcResponse["values"]>[number];
