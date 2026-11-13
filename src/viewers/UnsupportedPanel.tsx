import { Result, Typography } from 'antd';
import { FileUnknownOutlined } from '@ant-design/icons';
import type { OpenedFile } from '../types';
import { formatBytes } from '../types';
import { capabilities } from '../platform';

interface Props {
  file: OpenedFile;
}

export function UnsupportedPanel({ file }: Props) {
  return (
    <div className="viewer-pane">
      <Result
        icon={<FileUnknownOutlined />}
        title="暂不支持预览此格式"
        subTitle={
          <Typography.Paragraph type="secondary">
            {file.name}
            {file.extension ? ` (.${file.extension})` : ''} · {formatBytes(file.size)}
            <br />
            {capabilities.canDownload ? 'Web 端仍可下载该文件。' : ''}
          </Typography.Paragraph>
        }
      />
    </div>
  );
}
