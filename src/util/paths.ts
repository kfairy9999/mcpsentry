import path from 'node:path';

export function toPosix(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

export function relativePosix(root: string, filePath: string): string {
  return toPosix(path.relative(root, filePath));
}

export const DEFAULT_EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  '.wrangler',
  '.stryker-tmp',
  '.venv',
  'venv',
  '__pycache__',
  '.tox',
  'build',
]);

export const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.py',
]);

export function languageOf(filePath: string): 'typescript' | 'javascript' | 'python' | 'other' {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') {
    return 'typescript';
  }
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') {
    return 'javascript';
  }
  if (ext === '.py') {
    return 'python';
  }
  return 'other';
}
