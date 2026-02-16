export interface FileNode {
  path: string;
  type: 'file' | 'directory';
  content?: string; // Text content for files
  size?: number;
  children?: FileNode[]; // Only for directories
  raw_url?: string;
  error?: string;
}

export type Variables = {
  authHeader: string | null;
};
