import { Hono, type Context } from 'hono';
import { formatPlain } from './formatters/plain';
import { authMiddleware } from './middlewares/auth';
import { fetchTree } from './services/tree';
import type { FileNode, Variables } from './types';

const app = new Hono<{ Variables: Variables }>();

app.use('*', authMiddleware);

const handler = async (c: Context<{ Variables: Variables }>) => {
  const workspace = c.req.param('workspace');
  const repo_slug = c.req.param('repo_slug');
  const pathParam = c.req.param('path') || '';

  const query = c.req.query();
  let branch = query.branch;
  const userProvidedBranch = !!branch;
  if (!branch) branch = 'main';

  const format = query.format || 'text';
  const ignore = query.ignore ? query.ignore.split(',') : [];

  const authHeader = c.get('authHeader');

  try {
    let nodes: FileNode[];
    try {
      nodes = await fetchTree(
        workspace,
        repo_slug,
        branch,
        pathParam,
        authHeader,
        ignore,
      );
    } catch (err: any) {
      // Retry with 'master' if 'main' failed and branch wasn't specified
      // Only if the error suggests the branch/path wasn't found (404)
      if (
        !userProvidedBranch &&
        branch === 'main' &&
        (err.message.toLowerCase().includes('not found') ||
          err.message.includes('404'))
      ) {
        nodes = await fetchTree(
          workspace,
          repo_slug,
          'master',
          pathParam,
          authHeader,
          ignore,
        );
      } else {
        throw err;
      }
    }

    if (format === 'json') {
      return c.json(nodes);
    } else {
      const text = formatPlain(nodes);
      return c.text(text);
    }
  } catch (err: any) {
    const message = err.message || 'Internal Server Error';
    if (
      message.toLowerCase().includes('unauthorized') ||
      message.includes('401')
    ) {
      return c.text('Unauthorized', 401);
    }
    if (
      message.toLowerCase().includes('not found') ||
      message.includes('404')
    ) {
      return c.text(`Repository or path not found: ${message}`, 404);
    }
    return c.text(`Error: ${message}`, 500);
  }
};

app.get('/:workspace/:repo_slug', handler);
app.get('/:workspace/:repo_slug/:path{*}', handler);

export default app;
