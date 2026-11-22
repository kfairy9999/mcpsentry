import type { ExtractedTool, HttpSignals, Lockfile, ProjectFile } from '../types.js';
import { detectHttpSignals } from '../http-signals.js';
import { loadLockfiles } from '../lockfile.js';
import { walkSourceFiles } from '../walk.js';
import { extractToolsFromPython } from './python.js';
import { extractToolsFromTypeScript } from './typescript.js';

export interface ProjectModel {
  root: string;
  files: ProjectFile[];
  tools: ExtractedTool[];
  http: HttpSignals;
  lockfiles: Lockfile[];
}

export async function loadProject(root: string, exclude?: string[]): Promise<ProjectModel> {
  const files = await walkSourceFiles({ root, ...(exclude ? { exclude } : {}) });
  const tools: ExtractedTool[] = [];
  for (const file of files) {
    if (file.language === 'typescript' || file.language === 'javascript') {
      tools.push(...extractToolsFromTypeScript(file.relativePath, file.content));
    } else if (file.language === 'python') {
      tools.push(...extractToolsFromPython(file.relativePath, file.content));
    }
  }
  return {
    root,
    files,
    tools,
    http: detectHttpSignals(files),
    lockfiles: await loadLockfiles(root),
  };
}
