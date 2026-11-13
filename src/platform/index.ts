import type { OpenedFile } from '../types';
import { detectKind, getExtension } from '../types';

export interface PlatformCapabilities {
  canDownload: boolean;
  isElectronShell: boolean;
  canPickDir: boolean;
}

function isElectronShell(): boolean {
  return typeof window !== 'undefined' && Boolean(window.fileViewer?.isShell);
}

export const capabilities: PlatformCapabilities = {
  get canDownload() {
    return !isElectronShell();
  },
  get isElectronShell() {
    return isElectronShell();
  },
  get canPickDir() {
    return Boolean(window.fileViewer?.canPickDir || window.fileViewer?.pickDirectory);
  },
};

export function toOpenedFile(input: {
  name: string;
  size: number;
  lastModified: number;
  buffer: ArrayBuffer;
  path?: string;
  mimeType?: string;
}): OpenedFile {
  return {
    id: `${input.name}-${input.size}-${input.lastModified}-${Math.random().toString(36).slice(2)}`,
    name: input.name,
    size: input.size,
    lastModified: input.lastModified,
    path: input.path,
    mimeType: input.mimeType,
    buffer: input.buffer,
    kind: detectKind(input.name),
    extension: getExtension(input.name),
  };
}

function pickFilesViaInput(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const files = input.files ? Array.from(input.files) : [];
      input.remove();
      resolve(files);
    });
    document.body.appendChild(input);
    input.click();
  });
}

export async function openFiles(): Promise<OpenedFile[]> {
  if (capabilities.isElectronShell && window.fileViewer?.openFiles) {
    const payloads = await window.fileViewer.openFiles();
    return payloads.map((p) =>
      toOpenedFile({
        name: p.name,
        size: p.size,
        lastModified: p.lastModified,
        path: p.path,
        buffer: p.data,
      }),
    );
  }
  const files = await pickFilesViaInput();
  return Promise.all(
    files.map(async (file) =>
      toOpenedFile({
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        mimeType: file.type || undefined,
        buffer: await file.arrayBuffer(),
      }),
    ),
  );
}

export async function pickDirectory(): Promise<string | null> {
  if (!window.fileViewer?.pickDirectory) return null;
  const state = await window.fileViewer.pickDirectory();
  return state?.rootDir ?? null;
}

export function downloadFile(name: string, buffer: ArrayBuffer, mimeType?: string): void {
  if (!capabilities.canDownload) return;
  const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
