/* ============================================================
   rk-reading-progress.js —— 阅读进度·继续阅读（TASK-101，唯一来源）
   建立：MainAgent ｜ 2026-10-02
   存储：localStorage['rk-read'] = { "<location.pathname>": { t, u, p, a } }
   写入：内容页滚动节流 1.5s 写一次；p>=95 视为读完 → 删除记录；最多保留 20 条
   展示：#rkContinueReading 容器内渲染最近 3 条（首页主栏顶部 / 文章页侧栏顶部）
   恢复：回到某篇文章时自动滚回上次位置（±100px）
   兜底：隐私模式 localStorage 抛异常 → 整模块静默降级，页面功能不受影响
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'rk-read';
  var MAX = 20;      /* 最多保留 20 条 */
  var SHOW = 3;      /* 展示最近 3 条 */
  var SAVE_MS = 1500;
  var DONE_PCT = 95; /* >=95 视为读完 */

  /* 内容页清单（DeepSeek 设计稿指定）：文章页 + 4 个静态教程页。
     列表/入口页（首页、博客列表）不在此列，只展示不记录。 */
  var READER_RE = /^\/(blog\/post\.php|server\/(minecraft|csgo|csgo-dedicated)\/index\.html|board\/nvidia-tesla-m40\/index\.html|board\/hidog\/index\.html)/;

  function isReader() { return READER_RE.test(location.pathname); }

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

  function cleanTitle(t) {
    return String(t || '').split('|')[0].split(' - ')[0].split('—')[0].trim();
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
    data[key] = { t: cleanTitle(document.title), u: location.pathname + location.search, p: p, a: Date.now() };
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

  /* ---- 恢复上次阅读位置（±100px） ---- */
  function restore() {
    if (!isReader()) return;
    var data = readStore(); if (!data) return;
    var rec = data[location.pathname];
    if (!rec || !rec.p || rec.p <= 0) return;
    /* 等图片/字体加载、scrollHeight 稳定后再定位 */
    setTimeout(function () {
      var h = document.documentElement;
      var max = h.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      window.scrollTo(0, Math.round(rec.p / 100 * max));
    }, 600);
  }

  /* ---- 渲染「继续阅读」卡片（最近 SHOW 条，排除当前页） ---- */
  function render() {
    var box = document.getElementById('rkContinueReading');
    if (!box) return;
    var data = readStore();
    if (!data) { box.style.display = 'none'; return; }
    var items = Object.keys(data).map(function (k) { return data[k]; })
      .filter(function (it) { return it && it.u && it.u !== location.pathname && it.p > 0; })
      .sort(function (a, b) { return (b.a || 0) - (a.a || 0); })
      .slice(0, SHOW);
    if (!items.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = '';
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
    restore();
    window.addEventListener('scroll', scheduleSave, { passive: true });
    window.addEventListener('beforeunload', function () { /* 卸载前补一次 */
      if (saveTimer) { clearTimeout(saveTimer); save(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
