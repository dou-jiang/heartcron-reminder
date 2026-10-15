# HeartCron 心时

**Cron调度时间，心意准时抵达。**

HeartCron（心时）是一个暖心定时提醒 Web 系统，基于开源项目 Vitality-reminder 二次开发。
它会在设定时间自动获取天气信息、读取纪念日倒计时，结合你配置的待办事项生成关心文案（大模型生成、固定模板二选一），并通过 WxPusher 推送到微信。

代码本无温度，但可以用来准时传递温柔。

> 还没有女朋友？那就更该先把它跑起来——把「早安、天气、多喝热水、别忘了吃饭」这套关心链路先搭好，
> 等那个人出现的时候，你就是准备最充分的那一个。祝你一臂之力，早日脱单 ❤

[![GitHub](https://img.shields.io/badge/GitHub-dou--jiang%2Fheartcron--reminder-181717?logo=github)](https://github.com/dou-jiang/heartcron-reminder)

项目地址：https://github.com/dou-jiang/heartcron-reminder

## 功能特性

- 🕒 多组定时任务，支持可视化 Cron 配置
- 🌤 和风天气接入，自动获取气温、天气状况、降水、预警等信息
- 💖 纪念日管理，自动计算倒计时并融入文案
- 📝 每日待办清单，支持自定义提醒内容，支持仅工作日推送
- 🤖 两种文案模式：AI 大模型生成（每天不重样，支持自定义 Prompt 模板）或固定模板渲染（元气提醒 / 工资 / 生日 / 纪念日）
- 🧩 固定模板兼容 `{{变量}}` 与 `{{变量.DATA}}` 两种写法，相恋天数、生日倒计时、发薪日倒计时、天气四件套、每日一句自动填充
- 📡 WxPusher 微信消息推送
- 🖥 Vue3 + Element Plus Web 可视化管理后台
- 📜 推送历史日志记录，查看每一次推送详情
- 🧪 支持一键测试推送，快速验证整套推送链路
- 🚀 上传即用：网页安装向导自动检测环境、建库建表，只需填数据库信息与后台账号

## 技术栈

| 层次 | 技术 |
| --- | --- |
| 后端 | Node.js + Express |
| 前端 | Vue3 + Vite + Element Plus + vue-router + axios |
| 数据库 | MySQL 5.7+ / 8.0 / MariaDB 10.4+（mysql2 连接池） |
| 定时任务 | node-schedule + cron-parser |
| 第三方服务 | 和风天气、兼容 OpenAI 格式的大模型 API、WxPusher |

## 界面预览

安装向导（上传代码后访问 `/install`，自动检测环境、填写数据库信息并完成初始化）：

| ① 环境检测 | ② 数据库与账号 |
| --- | --- |
| ![安装向导-环境检测](docs/screenshots/install-step1.png) | ![安装向导-数据库与账号](docs/screenshots/install-step2.png) |

| ③ 推送与 AI 配置 | ④ 完成安装 |
| --- | --- |
| ![安装向导-推送与 AI](docs/screenshots/install-step3.png) | ![安装向导-完成](docs/screenshots/install-done.png) |

管理后台：

| 仪表盘 | 全局配置 |
| --- | --- |
| ![仪表盘](docs/screenshots/dashboard.png) | ![全局配置](docs/screenshots/config.png) |

固定模板模式（后台可选，内置 4 套示例模板一键套用）：

| 固定模板配置 | 仪表盘模板预览 |
| --- | --- |
| ![固定模板配置](docs/screenshots/config-template.png) | ![模板预览](docs/screenshots/config-template-preview.png) |

| 定时任务 | cron 可视化选择 |
| --- | --- |
| ![定时任务](docs/screenshots/task.png) | ![cron 可视化](docs/screenshots/task-cron.png) |

| 推送日志 | |
| --- | --- |
| ![推送日志](docs/screenshots/log.png) | |

## 示例模板

后台「全局配置 → 推送内容模式」选择 **固定模板文案** 后，文案不再交给大模型，而是由模板 + 真实数据直接拼出。
内置 4 套示例模板，点一下按钮即可套用，套用后还能随意修改。

### 元气提醒（日常）

适合早安 / 午间 / 晚安这类日常定时任务：一条消息里把日期、相恋天数、发薪日倒计时、生日倒计时和天气一次说完。

```
{{dateTime.DATA}}
今天是 我们相恋的第{{love.DATA}}天
距离上交工资还有{{pay.DATA}}天
距离你的生日还有{{birthday.DATA}}天
今日天气 {{weather.DATA}}
今日温度 {{temp.DATA}}度
空气湿度 {{humidity.DATA}}
风向 {{wind.DATA}}
每日一句
{{message.DATA}}
```

渲染出来大概是这样（示意数据）：

```
2026年10月15日 星期四
今天是 我们相恋的第1245天
距离上交工资还有0天
距离你的生日还有297天
今日天气 晴
今日温度 21度
空气湿度 38
风向 西北风3级
每日一句
今天也要开心呀
```

### 工资模板

把 cron 配成每月发薪日即可，例如 `0 0 10 15 * *` 表示每月 15 号 10:00 推送。

```
{{dateTime.DATA}}
亲爱的，今天要发工资了，咱们账户上又多了一笔！注意查收~！
```

### 生日模板

`{{individual.DATA}}` 是「人生中的第几个生日」，按生日配置里的出生年份计算，所以生日要填完整年份（如 `1998-08-08`）。

```
{{dateTime.DATA}}
听说今天是你人生当中第 {{individual.DATA}} 个生日？
天呐， 我差点忘记！因为你永远18岁~。
尽管，日历告诉我：你又涨了一岁，但你还是那个天真可爱的小仙女，生日快乐!
```

### 纪念日模板

`{{anniversary.DATA}}` 是相恋周年数，适合配成每年纪念日当天推送。

```
{{dateTime.DATA}}
今天是在一起{{anniversary.DATA}}周年纪念日。
经历了风风雨雨,最终依然走在一起,很幸运,很幸福!我们的小家庭要一直幸福下去。
```

### 固定模板可用变量

| 变量 | 说明 | 数据来源 |
| --- | --- | --- |
| `{{dateTime}}` | 当前日期时间，如 `2026年10月15日 星期四` | 系统 |
| `{{date}}` / `{{time}}` | 当前日期 / 精确到秒的时间 | 系统 |
| `{{love}}` | 相恋第几天（从相恋开始日期算起，含今天） | 基础信息 → 相恋开始日期 |
| `{{anniversary}}` | 相恋周年数 | 基础信息 → 相恋开始日期 |
| `{{birthday}}` | 距离下一个生日还有几天 | 基础信息 → 生日 |
| `{{individual}}` | 人生中的第几个生日（生日需填写年份） | 基础信息 → 生日 |
| `{{pay}}` | 距离下一个发薪日还有几天 | 基础信息 → 每月发薪日 |
| `{{weather}}` | 天气状况，如 `晴` | 和风天气 |
| `{{temp}}` | 当前温度 | 和风天气 |
| `{{humidity}}` | 空气湿度 | 和风天气 |
| `{{wind}}` | 风向风力，如 `西北风3级` | 和风天气 |
| `{{city}}` | 城市名称 | 和风天气 |
| `{{message}}` | 每日一句，从你填的多行里随机取一条 | 基础信息 → 每日一句 |
| `{{today_date}}` `{{weather_info}}` `{{anniversary_list}}` `{{todo_list}}` `{{boy_name}}` `{{girl_name}}` `{{push_time_period}}` `{{style_type}}` | 与 AI 模式共用的通用变量 | 系统 |

几点说明：

- `{{love}}` 与 `{{love.DATA}}` 两种写法等价，`{{ love.DATA }}` 这种带空格的也能识别（保留原版微信模板消息的写法，方便直接复制旧模板）。
- 没有配置的变量会渲染成 `—`，所以可以先把模板写好，再慢慢补「相恋开始日期 / 生日 / 发薪日 / 每日一句」。
- 相恋天数按自然日计算；发薪日填 31 时，2 月会自动按当月最后一天算；生日填 `02-29` 时，平年按 2 月 28 日算。
- 固定模板模式不会调用大模型，因此 AI 接口地址、API Key、模型名称留空也能正常推送。

## 目录结构

```
heartcron-reminder/
├── app.js                     # 后端入口：Express 服务 + 静态资源托管 + 定时任务加载
├── package.json               # 后端依赖与脚本
├── .env.example               # 环境变量示例（复制为 .env 使用）
├── data/                      # 安装锁等运行期文件目录（自动创建，已加入 .gitignore）
├── scripts/
│   └── init-db.js             # 数据库初始化脚本：建库建表 + 预置默认配置与 Prompt
├── src/
│   ├── config/
│   │   ├── index.js           # 运行时配置（端口、时区、MySQL 连接、登录账号）
│   │   ├── constants.js       # 业务常量（推送时段、文案风格、字段白名单）
│   │   ├── defaultPrompt.js   # 默认 AI 提示词模板与兜底文案
│   │   └── templateSamples.js # 内置固定模板示例（元气提醒 / 工资 / 生日 / 纪念日）
│   ├── db/
│   │   ├── index.js           # MySQL 访问层（mysql2 连接池 + Promise 化封装）
│   │   └── schema.sql         # 5 张表的建表语句（InnoDB / utf8mb4）
│   ├── middleware/
│   │   ├── auth.js            # 登录鉴权中间件
│   │   └── errorHandler.js    # 404 与统一异常处理
│   ├── routes/
│   │   ├── index.js           # 路由总入口
│   │   ├── auth.js            # 登录 / 退出 / 会话
│   │   ├── install.js         # 网页安装向导接口（免登录，安装后自动关闭）
│   │   ├── config.js          # 系统配置读写（密钥掩码）
│   │   ├── task.js            # 定时任务 CRUD
│   │   ├── anniversary.js     # 纪念日 CRUD
│   │   ├── todo.js            # 待办事项 CRUD
│   │   ├── log.js             # 推送日志分页查询
│   │   └── push.js            # 一键测试推送 / 仪表盘预览 / 元信息
│   ├── services/
│   │   ├── installer.js       # 安装向导：环境检测 / 写 .env / 初始化数据库
│   │   ├── weather.js         # 和风天气（实时 + 今日预报 + 预警）
│   │   ├── ai.js              # 大模型调用（OpenAI 兼容）
│   │   ├── wxpusher.js        # WxPusher 推送
│   │   ├── prompt.js          # {{变量}} 模板渲染
│   │   ├── template.js        # 固定模板渲染（相恋天数 / 生日 / 发薪日 / 天气四件套计算）
│   │   ├── anniversary.js     # 纪念日倒计时文本
│   │   ├── todo.js            # 待办筛选（含仅工作日）
│   │   ├── push.js            # 推送主链路（定时任务与测试推送共用）
│   │   └── scheduler.js       # node-schedule 任务注册与重载
│   └── utils/                 # 日志、HTTP、掩码、日期、asyncHandler 等工具
├── public/
│   └── install.html           # 网页安装向导页面（单文件，无需构建即可访问）
├── frontend/                  # Vue3 管理后台
│   ├── vite.config.js         # 开发代理 /api → http://localhost:8080
│   ├── index.html
│   └── src/
│       ├── main.js            # 入口：Element Plus + 图标 + 路由
│       ├── App.vue
│       ├── api/index.js       # 接口封装（统一错误提示与 401 跳转）
│       ├── router/index.js    # 路由与登录守卫
│       ├── layout/AdminLayout.vue      # 侧边导航 + 面包屑布局
│       ├── components/
│       │   ├── CronPicker.vue          # cron 可视化选择器
│       │   ├── SecretInput.vue         # 密钥掩码输入框
│       │   └── PushResultDialog.vue    # 测试推送结果弹窗
│       ├── utils/             # cron 工具、格式化工具、登录态
│       └── views/             # 登录 / 仪表盘 / 配置 / 任务 / 纪念日 / 待办 / 日志
└── legacy/vitality-reminder/  # 二次开发前的原始 Vitality-reminder 代码（保留备查）
```

## 快速开始

### 1. 安装依赖

```bash
git clone https://github.com/dou-jiang/heartcron-reminder.git
cd heartcron-reminder
npm install
```

> Node.js >= 16（推荐 20 LTS）。数据库使用纯 JS 实现的 `mysql2` 驱动，不需要编译工具链。

### 2. 准备 MySQL 数据库

MySQL 5.7 / 8.0 / MariaDB 10.4 及以上均可，数据库本身不需要提前创建（安装向导或 `npm run init-db` 会自动建库建表），只需要准备好**主机、端口、账号、密码**。

> 使用的数据库账号需要具备 `CREATE DATABASE` 权限。宝塔面板里安装的 MySQL，直接用 `root` 账号即可；也可以先手动建库（`utf8mb4`），再把账号只授权到该库。

### 3. 配置环境变量（两种方式二选一）

方式 A（推荐）：启动服务后用浏览器打开 `/install` 网页安装向导，按提示填写**数据库主机 / 端口 / 账号 / 密码 / 库名**与后台账号，向导会测试连接、自动建库建表并生成 `.env`。

方式 B：手动复制并编辑 `.env`：

```bash
cp .env.example .env    # Windows: copy .env.example .env
```

`.env` 支持的变量：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 服务端口 | 8080 |
| `ADMIN_USERNAME` | 后台登录账号 | admin |
| `ADMIN_PASSWORD` | 后台登录密码 | heartcron123 |
| `SESSION_SECRET` | 会话加密密钥 | 需自行修改 |
| `SESSION_MAX_AGE` | 会话有效期（毫秒） | 7 天 |
| `DB_HOST` | 数据库主机 | 127.0.0.1 |
| `DB_PORT` | 数据库端口 | 3306 |
| `DB_USER` | 数据库账号 | root |
| `DB_PASSWORD` | 数据库密码 | 空 |
| `DB_NAME` | 数据库名称（不存在时自动创建） | heartcron |
| `DB_CONNECTION_LIMIT` | 连接池大小 | 10 |
| `TZ` | 定时任务时区 | Asia/Shanghai |
| `HTTP_TIMEOUT` | 外部请求超时（毫秒） | 10000 |

### 4. 初始化数据库（网页向导会自动完成，手动部署时执行）

```bash
npm run init-db
```

脚本会连接 `.env` 中配置的 MySQL，数据库不存在时自动创建，然后建好 5 张表并写入默认系统配置与默认 Prompt 模板。重复执行不会覆盖已有数据。

### 5. 构建前端

```bash
npm run build          # 等价于 cd frontend && npm install && npm run build
```

构建产物输出到 `frontend/dist`，由后端 Express 直接托管，访问 `http://localhost:8080` 即可。

本地调试前端时也可以单独运行：

```bash
cd frontend && npm run dev   # 访问 http://localhost:5173，/api 自动代理到 8080
```

### 6. 启动服务

```bash
npm start
```

生产环境建议使用 PM2 托管进程：

```bash
npm install -g pm2
pm2 start app.js --name heartcron
pm2 save
pm2 logs heartcron
```

### 7. 打开安装向导 / 登录后台

1. 打开 `http://服务器地址:8080`，未安装时会自动跳转到安装向导 `/install`
2. 按向导完成「环境检测 → 数据库与账号 → 推送与 AI 配置 → 完成安装」
3. 使用向导中设置的账号密码登录后台
4. 进入「全局配置」补充 WxPusher、和风天气与大模型参数（向导中已填写的会保留）
5. 在「推送内容模式」里选择文案来源：**AI 生成文案** 或 **固定模板文案**（后者可在下方一键套用示例模板）
6. 点击「一键测试推送」验证链路，然后到「定时任务」「纪念日」「待办事项」配置内容

## 服务器部署（上传即用）

部署到自己的服务器只需要：**上传代码 → 安装依赖 → 启动服务 → 浏览器打开安装向导**，不需要手工建库、写 SQL、改配置文件——数据库和表都由向导自动创建。

> 前提：服务器上已经装好 MySQL / MariaDB，并知道它的主机、端口、账号、密码。若还没装，用宝塔面板「软件商店」一键安装 MySQL 5.7 或 8.0 即可。

```bash
# 1. 上传代码到服务器（git clone 或直接上传压缩包后解压）
cd /www/wwwroot/heartcron-reminder

# 2. 安装后端依赖（生产环境可加 --omit=dev）
npm install --omit=dev

# 3. 构建前端（本地构建后上传 frontend/dist 也可以）
npm run build

# 4. 用 PM2 常驻启动
npm install -g pm2
pm2 start app.js --name heartcron
pm2 save && pm2 startup

# 5. 浏览器打开安装向导
#    http://服务器IP:8080/install
```

### 安装向导做了什么

未安装时访问任意地址都会自动跳转到 `/install`，接口返回 `503 NOT_INSTALLED`；安装完成后向导会自动关闭（再次访问只显示「系统已安装」）。

| 步骤 | 说明 |
| --- | --- |
| ① 环境检测 | Node 版本、后端依赖模块、MySQL 驱动（mysql2）、项目目录写权限、前端构建产物、外网连通性、时区 |
| ② 数据库与账号 | 服务端口、时区、**数据库主机 / 端口 / 账号 / 密码 / 库名（带「测试连接」按钮）**、管理员账号密码、SESSION_SECRET |
| ③ 推送与 AI 配置 | WxPusher、和风天气、大模型参数与昵称（可跳过，后台再填） |
| ④ 完成安装 | 测试数据库连接、写入 `.env`、自动建库建表、写入配置与示例数据、生成 `data/install.lock`、注册定时任务 |

向导执行过程中会备份原有 `.env` 为 `.env.bak`；配置写入后会**热加载生效，无需重启进程**。

> 第 ② 步的「测试连接」会真实连一次 MySQL：连不上会直接告诉你原因（账号密码错误 / 无法连接主机 / 端口不通等），确认无误后再点「开始安装」。安装过程会先测试连接，连接失败不会写入任何配置。
>
> 数据库不存在时向导会自动 `CREATE DATABASE`（utf8mb4），已存在时只执行 `CREATE TABLE IF NOT EXISTS`，不会覆盖已有数据。

### 重新安装

删除项目目录下的 `data/install.lock`，刷新 `/install` 页面即可重新运行向导（重新安装会覆盖 `.env` 与数据库中的系统配置，业务数据表不受影响）。

### 宝塔面板部署

1. 在「软件商店」安装 **MySQL 5.7 / 8.0**、**Node.js 版本管理器**（Node 20 或更高）与 **PM2 管理器**
2. 记下 MySQL 的 root 密码（「数据库」页面可以查看/修改）
3. 把项目上传到 `/www/wwwroot/heartcron-reminder`，或直接用 Git 拉取
4. 终端进入项目目录执行 `npm install --omit=dev && npm run build`
5. 在「PM2 管理器」中添加项目：启动文件选 `app.js`，运行目录选项目根目录，端口填 8080
6. 在「网站 → 添加站点」里把域名反向代理到 `http://127.0.0.1:8080`，并在「安全」中放行端口
7. 浏览器访问 `http://你的域名/install`，第 ② 步填数据库主机 `127.0.0.1`、端口 `3306`、账号 `root` 与 root 密码，点「测试连接」通过后开始安装

### Nginx 反向代理示例

```nginx
server {
    listen 80;
    server_name heartcron.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### PM2 常用命令

```bash
pm2 start app.js --name heartcron   # 启动
pm2 restart heartcron               # 重启（修改 .env 后需要重启）
pm2 logs heartcron                  # 查看日志
pm2 status                          # 查看状态
pm2 delete heartcron                # 删除进程
```

### 部署注意事项

- 服务器需要能访问外网：`wxpusher.zjiecode.com`、`devapi.qweather.com`、你配置的大模型接口地址
- 记得在云服务器安全组 / 防火墙放行服务端口（默认 8080）
- 前端构建产物 `frontend/dist` 未上传时，只能访问接口与安装向导，请在服务器执行 `npm run build`
- 未配置 HTTPS 时，登录 Cookie 不带 Secure 标记；对外网开放建议用 Nginx 配置 HTTPS

## 手动安装（不用向导时）

如果已经按「快速开始」的步骤 1~6 手动配置好 `.env`（含 MySQL 连接信息）并执行过 `npm run init-db`，就不需要走安装向导，直接登录后台即可：

1. 打开 `http://服务器地址:8080`，使用 `.env` 中的账号密码登录
2. 进入「全局配置」填写 WxPusher AppToken / UID、和风天气 Key / 城市 ID、大模型接口地址与 Key
3. 点击「一键测试推送」验证链路是否打通
4. 到「定时任务」「纪念日」「待办事项」页面配置内容，任务启用后立即生效

## 数据库表结构

建表语句见 [src/db/schema.sql](src/db/schema.sql)，共 5 张表，全部为 InnoDB 引擎、`utf8mb4` 字符集（支持中文与 emoji）：

| 表名 | 说明 | 关键字段 |
| --- | --- | --- |
| `system_config` | 系统全局配置（单行，id=1） | wx_pusher_*、push_mode、push_template、qweather_*、ai_*、ai_prompt_template、boy_name、girl_name、default_style、love_start_date、birthday、pay_day、love_message |
| `remind_task` | 定时任务 | task_name、cron_expr、push_time_period、enable、remark |
| `anniversary` | 纪念日 | name、target_date、enable、show_countdown |
| `todo_item` | 待办事项 | content、enable、only_workday |
| `push_log` | 推送日志 | create_time、weather_info、ai_content、status、error_msg、task_id |

服务每次启动都会执行一遍建表与字段补全（`CREATE TABLE IF NOT EXISTS` + 按需 `ALTER TABLE ADD COLUMN`），所以老版本数据库升级后直接启动就行，不用手工改表，已有数据也不会被覆盖。

## 接口列表

除登录接口外，全部接口都需要登录会话（Cookie），未登录返回 401。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/login` | 登录，账号密码来自 `.env` |
| POST | `/api/logout` | 退出登录 |
| GET | `/api/session` | 查询当前登录状态 |
| GET | `/api/config` | 获取全部配置（密钥掩码返回） |
| PUT | `/api/config` | 更新配置（提交掩码值表示不修改该密钥） |
| GET/POST/PUT/DELETE | `/api/task[/:id]` | 定时任务增删改查 |
| GET/POST/PUT/DELETE | `/api/anniversary[/:id]` | 纪念日增删改查 |
| GET/POST/PUT/DELETE | `/api/todo[/:id]` | 待办事项增删改查 |
| GET | `/api/log?page=1&size=10` | 推送日志分页查询 |
| POST | `/api/test-push` | 一键测试推送，执行完整链路 |
| GET | `/api/preview` | 仪表盘今日预览（不推送） |
| GET | `/api/meta` | 前端下拉选项、时区、已注册任务数 |
| GET | `/healthz` | 健康检查 |

安装向导相关接口（免登录，仅未安装时可调用）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/install` | 安装向导页面 |
| GET | `/api/install/status` | 安装状态与环境检测结果 |
| POST | `/api/install/check` | 重新执行环境检测 |
| POST | `/api/install/test-db` | 测试 MySQL 连接（向导第 ② 步的「测试连接」） |
| POST | `/api/install/run` | 执行安装（测试连接 → 写 .env → 自动建库建表 → 写入初始配置） |

## 推送流程

```
定时触发（node-schedule）
  ↓ 读取 system_config 全部配置
  ↓ 请求和风天气 API，整理天气信息
  ↓ 读取纪念日列表，计算倒计时文本
  ↓ 读取今日待办（含仅工作日过滤）
  ↓ 按「推送内容模式」分支：
       AI 模式   → 渲染 Prompt 模板 → 请求大模型生成暖心文案（失败自动使用内置备用文案）
       模板模式  → 计算相恋天数 / 生日倒计时 / 发薪日倒计时 / 天气四件套 → 渲染固定模板
  ↓ 调用 WxPusher 推送微信消息
  ↓ 写入 push_log 推送日志（成功/失败、文案、时间、错误信息）
```

## Prompt 变量

后台「全局配置 → AI 提示词模板」支持以下变量，生成文案前会自动替换：

| 变量 | 说明 |
| --- | --- |
| `{{boy_name}}` | 你的昵称 |
| `{{girl_name}}` | 她的昵称 |
| `{{today_date}}` | 今日日期（含星期） |
| `{{weather_info}}` | 天气信息 |
| `{{anniversary_list}}` | 纪念日倒计时列表 |
| `{{todo_list}}` | 今日待办事项 |
| `{{push_time_period}}` | 推送时段（早安 / 午间关心 / 晚安提醒） |
| `{{style_type}}` | 文案风格（温柔治愈 / 简短清爽 / 俏皮可爱） |

## cron 表达式说明

任务使用标准 6 位 cron 表达式：`秒 分 时 日 月 周`，例如：

- `0 30 9 * * *`：每天 09:30:00
- `0 30 8 * * 1-5`：工作日 08:30:00
- `0 0 10 5 * *`：每月 5 号 10:00:00

前端「定时任务」弹窗内提供可视化选择器（每 / 指定 / 区间 / 间隔），也可以直接编辑表达式。

> 说明：需求文档建议使用 `vue3-cron` 组件，但该 npm 包发布产物缺少 `lib/vue3Cron.umd.js` 入口文件，安装后无法被构建工具解析。因此本项目实现了等价的本地组件 `frontend/src/components/CronPicker.vue`，直接产出后端可用的标准 6 位表达式（`vue3-cron` 生成的是 Quartz 风格 7 位表达式，与 node-schedule 并不兼容）。

## 安全说明

- WxPusher Token、和风天气 Key、大模型 API Key 仅存储在后端 MySQL，接口返回时统一掩码（如 `sk-a****cdef`），前端不接触明文
- 更新配置时提交掩码值表示「不修改原密钥」，留空同样保持原值
- 全部业务接口都经过登录校验，登录失败 10 次锁定该 IP 5 分钟
- 所有外部 HTTP 请求都设置超时与异常捕获，失败会降级写入推送日志

## 常见问题

**推送失败提示「未配置 WxPusher UID」**：请在 WxPusher 后台关注应用并获取 UID，填入全局配置。

**天气显示「（未配置和风天气…）」**：填写和风天气 Key 与城市 ID（Location ID）后即可，天气获取失败不会阻断推送。

**AI 文案像是模板**：说明大模型调用失败并走了内置备用文案，可在推送日志的「错误信息」中查看具体原因（常见为 API Key 无效、模型名称不存在、余额不足）。

**切到固定模板模式后，模板里的天数显示成 `—`**：说明对应配置还没填。相恋天数要填「相恋开始日期」，生日倒计时要填「生日」，发薪日倒计时要填「每月发薪日」，每日一句要填「每日一句」内容；天气四项则要先配好和风天气 Key 与城市 ID。

**固定模板模式还要填大模型参数吗**：不用。固定模板不调用大模型，AI 接口地址 / API Key / 模型名称留空也能正常推送；只有切回 AI 模式时才会要求填写。

**模板里 `{{xxx.DATA}}` 和 `{{xxx}}` 有区别吗**：没有区别，两种写法都能识别。保留 `.DATA` 是为了兼容原版 Vitality-reminder 的微信模板消息写法，方便直接复制旧模板。

**修改任务后什么时候生效**：任务增删改与启停都会立即重新加载全部调度，无需重启服务。

**访问 /install 显示「系统已安装」**：说明 `data/install.lock` 已存在，属于正常的防重复安装保护；需要重新安装时删除该文件再刷新页面。

**安装向导里需要填数据库地址吗**：需要。项目使用 MySQL，向导第 ② 步要填数据库主机、端口、账号、密码与库名，可以先点「测试连接」确认。库不存在时安装会自动创建，因此账号需要 `CREATE DATABASE` 权限。

**测试连接提示「数据库账号或密码错误」**：核对宝塔「数据库」页面里的 root 密码；如果数据库在另一台服务器上，还要在 MySQL 里授权该账号从本站 IP 访问（`GRANT ALL ON *.* TO 'user'@'%' IDENTIFIED BY '密码';` 后 `FLUSH PRIVILEGES;`），并在防火墙放行 3306。

**服务启动报「数据库连接失败」**：检查 `.env` 里的 `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` 是否正确、MySQL 是否已启动。想重新配置可以删除 `data/install.lock` 与 `.env` 后重启服务，再访问 `/install`。

**安装后改了端口没生效**：端口在进程启动时监听，改完 `.env` 需要重启服务（`pm2 restart heartcron`）；其余配置（密钥、Prompt、任务）都是即时生效的。

