import { describe, it, expect } from 'vitest';
import { formatPlain } from '../src/formatters/plain';
import { FileNode } from '../src/types';

describe('formatPlain', () => {
  it('formats files correctly', () => {
    const nodes: FileNode[] = [
      { path: 'src/index.ts', type: 'file', content: 'console.log("hello");' },
      { path: 'README.md', type: 'file', content: '# Readme' }
    ];
    const output = formatPlain(nodes);
    expect(output).toContain('File: src/index.ts');
    expect(output).toContain('console.log("hello");');
    expect(output).toContain('File: README.md');
    expect(output).toContain('# Readme');
  });

  it('handles directories recursively', () => {
    const nodes: FileNode[] = [
      {
        path: 'src',
        type: 'directory',
        children: [
          { path: 'src/utils.ts', type: 'file', content: 'export const util = {};' }
        ]
      }
    ];
    const output = formatPlain(nodes);
    expect(output).toContain('File: src/utils.ts');
    expect(output).toContain('export const util = {};');
  });

  it('handles errors', () => {
    const nodes: FileNode[] = [
      { path: 'error.ts', type: 'file', error: 'Fetch failed' }
    ];
    const output = formatPlain(nodes);
    expect(output).toContain('Error: Fetch failed');
  });
});
