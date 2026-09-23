import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export type ResolveResult =
  | { status: 'ok'; uri: vscode.Uri }
  | { status: 'blocked'; reason: string }
  | { status: 'not_found' }
  | { status: 'no_workspace' };

export async function isInsideWorkspace(
  candidateFsPath: string,
  workspaceFolders: readonly vscode.WorkspaceFolder[]
): Promise<{ inside: boolean; realPath: string; error?: unknown }> {
  for (const folder of workspaceFolders) {
    const root = path.resolve(folder.uri.fsPath);
    const resolvedCandidate = path.resolve(candidateFsPath);
    const rel = path.relative(root, resolvedCandidate);
    const isContained = !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep);
    if (isContained) {
      return { inside: true, realPath: resolvedCandidate };
    }
  }
  return { inside: false, realPath: candidateFsPath };
}

export async function resolveTargetFile(targetFile: string): Promise<ResolveResult> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return { status: 'no_workspace' };
  }

  if (!targetFile || targetFile.trim() === '') {
    return { status: 'not_found' };
  }

  // 2. Absolute path: only allowed if it's inside one of the workspace folders
  if (path.isAbsolute(targetFile)) {
    let exists = false;
    try {
      await fs.promises.lstat(targetFile);
      exists = true;
    } catch {
      exists = false;
    }

    const check = await isInsideWorkspace(targetFile, workspaceFolders);
    if (!check.inside) {
      return { status: 'blocked', reason: 'targetFile is outside the workspace' };
    }
    if (!exists) {
      return { status: 'not_found' };
    }
    return { status: 'ok', uri: vscode.Uri.file(check.realPath) };
  }

  // 3. Relative path with any '..' segment
  const segments = targetFile.split(/[/\\]/);
  if (segments.includes('..')) {
    return { status: 'blocked', reason: 'targetFile contains directory traversal segment ".."' };
  }

  // 4. Relative path: try exact path under each workspace folder
  for (const folder of workspaceFolders) {
    const exactPath = path.join(folder.uri.fsPath, targetFile);
    let exists = false;
    try {
      await fs.promises.lstat(exactPath);
      exists = true;
    } catch {
      exists = false;
    }

    if (exists) {
      const check = await isInsideWorkspace(exactPath, workspaceFolders);
      if (!check.inside) {
        return { status: 'blocked', reason: 'targetFile is outside the workspace' };
      }
      return { status: 'ok', uri: vscode.Uri.file(check.realPath) };
    }
  }

  // Fallback to findFiles(targetFile, '**/node_modules/**', 1)
  const exactMatches = await vscode.workspace.findFiles(targetFile, '**/node_modules/**', 1);
  for (const match of exactMatches) {
    if (match.scheme !== 'file') {
      continue;
    }
    const candidatePath = match.fsPath;
    const check = await isInsideWorkspace(candidatePath, workspaceFolders);
    if (!check.inside) {
      return { status: 'blocked', reason: 'targetFile is outside the workspace' };
    }
    return { status: 'ok', uri: vscode.Uri.file(check.realPath) };
  }

  // Fallback to findFiles('**/' + targetFile, '**/node_modules/**', 1)
  const globMatches = await vscode.workspace.findFiles('**/' + targetFile, '**/node_modules/**', 1);
  for (const match of globMatches) {
    if (match.scheme !== 'file') {
      continue;
    }
    const candidatePath = match.fsPath;
    const check = await isInsideWorkspace(candidatePath, workspaceFolders);
    if (!check.inside) {
      return { status: 'blocked', reason: 'targetFile is outside the workspace' };
    }
    return { status: 'ok', uri: vscode.Uri.file(check.realPath) };
  }

  return { status: 'not_found' };
}
