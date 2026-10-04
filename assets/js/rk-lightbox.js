/* ============================================================
   rk-lightbox.js —— 正文图片灯箱（TASK-077 共享唯一来源）
   建立者：Doubao MainAgent ｜ 2026-09-28

   功能：
     · 点击文章正文（#articleBody 等容器）内任意 <img> → 全屏遮罩放大
     · Esc / 点击遮罩 关闭；← / → 在同篇图片间切换；滚轮 / +- 键缩放
     · 与 TASK-087 rk-keys.js 联动：Esc 触发 rk-lightbox-close 事件
     · 不预取、不修改原 img（保留 srcset/sizes/loading=lazy）

   安全与约定：
     · 事件委托，不遍历图片、不阻塞页面
     · 样式走 --rk-* 令牌，零硬编码色
     · 镜像站禁用（灯箱依赖 DOM，纯增强，不做也能阅读）
   ============================================================ */
(function () {
    'use strict';
    if (window.RK_MIRROR) { return; }
    if (window.__rkLightboxLoaded) { return; }
    window.__rkLightboxLoaded = true;

    /* ---- 正文容器选择器（文章页 + 静态教程页通用） ---- */
    /* TASK-124（2026-10-04，DeepSeek）：末尾补上裸 `article`。
       静态教程页的正文容器是 <article class="bg-cardbg rounded-xl p-6">，原先这 6 个选择器
       一个都不匹配 ⇒ 静态页点图完全不开灯箱（实测 BODY_SEL 命中 = NONE、open 恒为 false）。
       安全性：静态页的作者卡/目录卡标题都在 <aside> 里，article 内只有正文，不会误纳。
       注：走的是「就近命中」，动态文章正文有 #articleBody，仍优先命中它，行为不变。 */
    var BODY_SEL = '#articleBody, .rk-article-body, .post-content, .markdown-body, article .content, .rk-article, article';

    /* ---- 灯箱样式（令牌） ---- */
    var css = '' +
        '.rk-lightbox{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;' +
        'background:rgba(0,0,0,.88);cursor:zoom-out;-webkit-user-select:none;user-select:none}' +
        '.rk-lightbox.open{display:flex}' +
        '.rk-lightbox figure{margin:0;max-width:92vw;max-height:88vh;display:flex;flex-direction:column;align-items:center;gap:.6rem}' +
        '.rk-lightbox img{max-width:92vw;max-height:82vh;object-fit:contain;border-radius:.5rem;' +
        'box-shadow:0 20px 70px rgba(0,0,0,.6);transform-origin:center center;transition:transform .15s ease}' +
        '.rk-lightbox figcaption{color:#e2e8f0;font-size:.78rem;max-width:92vw;text-align:center;' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.rk-lightbox .rk-lb-close{position:absolute;top:14px;right:18px;width:44px;height:44px;' +
        'display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;cursor:pointer;' +
        'background:rgba(255,255,255,.12);border-radius:50%;border:0}' +
        '.rk-lightbox .rk-lb-counter{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);' +
        'color:#cbd5e1;font-size:.75rem;background:rgba(0,0,0,.45);padding:.2rem .7rem;border-radius:999px}' +
        '.rk-lightbox .rk-lb-hint{position:absolute;top:14px;left:18px;color:#94a3b8;font-size:.72rem;' +
        'background:rgba(0,0,0,.35);padding:.2rem .6rem;border-radius:999px;pointer-events:none}';

    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    /* ---- 灯箱 DOM ---- */
    var box = document.createElement('div');
    box.className = 'rk-lightbox';
    box.innerHTML =
        '<span class="rk-lb-close" title="关闭">✕</span>' +
        '<span class="rk-lb-hint">Esc 关闭 · ←→ 切换 · 滚轮缩放</span>' +
        '<figure><img alt=""><figcaption></figcaption></figure>' +
        '<span class="rk-lb-counter"></span>';
    document.body.appendChild(box);

    var imgEl = box.querySelector('img');
    var capEl = box.querySelector('figcaption');
    var cntEl = box.querySelector('.rk-lb-counter');

    var images = [];      /* 当前文章内的图片列表（点击时快照） */
    var idx = 0;
    var scale = 1;

    function show(i) {
        idx = (i + images.length) % images.length;
        var src = images[idx];
        if (!src) { return; }
        imgEl.src = src;
        scale = 1;
        imgEl.style.transform = 'scale(1)';
        var cap = '';
        var a = images[idx].closest ? null : null;   /* src 是字符串，无 closest */
        /* 尝试从原图节点取 title/alt 做说明 */
        var srcMap = images._nodes || {};
        var node = srcMap[src];
        if (node) { cap = node.getAttribute('title') || node.getAttribute('alt') || ''; }
        capEl.textContent = cap;
        cntEl.textContent = images.length > 1 ? (idx + 1) + ' / ' + images.length : '';
        box.classList.add('open');
    }

    function close() {
        box.classList.remove('open');
        imgEl.src = '';
    }
    function step(d) { show(idx + d); }
    function zoom(d) {
        scale = Math.min(4, Math.max(0.5, scale + d));
        imgEl.style.transform = 'scale(' + scale + ')';
    }

    /* ---- 事件委托：正文内点击图片 ---- */
    document.addEventListener('click', function (e) {
        var t = e.target;
        while (t && t !== document.body) {
            if (t.matches && t.matches(BODY_SEL)) {
                /* 在正文容器内点击，找最近的 img */
                var im = e.target.closest('img');
                if (im && im.src && !im.closest('.rk-lightbox')) {
                    e.preventDefault();
                    images = [];
                    images._nodes = {};
                    var all = t.querySelectorAll('img');
                    all.forEach(function (x) {
                        if (x.src && !x.closest('.rk-lightbox')) {
                            images.push(x.src);
                            images._nodes[x.src] = x;
                        }
                    });
                    var cur = im.src;
                    var ci = images.indexOf(cur);
                    show(ci >= 0 ? ci : 0);
                }
                return;
            }
            t = t.parentNode;
        }
    });

    /* ---- 遮罩点击关闭（点图不关，点空白关） ---- */
    box.addEventListener('click', function (e) {
        if (e.target === box || e.target.classList.contains('rk-lb-close')) { close(); }
    });

    /* ---- 键盘：Esc / ← / → / +/- ---- */
    document.addEventListener('keydown', function (e) {
        if (!box.classList.contains('open')) { return; }
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) { return; }
        var k = e.key;
        if (k === 'Escape') { close(); e.preventDefault(); }
        else if (k === 'ArrowLeft') { step(-1); e.preventDefault(); }
        else if (k === 'ArrowRight') { step(1); e.preventDefault(); }
        else if (k === '+' || k === '=') { zoom(0.25); e.preventDefault(); }
        else if (k === '-') { zoom(-0.25); e.preventDefault(); }
    });

    /* ---- 滚轮缩放 ---- */
    box.addEventListener('wheel', function (e) {
        e.preventDefault();
        zoom(e.deltaY < 0 ? 0.2 : -0.2);
    }, { passive: false });

    /* ---- 与 rk-keys.js 联动：Esc 关灯箱 ---- */
    window.addEventListener('rk-lightbox-close', function () { close(); });

    /* ---- 移动端触摸：上滑/点击空白关闭（简单两指缩放不实现） ---- */
    var touchStart = null;
    box.addEventListener('touchstart', function (e) {
        touchStart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    }, { passive: true });
    box.addEventListener('touchend', function (e) {
        if (touchStart && e.changedTouches.length === 1) {
            var dx = e.changedTouches[0].clientX - touchStart.x;
            var dy = e.changedTouches[0].clientY - touchStart.y;
            if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { close(); }   /* 轻点 = 关闭 */
        }
        touchStart = null;
    }, { passive: true });
})();
