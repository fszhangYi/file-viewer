export function bufferToText(buffer: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

export function bufferToObjectUrl(buffer: ArrayBuffer, mimeType: string): string {
  return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
}
