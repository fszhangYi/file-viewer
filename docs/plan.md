# File Viewer 计划（已调整）

## 模型

- **桌面进程 = 服务端**；Web UI 始终由本地 HTTP 提供
- 启动：`./start.sh --dir <root> [--ui] [-p|--port 8787] [--host 0.0.0.0]`
  - 无 `--ui`：无头（`node server/cli.cjs`）
  - 有 `--ui`：同一服务 + Electron 窗（可「选择目录」覆盖 `--dir`）

## 主交互

- 左侧边栏：当前目录 **depth=1**
- 双击目录：进入该层；双击文件：懒加载预览
- `..` / 面包屑返回，不超出根目录
- 「打开文件」保留为补充

## API

- `GET /api/state` / `GET /api/list?cwd=` / `GET /api/file?path=` / `POST /api/root`
