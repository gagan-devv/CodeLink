import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveTargetFile } from './resolveTargetFile';

let mockWorkspaceFolders: any = undefined;
const mockFindFiles = vi.fn();

vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() {
      return mockWorkspaceFolders;
    },
    findFiles: (include: string, exclude?: string, maxResults?: number) =>
      mockFindFiles(include, exclude, maxResults),
  },
  Uri: {
    file: (fsPath: string) => ({
      fsPath,
      scheme: 'file',
      path: fsPath,
      toString: () => `file://${fsPath}`,
    }),
  },
}));

describe('resolveTargetFile', () => {
  let tempBase: string;
  let wsDir: string;
  let outsideDir: string;
  let srcDir: string;
  let appTsxPath: string;
  let outsideSecretPath: string;

  beforeEach(async () => {
    tempBase = await fs.promises.realpath(
      await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codelink-test-'))
    );
    wsDir = path.join(tempBase, 'ws');
    outsideDir = path.join(tempBase, 'outside');
    srcDir = path.join(wsDir, 'src');

    await fs.promises.mkdir(wsDir, { recursive: true });
    await fs.promises.mkdir(outsideDir, { recursive: true });
    await fs.promises.mkdir(srcDir, { recursive: true });

    appTsxPath = path.join(srcDir, 'App.tsx');
    await fs.promises.writeFile(appTsxPath, '// App content');

    outsideSecretPath = path.join(outsideDir, 'secret.txt');
    await fs.promises.writeFile(outsideSecretPath, 'top secret');

    mockWorkspaceFolders = [
      {
        uri: { fsPath: wsDir, scheme: 'file' },
        name: 'workspace',
        index: 0,
      },
    ];

    mockFindFiles.mockReset();
    mockFindFiles.mockImplementation(async (pattern: string) => {
      if (pattern === '**/App.tsx') {
        return [
          {
            fsPath: appTsxPath,
            scheme: 'file',
          },
        ];
      }
      return [];
    });
  });

  afterEach(async () => {
    if (tempBase) {
      await fs.promises.rm(tempBase, { recursive: true, force: true });
    }
  });

  it('src/App.tsx resolves exactly', async () => {
    const result = await resolveTargetFile('src/App.tsx');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.uri.fsPath).toBe(appTsxPath);
    }
  });

  it('a bare App.tsx resolves through the **/ findFiles fallback', async () => {
    const result = await resolveTargetFile('App.tsx');
    expect(mockFindFiles).toHaveBeenCalledWith('App.tsx', '**/node_modules/**', 1);
    expect(mockFindFiles).toHaveBeenCalledWith('**/App.tsx', '**/node_modules/**', 1);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.uri.fsPath).toBe(appTsxPath);
    }
  });

  it('an absolute path inside the workspace gives ok', async () => {
    const result = await resolveTargetFile(appTsxPath);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.uri.fsPath).toBe(appTsxPath);
    }
  });

  it('/etc/passwd gives blocked', async () => {
    const result = await resolveTargetFile('/etc/passwd');
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('targetFile is outside the workspace');
    }
  });

  it('../secret.txt and src/../../x give blocked', async () => {
    const result1 = await resolveTargetFile('../secret.txt');
    expect(result1.status).toBe('blocked');
    if (result1.status === 'blocked') {
      expect(result1.reason).toContain('directory traversal');
    }

    const result2 = await resolveTargetFile('src/../../x');
    expect(result2.status).toBe('blocked');
    if (result2.status === 'blocked') {
      expect(result2.reason).toContain('directory traversal');
    }
  });

  it('a symlink ws/link -> <tmp>/outside/secret.txt gives blocked', async () => {
    const linkPath = path.join(wsDir, 'link');
    await fs.promises.symlink(outsideSecretPath, linkPath);

    const result = await resolveTargetFile('link');
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('targetFile is outside the workspace');
    }
  });

  it('a symlink to a file inside the workspace gives ok', async () => {
    const linkInside = path.join(wsDir, 'link_inside');
    await fs.promises.symlink(appTsxPath, linkInside);

    const result = await resolveTargetFile('link_inside');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      // Must resolve to real path
      expect(result.uri.fsPath).toBe(appTsxPath);
    }
  });

  it('no workspace folders gives no_workspace', async () => {
    mockWorkspaceFolders = undefined;
    const result1 = await resolveTargetFile('src/App.tsx');
    expect(result1.status).toBe('no_workspace');

    mockWorkspaceFolders = [];
    const result2 = await resolveTargetFile('src/App.tsx');
    expect(result2.status).toBe('no_workspace');
  });

  it('a missing file gives not_found', async () => {
    const result = await resolveTargetFile('missing.txt');
    expect(result.status).toBe('not_found');
  });

  it('an absolute path inside workspace that is missing gives not_found', async () => {
    const missingAbs = path.join(wsDir, 'missing.txt');
    const result = await resolveTargetFile(missingAbs);
    expect(result.status).toBe('not_found');
  });
});
