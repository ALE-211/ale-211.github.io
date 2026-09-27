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
    var BASE = 60, STEP = 70, ROW_GAP = 24;

    function reveal() {
        var list = els();
        if (!list.length) { return; }
        var now = list.filter(function (el) { return !el.classList.contains('rk-in'); });
        if (!now.length) { return; }
        now.forEach(function (el) { if (!el.classList.contains('rk-reveal')) { el.classList.add('rk-reveal'); } });

        var inView = [], outView = [];
        now.forEach(function (el) {
            var r = el.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0) { inView.push(el); }
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
            }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });
            io.observe(el);
        });
    }

    function start() {
        if (window.__rkStarted) { return; }
        window.__rkStarted = true;
        reveal();
        /* 5 秒兜底：强制全部出现（不可删） */
        setTimeout(function () {
            els().forEach(function (el) { el.classList.add('rk-in'); });
        }, 5000);
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
