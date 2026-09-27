/* ============================================================
   rk-likes.js —— 文章点赞 widget（TASK-068 共享唯一来源）
   建立者：Doubao MainAgent ｜ 2026-09-27

   用法：
       <div id="rkLikes" data-post-id="12"></div>
       <script src="/assets/js/rk-likes.js"></script>

   安全约定（与 api_likes.php 配套）：
     · 挂载点不套卡片容器（TASK-053 教训：容器别当框用）
     · 未登录点击 → 提示请先登录并跳登录页，不产生记录
     · 失败只提示不报错；镜像站（window.RK_MIRROR）直接禁用
   ============================================================ */
(function () {
    'use strict';

    if (window.RK_MIRROR) { return; } /* 镜像站没有 PHP 后端 */

    var root = document.getElementById('rkLikes');
    if (!root) { return; }

    var postId = parseInt(root.getAttribute('data-post-id') || '', 10);
    var API = '/blog/api_likes.php';
    var LOGIN = '/auth/login.html';

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) { n.className = cls; }
        if (text != null) { n.textContent = text; }
        return n;
    }
    function toast(msg, isErr) {
        var t = el('div', 'rk-c-toast' + (isErr ? ' rk-c-toast-err' : ''), msg);
        root.appendChild(t);
        setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, 3200);
    }
    function getCsrf() {
        return fetch('/auth/api_csrf.php', { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (j) { return j && j.csrf ? j.csrf : ''; })
            .catch(function () { return ''; });
    }
    function api(action, body) {
        var headers = { 'Content-Type': 'application/json' };
        var req = getCsrf().then(function (csrf) {
            if (csrf) { headers['X-CSRF-Token'] = csrf; }
            return fetch(API, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(Object.assign({ action: action, post_id: postId }, body))
            });
        });
        return req.then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                j.status = r.status;
                return j;
            });
        });
    }

    function render(count, liked) {
        root.innerHTML = '';
        var btn = el('button', 'rk-l-btn' + (liked ? ' rk-l-btn-on' : ''), '');
        var icon = el('i', 'fa ' + (liked ? 'fa-heart' : 'fa-heart-o'));
        btn.appendChild(icon);
        btn.appendChild(el('span', 'rk-l-count', String(count)));
        btn.title = liked ? '取消点赞' : '点赞';
        btn.onclick = function () { toggle(); };
        root.appendChild(btn);
    }

    function load() {
        fetch(API + '?action=count&post_id=' + postId, { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (!j.ok) { return; }
                render(j.count || 0, false);
            })
            .catch(function () {});
    }

    function toggle() {
        api('toggle').then(function (j) {
            if (j.ok) { render(j.count, !!j.liked); return; }
            if (j.status === 401) {
                toast('请先登录', true);
                setTimeout(function () {
                    location.href = LOGIN + '?next=' + encodeURIComponent(location.pathname + location.search);
                }, 900);
                return;
            }
            toast(j.error || '操作失败', true);
            load();
        });
    }

    load();
})();
