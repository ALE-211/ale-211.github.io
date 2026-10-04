/* ============================================================
   rk-post-widgets.js —— 静态教程页的公共组件（唯一来源）
   建立者：DeepSeek harness ｜ 2026-09-26

   职责：① 阅读量上报  ② 左侧作者卡渲染

   页面里的用法（替换掉原先那一整段内联脚本）：
       <script>window.RK_SLUG='mc-server-guide';</script>
       <script src="/assets/js/rk-post-widgets.js"></script>

   为什么提取：这段逻辑原先在 4 个静态教程页里各复制了一份
   （minecraft / csgo / csgo-dedicated / nvidia-tesla-m40），
   "复制多份"正是本站反复吃亏的模式，统一到此处。

   镜像站模式（window.RK_MIRROR=true，由 publish-mirror.ps1 注入）：
     · 不上报阅读量（镜像站没有 PHP 后端）
     · 作者卡改读静态 /assets/data/author.json
       （该文件由 publish-mirror.ps1 在导出时抓取一次生成，内容是真实资料）
     · 静态文件缺失时用内置兜底，**保证不留空白**
   ============================================================ */
(function () {
    'use strict';

    var SLUG   = window.RK_SLUG || '';
    var MIRROR = !!window.RK_MIRROR;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function renderCard(a, stats) {
        /* TASK-119（2026-10-03，DeepSeek）：修站长报的「旧文章左上先显示新版作者卡片、然后才是继续阅读」。
           根因：本行原为 `querySelector('aside .bg-cardbg')` —— 取 aside 里**第一个**带 bg-cardbg 的元素；
           而 TASK-118 给静态文章页插入了「继续阅读」容器（同样带 bg-cardbg，且在 aside 最前面），
           于是新版作者卡被塞进了「继续阅读」卡片里，真正的作者卡反而留在下面（还是旧版）。
           修法：显式排除 #rkContinueReading；有 #authorCard 时优先用它。 */
        var box = document.getElementById('authorCard');
        if (!box) {
            var _cands = document.querySelectorAll('aside .bg-cardbg');
            for (var _i = 0; _i < _cands.length; _i++) {
                if (_cands[_i].id !== 'rkContinueReading') { box = _cands[_i]; break; }
            }
        }
        if (!box || !a) { return; }
        var st = stats || a.stats || null;
        var roleCls = a.role === 'admin'  ? 'bg-orange-500/15 text-orange-400'
                    : a.role === 'editor' ? 'bg-blue-500/15 text-blue-400'
                                          : 'bg-gray-700/50 text-gray-300';
        var social = '';
        if (a.github)  { social += '<a href="' + esc(a.github) + '" target="_blank" rel="noopener" title="GitHub" class="hover:text-primary transition-colors"><i class="fa fa-github"></i></a>'; }
        if (a.qq)      { social += '<a href="' + esc(a.qq) + '" target="_blank" rel="noopener" title="QQ" class="hover:text-primary transition-colors"><i class="fa fa-qq"></i></a>'; }
        if (a.email)   { social += '<a href="mailto:' + esc(a.email) + '" title="邮箱" class="hover:text-primary transition-colors"><i class="fa fa-envelope"></i></a>'; }
        if (a.website) { social += '<a href="' + esc(a.website) + '" target="_blank" rel="noopener" title="个人网站" class="hover:text-primary transition-colors"><i class="fa fa-globe"></i></a>'; }

        var labs = (a.labels || []).map(function (l) {
            return '<span class="text-xs text-gray-400 bg-gray-800 rounded-lg px-2.5 py-1">' + esc(l) + '</span>';
        }).join('') || '<span class="text-xs text-gray-400 bg-gray-800 rounded-lg px-2.5 py-1">Minecraft / CS:GO / Linux</span>';

        box.innerHTML =
            '<img src="' + esc(a.avatar || '/LOGO260721.png') + '" alt="作者头像" class="w-20 h-20 mx-auto rounded-full object-cover mb-4 border-2 border-gray-700" onerror="this.src=\'/LOGO260721.png\'">' +
            '<h2 class="text-lg text-center font-bold text-white mb-1">' + esc(a.display_name) + '</h2>' +
            '<div class="text-center mb-1">' +
                '<span class="pill ' + roleCls + '">' + esc(a.role_name || '') + '</span>' +
                '<span class="pill bg-amber-500/15 text-amber-400 ml-1" title="经验值 ' + (st ? st.exp : 0) + '">lv' + (st ? st.level : '?') + '</span>' +
            '</div>' +
            (a.location ? '<p class="text-gray-400 text-xs text-center mt-2"><i class="fa fa-map-marker mr-1"></i>' + esc(a.location) + '</p>' : '') +
            '<p class="text-gray-400 text-xs text-center leading-relaxed mt-2 mb-4">' + esc(a.bio || '这个人很懒，还没有写简介。') + '</p>' +
            (social ? '<div class="flex justify-center gap-4 text-lg mb-5">' + social + '</div>' : '') +
            '<div class="flex flex-wrap justify-center gap-2 text-sm mb-4">' + labs + '</div>';
    }

    /* ---------- 镜像站：无后端 ---------- */
    if (MIRROR) {
        fetch('/assets/data/author.json', { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (d) { if (d && d.author) { renderCard(d.author, d.author.stats); } })
            .catch(function () {
                /* 兜底：静态文件缺失时也要有内容，不能留空白 */
                renderCard({
                    display_name: 'Rick Chou', role: 'admin', role_name: '管理员',
                    avatar: '/LOGO260721.png',
                    bio: 'Minecraft / CS:GO / Linux 折腾记录。',
                    labels: ['Minecraft', 'CS:GO', 'Linux']
                }, null);
            });
        return;
    }

    /* ---------- 主站：上报阅读量 + 抓真实作者资料 ---------- */
    if (SLUG) {
        try { fetch('/blog/api_views.php?slug=' + encodeURIComponent(SLUG), { cache: 'no-store' }); } catch (e) {}
    }
    fetch('/blog/api_author.php?u=admin', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.ok) { renderCard(d.author, d.author && d.author.stats); } })
        .catch(function () {});
/* ================= TASK-094：静态教程页补齐「文章页那套」功能 =================
   静态页没有 PHP，所以：阅读时长前端算、相关教程用 static_posts.json（**零 DB 依赖**，镜像站也可用）。
   全部幂等：文章页有它自己的实现，这里只补静态页缺的部分。 */
(function () {
    /* ① 阅读进度条（文章页已自建 #rkReadBar，这里只在缺失时创建） */
    if (!document.getElementById('rkReadBar')) {
        var rb = document.createElement('div');
        rb.id = 'rkReadBar';
        document.body.appendChild(rb);
        var upd = function () {
            var h = document.documentElement.scrollHeight - window.innerHeight;
            rb.style.width = (h > 0 ? Math.min(100, window.scrollY / h * 100) : 0) + '%';
        };
        window.addEventListener('scroll', upd, { passive: true });
        window.addEventListener('resize', upd, { passive: true });
        upd();
    }

    /* ② 标题栏信息行（静态页没有 PHP ⇒ 前端拼；与文章页同款：作者 · 更新时间 · 阅读 · 经验lv · 阅读时长） */
    var art = document.querySelector('article');
    if (art && !document.querySelector('.rk-meta')) {
        var h1m = art.querySelector('h1');
        if (h1m) {
            var txt = (art.innerText || '').replace(/\s+/g, '');
            var han = (txt.match(/[\u4e00-\u9fa5]/g) || []).length;
            var imgs = art.querySelectorAll('img').length;
            var mins = Math.max(1, Math.round(han / 400 + imgs * 0.2));
            var meta = document.createElement('div');
            meta.className = 'rk-meta';
            meta.innerHTML = '<span><i class="fa fa-user"></i>Rick Chou</span>' +
                '<span data-rk-updated style="display:none"></span>' +
                '<span data-rk-views style="display:none"></span>' +
                '<span data-rk-exp style="display:none"></span>' +
                '<span><i class="fa fa-hourglass-half"></i>约 ' + mins + ' 分钟阅读</span>';
            h1m.parentNode.insertBefore(meta, h1m.nextSibling);
            var setSpan = function (sel, html) {
                var el = meta.querySelector(sel);
                if (el) { el.innerHTML = html; el.style.display = ''; }
            };
            /* 更新时间：来自 static_posts.json */
            fetch('/blog/static_posts.json', { cache: 'no-store' })
                .then(function (r) { return r.json(); })
                .then(function (list) {
                    if (!Array.isArray(list)) { return; }
                    var here = location.pathname.replace(/\/$/, '/index.html');
                    var me = list.filter(function (x) { return x.url === here; })[0];
                    if (me && me.updated) { setSpan('[data-rk-updated]', '<i class="fa fa-clock-o"></i>' + me.updated); }
                }).catch(function () { });
            /* 阅读量：api_views.php（顺带上报；已计过也返回当前值） */
            if (SLUG) {
                fetch('/blog/api_views.php?slug=' + encodeURIComponent(SLUG), { cache: 'no-store' })
                    .then(function (r) { return r.json(); })
                    .then(function (d) {
                        if (!d || !d.ok) { return; }
                        if (typeof d.views === 'number') { setSpan('[data-rk-views]', '<i class="fa fa-eye"></i>' + d.views + ' 阅读'); }
                        if (d.updated_at) { setSpan('[data-rk-updated]', '<i class="fa fa-clock-o"></i>' + d.updated_at); }
                    })
                    .catch(function () { });
            }
            /* 经验 / 等级：api_author.php */
            fetch('/blog/api_author.php?u=admin', { cache: 'no-store' })
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    var st = d && d.ok && d.author && d.author.stats;
                    if (st) { setSpan('[data-rk-exp]', '<i class="fa fa-star"></i>' + st.exp + ' 经验 · lv' + st.level); }
                }).catch(function () { });
        }
    }

    /* ③ 标题锚点复制（静态页正文不叫 #articleBody，共享 CSS 已同时覆盖 article 选择器） */
    if (art) {
        /* TASK-124（2026-10-04，DeepSeek）：先给正文里没写 id 的 h2/h3 自动补 id。
           与 blog/db.php 的 ensure_heading_ids() 同一套规则（sectionN，跳过已占用的号），
           这样以后新增的静态文章即使忘了手写 id，也照样有井号锚点。
           范围限定 <article>：静态页的卡片标题（作者卡、目录卡）都在 <aside> 里，不会被误加。 */
        (function () {
            var used = {}, all = document.querySelectorAll('[id]'), i;
            for (i = 0; i < all.length; i++) { if (all[i].id) { used[all[i].id] = true; } }
            var n = 0;
            Array.prototype.forEach.call(art.querySelectorAll('h2, h3'), function (h) {
                if (h.id) { return; }
                do { n++; } while (used['section' + n]);
                h.id = 'section' + n;
                used[h.id] = true;
            });
        })();
        Array.prototype.forEach.call(art.querySelectorAll('h2[id],h3[id]'), function (h) {
            if (h.querySelector('.rk-anchor')) { return; }
            var a = document.createElement('a');
            a.className = 'rk-anchor';
            a.href = '#' + h.id;
            /* TASK-094：'#' 改由 .rk-anchor::after 画，不放文本节点 —— 否则会被 rk-toc 的 innerText 收进目录文字 */
            a.title = '复制该标题链接';
            a.addEventListener('click', function (ev) {
                ev.preventDefault();
                var url = location.origin + location.pathname + '#' + h.id;
                try { history.replaceState(null, '', '#' + h.id); } catch (e) { }
                if (navigator.clipboard) { navigator.clipboard.writeText(url); }
            });
            h.appendChild(a);
        });
    }

    /* ④ 分享按钮（文章页有自己的处理；这里只接管尚未绑定的） */
    var sh = document.getElementById('rkShareBtn');
    if (sh && !sh.dataset.rkBound) {
        sh.dataset.rkBound = '1';
        sh.addEventListener('click', function () {
            var url = location.origin + location.pathname;
            var done = function () {
                sh.innerHTML = '<i class="fa fa-check"></i><span class="rk-l-count">已复制</span>';
                setTimeout(function () { sh.innerHTML = '<i class="fa fa-share-alt"></i><span class="rk-l-count">分享</span>'; }, 1500);
            };
            if (navigator.clipboard) { navigator.clipboard.writeText(url).then(done, done); } else { done(); }
        });
    }

    /* ⑤ 相关教程：同 section 的其它静态页（数据来自 static_posts.json），插到评论区上方 */
    var cm = document.getElementById('rkComments');
    if (cm && !document.querySelector('.rk-rel-wrap')) {
        fetch('/blog/static_posts.json', { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (list) {
                if (!Array.isArray(list)) { return; }
                var here = location.pathname.replace(/\/$/, '/index.html');
                var me = list.filter(function (x) { return x.url === here; })[0];
                var sec = me ? me.section : '';
                var rel = list.filter(function (x) { return x.url !== here && (!sec || x.section === sec); }).slice(0, 6);
                if (!rel.length) { rel = list.filter(function (x) { return x.url !== here; }).slice(0, 6); }
                if (!rel.length) { return; }
                var box = document.createElement('div');
                box.className = 'rk-rel-wrap';
                box.innerHTML = '<h3><i class="fa fa-th-large text-primary mr-1"></i>相关教程</h3><ul>' +
                    rel.map(function (x) {
                        return '<li><a href="' + x.url + '">' + (x.title || x.url) + '</a>' +
                            (x.section ? '<span class="rk-rel-sec">' + x.section + '</span>' : '') + '</li>';
                    }).join('') + '</ul>';
                cm.parentNode.insertBefore(box, cm);
            })
            .catch(function () { });
    }
})();

})();
