import { useMemo } from 'react';
import type { OpenedFile } from '../types';
import { bufferToText } from './utils';

interface Props {
  file: OpenedFile;
}

export function TextViewer({ file }: Props) {
  const text = useMemo(() => bufferToText(file.buffer), [file.buffer]);
  return (
    <div className="viewer-pane">
      <pre className="text-pre">{text}</pre>
    </div>
  );
}
