import { type Context, Hono } from "hono";
import { streamText } from "hono/streaming";
import { authMiddleware } from "./middlewares/auth";
import { BitbucketClient } from "./services/bitbucket";
import type { FileNode, Variables } from "./types";

const app = new Hono<{ Variables: Variables; Bindings: CloudflareBindings }>();

app.use("*", authMiddleware);

const handler = async (c: Context<{ Variables: Variables; Bindings: CloudflareBindings }>) => {
  const workspace = c.req.param("workspace");
  const repo_slug = c.req.param("repo_slug");
  const pathParam = c.req.param("path") || "";

  const query = c.req.query();
  let branch = query.branch;
  const userProvidedBranch = !!branch;
  if (!branch) branch = "main";

  const format = query.format || "text";
  const ignore = query.ignore ? query.ignore.split(",") : [];

  const authHeader = c.get("authHeader");

  try {
    // Helper to fetch ignore patterns
    const getIgnorePatterns = async (client: BitbucketClient) => {
      const ignoreFiles = [".gitignore", ".genignore"];
      const ignoreContents = await Promise.all(
        ignoreFiles.map(async (f) => {
          try {
            return await client.fetchFileContent(f);
          } catch (e: any) {
            return "";
          }
        }),
      );
      return ignoreContents
        .filter(Boolean)
        .flatMap((content) => content.split("\n"))
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
    };

    // Helper to find valid branch (main or master fallback)
    const findValidBranch = async (initialBranch: string) => {
      let client = new BitbucketClient(workspace, repo_slug, initialBranch, authHeader);
      try {
        // Try to fetch root listing to verify branch existence
        // This prevents starting a stream on a non-existent branch
        await client.fetchDirectoryListing("");
        return client;
      } catch (e: any) {
        if (
          !userProvidedBranch &&
          initialBranch === "main" &&
          (e.message.toLowerCase().includes("not found") || e.message.includes("404"))
        ) {
          // Retry with master
          client = new BitbucketClient(workspace, repo_slug, "master", authHeader);
          await client.fetchDirectoryListing("");
          return client;
        }
        throw e;
      }
    };

    const client = await findValidBranch(branch);
    const dynamicIgnores = await getIgnorePatterns(client);
    const combinedIgnore = [...ignore, ...dynamicIgnores];

    if (format === "json") {
      const nodes = await client.getTree(pathParam, combinedIgnore);
      return c.json(nodes);
    } else {
      return streamText(c, async (stream) => {
        for await (const chunk of client.streamTextTree(pathParam, combinedIgnore)) {
          await stream.write(chunk);
        }
      });
    }
  } catch (err: any) {
    const message = err.message || "Internal Server Error";
    if (message.toLowerCase().includes("unauthorized") || message.includes("401")) {
      return c.text("Unauthorized", 401);
    }
    if (message.toLowerCase().includes("not found") || message.includes("404")) {
      return c.text(`Repository or path not found: ${message}`, 404);
    }
    return c.text(`Error: ${message}`, 500);
  }
};

app.get("/:workspace/:repo_slug", handler);
app.get("/:workspace/:repo_slug/:path{*}", handler);

export default app;
