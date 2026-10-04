/* ============================================================
   rk-reading-progress.js —— 阅读进度·继续阅读（TASK-101，唯一来源）
   建立：MainAgent ｜ 2026-10-02 ｜ 修订：TASK-115（②⑤⑥，2026-10-03）
   存储：localStorage['rk-read'] = { "<规范URL>": { t, u, p, a } }
        （TASK-151 起用规范 URL 作键 —— <link rel=canonical>，取不到才回落 pathname+search；
          旧版用 location.pathname，同一篇的干净 URL 与 post.php?slug= 会各存一条，
          而且 post.php 下所有文章还共用一个键 `/blog/post.php`）
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
  /* TASK-151：超过这么久没动过的记录视为过期、直接丢掉。
     站长：「那个继续阅读 12% 还在，已经死在那边了」—— 一条卡住的记录（因为进度没能继续
     更新，见下面 restoreOnce 的修复）会永远挂在卡片上，所以除了修根因，也加一道时间闸门。 */
  var EXPIRE_MS = 7 * 24 * 3600 * 1000;

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

  /* ============================================================
     TASK-151（2026-10-04，DeepSeek）：**同一篇文章的两个 URL 形态被当成两个页面**
     站长：「我都按回到顶部滑到顶了还提示我阅读了 12% 继续阅读」。
     实测（headless，种入两条记录）：
       · 在干净 URL `/board/arduino-ffb-board/` 上，「继续阅读」卡片里列出来的**就是这一篇**
         —— 只不过用的是旧 `/blog/post.php?slug=arduino-ffb-board` 那条记录（37%）；
       · 在旧 URL 上更糟：**连当前页自己都被列进去了**，因为过滤写的是
         `it.u !== location.pathname` —— 拿"带查询串的 URL"去比"纯路径"，永远不相等 ✗。
     修法两条（都只在下面这几个函数里）：
       pageUrl() —— 本页的**规范 URL**：优先 `<link rel="canonical">`（post.php 一直有），
                   否则退回落 pathname+search。于是「干净 URL」与「post.php?slug=」
                   从此**共用同一条记录**，不再各自攒一条。
       isHere()  —— "这条记录是不是我正在读的这篇文章"：先比规范 URL；再比**文章身份**
                   （`?slug=xxx` 与 `/<板块>/<slug>/` 视为同一篇）。
       另外 render() 会按文章身份**去重**，把历史遗留的重复记录合并显示。
     ============================================================ */
  var SECTION_1 = { board: 1, server: 1, download: 1 };
  function safeDec(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function normPath(u) {
    var s = String(u || '');
    var hash = s.indexOf('#'); if (hash >= 0) s = s.slice(0, hash);
    try { var x = new URL(s, location.origin); return x.pathname + x.search; } catch (e) { return s; }
  }
  /* 能唯一认出"哪一篇文章"时才返回 slug，否则返回 ''（宁可少合并，也不要错合并） */
  function slugOf(u) {
    var s = String(u || '');
    var m = /[?&]slug=([^&#]*)/.exec(s);
    if (m) return safeDec(m[1]);
    var p = s.split('#')[0].split('?')[0].replace(/\/+$/, '');
    var seg = p.split('/').filter(Boolean);
    if (seg.length === 2 && SECTION_1[seg[0]]) return safeDec(seg[1]);
    return '';
  }
  function pageUrl() {
    var l = document.querySelector('link[rel="canonical"]');
    var href = l && l.getAttribute('href');
    if (href) {
      try {
        var u = new URL(href, location.href);
        if (u.origin === location.origin) return u.pathname + u.search;
      } catch (e) {}
    }
    return location.pathname + location.search;
  }
  var HERE_URL = pageUrl();
  var HERE_SLUG = slugOf(location.pathname + location.search);
  function isHere(u) {
    if (!u) return false;
    if (normPath(u) === HERE_URL) return true;
    var sl = slugOf(u);
    return !!(sl && HERE_SLUG && sl === HERE_SLUG);
  }
  /* 去重用的身份：优先 slug，其次规范路径 */
  function identOf(u) { return slugOf(u) || normPath(u); }

  /* ---- 节流写入 ---- */
  var saveTimer = null;
  function save() {
    if (!isReader()) return;
    var data = readStore(); if (!data) return;
    var p = calcPct();
    /* TASK-151：键改用**规范 URL**（不再是 location.pathname ——
       旧写法还把 post.php 那一堆文章全挤在同一个键 `/blog/post.php` 上，
       等于互相覆盖）。 */
    var key = HERE_URL;
    if (p >= DONE_PCT) {
      var dirty = false;
      Object.keys(data).forEach(function (k) {
        if (k === key || isHere(data[k] && data[k].u)) { delete data[k]; dirty = true; }
      });
      if (dirty) { writeStore(data); render(); }
      return;
    }
    data[key] = { t: pageTitle(), u: HERE_URL, p: p, a: Date.now() };
    /* TASK-151：把**同一篇文章**的历史遗留键合并掉（旧版按 location.pathname 存，
       同一篇的干净 URL 与 post.php?slug= 会各留一条）。render() 也按身份去重，
       这里顺手清掉，免得同一条记录在存储里越攒越多。 */
    Object.keys(data).forEach(function (k) {
      if (k !== key && data[k] && isHere(data[k].u)) delete data[k];
    });
    /* TASK-151：顺手清掉过期记录，再按 a 倒序裁剪（只留最新 MAX 条） */
    pruneExpired(data);
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
  /* TASK-151：**用户一旦自己滚过，就绝不再把他拽回去**。
     原实现只在 init / load / 300ms 各"校正"一次，本意是等图片加载完、文档高度确定后
     再落到正确位置；但 load 事件在长文里可能很晚（等图片/字体），于是出现
     「我已经滚到顶了，它又把我拽回上次的位置」—— 实测（headless 种入 12% 记录后
     滚到 50%）记录里**仍然是 12%**，说明那次延迟校正真的把我拉回去了 ✗。
     现在用一个标记区分"我自己的 scrollTo"与"用户滚的"：用户滚过之后直接放弃校正。 */
  var selfScroll = false, userScrolled = false;
  function jumpToPct(pct) {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    selfScroll = true;
    window.scrollTo(0, Math.round(pct / 100 * max));
    /* scroll 事件是**异步派发**的 ⇒ 用一个宏任务把标记放掉，否则会把自己的滚动误判成用户的 */
    setTimeout(function () { selfScroll = false; }, 0);
  }
  window.addEventListener('scroll', function () { if (!selfScroll) userScrolled = true; }, { passive: true });

  function restoreOnce() {
    if (!isReader() || userScrolled) return;
    var data = readStore(); if (!data) return;
    /* TASK-151：先按规范 URL 取；取不到再按"文章身份"找（兼容历史记录 ——
       它们的键是旧的 location.pathname、u 是 /blog/post.php?slug=…）。 */
    var rec = data[HERE_URL];
    if (!rec) {
      Object.keys(data).forEach(function (k) {
        var it = data[k];
        if (!it || !isHere(it.u)) return;
        if (!rec || (it.a || 0) > (rec.a || 0)) rec = it;
      });
    }
    if (!rec || !rec.p || rec.p <= 0) return;
    jumpToPct(rec.p);
  }

  /* ---- 渲染「继续阅读」卡片（最近 SHOW 条，排除当前页） ---- */
  function render() {
    var box = document.getElementById('rkContinueReading');
    if (!box) return;
    var data = readStore();
    /* ⑤ 死代码修复：data 恒为 {}，必须连同 Object.keys 判空 */
    if (!data || !Object.keys(data).length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    /* TASK-151：先丢过期记录（>EXPIRE_MS 没动过的），有改动就回写。
       —— 这是给"卡死在 12%"那条记录的第二道保险：即使它再也不会被更新，也不会永远挂着。 */
    if (pruneExpired(data)) writeStore(data);
    if (!Object.keys(data).length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    /* TASK-151：① 排除**当前这篇文章**（按文章身份，不再按 URL 字符串 ——
       旧写法 `it.u !== location.pathname` 在带查询串的页面上永远不相等，
       于是"你正在读的这一篇"会被列成"继续阅读"）；② 按身份去重（历史上同一篇
       可能既存了干净 URL 又存了 post.php URL 两条），保留更新的那条。 */
    var seen = {};
    var items = Object.keys(data).map(function (k) { return { k: k, it: data[k] }; })
      .filter(function (x) { return x.it && x.it.u && x.it.p > 0 && !isHere(x.it.u); })
      .sort(function (a, b) { return (b.it.a || 0) - (a.it.a || 0); })
      .filter(function (x) {
        var id = identOf(x.it.u);
        if (seen[id]) return false;
        seen[id] = 1;
        return true;
      })
      .slice(0, SHOW);
    if (!items.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    /* ⑤ 修复：id 选择器 #rkContinueReading{display:none} 特异性 100，
       内联 display=''（清除）会被 CSS 重新压成 none ⇒ 卡片永远不显示。改为显式 block。 */
    box.style.display = 'block';
    var html = '<h3 class="rk-read-h3"><i class="fa fa-history"></i>继续阅读</h3><div class="space-y-3">';
    items.forEach(function (x) {
      var it = x.it;
      var pct = Math.max(0, Math.min(100, Math.round(it.p || 0)));
      html += '<div class="rk-read-item">'
        + '<a class="rk-read-card" href="' + escapeHtml(it.u) + '">'
        + '<div class="rk-read-row"><span class="rk-read-title">' + escapeHtml(it.t || it.u) + '</span>'
        + '<span class="rk-read-pct">' + pct + '%</span></div>'
        + '<div class="rk-read-bar"><div class="rk-read-fill" style="width:' + pct + '%"></div></div>'
        + '</a>'
        /* TASK-151：每条给一个"移除"按钮（悬停才出现）。
           ⚠️ 必须放在 <a> **外面** —— 交互元素嵌在链接里是非法结构，浏览器会把它搬出去
             （TASK-133 的 <a> 套 <a> 就是被解析器拆散的），所以用 .rk-read-item 包一层。 */
        + '<button type="button" class="rk-read-x" data-k="' + escapeHtml(x.k) + '"'
        + ' title="从「继续阅读」里移除" aria-label="移除">×</button>'
        + '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
  }

  /* TASK-151：丢掉过期记录，返回是否有改动 */
  function pruneExpired(data) {
    var now = Date.now(), changed = false;
    Object.keys(data).forEach(function (k) {
      var it = data[k];
      if (!it || typeof it !== 'object' || !it.a || (now - it.a) > EXPIRE_MS) { delete data[k]; changed = true; }
    });
    return changed;
  }
  /* TASK-151：手动移除一条记录（点卡片右上角那个 ×） */
  function removeEntry(k) {
    if (!k) return;
    var data = readStore(); if (!data) return;
    if (data[k]) { delete data[k]; writeStore(data); }
    render();
  }
  /* 事件委托：绑定一次即可（render() 只换 innerHTML，容器本身不换） */
  function bindBox() {
    var box = document.getElementById('rkContinueReading');
    if (!box || box.__rkBound) return;
    box.__rkBound = 1;
    box.addEventListener('click', function (e) {
      var btn = (e.target && e.target.closest) ? e.target.closest('.rk-read-x') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      removeEntry(btn.getAttribute('data-k') || '');
    });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---- 启动 ---- */
  function init() {
    if (readStore() === null) return; /* 存储不可用：静默降级 */
    bindBox();   /* TASK-151：× 按钮的事件委托，只绑一次 */
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
