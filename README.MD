# Tiny Moods

线上地址：<https://tinymoods.mikeywa.site/>

公开仓库：<https://github.com/yanghaoleng/Tiny-Moods>

## 产品目标

用户上传一张有权使用的人物或宠物正脸照，生成九张透明纯头部表情、永久互动页和 9:16 短视频。生成前展示微信/支付宝自愿打赏二维码，金额提示为 `¥0.6`，不核验金额。

## 核心功能

- Seedream 5.0 Pro 生成无缝 3×3 九宫格；每格只允许头顶到下巴，禁止脖子、肩膀、衣服、手和身体
- 浏览器本地精确三等分、连通白底抠图；裁切内缩为 `0`，不丢边也不产生分隔缝
- 每个作品生成永久互动链接和带作品表情的分享二维码；二维码气泡支持点开或浏览器长按保存
- 内部运营后台 `/admin` 可按状态、关键词和时间范围查看全部生成记录、九张成图、永久链接、模型请求号、估算成本、失败详情和关联埋点
- 前台采集匿名页面访问、可见停留时长、点击与表单状态变化，并把事件关联到具体作品或 DEMO；不采集输入内容、原始 IP、完整 User-Agent 或原照片
- 互动页底部直接外露复制链接、保存图片和分享二维码；保存图片使用底部半弹窗，支持批量保存、逐张长按和本机视频测试入口
- 互动页左上角使用房子图标返回主页，并提供背景音乐开关；背景与装饰开关位于顶部，悬停不会暂停或覆盖自动换表情
- Jennie、团子、耙耙柑、羊石坨坨四个 DEMO 与正式作品共用分享、保存和音乐交互
- 点击“保存视频”后在当前浏览器本机渲染，自动下载 MP4；不支持 MP4 时回退 WebM
- 首页使用上下布局，支持单图拖拽/点击上传、对象命名和四个动态案例
- App Icon 旁使用英文产品名 `Tiny Moods`；统一加粗字号，`Tiny` 固定黑底，`Moods` 五个字母独立随机换色
- `Tiny Moods` 左侧保留 9 个正放扁平透明相机图标；每次进入随机出现一个，点击品牌区域随机切换到另一个且不连续重复
- 全站按钮使用 UI SFX `10 Cinematic` 语义音效；首次操作后启用，支持持久静音，不额外请求音频文件
- 桌面端使用放大的黑色鼠标箭头，移动时留下中文或英文单语情绪词彩色标签轨迹；触摸设备和低动态偏好显示静态示例

## 最终首页交互

- 首页固定为明亮的“轻日系相册”风格，不提供主题切换或暗色模式
- 首页主标题从 11 句文案中随机选择；点击标题随机切换且不连续重复，默认保持单行，宽度不足时只在逗号后换行并隐藏第一行末尾逗号
- 上传后填写对象名字，作品开场直接显示“xxx的9个可爱瞬间”
- 案例角色无卡片边框，在留白中轻微浮动
- 案例桌面端使用 3:4 浮窗，移动端使用底部半弹窗；嵌入预览隐藏返回按钮
- 分享二维码为 1080×1080 高纠错黑白方形码，中间嵌入该作品的一张表情图；页面用气泡承载，不生成额外海报
- 打赏、二维码气泡和保存半弹窗统一为极简黑白风格
- 首页主标题使用 Typer 波浪入场，字形依次经历实心、反白、强调色和描边状态后落回加粗纯文字
- 9 个相机图标已全部保留在品牌组件中，临时选择 Tab 已移除；静态图片统一使用 WebP

## 架构

```text
浏览器选图并本地暂存
  → 自愿打赏说明与免费生成凭证
  → 服务端安全调用 Seedream（密钥不下发）
  → 浏览器 Web Worker 无缝拆图、抠白底
  → 九张透明 PNG 原图回传，同时生成 WebP 浏览预览和永久互动页
  → 浏览器按当前样式和 BGM 本机渲染、下载视频
```

- 前端：Vite、React、Motion、UI SFX / Web Audio、Canvas 2D、Web Worker、Remotion Web Renderer
- 服务端：Express、Multer、Sharp，负责模型密钥、任务/订单状态、永久素材、匿名埋点和运营后台；不渲染视频
- 模型：火山方舟 `doubao-seedream-5-0-pro-260628`
- 视频：1080×1920 布局按 `2/3` 缩放输出为 720×1280、30fps、约 21.27 秒、9 个造型；优先 H.264/AAC MP4
- 数据：生产 `DATA_ROOT=/var/lib/9face`；作品资源使用同源相对地址，埋点按北京时间写入 `analytics/events/YYYY-MM-DD.jsonl`
- 图片：静态运行素材统一为 WebP，只有约 14KB 的浏览器图标保留 PNG；作品浏览使用 960px WebP，保存和下载使用透明 PNG 原图
- 后台安全：不设置账户名，仅使用服务端 `ADMIN_PASSWORD`；登录后使用 12 小时 HttpOnly、SameSite 会话 Cookie，不把管理密码写入前端
- 兼容：本机视频生成要求支持 WebCodecs 的新版 Chrome、Firefox 或 Safari

## API

- `GET /api/health`：模型、免费模式、本地媒体处理和浏览器渲染状态
- `POST /api/analytics/events`：批量接收匿名访问、可见停留和交互事件
- `GET` / `POST` / `DELETE /api/admin/session`：检查、创建和退出后台会话
- `GET /api/admin/dashboard`：读取生成记录、九图、永久链接和埋点聚合
- `GET /api/admin/jobs/:id/events`：读取单次生成的埋点明细
- `GET /api/admin/jobs/:id/sheet`：后台查看尚待浏览器处理的九宫格母图
- `POST /api/orders/donation`：创建免费生成凭证
- `POST /api/jobs`：上传照片并创建任务
- `GET /api/jobs/:id`：读取任务和永久素材
- `GET /api/jobs/:id/sheet`：凭作品令牌读取九宫格母图
- `POST /api/jobs/:id/faces`：上传浏览器本地抠图后的九张 PNG
- `POST /api/jobs/:id/renders`、`POST /api/public/jobs/:id/renders`：旧服务端渲染接口，现返回 `410`
- `GET /generated/:id/face-XX.webp`：读取长期缓存的互动页预览
- `GET /generated/:id/face-XX.png`：读取保存用透明原图；旧 `video.mp4` 仅兼容历史作品

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

不调用模型的流程测试：

```bash
GENERATOR_DEMO_MODE=1 npm run dev
```

生产构建：

```bash
npm run build
npm start
```

压缩新增的静态 PNG 素材并转换为 WebP（浏览器图标除外）：

```bash
npm run images:optimize
```

本地查看运营后台：在 `.env.local` 配置 6 位数字 `ADMIN_PASSWORD`，启动后访问 `http://127.0.0.1:4173/admin`。登录页只有密码框；手机唤起数字键盘，电脑支持数字键和回车。埋点从本版本上线后开始累计，历史作品不会补造访问数据。

团子案例按当前提示词真实重做：

```bash
node scripts/regenerate-tuanzi.mjs
```

从指定永久作品同步首页轻量示例素材：

```bash
node scripts/sync-home-examples.mjs
```

## 生产部署

- 腾讯云：`115.159.25.169`
- 程序：`/opt/9face/current`
- 数据：`/var/lib/9face`
- 配置：`/etc/9face.env`
- 服务：`9face.service` → `127.0.0.1:8095`
- 正式入口：Nginx `https://tinymoods.mikeywa.site`
- 旧入口：`https://9face.mikeywa.site` 保留为带路径和参数的 `301` 跳转
- HTTPS：Let's Encrypt 自动续期，当前证书有效至 `2026-11-17`
- 当前发布：`/opt/9face/releases/20260819143744`
- 回滚点：`/opt/9face/releases/20260819100933`
- 运营后台与埋点已发布；`ARK_API_KEY`、管理密码、会话密钥和埋点盐值只保存在服务器环境文件，不进入仓库

## 成本

- Seedream 每次生成一张 `2144×2144` 九宫格，当前按量估算约 `0.60 元`
- 本地拆图、抠图和反复渲染视频不产生模型费用，也不消耗服务器渲染资源
