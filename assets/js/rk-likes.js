/* ============================================================
   rk-likes.js —— 文章点赞 + 收藏 widget（TASK-068/070 共享唯一来源）
   建立者：Doubao MainAgent ｜ 2026-09-27（070 扩展双按钮）

   用法：
       <div id="rkLikes" data-post-id="12"></div>
       <script src="/assets/js/rk-likes.js"></script>

   安全约定（与 api_likes.php 配套）：
     · 挂载点不套卡片容器（TASK-053 教训：容器别当框用）
     · 点赞/收藏两个按钮各自独立，状态一律取接口返回真值（不硬写）
     · 未登录点击 → 提示请先登录并跳登录页，不产生记录
     · 失败只提示不报错；镜像站（window.RK_MIRROR）直接禁用
   ============================================================ */
(function () {
    'use strict';

    if (window.RK_MIRROR) { return; } /* 镜像站没有 PHP 后端 */

    var root = document.getElementById('rkLikes');
    if (!root) { return; }

    var postId = parseInt(root.getAttribute('data-post-id') || '', 10);
    var slug = root.getAttribute('data-slug') || '';
    /* TASK-094：静态教程页用 data-slug（这些 slug 在 posts 表里有真实行，服务端换算成 post_id）；
       文章页仍用 data-post-id。两者都没有就不初始化。 */
    if (!(postId > 0) && !slug) { return; }
    var QKEY = postId > 0 ? ('post_id=' + postId) : ('slug=' + encodeURIComponent(slug));
    var API = '/blog/api_likes.php';
    var LOGIN = '/auth/login.html';

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
                body: JSON.stringify(Object.assign({ action: action },
                    (postId > 0 ? { post_id: postId } : { slug: slug }), body))
            });
        });
        return req.then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                j.status = r.status;
                return j;
            });
        });
    }
    function gotoLogin() {
        toast('请先登录', true);
        setTimeout(function () {
            location.href = LOGIN + '?next=' + encodeURIComponent(location.pathname + location.search);
        }, 900);
    }

    var state = { count: 0, liked: false, fav_count: 0, faved: false };
    var btnLike, btnFav, spanLike, spanFav;

    function render() {
        root.innerHTML = '';
        var row = el('div', 'rk-l-row');
        /* 点赞（心形） */
        btnLike = el('button', 'rk-l-btn' + (state.liked ? ' rk-l-btn-on' : ''), '');
        var iconLike = el('i', 'fa ' + (state.liked ? 'fa-heart' : 'fa-heart-o'));
        spanLike = el('span', 'rk-l-count', String(state.count));
        btnLike.appendChild(iconLike);
        btnLike.appendChild(spanLike);
        btnLike.title = state.liked ? '取消点赞' : '点赞';
        btnLike.onclick = function () { toggle('toggle', 'liked', 'count', spanLike, btnLike, '点赞'); };
        row.appendChild(btnLike);
        /* 收藏（书签） */
        btnFav = el('button', 'rk-l-btn' + (state.faved ? ' rk-l-btn-on' : ''), '');
        var iconFav = el('i', 'fa ' + (state.faved ? 'fa-bookmark' : 'fa-bookmark-o'));
        spanFav = el('span', 'rk-l-count', String(state.fav_count));
        btnFav.appendChild(iconFav);
        btnFav.appendChild(spanFav);
        btnFav.title = state.faved ? '取消收藏' : '收藏';
        btnFav.onclick = function () { toggle('fav_toggle', 'faved', 'fav_count', spanFav, btnFav, '收藏'); };
        row.appendChild(btnFav);
        root.appendChild(row);
    }

    function toggle(action, key, countKey, span, btn, label) {
        api(action).then(function (j) {
            if (j.ok) {
                state[key] = !!j[key];
                state[countKey] = j[countKey] || 0;
                span.textContent = String(state[countKey]);
                btn.classList.toggle('rk-l-btn-on', state[key]);
                btn.title = state[key] ? '取消' + label : label;
                return;
            }
            if (j.status === 401) { gotoLogin(); return; }
            toast(j.error || '操作失败', true);
            load();
        });
    }

    function load() {
        /* 两个接口并行拉取，状态都取接口真值（不硬写） */
        var c1 = fetch(API + '?action=count&' + QKEY, { cache: 'no-store' })
            .then(function (r) { return r.json(); }).catch(function () { return {}; });
        var c2 = fetch(API + '?action=fav_count&' + QKEY, { cache: 'no-store' })
            .then(function (r) { return r.json(); }).catch(function () { return {}; });
        Promise.all([c1, c2]).then(function (rs) {
            var a = rs[0] || {}, b = rs[1] || {};
            state.count = a.count || 0;
            state.liked = !!a.liked;
            state.fav_count = b.fav_count || 0;
            state.faved = !!b.faved;
            render();
        });
    }

    load();
})();
