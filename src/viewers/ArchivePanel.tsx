import { Result, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { OpenedFile } from '../types';
import { formatBytes } from '../types';
import { capabilities } from '../platform';

interface Props {
  file: OpenedFile;
}

export function ArchivePanel({ file }: Props) {
  return (
    <div className="viewer-pane">
      <Result
        icon={<InboxOutlined />}
        title="压缩包不提供预览"
        subTitle={
          <Typography.Paragraph type="secondary">
            {file.name}（{formatBytes(file.size)}）
            <br />
            {capabilities.canDownload
              ? '请使用顶部「下载」按钮将文件保存到本机。'
              : '桌面端可直接在资源管理器中打开该文件。'}
          </Typography.Paragraph>
        }
      />
    </div>
  );
}
