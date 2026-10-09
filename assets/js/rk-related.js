/* ============================================================
   rk-related.js —— 静态教程页右栏的「相关文章」（TASK-159，2026-10-08，DeepSeek）
   建立：v20261004v1

   背景：站长要求文章页右侧依次放「继续阅读 / 系列文章 / 相关文章 / 归档卡片」。
   动态文章（post.php）的相关文章是服务端渲染；静态教程页（mc / csgo / csgo-dedicated /
   nvidia-m40 / hidog）是纯 .html 不跑 PHP ⇒ 由本脚本调 /blog/api_related.php 取数填充。
   打分与可见性过滤在服务端（db.php 的 post_related_posts），本脚本只负责渲染。

   行为约定：
     · 页面里放一个 <div id="rkRelatedBox" data-slug="<posts.slug>" hidden> 占位；
       取到数据才显示（hidden=false），取不到 / 出错 / 空 ⇒ 保持隐藏（不占位）。
     · **镜像站（*.github.io）直接跳过**：那里没有 PHP，相关链接也都指向主站。
     · 渲染结构 = post.php 侧栏版的同款卡片，保证两种页面外观一致。
   ============================================================ */
(function () {
    'use strict';

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function init() {
        var box = document.getElementById('rkRelatedBox');
        if (!box) return;
        /* 镜像站/任何 github.io 静态托管：没有 PHP，跳过（盒子默认 hidden，无需动） */
        if (/(^|\.)github\.io$/i.test(location.hostname)) return;

        var slug = (box.getAttribute('data-slug') || '').trim();
        var list = box.querySelector('.rk-related-list');
        if (!slug || !list) return;

        fetch('/blog/api_related.php?slug=' + encodeURIComponent(slug) + '&n=4', { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function (j) {
                if (!j || !j.ok || !j.items || !j.items.length) return; /* 保持隐藏 */
                var html = '';
                for (var i = 0; i < j.items.length; i++) {
                    var it = j.items[i];
                    html += '<a href="' + esc(it.url) + '" class="block rounded-lg border border-gray-700/60 p-3 hover:border-primary transition-colors">'
                         +  '<div class="text-sm font-semibold text-white line-clamp-2">' + esc(it.title) + '</div>'
                         +  '<div class="text-[11px] text-gray-600 mt-1">' + esc(it.date) + '</div>'
                         +  '</a>';
                }
                list.innerHTML = html;
                box.hidden = false;
            })
            .catch(function () { /* 出错保持隐藏，不影响页面其它部分 */ });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
