declare module 'occt-import-js' {
  type OcctMesh = {
    attributes: {
      position: { array: number[] };
      normal?: { array: number[] };
      index?: { array: number[] };
    };
    color?: number[];
  };

  type OcctResult = {
    success: boolean;
    meshes: OcctMesh[];
  };

  type OcctApi = {
    ReadStepFile: (content: Uint8Array) => OcctResult;
  };

  type OcctModuleConfig = {
    locateFile?: (path: string, scriptDirectory?: string) => string;
  };

  const occtimportjs: (config?: OcctModuleConfig) => Promise<OcctApi>;
  export default occtimportjs;
}

declare module 'occt-import-js/dist/occt-import-js.wasm?url' {
  const url: string;
  export default url;
}
