import ignore from "ignore";

const BINARY_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "ico",
  "webp",
  "avif",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
  "tar",
  "gz",
  "tgz",
  "rar",
  "7z",
  "iso",
  "bin",
  "exe",
  "dll",
  "so",
  "dylib",
  "mp4",
  "webm",
  "ogg",
  "mp3",
  "wav",
  "flac",
  "aac",
];

const DEFAULT_IGNORE_PATTERNS = [
  ".git/",
  "node_modules/",
  ".DS_Store",
  "Thumbs.db",
  ".env*",
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
  "dist/",
  "build/",
  ...BINARY_EXTENSIONS.map((ext) => `*.${ext}`),
];

export function shouldIgnore(filepath: string, customPatterns: string[] = []): boolean {
  const ig = ignore().add(DEFAULT_IGNORE_PATTERNS).add(customPatterns);
  return ig.ignores(filepath);
}
