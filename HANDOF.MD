# 任务交接

更新时间：2026-08-19

## 当前目标

维护已上线的 `Tiny Moods`：用户上传一张照片，生成九张透明表情、永久互动页和浏览器本机视频；运营后台可查看作品、链接、成本、访问、停留时间与交互埋点。

本轮目标是优化互动页：Hover 不打断自动换表情、全量图片压缩、分享操作外露、二维码嵌入作品表情、保存图片使用半弹窗、背景音乐立即播放并提供开关。

## 本轮本地已完成

- [x] 移除头像按钮 `whileHover`，自动换表情继续由独立的 `AUTO_CHANGE_INTERVAL=6563ms` 驱动
- [x] 默认头像、Hero、App Icon 和全部装饰 PNG 转为 WebP；仅保留约 14KB 的 `favicon.png`
- [x] 首页四组案例改为只预取下一张，不再一次预载 36 张 WebP
- [x] 服务端为每张透明 PNG 原图生成 960px WebP 预览；互动浏览、二维码和视频读取 WebP，保存读取 PNG
- [x] 服务启动时补齐历史作品 WebP；图片响应使用 `private, max-age=31536000, immutable`
- [x] 互动页底部直接外露“复制链接 / 保存图片 / 分享二维码”三个操作
- [x] 保存图片改为底部半弹窗，支持一键保存九张、逐张点开和浏览器长按保存
- [x] 保存视频移到保存图片半弹窗底部，并注明“测试功能，生成比较慢，请保持页面打开”
- [x] 分享二维码改为气泡弹层，1080×1080 高纠错黑白码中央嵌入该作品表情，图片支持点开或长按保存
- [x] 分享互动页左上角使用 Phosphor 房子图标返回主页，不再使用 App Icon
- [x] 背景音乐页面挂载后立即请求播放，音频改为 `preload="auto"`；浏览器拦截时第一次可信点击补播
- [x] 左上角新增背景音乐开关；背景与装饰开关保留在顶部
- [x] 新增 `audio_play`、`audio_pause`、`qr_open`、`qr_close`、`save_images_close` 埋点中文映射

## 本轮验收

- [x] `npm run images:optimize` 可重复执行；本次目标图片 `5,953,190 → 2,172,348 bytes`，减少 `64%`
- [x] 示例单张服务端预览 `398,511B PNG → 30,944B WebP`，减少约 `92%`
- [x] `npm run build` 通过，635 个模块完成构建
- [x] 390×844 手机布局：左上角主页与音乐、右上角背景与装饰、底部四项操作均无拥挤或横向溢出
- [x] 1280×800 桌面布局通过；主页为房子图标，三个分享操作显示完整标签
- [x] 鼠标停在头像区域 7 秒后表情继续自动切换
- [x] 浏览器可信点击后 BGM 播放成功；左上角开关可暂停和恢复
- [x] 二维码气泡显示作品表情并输出 PNG Data URL；保存半弹窗显示九张预览、视频按钮和测试提示
- [x] DEMO 接口返回 9 个 WebP `src` 与 9 个 PNG `downloadSrc`，MIME 和一年缓存头正确

## 发布状态

- 本轮修改仅在本地工作区，尚未提交、推送或部署
- 当前线上仍是发布 `20260819143744`，回滚点 `20260819100933`
- 下一步如需上线：先检查工作区、提交到公开仓库，再按原子发布流程部署并验收 HTTPS、DEMO WebP、二维码、半弹窗、音乐与后台埋点
- API Key、管理密码、会话密钥、埋点盐和运行数据只允许保存在环境变量或服务器数据目录，不进入公开仓库

## 当前生产

- 地址：`https://tinymoods.mikeywa.site/`
- 仓库：`https://github.com/yanghaoleng/Tiny-Moods`
- 主机：`115.159.25.169`
- 服务：`9face.service`，监听 `127.0.0.1:8095`
- 程序：`/opt/9face/current`
- 数据：`/var/lib/9face`
- 配置：`/etc/9face.env`

## 关键文件

- 互动页：`src/JennieExperience.jsx`、`src/styles.css`
- 分享与保存：`src/generator/GeneratorApp.jsx`、`src/generator/generator.css`
- 图片预览与接口：`server/index.mjs`、`server/pipeline.mjs`
- 静态图片压缩：`scripts/optimize-static-images.mjs`
- 本机视频：`src/generator/localVideoRender.js`、`src/remotion/`
- 前端埋点：`src/analytics.js`
- 运营后台：`src/admin/AdminApp.jsx`、`src/admin/admin.css`
