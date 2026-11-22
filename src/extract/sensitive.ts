export const SENSITIVE_PARAM_NAMES = new Set([
  'command',
  'cmd',
  'shell',
  'script',
  'exec',
  'path',
  'file',
  'filepath',
  'file_path',
  'filePath',
  'filename',
  'dir',
  'directory',
  'url',
  'uri',
  'endpoint',
  'sql',
  'query',
  'code',
  'expression',
  'eval',
]);

const CONSTRAINT_MARKERS = [
  '.enum(',
  '.nativeEnum(',
  '.regex(',
  '.refine(',
  '.pipe(',
  '.literal(',
  '.union(',
  'z.enum(',
  'z.literal(',
  'z.union(',
];

export function isSensitiveName(name: string): boolean {
  return SENSITIVE_PARAM_NAMES.has(name);
}

export function isUnconstrainedSchema(schemaText: string): boolean {
  const trimmed = schemaText.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return true;
  }
  if (CONSTRAINT_MARKERS.some((marker) => trimmed.includes(marker))) {
    return false;
  }
  if (/z\.any\s*\(/.test(trimmed) || /z\.unknown\s*\(/.test(trimmed)) {
    return true;
  }
  // A bare z.string() or z.string().describe(...) or TypeScript `str` / `string` is unconstrained.
  if (/^z\.string\s*\(/.test(trimmed)) {
    return true;
  }
  if (/^(str|string|Any)\s*$/.test(trimmed)) {
    return true;
  }
  return false;
}
