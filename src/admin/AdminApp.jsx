import {useDeferredValue, useEffect, useMemo, useState} from "react";
import {ArrowClockwise} from "@phosphor-icons/react/ArrowClockwise";
import {ArrowSquareOut} from "@phosphor-icons/react/ArrowSquareOut";
import {CopySimple} from "@phosphor-icons/react/CopySimple";
import {ImageSquare} from "@phosphor-icons/react/ImageSquare";
import {LockKey} from "@phosphor-icons/react/LockKey";
import {MagnifyingGlass} from "@phosphor-icons/react/MagnifyingGlass";
import {SignOut} from "@phosphor-icons/react/SignOut";
import {X} from "@phosphor-icons/react/X";
import "./admin.css";

const API_BASE = `${import.meta.env.BASE_URL}api/admin`;

const fetchJson = async (url, options) => {
  const response = await fetch(url, {cache: "no-store", credentials: "same-origin", ...options});
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "请求没有完成");
    error.status = response.status;
    throw error;
  }
  return payload;
};

const dateTime = (value) => value ? new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(value)) : "-";

const dateOnly = (value) => value ? new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(value)) : "-";

const duration = (seconds = 0) => {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  if (value < 60) return `${value} 秒`;
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  return remainder ? `${minutes} 分 ${remainder} 秒` : `${minutes} 分`;
};

const statusText = {
  ready: "已完成",
  failed: "失败",
  queued: "排队中",
  generating: "生成中",
  awaiting_client_processing: "等待本地处理",
  rendering: "处理中",
};

const eventText = {
  page_view: "进入页面",
  page_stay: "页面停留",
  interaction: "交互",
  generation_started: "开始生成",
  generation_job_created: "任务创建",
  client_processing_completed: "本地抠图完成",
  client_processing_failed: "本地抠图失败",
  local_video_started: "开始生成视频",
  local_video_completed: "视频生成完成",
  local_video_failed: "视频生成失败",
};

const actionText = {
  brand_click: "点击品牌",
  headline_change: "更换首页标题",
  upload_open: "打开选图",
  photo_selected: "选择照片",
  photo_remove: "移除照片",
  generation_prepare: "准备生成",
  donation_model: "切换生成模型",
  donation_method: "切换打赏方式",
  donation_continue: "确认并继续生成",
  example_open: "打开案例",
  look_change: "切换表情",
  background_toggle: "切换背景",
  decorations_toggle: "切换装饰",
  audio_play: "播放背景音乐",
  audio_pause: "暂停背景音乐",
  share_open: "打开分享设置",
  share_close: "关闭分享设置",
  faces_open: "打开九图列表",
  save_images_close: "关闭保存图片",
  face_open: "查看单张大图",
  faces_save_all: "保存九张图片",
  ai_original_open: "打开 AI 原图",
  ai_original_download: "下载 AI 原图",
  qr_open: "打开分享二维码",
  qr_close: "关闭分享二维码",
  qr_save: "保存二维码",
  link_copy: "复制链接",
  video_generate: "生成视频",
  video_download_again: "再次下载视频",
  sound_toggle: "切换界面音效",
  home: "返回主页",
};

const readableAction = (value) => actionText[value] || value || "未命名交互";

function Login({configured, onLogin}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson(`${API_BASE}/session`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({password}),
      });
      onLogin();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-panel">
        <div className="admin-login-icon" aria-hidden="true"><LockKey weight="bold" /></div>
        <p className="admin-product">Tiny Moods</p>
        <h1>运营后台</h1>
        <p className="admin-login-copy">查看生成作品、永久链接和用户行为数据。</p>
        {configured === false ? (
          <div className="admin-config-warning">
            服务器还没有配置管理密码。请设置 <code>ADMIN_PASSWORD</code> 后重启服务。
          </div>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="admin-password">管理密码</label>
            <input
              id="admin-password"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              enterKeyHint="go"
              value={password}
              onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 6))}
              autoComplete="current-password"
              autoFocus
            />
            {error ? <p className="admin-form-error">{error}</p> : null}
            <button type="submit" disabled={busy || password.length !== 6}>{busy ? "正在登录" : "进入后台"}</button>
          </form>
        )}
        <a className="admin-back-home" href={import.meta.env.BASE_URL}>返回产品首页</a>
      </section>
    </main>
  );
}

function Metric({label, value, note}) {
  return (
    <div className="admin-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function ActivityChart({daily}) {
  const maxValue = Math.max(1, ...daily.map((item) => item.visits + item.interactions));
  if (!daily.length) return <div className="admin-empty-compact">当前时间范围还没有访问数据</div>;
  return (
    <div className="admin-chart" aria-label="访问与交互趋势">
      {daily.map((item) => {
        const visitHeight = Math.max(3, Math.round(item.visits / maxValue * 100));
        const interactionHeight = Math.max(3, Math.round(item.interactions / maxValue * 100));
        return (
          <div className="admin-chart-day" key={item.date} title={`${item.date}：${item.visits} 次访问，${item.interactions} 次交互`}>
            <div className="admin-chart-bars">
              <span className="is-visits" style={{height: `${visitHeight}%`}} />
              <span className="is-interactions" style={{height: `${interactionHeight}%`}} />
            </div>
            <small>{item.date.slice(5).replace("-", "/")}</small>
          </div>
        );
      })}
    </div>
  );
}

function JobFaces({job, large = false}) {
  if (!job.imageUrls?.length) {
    return <div className={`admin-faces-empty ${large ? "is-large" : ""}`}><ImageSquare weight="bold" /><span>暂无成图</span></div>;
  }
  return (
    <div className={`admin-faces ${large ? "is-large" : ""}`}>
      {job.imageUrls.map((src, index) => <img key={src} src={src} alt={`${job.title} 第 ${index + 1} 张生成图`} loading="lazy" />)}
    </div>
  );
}

function JobCard({job, onOpen}) {
  const metrics = job.analytics || {};
  const linkLabel = job.status === "ready" ? "打开永久链接" : "打开固定任务链接";
  return (
    <article className="admin-job-card">
      <button type="button" className="admin-job-open" onClick={() => onOpen(job)} aria-label={`查看 ${job.title} 的生成详情`}>
        <JobFaces job={job} />
        <div className="admin-job-main">
          <div className="admin-job-title-line">
            <h3>{job.title}</h3>
            <span className={`admin-status is-${job.status}`}>{statusText[job.status] || job.status}</span>
          </div>
          <p>{dateTime(job.createdAt)}<span>{job.demo ? "案例" : job.modelLabel || job.model || "未记录模型"}</span></p>
          <div className="admin-job-data">
            <span><strong>{metrics.visits || 0}</strong>访问</span>
            <span><strong>{metrics.uniqueSessions || 0}</strong>会话</span>
            <span><strong>{duration(metrics.averageStaySeconds || 0)}</strong>平均停留</span>
            <span><strong>{metrics.interactions || 0}</strong>交互</span>
          </div>
        </div>
      </button>
      <div className="admin-job-footer">
        <code>{job.id}</code>
        <a href={job.adminOpenUrl || job.fixedUrl} target="_blank" rel="noreferrer">{linkLabel} <ArrowSquareOut weight="bold" /></a>
      </div>
    </article>
  );
}

function EventList({events, compact = false}) {
  if (!events?.length) return <div className="admin-empty-compact">当前没有可展示的埋点事件</div>;
  return (
    <div className={`admin-event-list ${compact ? "is-compact" : ""}`}>
      {events.map((event) => (
        <div className="admin-event-row" key={event.id}>
          <div>
            <strong>{event.name === "interaction" ? readableAction(event.properties?.action) : eventText[event.name] || event.name}</strong>
            <span>
              {[event.page, event.device, event.properties?.target || event.properties?.method, event.sessionId ? `会话 ${event.sessionId.slice(0, 8)}` : ""].filter(Boolean).join(" / ")}
            </span>
          </div>
          <div>
            {event.name === "page_stay" ? <strong>{duration((event.durationMs || 0) / 1000)}</strong> : null}
            <time>{dateTime(event.occurredAt)}</time>
          </div>
        </div>
      ))}
    </div>
  );
}

function JobDetail({job, detail, loading, onClose}) {
  const [copyState, setCopyState] = useState("");
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    document.body.classList.add("admin-detail-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("admin-detail-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const current = detail?.job || job;
  const copyLink = async () => {
    if (!current.fixedUrl) return;
    await navigator.clipboard.writeText(current.fixedUrl);
    setCopyState("已复制");
    window.setTimeout(() => setCopyState(""), 1600);
  };

  const metrics = current.analytics || {};
  const linkLabel = current.status === "ready" ? "打开永久链接" : "打开固定任务链接";
  return (
    <div className="admin-detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="admin-detail" role="dialog" aria-modal="true" aria-labelledby="admin-detail-title">
        <header>
          <div>
            <p>{current.demo ? "案例作品" : "生成记录"}</p>
            <h2 id="admin-detail-title">{current.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭详情"><X weight="bold" /></button>
        </header>
        <div className="admin-detail-scroll">
          <JobFaces job={current} large />
          <div className="admin-detail-actions">
            <a href={current.adminOpenUrl || current.fixedUrl} target="_blank" rel="noreferrer">{linkLabel} <ArrowSquareOut weight="bold" /></a>
            <button type="button" onClick={copyLink}><CopySimple weight="bold" />{copyState || "复制固定链接"}</button>
          </div>

          <section className="admin-detail-section">
            <h3>生成数据</h3>
            <dl className="admin-definition-grid">
              <div><dt>任务 ID</dt><dd>{current.id}</dd></div>
              <div><dt>状态</dt><dd>{statusText[current.status] || current.status}</dd></div>
              <div><dt>创建时间</dt><dd>{dateOnly(current.createdAt)} {dateTime(current.createdAt).slice(-5)}</dd></div>
              <div><dt>生成耗时</dt><dd>{current.generationSeconds === null ? "-" : duration(current.generationSeconds)}</dd></div>
              <div><dt>模型</dt><dd>{current.modelLabel || current.model || "-"}</dd></div>
              <div><dt>成图尺寸</dt><dd>{current.generatedImageSize || "-"}</dd></div>
              <div><dt>Seedream 请求号</dt><dd>{current.seedreamRequestId || "-"}</dd></div>
              <div><dt>估算成本</dt><dd>{current.seedreamCostEstimate ? `¥${Number(current.seedreamCostEstimate.estimatedTotalCny).toFixed(2)}` : "-"}</dd></div>
              <div><dt>订单</dt><dd>{current.order?.id || current.orderId || "-"}</dd></div>
              <div><dt>支付/打赏</dt><dd>{current.order?.provider === "voluntary_tip" ? `自愿打赏 / 建议 ¥${current.order.suggestedDonationCny || current.suggestedDonationCny || "-"}` : current.order ? `${current.order.channel} / ¥${current.order.amountCny}` : current.payment?.status || "-"}</dd></div>
            </dl>
            {current.generationError ? <div className="admin-generation-error"><strong>失败详情</strong><p>{current.generationError}</p></div> : null}
            {current.sheetUrl ? <div className="admin-sheet"><h4>{current.status === "ready" ? "AI 生成原图" : "待处理九宫格母图"}</h4><img src={current.sheetUrl} alt={`${current.title} 九宫格母图`} /></div> : null}
          </section>

          <section className="admin-detail-section">
            <h3>关联埋点</h3>
            <div className="admin-detail-metrics">
              <Metric label="访问" value={metrics.visits || 0} note={`${metrics.uniqueSessions || 0} 个匿名会话`} />
              <Metric label="平均停留" value={duration(metrics.averageStaySeconds || 0)} note={`累计 ${duration(metrics.visibleSeconds || 0)}`} />
              <Metric label="交互" value={metrics.interactions || 0} note={metrics.lastEventAt ? `最近 ${dateTime(metrics.lastEventAt)}` : "暂无事件"} />
            </div>
            {loading ? <div className="admin-detail-loading">正在读取事件明细</div> : <EventList events={detail?.events || []} />}
          </section>
        </div>
      </aside>
    </div>
  );
}

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState("7");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [includeDemos, setIncludeDemos] = useState(false);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetail, setJobDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    document.title = "Tiny Moods 运营后台";
    document.body.classList.add("admin-body");
    void fetchJson(`${API_BASE}/session`)
      .then(setSession)
      .catch((requestError) => setSession({configured: true, authenticated: false, error: requestError.message}));
    return () => document.body.classList.remove("admin-body");
  }, []);

  useEffect(() => { setPage(1); }, [deferredQuery, status, includeDemos, days]);

  useEffect(() => {
    if (!session?.authenticated) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        days,
        q: deferredQuery,
        status,
        includeDemos: includeDemos ? "1" : "0",
        page: String(page),
        pageSize: "36",
      });
      void fetchJson(`${API_BASE}/dashboard?${params}`)
        .then((payload) => { if (active) setData(payload); })
        .catch((requestError) => {
          if (!active) return;
          if (requestError.status === 401) setSession((current) => ({...current, authenticated: false}));
          else setError(requestError.message);
        })
        .finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [days, deferredQuery, includeDemos, page, refreshKey, session?.authenticated, status]);

  const openJob = async (job) => {
    setSelectedJob(job);
    setJobDetail(null);
    setDetailLoading(true);
    try {
      const payload = await fetchJson(`${API_BASE}/jobs/${encodeURIComponent(job.id)}/events?days=${days}&limit=300`);
      setJobDetail(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const logout = async () => {
    await fetchJson(`${API_BASE}/session`, {method: "DELETE"});
    setSession((current) => ({...current, authenticated: false}));
    setData(null);
  };

  const periodLabel = days === "0" ? "全部时间" : days === "1" ? "今天" : `近 ${days} 天`;
  const maxAction = useMemo(() => Math.max(1, ...(data?.topActions || []).map((item) => item.count)), [data?.topActions]);

  if (!session) return <main className="admin-loading-page">正在检查后台配置</main>;
  if (!session.authenticated) return <Login configured={session.configured} onLogin={() => setSession({configured: true, authenticated: true})} />;

  const overview = data?.overview || {};
  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p>Tiny Moods</p>
          <h1>运营后台</h1>
        </div>
        <div className="admin-header-actions">
          <a href={import.meta.env.BASE_URL} target="_blank" rel="noreferrer">产品首页 <ArrowSquareOut weight="bold" /></a>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><ArrowClockwise weight="bold" />刷新</button>
          <button type="button" onClick={logout}><SignOut weight="bold" />退出</button>
        </div>
      </header>

      <div className="admin-content">
        <section className="admin-overview" aria-label="核心数据">
          <Metric label="正式生成" value={overview.totalJobs ?? "-"} note={`今天 ${overview.todayJobs || 0} 次，完成 ${overview.readyJobs || 0} 次`} />
          <Metric label="生成图片" value={overview.totalImages ?? "-"} note={`${overview.permanentJobs || 0} 个永久作品`} />
          <Metric label={`${periodLabel}访问`} value={overview.visits ?? "-"} note={`${overview.uniqueSessions || 0} 个匿名会话`} />
          <Metric label="平均停留" value={duration(overview.averageStaySeconds || 0)} note={`累计 ${duration(overview.visibleSeconds || 0)}`} />
          <Metric label="交互事件" value={overview.interactions ?? "-"} note={`估算模型成本 ¥${Number(overview.totalEstimatedCostCny || 0).toFixed(2)}`} />
        </section>

        <section className="admin-insights-grid">
          <div className="admin-panel">
            <div className="admin-panel-heading"><h2>行为趋势</h2><span>{periodLabel}</span></div>
            <div className="admin-chart-legend"><span className="is-visits">访问</span><span className="is-interactions">交互</span></div>
            <ActivityChart daily={data?.daily || []} />
          </div>
          <div className="admin-panel">
            <div className="admin-panel-heading"><h2>高频交互</h2><span>前 12 项</span></div>
            {data?.topActions?.length ? <div className="admin-actions-ranking">
              {data.topActions.map((item) => (
                <div key={item.action}>
                  <span>{readableAction(item.action)}</span>
                  <div><i style={{width: `${Math.max(4, item.count / maxAction * 100)}%`}} /></div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div> : <div className="admin-empty-compact">还没有交互事件</div>}
          </div>
        </section>

        <section className="admin-jobs-section">
          <div className="admin-section-heading">
            <div><h2>生成记录</h2><p>查看九张成图、永久链接、生成参数和关联埋点。</p></div>
            <span>{data?.pagination?.total || 0} 条</span>
          </div>
          <div className="admin-toolbar">
            <label className="admin-search"><MagnifyingGlass weight="bold" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名字、任务 ID 或订单 ID" /></label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="筛选生成状态">
              <option value="all">全部状态</option>
              <option value="ready">已完成</option>
              <option value="failed">失败</option>
              <option value="awaiting_client_processing">等待本地处理</option>
              <option value="generating">生成中</option>
              <option value="queued">排队中</option>
            </select>
            <select value={days} onChange={(event) => setDays(event.target.value)} aria-label="选择埋点时间范围">
              <option value="1">今天</option>
              <option value="7">近 7 天</option>
              <option value="30">近 30 天</option>
              <option value="90">近 90 天</option>
              <option value="0">全部时间</option>
            </select>
            <label className="admin-checkbox"><input type="checkbox" checked={includeDemos} onChange={(event) => setIncludeDemos(event.target.checked)} /><span>包含案例</span></label>
          </div>
          {error ? <div className="admin-error">{error}<button type="button" onClick={() => setRefreshKey((value) => value + 1)}>重试</button></div> : null}
          {loading && !data ? <div className="admin-job-skeletons">{Array.from({length: 6}, (_, index) => <span key={index} />)}</div> : null}
          {!loading && data && !data.jobs.length ? <div className="admin-empty"><ImageSquare weight="bold" /><h3>没有匹配的生成记录</h3><p>调整搜索词或筛选条件后再试。</p></div> : null}
          {data?.jobs?.length ? <div className={`admin-job-grid ${loading ? "is-refreshing" : ""}`}>{data.jobs.map((job) => <JobCard key={job.id} job={job} onOpen={openJob} />)}</div> : null}
          {data?.pagination?.pages > 1 ? <div className="admin-pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
            <span>第 {data.pagination.page} / {data.pagination.pages} 页</span>
            <button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage((value) => value + 1)}>下一页</button>
          </div> : null}
        </section>

        <section className="admin-panel admin-recent-panel">
          <div className="admin-panel-heading"><h2>最近事件</h2><span>最新 60 条</span></div>
          <EventList events={data?.recentEvents || []} compact />
        </section>
      </div>

      {selectedJob ? <JobDetail job={selectedJob} detail={jobDetail} loading={detailLoading} onClose={() => { setSelectedJob(null); setJobDetail(null); }} /> : null}
    </main>
  );
}
