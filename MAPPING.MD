# 元素映射

| 俗称 | 学名 | 代码名 |
| --- | --- | --- |
| 首页 / 落地页 | 生成器入口 | `Landing` / `.generator-page` |
| 首页大标题 / 随机文案 | 11 句随机 Typer 波浪主标题，点击换一句；空间不足时从逗号后换行并隐藏行尾逗号 | `landingHeadlines` / `headline` / `showNextHeadline` / `TyperHeadline` / `wrapped` / `.typer-headline-button` / `.typer-flow` / `.typer-phrase` / `.typer-comma` |
| 黑色鼠标 / 放大指针 | 桌面端 37px 自定义实心指针，按下位移 2px | `EmotionCursorTrail` / `.emotion-cursor` |
| Tiny Moods Logo / 九格拍立得 Logo | 品牌按钮和相机图标 | `BrandButton` / `app-icon.png` |
| 随机相机图标 / 点一下换相机 | 导航左侧保留的 9 个扁平透明相机；进入随机，点击品牌切换且不连续重复 | `CameraIcon` / `cameraIconConcepts` / `createCameraIconVariant` / `createInitialCameraIconVariant` / `tiny-moods:camera-icon` / `.camera-icon-*` |
| 图标生成参考稿 | 9 个图像生成方向的原始探索图，不直接用于页面透明图标 | `output/icon-concepts/flat-camera-generated/` |
| App Icon 旁边的文字 / 网页标题 | 英文动态品牌字标 `Tiny Moods` | `BrandButton` / `.brand-glyph-bar` / `.brand-glyph` |
| Tiny 黑色 / Moods 彩色 | 固定词与随机配色词 | `brandFixedLetters` / `brandMoodLetters` / `createMoodPalette` |
| 跟着字体边界走的色块 | 上伸、x 高度、下伸三类字形底板 | `brandMetricClass` / `.is-ascender` / `.is-xheight` / `.is-descender` |
| 下边四个头 | 上传区下方的动态案例 | `ExamplePortrait` / `exampleProfiles` / `.example-gallery` |
| 首页乱画 | 蜡笔涂鸦 | `.hero-doodle` / `crayonDoodles` |
| 上传照片 | 点击或拖拽单图入口 | `acceptDroppedFiles` / `.photo-dropzone` |
| 拖入框 / 上传栏 | 单图拖拽上传区 | `.photo-dropzone` / `.photo-workbench` |
| 对象名字 / 谁的名字 | 选图后展开的名称输入 | `subjectName` / `.subject-name-field` |
| 首页案例 | 上传区下方无框、微浮动的透明角色列 | `.example-gallery` / `.example-card` / `.example-card-portrait` |
| 案例浮窗 | 桌面 3:4 预览浮窗、手机底部半弹窗 | `ExamplePreviewDialog` / `embedded` |
| 日系相册 / C 方案 | 首页固定的明亮轻日系视觉 | `.landing-theme` |
| 打赏弹窗 | 免费生成前说明层 | `DonationDialog` |
| ¥0.6 / 打赏金额 | 打赏主标题 | `#donation-title` |
| 我已打赏，继续生成 | 打赏完成后的生成入口 | `.donation-continue` / `continueAfterDonation` |
| 已打赏继续 | 免费生成凭证入口 | `continueAfterDonation` / `/api/orders/donation` |
| 九宫格提示词 | 纯头部、无缝三等分规则 | `expressionPrompt` |
| 只要头 | 头顶到下巴，禁止身体 | `expressionPrompt` 的纯头部约束 |
| 九宫格白线 / 裁剪缝 | 裁切内缩 | `CELL_INSET_RATIO=0` |
| 在用户电脑上拆图 | 浏览器拆格与抠白底 | `localMatting.js` / `matting.worker.js` |
| 制作进度页 | 图片生成状态 | `JobStatus` |
| 互动页 | 永久作品体验 | `SharedJobExperience` / `JennieExperience` |
| 分享设置浮窗 | 九图入口、纯二维码、复制链接和视频入口 | `ShareSettingsSheet` / `view="share"` |
| 保存 9 张透明图片 / 九图入口 | 打开透明图平铺保存页 | `.share-faces-entry` / `setView("faces")` |
| 九图平铺 / 九张列表 | 3×3 透明原图网格 | `.share-face-grid` / `.share-face-item` |
| 一键保存 9 张 | 手机系统多图保存，电脑 ZIP 单文件下载 | `saveAllFaces` / `prepareAvatarFiles` / `downloadFilesAsZip` / `.share-save-all` |
| 背景开关 | 互动页顶部的彩色/纯白切换 | `.experience-display-controls` / `backgroundMode` / `patternStyle` |
| 装饰开关 | 互动页顶部的贴纸显示切换 | `.experience-display-controls` / `decorations` / `stickerSlots` |
| 主页图标 | 互动页底部返回主页入口 | `.experience-home` / `app-icon.png` / `onExit` |
| 保存视频 | 进入浏览器本机渲染 | `.share-save-video` / `?render=1` |
| 渲染进度页 | 本机视频生成状态 | `LocalVideoRenderPage` |
| 本机渲染器 | 按需加载 Remotion Web Renderer | `localVideoRender.js` / `renderVideoLocally` |
| 再次下载视频 | Blob 下载兜底按钮 | `triggerDownload` |
| 访客再生成视频 | 分享访客本机反复渲染 | `LocalVideoRenderPage`，不调用服务端渲染接口 |
| 永久链接 | 作品或 DEMO 地址 | `?view=:id` / `?demo=:id` |
| 分享二维码 / 纯二维码 | 无标题、头像和说明的 1080×1080 永久链接码 | `qrcode` / `buildQrCodeDataUrl` / `.share-qr-preview` |
| 视频次按钮 | 分享面板内弱化的视频入口 | `.share-save-video` |
| 团子示例 | 团子九表情互动页 | `?demo=tuanzi` / `tuanziAvatars` |
| Jennie 示例 | 由永久作品 `cec29c58067e4bdc9b6c197b540e7b74` 同步的互动页 | `?demo=jennie` / `featuredJennieAvatars` |
| 耙耙柑 / 小太阳 | 鹦鹉互动页 | `?demo=sun-conure` / `sunConureAvatars` |
| 羊石坨坨示例 | 由永久作品 `0794c461bc974ab395b539f70e52b2bf` 同步的互动页 | `?demo=yangshi-tuotuo` / `yangshiTuotuoAvatars` |
| 同步首页案例 | 永久作品转 720px 透明 WebP | `scripts/sync-home-examples.mjs` |
| 大头 | 主交互透明主体 | `.portrait` / `avatar` |
| 人物白边 | Alpha 通道描边 | `.portrait` 的 `drop-shadow` |
| 波纹 | 半调点阵高亮扩散 | `HalftoneRippleBackground` |
| 自动慢慢换一个 | 自动换装计时器 | `AUTO_CHANGE_INTERVAL` |
| 播放按钮 | BGM 自动播放回退 | `.audio-start` |
| 按钮音效 / 电影感音效 | UI SFX `10 Cinematic` 语义音效层 | `uiSfx` / `playUISfx` / `data-uisfx` |
| 声音开关 / 静音按钮 | 全站界面音效开关 | `UISoundToggle` / `.ui-sfx-toggle` / `9face:ui-sfx` |
| 大黑鼠标 / 情绪词轨迹 | 桌面自定义指针与无重叠彩色情绪标签拖尾 | `EmotionCursorTrail` / `.emotion-cursor` / `.emotion-trail-badge` |
| 生成中的低音 | 本机渲染持续反馈 | `processingSound` / `processing` |
| 渲染 Loader | 随机蜡笔替换动画 | `LoadingDoodle` |
| 旧服务端渲染接口 | 已停用兼容入口 | `/api/*/renders`，返回 `410` |
| B 端 / 后台 / 运营后台 | 内部生成与行为数据控制台 | `/admin` / `AdminApp` / `.admin-page` |
| 后台密码 / 密码键盘 | 无账户名的 6 位管理口令；手机数字键盘、电脑数字键与回车兼容 | `ADMIN_PASSWORD` / `#admin-password` / `inputMode="numeric"` |
| 后台总览 / 数据大盘 | 生成数量、访问、停留、交互和成本汇总 | `/api/admin/dashboard` / `.admin-overview` |
| 生成记录 / 作品列表 | 可筛选的九图与永久链接列表 | `JobCard` / `.admin-job-grid` |
| 生成详情 / 右侧抽屉 | 单次生成参数、九图和埋点时间线 | `JobDetail` / `.admin-detail` |
| 埋点 / 数据埋点 | 匿名页面、停留、交互和生成阶段事件 | `trackEvent` / `/api/analytics/events` |
| 页面停留时间 | 页面处于可见状态的累计时长，15 秒心跳与离开补报 | `usePageAnalytics` / `page_stay` |
| 页面访问 | 每次进入首页、生成页、互动页或视频页 | `page_view` |
| 每一个交互事件 | 全局按钮、链接、开关和输入状态变化；核心操作使用稳定动作名 | `bindInteractionAnalytics` / `interaction` / `data-analytics-action` |
| 单次生成对应埋点 | 通过作品 ID 或 DEMO ID 关联的访问、停留和交互 | `jobId` / `demoId` / `/api/admin/jobs/:id/events` |
| 埋点文件 | 按北京时间每日追加的 JSONL 事件文件 | `DATA_ROOT/analytics/events/YYYY-MM-DD.jsonl` |
