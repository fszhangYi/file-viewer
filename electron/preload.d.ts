export interface ElectronFilePayload {
  name: string;
  path: string;
  size: number;
  lastModified: number;
  data: ArrayBuffer;
}

export interface ServerStatePayload {
  rootDir: string;
  canPickDir: boolean;
  host: string;
  port: number;
}

export interface FileViewerElectronAPI {
  isShell?: boolean;
  canPickDir?: boolean;
  pickDirectory?: () => Promise<ServerStatePayload | null>;
  openFiles: () => Promise<ElectronFilePayload[]>;
  onRootChanged?: (cb: (state: ServerStatePayload) => void) => () => void;
}

declare global {
  interface Window {
    fileViewer?: FileViewerElectronAPI;
  }
}

export {};
