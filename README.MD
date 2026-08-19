# Tiny Moods

线上地址：<https://tinymoods.mikeywa.site/>

公开仓库：<https://github.com/yanghaoleng/Tiny-Moods>

## 产品目标

用户上传一张有权使用的人物或宠物正脸照，生成九张透明纯头部表情、永久互动页和 9:16 短视频。生成前可选择 Seedream 5.0 Pro 或 Lite，并展示与模型成本对应的微信/支付宝自愿打赏建议，不核验金额。

## 核心功能

- 生成前在打赏层选择 Seedream 5.0 Lite（默认，模型成本 `¥0.22`）或 Pro（模型成本 `¥0.60`）；服务端白名单校验并严格按所选模型发起生成
- 打赏建议固定显示 `¥1 ~ ¥3`；10 条简短感谢文案每次随机出现，Calligraph 负责逐字入场，并遵循系统减少动效设置
- 打赏层提供作者微信 `yanghaoleng` 一键复制，用于收集问题和建议
- Seedream 生成无缝 3×3 九宫格；每格只允许头顶到下巴，禁止脖子、肩膀、衣服、手和身体
- 浏览器本地三等分并向每格内缩 `0.6%` 后连通白底抠图，避免把九宫格边界细线带入成图
- 每个作品生成永久互动链接和带作品表情的分享二维码；二维码气泡支持点开或浏览器长按保存
- 内部运营后台 `/admin` 可按状态、关键词和时间范围查看全部生成记录、九张成图、永久链接、模型请求号、估算成本、失败详情和关联埋点
- 前台采集匿名页面访问、可见停留时长、点击与表单状态变化，并把事件关联到具体作品或 DEMO；不采集输入内容、原始 IP、完整 User-Agent 或原照片
- 互动页底部直接外露复制链接、保存图片和分享二维码；保存图片使用底部半弹窗，支持批量保存、逐张长按和本机视频测试入口
- 互动页左上角使用房子图标返回主页，并提供背景音乐开关；背景与装饰开关位于顶部，悬停不会暂停或覆盖自动换表情
- 作品轮播在 5 种相近的浅色背景中循环；作品主人切换背景显示或装饰显示后保存到服务端，下次打开恢复原样
- 互动页只保留左上角背景音乐开关，底部不重复显示界面音效按钮，也不显示右下角 `made for` 角标
- Jennie、团子、耙耙柑、羊石坨坨四个 DEMO 与正式作品共用分享、保存和音乐交互
- 保存图片半弹窗中一键保存为主按钮，“保存视频（测试）”为无填充次要按钮，两者之间不使用分割线或小字说明
- 点击“保存视频（测试）”后在当前浏览器本机渲染，自动下载 MP4；不支持 MP4 时回退 WebM
- 首页使用上下布局，支持单图拖拽/点击上传、对象命名和四个动态案例
- 首页右上角只保留“生成记录”，不显示界面音效静音按钮；服务端用一年期 HttpOnly 匿名 Cookie 关联当前浏览器创建的任务
- 首页左下角提供小号“作者主页”外链，指向 `https://mikeywa.icu`，页边距与 NCM 保持一致
- 每个任务创建后立即获得固定恢复地址 `?job=:id`；等待浏览器本地拆图/抠图时重新进入该地址可继续完成，完成后自动进入永久互动页
- 生成记录面板支持输入生成时的完整名字精确查询已完成作品和等待前端处理的作品；后者返回固定恢复链接和恢复凭证，进入后可继续本地拆图与抠图
- App Icon 旁使用英文产品名 `Tiny Moods`；统一加粗字号，`Tiny` 固定黑底，`Moods` 五个字母独立随机换色
- `Tiny Moods` 左侧保留 9 个正放扁平透明相机图标；每次进入随机出现一个，点击品牌区域随机切换到另一个且不连续重复
- 首页左上角相机图标单独上移 `10px`，与 `Tiny Moods` 字标保持光学横向对齐
- 浏览器 Favicon 复用同一套 9 种相机配色，每次打开随机换一种并尽量避免与上次重复；静态回退图标为 SVG
- 全站按钮使用 UI SFX `10 Cinematic` 语义音效；首次操作后启用，支持持久静音，不额外请求音频文件
- 桌面端使用放大的黑色鼠标箭头和情绪词拖尾；无精细指针的手机和平板不渲染该效果，小尺寸桌面窗口仍保留
- 鼠标轨迹逐帧合并指针事件，预先缓存标签尺寸并固定复用 10 个节点；移动热路径不读取布局，移动箭头不使用实时滤镜

## 最终首页交互

- 首页固定为明亮的“轻日系相册”风格，不提供主题切换或暗色模式
- 首页导航下方与案例区上方不使用分割线；空上传框桌面高 `320px`、窄屏约 `150px`，手机首屏可直接露出下方案例
- 首页主标题从 11 句文案中随机选择；点击标题随机切换且不连续重复，默认保持单行，宽度不足时只在逗号后换行并隐藏第一行末尾逗号
- 首页主标题整体向下微调 `10px`，桌面与手机布局一致
- 上传后填写对象名字，说明文字位于输入框上方；输入框、移除照片和生成按钮同排同高，作品开场直接显示“xxx的9个可爱瞬间”
- 案例角色无卡片边框，在留白中轻微浮动
- 案例桌面端使用 3:4 浮窗，移动端使用底部半弹窗；嵌入预览隐藏返回按钮
- 九图保存弹层先显示九张预览，单张下载和服务端预制 ZIP 均为 `1080px` 白底 JPG；批量按钮打开弹层即可使用
- 分享二维码为 1080×1080 高纠错圆点码，少量深彩色点与圆形定位点增加童趣；中间使用圆角方形底板承载作品表情
- 图片生成完成后直接进入永久互动页，不再展示独立成功页
- 打赏、二维码气泡和保存半弹窗统一为极简黑白风格
- 首页主标题使用 Typer 波浪入场，字形依次经历实心、反白、强调色和描边状态后落回加粗纯文字
- 9 个相机图标已全部保留在品牌组件中，临时选择 Tab 已移除；静态图片统一使用 WebP

## 架构

```text
浏览器选图并本地暂存
  → 用 Lite / Pro 开关选择模型（默认 Lite），创建免费生成凭证
  → 服务端安全调用 Seedream（密钥不下发）
  → 浏览器 Web Worker 无缝拆图、抠白底
  → 浏览器输出九张 1080px 透明 WebP，服务端并行规范化并预制白底 JPG 压缩包
  → 浏览器按当前样式和 BGM 本机渲染、下载视频
```

- 前端：Vite、React、Motion、Calligraph、UI SFX / Web Audio、Canvas 2D、Web Worker、Remotion Web Renderer
- 服务端：Express、Multer、Sharp，负责模型密钥、任务/订单状态、永久素材、匿名埋点和运营后台；不渲染视频
- 模型：火山方舟 Lite `doubao-seedream-5-0-260128`（默认）；Pro `doubao-seedream-5-0-pro-260628`；模型 ID、尺寸和价格均可由服务端环境变量覆盖
- 视频：1080×1920 布局按 `2/3` 缩放输出为 720×1280、30fps、约 21.27 秒、9 个造型；优先 H.264/AAC MP4
- 数据：生产 `DATA_ROOT=/var/lib/9face`；作品资源使用同源相对地址，埋点按北京时间写入 `analytics/events/YYYY-MM-DD.jsonl`
- 匿名身份：Cookie `tiny_moods_visitor` 仅保存随机访客 ID，HttpOnly、SameSite=Lax、有效期一年；照片、名字和作品访问令牌不写入 Cookie
- 图片：静态位图统一为 WebP，Favicon 为 SVG；作品长期只保存 9 张 1080px 透明 WebP，单张 JPG 按需转换，白底 JPG ZIP 在任务完成时预制
- 后台安全：不设置账户名，仅使用服务端 `ADMIN_PASSWORD`；登录后使用 12 小时 HttpOnly、SameSite 会话 Cookie，不把管理密码写入前端
- 兼容：本机视频生成要求支持 WebCodecs 的新版 Chrome、Firefox 或 Safari

## API

- `GET /api/health`：可选模型、默认模型、对应建议金额、免费模式及媒体处理状态
- `GET /api/history`：按匿名 Cookie 返回当前浏览器的生成记录及实时状态
- `GET /api/works/search?name=`：按完整名字精确查询已完成或等待前端处理的作品，最多返回最近 20 个同名结果；待处理结果附带恢复凭证
- `POST /api/analytics/events`：批量接收匿名访问、可见停留和交互事件
- `GET` / `POST` / `DELETE /api/admin/session`：检查、创建和退出后台会话
- `GET /api/admin/dashboard`：读取生成记录、九图、永久链接和埋点聚合
- `GET /api/admin/jobs/:id/events`：读取单次生成的埋点明细
- `GET /api/admin/jobs/:id/sheet`：后台查看尚待浏览器处理的九宫格母图
- `POST /api/orders/donation`：提交 `title` 和 `model=pro|lite`，服务端校验后创建带模型快照的免费生成凭证
- `POST /api/jobs`：上传照片并创建任务
- `GET /api/jobs/:id`：读取任务和永久素材
- `PATCH /api/jobs/:id/appearance`：作品主人保存背景与装饰显示设置
- `GET /api/jobs/:id/sheet`：凭作品令牌读取九宫格母图
- `POST /api/jobs/:id/faces`：上传浏览器本地抠图后的九张 WebP（兼容旧 PNG）
- `POST /api/jobs/:id/renders`、`POST /api/public/jobs/:id/renders`：旧服务端渲染接口，现返回 `410`
- `GET /generated/:id/face-XX.webp`：读取长期缓存的互动页预览
- `GET /generated/:id/face-XX.jpg`：按需读取 1080px 白底 JPG
- `GET /generated/:id/faces-jpg-v2.zip`：下载预制的九张白底 JPG；历史作品首次访问时自动补建
- `GET /generated/:id/face-XX.png`：仅兼容历史作品；旧 `video.mp4` 同样保留兼容

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

压缩新增的静态 PNG 素材并转换为 WebP（SVG Favicon 不参与位图转换）：

```bash
npm run images:optimize
```

若回滚到仍依赖透明 PNG 的旧服务版本，先从 WebP 重建缺失 PNG：

```bash
DATA_ROOT=/var/lib/9face npm run faces:restore-png
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
- 当前发布：`/opt/9face/releases/20260819182515`
- 直接回滚点：`/opt/9face/releases/20260819182437`
- 运营后台与埋点已发布；`ARK_API_KEY`、管理密码、会话密钥和埋点盐值只保存在服务器环境文件，不进入仓库
- 后续每个完成任务默认执行本地提交、推送和正式部署

## 成本

- Seedream 每次生成一张 `2144×2144` 九宫格：Pro 当前项目估算 `0.60 元`，Lite 公开按量价 `0.22 元`
- 本地拆图、抠图和反复渲染视频不产生模型费用，也不消耗服务器渲染资源
