/* ============================================================
   rk-reading-progress.js —— 阅读进度·继续阅读（TASK-101，唯一来源）
   建立：MainAgent ｜ 2026-10-02 ｜ 修订：TASK-115（②⑤⑥，2026-10-03）
   存储：localStorage['rk-read'] = { "<location.pathname>": { t, u, p, a } }
   写入：内容页滚动节流 1.5s 写一次；p>=95 视为读完 → 删除记录；最多保留 20 条
   展示：#rkContinueReading 容器内渲染最近 3 条（首页主栏顶部 / 文章页侧栏顶部）
   恢复：回到某篇文章时立即瞬时滚回上次位置（load/300ms 后校正，不闪开头）
   兜底：隐私模式 localStorage 抛异常 → 整模块静默降级，页面功能不受影响
   ============================================================ */
(function () {
  'use strict';

  /* ⑥ 尽早关掉浏览器自带滚动恢复，避免「先停开头再跳」 */
  try { if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; } } catch (e) {}

  var KEY = 'rk-read';
  var MAX = 20;      /* 最多保留 20 条 */
  var SHOW = 3;      /* 展示最近 3 条 */
  var SAVE_MS = 1500;
  var DONE_PCT = 95; /* >=95 视为读完 */

  /* ② 结构化判据：文章页 = 有评论区容器 + 正文里有 h1。
     首页/板块落地页/列表页/下载页都没有 #rkComments ⇒ 天然排除，不再维护路径清单。 */
  function isReader() {
    return !!document.getElementById('rkComments') && !!document.querySelector('article h1');
  }

  /* ---- localStorage 隐私模式兜底（Safari 无痕 setItem 会抛） ---- */
  function readStore() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      return (v && typeof v === 'object') ? v : {};
    } catch (e) { return null; } /* null = 存储不可用，整个模块静默 */
  }
  function writeStore(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
  }

  /* ---- 进度算法：每次现取 scrollHeight（图片加载后会变） ---- */
  function calcPct() {
    var h = document.documentElement;
    var max = h.scrollHeight - window.innerHeight;
    if (max <= 0) return 0;
    var p = Math.round((window.scrollY || 0) / max * 100);
    return Math.max(0, Math.min(100, p));
  }

  /* TASK-116②（2026-10-03，DeepSeek）：修「继续阅读卡片显示成 RickC.TechBlog、看不到文章名」。
     根因：本站各页 <title> 的站点名位置**不统一** ——
       blog/post.php      -> "文章名 | RickC.TechBlog"   （站点名在后）
       server/minecraft…  -> "RickC.TechBlog | 文章名"   （站点名在前）
       board/hidog…       -> "RickC.TechBlog | Hi-Dog"
     而原实现是 split('|')[0]（取第一段）⇒ 站点名在前时就只剩 "RickC.TechBlog"。
     修法：① 主来源改为正文里的 <article> h1（文章真名，且 isReader() 已要求它存在）；
           ② 兜底才是 title，且改成「跳过站点名那一段」。 */
  var SITE_NAME = 'RickC.TechBlog';
  function cleanTitle(t) {
    var s = String(t || '');
    var parts = s.split(/\s*[|·]\s*|\s+-\s+|\s*—\s*/);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p && p.indexOf(SITE_NAME) === -1) { return p; }
    }
    return s.trim();
  }
  function pageTitle() {
    var h = document.querySelector('article h1');
    var s = h ? String(h.textContent || '').trim() : '';
    return s || cleanTitle(document.title);
  }

  /* ---- 节流写入 ---- */
  var saveTimer = null;
  function save() {
    if (!isReader()) return;
    var data = readStore(); if (!data) return;
    var p = calcPct();
    var key = location.pathname;
    if (p >= DONE_PCT) {
      if (data[key]) { delete data[key]; writeStore(data); render(); }
      return;
    }
    data[key] = { t: pageTitle(), u: location.pathname + location.search, p: p, a: Date.now() };
    /* 按 a 倒序裁剪：只留最新 MAX 条 */
    Object.keys(data).sort(function (x, y) { return (data[y].a || 0) - (data[x].a || 0); })
      .slice(MAX).forEach(function (k) { delete data[k]; });
    writeStore(data);
    render();
  }
  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () { saveTimer = null; save(); }, SAVE_MS);
  }

  /* ---- ⑥ 恢复上次阅读位置：瞬时 scrollTo（不用 smooth），load/300ms 后校正 ---- */
  function restoreOnce() {
    if (!isReader()) return;
    var data = readStore(); if (!data) return;
    var rec = data[location.pathname];
    if (!rec || !rec.p || rec.p <= 0) return;
    var h = document.documentElement;
    var max = h.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    window.scrollTo(0, Math.round(rec.p / 100 * max));
  }

  /* ---- 渲染「继续阅读」卡片（最近 SHOW 条，排除当前页） ---- */
  function render() {
    var box = document.getElementById('rkContinueReading');
    if (!box) return;
    var data = readStore();
    /* ⑤ 死代码修复：data 恒为 {}，必须连同 Object.keys 判空 */
    if (!data || !Object.keys(data).length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var items = Object.keys(data).map(function (k) { return data[k]; })
      .filter(function (it) { return it && it.u && it.u !== location.pathname && it.p > 0; })
      .sort(function (a, b) { return (b.a || 0) - (a.a || 0); })
      .slice(0, SHOW);
    if (!items.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    /* ⑤ 修复：id 选择器 #rkContinueReading{display:none} 特异性 100，
       内联 display=''（清除）会被 CSS 重新压成 none ⇒ 卡片永远不显示。改为显式 block。 */
    box.style.display = 'block';
    var html = '<h3 class="rk-read-h3"><i class="fa fa-history"></i>继续阅读</h3><div class="space-y-3">';
    items.forEach(function (it) {
      var pct = Math.max(0, Math.min(100, Math.round(it.p || 0)));
      html += '<a class="rk-read-card" href="' + it.u + '">'
        + '<div class="rk-read-row"><span class="rk-read-title">' + escapeHtml(it.t || it.u) + '</span>'
        + '<span class="rk-read-pct">' + pct + '%</span></div>'
        + '<div class="rk-read-bar"><div class="rk-read-fill" style="width:' + pct + '%"></div></div>'
        + '</a>';
    });
    html += '</div>';
    box.innerHTML = html;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---- 启动 ---- */
  function init() {
    if (readStore() === null) return; /* 存储不可用：静默降级 */
    render();
    restoreOnce();                                  /* ⑥ 立即恢复，不闪开头 */
    window.addEventListener('load', restoreOnce);   /* ⑥ 图片加载后校正文档高度 */
    setTimeout(restoreOnce, 300);                   /* ⑥ 兜底再校正一次 */
    window.addEventListener('scroll', scheduleSave, { passive: true });
    window.addEventListener('beforeunload', function () { /* 卸载前补一次 */
      if (saveTimer) { clearTimeout(saveTimer); save(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
