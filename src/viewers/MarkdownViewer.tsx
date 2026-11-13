import { useMemo, useState } from 'react';
import { Segmented } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { OpenedFile } from '../types';
import { bufferToText } from './utils';

interface Props {
  file: OpenedFile;
}

export function MarkdownViewer({ file }: Props) {
  const [mode, setMode] = useState<'view' | 'source' | 'split'>('view');
  const text = useMemo(() => bufferToText(file.buffer), [file.buffer]);

  const preview = (
    <div className="md-preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
  const source = <pre className="text-pre">{text}</pre>;

  return (
    <div className="viewer-pane">
      <div className="viewer-toolbar">
        <Segmented
          size="small"
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
          options={[
            { label: '预览', value: 'view' },
            { label: '源码', value: 'source' },
            { label: '对照', value: 'split' },
          ]}
        />
      </div>
      {mode === 'view' && preview}
      {mode === 'source' && source}
      {mode === 'split' && (
        <div className="md-split">
          {source}
          {preview}
        </div>
      )}
    </div>
  );
}
