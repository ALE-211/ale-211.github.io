/* ============================================================
   rk-anim.js —— 全站渐进载入动画（唯一来源，TASK-062）
   建立者：豆包（依 DeepSeek 任务单 062）｜ 2026-09-27

   用法：页面里保留 RickC-ANIM 的 CSS 预隐藏块
   （opacity:0 + translateY(14px) + transition .5s），并把原来那份
   内联动画脚本整段替换为：
       <script src="/assets/js/rk-anim.js?v=20260927v1"></script>

   三条兜底不可删：IntersectionObserver / 5 秒强制全显 / MutationObserver。
   禁止加 prefers-reduced-motion 禁用规则（站长铁律）。
   ============================================================ */
(function () {
    'use strict';
    if (window.__rkAnimLoaded) { return; }
    window.__rkAnimLoaded = true;

    /* ---- 动画时长统一覆盖（页面内联是 .5s/14px，这里改成 .9s/28px；同选择器、后插入 ⇒ 生效） ---- */
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

    /* ---- TASK-062：按"视觉行"分桶，行内同延迟，左右同时渐进 + 提速 ----
       原实现：150 + idx*120（DOM 顺序排队，左栏先动、左右不同步、最慢 ~1.9s）
       新实现：BASE 60ms / STEP 70ms / 同行阈值 24px / 视口外仍走 IntersectionObserver */
    /* TASK-169（2026-10-31）：站长「主页全局动画加载太快太提前了，都看不到」。
       三个原因一起改：① 触发线原本是 `top < innerHeight`（卡片刚露头就动，等于在屏幕外就演完了）；
       ② 过渡只有 .5s / 位移 14px，太快看不清；③ 5 秒的强制全显兜底会把**下面还没滚到的**也一起点亮。
       现改为：触发线收进视口 70px、时长 .9s、位移 28px、兜底从 5s 放宽到 25s（并只对「已经滚过顶部/正在视口内」的元素生效）。 */
    var BASE = 140, STEP = 100, ROW_GAP = 24;

    function reveal() {
        var list = els();
        if (!list.length) { return; }
        var now = list.filter(function (el) { return !el.classList.contains('rk-in'); });
        if (!now.length) { return; }
        now.forEach(function (el) { if (!el.classList.contains('rk-reveal')) { el.classList.add('rk-reveal'); } });

        var inView = [], outView = [];
        now.forEach(function (el) {
            var r = el.getBoundingClientRect();
            if (r.top < window.innerHeight - 70 && r.bottom > 0) { inView.push(el); }
            else { outView.push(el); }
        });

        /* 视口内：按 top 排序 → 分桶（top 差 < 24px 视为同一行）→ 行内同一延迟 */
        if (inView.length) {
            inView.sort(function (a, b) {
                return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
            });
            var row = -1, lastTop = null, rows = [];
            inView.forEach(function (el) {
                var top = Math.round(el.getBoundingClientRect().top);
                if (lastTop === null || Math.abs(top - lastTop) >= ROW_GAP) { row++; lastTop = top; }
                if (!rows[row]) { rows[row] = []; }
                rows[row].push(el);
            });
            rows.forEach(function (group, r) {
                setTimeout(function () {
                    group.forEach(function (el) { el.classList.add('rk-in'); });
                }, BASE + r * STEP);
            });
        }

        /* 视口外：IntersectionObserver 兜底（不能被分桶逻辑破坏） */
        outView.forEach(function (el) {
            var io = new IntersectionObserver(function (es) {
                es.forEach(function (en) {
                    if (en.isIntersecting) {
                        en.target.classList.add('rk-in');
                        io.unobserve(en.target);
                    }
                });
            }, { rootMargin: '0px 0px -70px 0px', threshold: 0.15 });
            io.observe(el);
        });
    }

    function start() {
        if (window.__rkStarted) { return; }
        window.__rkStarted = true;
        reveal();
        /* 兜底（不可删）：① 25 秒后强制全显；② 任何时候「已经滚出视口上方」的元素立刻显形，
           避免长页面里兜底把还没滚到的卡片提前点亮（那正是「都看不到」的元凶）。 */
        function sweep() {
            els().forEach(function (el) {
                if (el.classList.contains('rk-in')) { return; }
                var r = el.getBoundingClientRect();
                if (r.bottom < 0) { el.classList.add('rk-reveal'); el.classList.add('rk-in'); }
            });
        }
        window.addEventListener('scroll', function () { setTimeout(sweep, 120); }, { passive: true });
        setTimeout(function () {
            els().forEach(function (el) { el.classList.add('rk-in'); });
        }, 25000);
    }

    if (document.readyState === 'complete') { setTimeout(start, 60); }
    else { window.addEventListener('load', function () { setTimeout(start, 60); }); }
    setTimeout(function () { start(); }, 3000);

    /* MutationObserver：动态插入的卡片继续渐进（不可删） */
    if ('MutationObserver' in window && !window.__rkMo) {
        window.__rkMo = new MutationObserver(function (muts) {
            var need = false;
            muts.forEach(function (m) {
                m.addedNodes.forEach(function (n) {
                    if (n.nodeType !== 1) { return; }
                    if ((n.matches && n.matches('.card, article, .post-card, .card-hover, .rk-reveal-target, [class~=card]')) ||
                        (n.querySelectorAll && n.querySelectorAll('.card, article, .post-card, .card-hover, .rk-reveal-target, [class~=card]').length)) { need = true; }
                });
            });
            if (need) { reveal(); }
        });
        window.__rkMo.observe(document.body, { childList: true, subtree: true });
    }
})();
