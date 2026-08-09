# CdcBuddy Docker 远程部署设计

## 目标

将当前 Next.js + Python 算法引擎应用改造为单个 Linux/amd64 生产镜像，在本机完成构建与 `docker save`，上传到 `root@39.106.143.253:/data/Agent-CdcBuddy`，并从 `32100-32199` 中选择首个未占用端口映射到容器的 3000 端口。

## 容器架构

采用单容器生产架构，保持现有 Next.js 通过子进程调用 Python 算法脚本的边界。构建阶段使用 Node.js 22 安装锁定依赖并执行 Next.js standalone 构建；运行阶段同时提供 Node.js 22、Python 3.11 与 `requirements.txt` 中的算法依赖。

最终镜像不包含 `vector_monitoring.db`、`app_business.db` 或生产环境文件。监测事实库以只读方式挂载到 `/app/vector_monitoring.db`；业务数据目录 `/data/Agent-CdcBuddy/data` 以可写方式挂载到 `/app/data`，业务库路径为 `/app/data/app_business.db`。容器启动时仅在业务库不存在时执行初始化脚本。

## 部署文件

- `Dockerfile`：多阶段 Linux/amd64 生产镜像。
- `.dockerignore`：排除 Git、依赖、构建缓存、数据库、日志和环境文件。
- `docker/entrypoint.sh`：初始化业务库并启动 Next.js standalone 服务。
- `compose.production.yml`：固定容器内端口和数据库挂载，外部端口由 `APP_PORT` 注入。
- `scripts/deploy/build-image.ps1`：本机构建、检查并导出 tar。
- `scripts/deploy/deploy-remote.ps1`：创建远端目录、选择空闲端口、上传 tar 与部署文件、加载并启动镜像。
- `scripts/deploy/remote-common.ps1`：集中 SSH/SCP、路径与端口安全校验。
- `scripts/deploy/status.ps1`、`logs.ps1`：远端状态和日志入口。
- `scripts/deploy/deploy.config.ps1.example`：非敏感配置模板；本地实际配置被 Git 忽略。

## 配置与密钥

`SILICONFLOW_API_KEY`、`SILICONFLOW_BASE_URL` 和 `SILICONFLOW_MODEL` 仅通过远端 `/data/Agent-CdcBuddy/.env` 注入。部署脚本在该文件不存在时从 `.env.example` 创建占位副本，但不会覆盖已有文件。

`NEXT_PUBLIC_TIANDITU_KEY` 是 Next.js 构建期变量。当前本机未提供该变量，因此本次构建沿用代码现有地图配置。今后更换该 Key 必须在本机构建镜像前注入并重新构建。

源码中的硬编码 SiliconFlow API Key 不进入生产镜像；运行代码改为从环境变量读取，缺失时使用无权限占位值，使服务可以启动但 AI 请求会明确失败，直到运维补齐环境配置。

## 端口与生命周期

远端脚本通过 `ss` 和 Docker 已发布端口共同检查 `32100-32199`，选择第一个空闲端口。选定值写入 `/data/Agent-CdcBuddy/deploy.env`，供后续重启保持同一端口。容器命名为 `agent-cdcbuddy`，镜像命名为 `agent-cdcbuddy:1.0.0`。

健康检查访问容器内 `http://127.0.0.1:3000/`。启动后同时验证容器健康状态与远端映射端口 HTTP 响应。

## 失败与回滚

构建失败时不生成或覆盖交付 tar。远端部署先加载新镜像，再替换同名容器，不删除数据库目录。若新容器无法通过健康检查，保留容器日志并停止发布流程；数据库文件和环境文件不受影响。

## 验证

1. 静态检查部署文件、路径安全、数据库排除和密钥排除。
2. 执行 Next.js 生产构建。
3. 构建 Linux/amd64 镜像并检查架构、健康检查和镜像内容。
4. 使用挂载的真实 `vector_monitoring.db` 进行本地容器 HTTP 冒烟测试。
5. 导出 tar，上传远端，加载并启动。
6. 验证远端容器状态、HTTP 首页、数据库挂载和端口记录。
