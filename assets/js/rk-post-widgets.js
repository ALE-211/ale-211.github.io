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
        var box = document.querySelector('aside .bg-cardbg') || document.getElementById('authorCard');
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
})();
