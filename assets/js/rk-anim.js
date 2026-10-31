/* ============================================================
   rk-anim.js —— 全站渐进载入动画（唯一来源，TASK-062 建立；TASK-169 重写节奏）
   建立者：豆包（依 DeepSeek 任务单 062）｜ 2026-09-27
   重写：DeepSeek ｜ 2026-10-31

   用法：页面里保留 RickC-ANIM 的 CSS 预隐藏块（opacity:0 + translateY），并把
        原来那份内联动画脚本整段替换为：
            <script src="/assets/js/rk-anim.js?v=20261031v2"><\/script>

   三条兜底不可删：IntersectionObserver / 25 秒强制全显 / MutationObserver。
   禁止加 prefers-reduced-motion 禁用规则（站长铁律）。

   ---- 2026-10-31 为什么重写 ----
   站长前后三条反馈：①「动画太快太提前，都看不到」②「小板块会闪烁」
   ③「最新文章应该最后加载，要按从上到下的顺序」。
   旧实现按"视觉行"分桶 + 一次性给所有元素排 setTimeout，问题在于：
     · 分桶依据是**当时的** top，动态插入的卡片（最新文章）自己另跑一套内联动画，
       于是底部的卡先出现、上面的板块后出现 —— 顺序是反的；
     · 两套动画（内联 + 本脚本）同时改同一个元素的 opacity/transform ⇒ 视觉上"闪一下"。
   现在改成**单一队列 + 逐条播放**：
     · 所有待显元素进同一条队列，按**文档从上到下**排序，每 SEQ 毫秒只放一条；
     · 新插入的元素（无限滚动的文章、弹窗里的卡）走 MutationObserver 入队，
       仍然按 top 插到正确位置 ⇒ 顺序永远是上→下，最新文章自然最后出现；
     · 视口外的元素不入队播放，改交 IntersectionObserver，滚到哪儿显到哪儿。
   ============================================================ */
(function () {
    'use strict';
    if (window.__rkAnimLoaded) { return; }
    window.__rkAnimLoaded = true;

    /* ---- 动画时长统一覆盖（页面内联多为 .5s / 14px；这里统一成 .9s / 28px） ---- */
    (function () {
        var ov = document.createElement('style');
        ov.id = 'rkAnimTiming';
        ov.textContent = '.card, article, .post-card, .card-hover, .rk-reveal-target, [class~=card]{transform:translateY(28px);transition:opacity .9s cubic-bezier(.22,.61,.36,1),transform .9s cubic-bezier(.22,.61,.36,1)}.rk-reveal.rk-in{opacity:1;transform:none}';
        (document.head || document.documentElement).appendChild(ov);
    })();

    /* ---- 顶部进度条 ---- */
    var bar = document.createElement('div');
    bar.id = 'pageProgress';
    document.body.insertBefore(bar, document.body.firstChild);
    var p = 0, done = false;
    var timer = setInterval(function () {
        if (done) { return; }
        p = Math.min(p + (100 - p) * 0.18 + 1.5, 92);
        bar.style.width = p + '%';
    }, 120);
    function finish() {
        if (done) { return; }
        done = true;
        clearInterval(timer);
        bar.style.width = '100%';
        setTimeout(function () { bar.classList.add('done'); }, 350);
        setTimeout(function () { if (bar.parentNode) { bar.parentNode.removeChild(bar); } }, 1200);
    }
    if (document.readyState === 'complete') { finish(); }
    else { window.addEventListener('load', finish); }
    setTimeout(finish, 4000);

    /* ---- 渐进元素选择器 ---- */
    var SEL = '.card, article, .post-card, .card-hover, .rk-reveal-target, [class~=card]:not(.rk-reveal)';
    function els() { return Array.prototype.slice.call(document.querySelectorAll(SEL)); }

    var SEQ = 110;            /* 一条一条来：每 110ms 放出一条（旧实现是整行同时弹） */
    var queue = [], seqTimer = null;
    var io = null;

    function docTop(el) {
        var r = el.getBoundingClientRect();
        return r.top + (window.pageYOffset || document.documentElement.scrollTop || 0);
    }
    function inView(el) {
        var r = el.getBoundingClientRect();
        return r.top < window.innerHeight - 70 && r.bottom > 0;
    }
    /* 视口检测：进入视口不立刻显形，先丢进 ready 队列，仍然一条一条放（否则滚快了会两张一起弹） */
    var ready = [], drainTimer = null;
    function drain() {
        if (drainTimer) { return; }
        ready = ready.filter(function (el) { return el.isConnected && !el.classList.contains('rk-in'); });
        if (!ready.length) { drainTimer = null; return; }
        ready.sort(function (a, b) { return docTop(a) - docTop(b); });
        var el = ready.shift();
        if (el) { el.classList.add('rk-in'); }
        drainTimer = setTimeout(function () { drainTimer = null; drain(); }, SEQ);
    }
    function observe(el) {
        if (!('IntersectionObserver' in window)) { ready.push(el); drain(); return; }
        if (!io) {
            io = new IntersectionObserver(function (entries) {
                entries.forEach(function (en) {
                    if (en.isIntersecting) { io.unobserve(en.target); ready.push(en.target); drain(); }
                });
            }, { rootMargin: '0px 0px -70px 0px', threshold: 0.12 });
        }
        io.observe(el);
    }

    /* 入队：只收还没显形、也没排过队的元素；整条队列按文档顺序（上→下）重排 */
    function enqueue() {
        var pend = els().filter(function (el) { return !el.classList.contains('rk-in') && !el.__rkQ; });
        if (!pend.length) { pump(); return; }
        pend.forEach(function (el) {
            el.__rkQ = 1;
            if (!el.classList.contains('rk-reveal')) { el.classList.add('rk-reveal'); }
        });
        queue = queue.filter(function (el) { return el.isConnected && !el.classList.contains('rk-in'); }).concat(pend);
        queue.sort(function (a, b) {
            var d = docTop(a) - docTop(b);
            if (d !== 0) { return d; }
            return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
        });
        pump();
    }

    function pump() {
        if (seqTimer) { return; }
        var el = null;
        while (queue.length) {
            var cand = queue.shift();
            if (!cand.isConnected || cand.classList.contains('rk-in')) { continue; }
            el = cand;
            break;
        }
        if (!el) { seqTimer = null; if (queue.length) { pump(); } return; }
        if (inView(el)) { ready.push(el); drain(); }   /* 统一走 drain：全站只有一条显形通道 */
        else { observe(el); }                          /* 视口外：滚到再显，不占队列节奏 */
        seqTimer = setTimeout(function () { seqTimer = null; pump(); }, SEQ);
    }

    function start() {
        if (window.__rkStarted) { return; }
        window.__rkStarted = true;
        enqueue();
        /* 兜底：① 25 秒强制全显；② 已经滚出视口上方的立刻显形（防止长页面里漏显） */
        function sweep() {
            els().forEach(function (el) {
                if (el.classList.contains('rk-in')) { return; }
                var r = el.getBoundingClientRect();
                if (r.bottom < 0) { el.classList.add('rk-reveal'); el.classList.add('rk-in'); }
            });
        }
        window.addEventListener('scroll', function () { setTimeout(sweep, 120); }, { passive: true });
        setTimeout(function () {
            queue.length = 0;
            els().forEach(function (el) {
                el.classList.add('rk-reveal');   /* 兜底必须两个类一起加，只加 rk-in 不生效 */
                el.classList.add('rk-in');
            });
        }, 25000);
    }

    if (document.readyState === 'complete') { setTimeout(start, 60); }
    else { window.addEventListener('load', function () { setTimeout(start, 60); }); }
    setTimeout(function () { start(); }, 3000);

    /* 滚动到新区域时把露头但还没入队的元素补进队列 */
    var scrollTimer = null;
    window.addEventListener('scroll', function () {
        if (scrollTimer) { return; }
        scrollTimer = setTimeout(function () { scrollTimer = null; enqueue(); }, 180);
    }, { passive: true });

    /* MutationObserver：动态插入的卡片继续渐进（按 top 插回队列，顺序不会乱） */
    if ('MutationObserver' in window && !window.__rkMo) {
        window.__rkMo = new MutationObserver(function () {
            enqueue();
        });
        window.__rkMo.observe(document.body, { childList: true, subtree: true });
    }
})();
