# Node.js 版（原有部署方式）

普通宝塔 PHP 站点请使用项目首页说明的 PHP 版。这份说明只用于保留原有 Node.js 服务的用户。

1. 安装 Node.js 和 MySQL，在项目根目录执行 `npm install`。
2. 执行 `npm start`，打开 `http://服务器IP:8080/install`，填写数据库和管理员信息。
3. 用 PM2 托管：`pm2 start app.js --name heartcron`，再执行 `pm2 save`。
4. 域名访问时，在宝塔站点设置里添加反向代理，目标为 `http://127.0.0.1:8080`。

前端打包文件已随仓库提供。修改前端源码后才需要执行 `npm run build`。

Node.js 版从 `.env` 读取数据库和管理员配置，示例见根目录 `.env.example`；使用 node-schedule 执行定时任务。PHP 版从 `config.php` 读取配置，通过 `cron.php` 执行定时任务。两种后端使用同一组业务数据表，迁移时停止原 Node.js 服务及它的 PM2 自启，避免同时推送。

开发前端：`npm --prefix frontend run dev`；Vite 默认将 `/api` 代理到本地 8080 端口。
