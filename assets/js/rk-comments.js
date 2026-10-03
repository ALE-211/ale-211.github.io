/* ============================================================
   rk-comments.js —— 评论 widget（TASK-039 共享唯一来源）
   建立者：Doubao MainAgent ｜ 2026-09-26

   职责：评论列表 / 回复 / 发表 / 删除 / 隐藏（登录才可评，列表匿名可读）

   用法：
       <div id="rkComments" data-post-id="12"></div>   （动态文章）
       <div id="rkComments" data-slug="mc-server-guide"></div>  （静态教程页）
       <script src="/assets/js/rk-comments.js"></script>

   安全约定（与 api_comments.php 配套）：
     · 用户正文在服务端只存纯文本；渲染一律用 textContent，禁 innerHTML 直插
     · 头像/昵称等可控字段也经 esc() 后才允许 innerHTML
     · CSRF 复用 /auth/api_csrf.php（X-CSRF-Token header）
     · 镜像站（window.RK_MIRROR）无 PHP 后端，直接禁用
   ============================================================ */
(function () {
    'use strict';

    if (window.RK_MIRROR) { return; } /* 镜像站没有 PHP，禁加载避免 404 */

    var root = document.getElementById('rkComments');
    if (!root) { return; }

    var postId = root.getAttribute('data-post-id') || '';
    var slug   = root.getAttribute('data-slug') || '';
    var API    = '/blog/api_comments.php';
    var LOGIN  = '/auth/login.html';
    var state  = { comments: [], canComment: false, replyTo: 0 };

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
    function avatarImg(url) {
        var img = document.createElement('img');
        img.className = 'rk-c-avatar';
        img.alt = '';
        img.src = url || '/LOGO260721.png';
        img.onerror = function () { img.src = '/LOGO260721.png'; };
        return img;
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
        var needCsrf = (action !== 'list' && action !== 'by_slug');
        var req = getCsrf().then(function (csrf) {
            if (needCsrf && csrf) { headers['X-CSRF-Token'] = csrf; }
            return fetch(API, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(Object.assign({ action: action }, body))
            });
        });
        return req.then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                j.status = r.status;
                return j;
            });
        });
    }

    /* ---------- 列表 ---------- */
    function load() {
        var q = postId
            ? 'action=list&post_id=' + encodeURIComponent(postId)
            : 'action=by_slug&slug=' + encodeURIComponent(slug);
        fetch(API + '?' + q, { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (!j.ok) { root.appendChild(el('div', 'rk-c-note', '评论加载失败，请稍后重试')); return; }
                state.comments = j.comments || [];
                state.canComment = !!j.can_comment;
                render();
            })
            .catch(function () { root.appendChild(el('div', 'rk-c-note', '评论加载失败，请稍后重试')); });
    }

    /* ---------- 渲染 ---------- */
    function render() {
        root.innerHTML = ''; /* 根容器只放我们自己生成的节点，安全 */
        root.appendChild(el('h3', 'rk-c-title', '评论（' + state.comments.length + '）'));
        if (!state.comments.length) {
            root.appendChild(el('p', 'rk-c-note', '还没有评论，来抢沙发~'));
        } else {
            var wrap = el('div', 'rk-c-list');
            state.comments.forEach(function (c) {
                if (!c.parent_id) { wrap.appendChild(renderItem(c)); }
            });
            root.appendChild(wrap);
        }
        root.appendChild(renderForm());
    }
    function renderItem(c) {
        var row = el('div', 'rk-c-item');
        row.appendChild(avatarImg(c.avatar));
        var body = el('div', 'rk-c-body');
        var head = el('div', 'rk-c-head');
        head.appendChild(el('span', 'rk-c-name', c.display));
        head.appendChild(el('span', 'rk-c-time', c.created_at));
        if (c.parent_id) { head.appendChild(el('span', 'rk-c-reply-tag', '回复')); }
        body.appendChild(head);
        var content = el('div', 'rk-c-text');
        /* TASK-105：软删评论显示占位 */
        if (c.content === '' && (c.author === '[deleted]' || c.display === '[deleted]')) {
            content.textContent = '原评论已删除';
            content.style.opacity = '.6';
        } else if (c.html) {
            /* TASK-106：服务端已 sanitize_html，安全插入渲染后的 Markdown HTML */
            content.innerHTML = c.html;
        } else {
            content.textContent = c.content;
        }
        body.appendChild(content);
        var foot = el('div', 'rk-c-actions');
        /* TASK-B2：点赞（登录才可点，显示计数） */
        var likeBtn = el('button', 'rk-c-btn rk-c-like');
        likeBtn.innerHTML = '<i class="fa fa-thumbs-up"></i> <span class="rk-c-like-n">' + (c.like_count || 0) + '</span>';
        if (c.liked) likeBtn.style.color = 'var(--rk-primary-hi)';
        likeBtn.onclick = function () { toggleLike(c.id, likeBtn); };
        foot.appendChild(likeBtn);
        if (state.canComment) {
            var rb = el('button', 'rk-c-btn', '回复');
            rb.onclick = function () { focusReply(c, c.display); };
            foot.appendChild(rb);
        }
        if (c.can_delete) {
            var db = el('button', 'rk-c-btn rk-c-btn-danger', '删除');
            db.onclick = function () { delComment(c.id); };
            foot.appendChild(db);
        }
        if (c.can_hide) {
            var hb = el('button', 'rk-c-btn', '隐藏');
            hb.onclick = function () { hideComment(c.id); };
            foot.appendChild(hb);
        }
        if (foot.childNodes.length) { body.appendChild(foot); }
        row.appendChild(body);
        /* 一层回复：parent 评论的直接子回复缩进显示 */
        var kids = state.comments.filter(function (k) { return k.parent_id === c.id; });
        if (kids.length) {
            var kWrap = el('div', 'rk-c-replies');
            kids.forEach(function (k) { kWrap.appendChild(renderItem(k)); });
            row.appendChild(kWrap);
        }
        return row;
    }

    /* ---------- 发表框 ---------- */
    function renderForm() {
        var box = el('div', 'rk-c-form');
        if (!state.canComment) {
            box.appendChild(el('p', 'rk-c-note', '登录后可评论'));
            var a = el('a', 'rk-c-btn', '去登录');
            a.href = LOGIN + '?next=' + encodeURIComponent(location.pathname + location.search);
            a.rel = 'noopener';
            box.appendChild(a);
            return box;
        }
        var ta = el('textarea', 'rk-c-input');
        ta.placeholder = '友善评论（支持 Markdown：**粗体** `代码` [链接](https://) · 2000 字以内）';
        ta.rows = 3;
        box.appendChild(ta);
        /* TASK-C3：@ 自动补全（防抖 250ms，键盘上下+回车） */
        var atBox = el('div', 'rk-atbox');
        atBox.style.cssText = 'display:none;position:absolute;z-index:50;background:#1e293b;border:1px solid #334155;border-radius:8px;margin-top:2px;max-height:200px;overflow:auto;min-width:180px;box-shadow:0 4px 16px rgba(0,0,0,.4)';
        ta.parentNode.style.position = 'relative';
        ta.parentNode.appendChild(atBox);
        var atItems = [], atIdx = -1, atTimer = null;
        ta.addEventListener('input', function () {
            var pos = ta.selectionStart || 0;
            var before = ta.value.slice(0, pos);
            var m = before.match(/@(\w*)$/);
            if (!m) { atBox.style.display = 'none'; return; }
            var q = m[1];
            clearTimeout(atTimer);
            atTimer = setTimeout(function () {
                fetch('/blog/api_users_search.php?q=' + encodeURIComponent(q))
                    .then(function (r) { return r.json(); })
                    .then(function (j) {
                        atItems = (j.users || []); atIdx = -1; atBox.innerHTML = '';
                        if (!atItems.length) { atBox.style.display = 'none'; return; }
                        atItems.forEach(function (u, i) {
                            var it = el('div', 'rk-at-item');
                            it.textContent = u.display_name + ' (@' + u.username + ')';
                            it.style.cssText = 'padding:6px 10px;cursor:pointer;font-size:13px';
                            it.onclick = function () { pickAt(u.username); };
                            atBox.appendChild(it);
                        });
                        atBox.style.display = 'block';
                    });
            }, 250);
        });
        ta.addEventListener('keydown', function (e) {
            if (atBox.style.display === 'none') return;
            if (e.key === 'ArrowDown') { e.preventDefault(); atIdx = Math.min(atIdx + 1, atItems.length - 1); paintAt(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); atIdx = Math.max(atIdx - 1, 0); paintAt(); }
            else if (e.key === 'Enter' && atIdx >= 0) { e.preventDefault(); pickAt(atItems[atIdx].username); }
        });
        function paintAt() {
            Array.prototype.forEach.call(atBox.children, function (el, i) {
                el.style.background = i === atIdx ? 'rgba(128,128,128,.3)' : 'none';
            });
        }
        function pickAt(username) {
            var pos = ta.selectionStart || 0;
            var before = ta.value.slice(0, pos);
            var after = ta.value.slice(pos);
            before = before.replace(/@\w*$/, '@' + username + ' ');
            ta.value = before + after;
            atBox.style.display = 'none';
            ta.focus(); ta.selectionStart = ta.selectionEnd = before.length;
        }
        /* TASK-106：表情面板（固定 emoji，点插入光标位置） */
        var em = el('div', 'rk-c-emoji');
        em.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;margin-top:.4rem;font-size:1.1rem';
        var EMOJIS = '😀 😁 😂 🤣 😊 😍 😘 😎 🤔 😅 😭 😡 😱 😴 🥺 😍 🤗 🙄 😬 🤭 😏 😌 😉 🥳 😎 🤓 😴 👍 👎 👌 🙏 💪 🤝 👏 🙌 👋 ✌️ 🤞 💪 🫶 ❤️ 💔 🔥 ⭐ 🎉 🎊 🎈 🎁 💡 📌 🚀 ✅ ❌ ⚠️ 🍺 ☕ 🌙 ☀️'.split(' ');
        EMOJIS.forEach(function (e) {
            var b = el('button');
            b.type = 'button';
            b.textContent = e;
            b.style.cssText = 'background:none;border:0;cursor:pointer;padding:2px 4px;border-radius:4px';
            b.onmouseenter = function () { b.style.background = 'rgba(128,128,128,.2)'; };
            b.onmouseleave = function () { b.style.background = 'none'; };
            b.onclick = function () {
                var s = ta.selectionStart || 0, en = ta.selectionEnd || 0;
                ta.value = ta.value.slice(0, s) + e + ta.value.slice(en);
                ta.focus();
                ta.selectionStart = ta.selectionEnd = s + e.length;
            };
            em.appendChild(b);
        });
        box.appendChild(em);
        var btn = el('button', 'rk-c-btn rk-c-btn-primary', '发表评论');
        btn.onclick = function () { submit(ta); };
        box.appendChild(ta);
        box.appendChild(btn);
        return box;
    }
    function focusReply(c, display) {
        /* TASK-105：2 层限制——回复"回复"时挂到顶层父评论 */
        state.replyTo = c.parent_id ? c.parent_id : c.id;
        var ta = root.querySelector('.rk-c-input');
        if (ta) {
            ta.placeholder = '回复 @' + display + '：';
            ta.focus();
            ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /* ---------- TASK-B2：评论点赞 ---------- */
    function toggleLike(cid, btn) {
        getCsrf().then(function (csrf) {
            return fetch('/blog/api_comment_likes.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
                body: JSON.stringify({ action: 'toggle', comment_id: cid })
            }).then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }); });
        }).then(function (j) {
            if (j.status === 401) { toast('登录后可点赞', true); return; }
            if (!j.ok) { toast(j.error || '操作失败', true); return; }
            btn.querySelector('.rk-c-like-n').textContent = j.count;
            btn.style.color = j.liked ? 'var(--rk-primary-hi)' : '';
        });
    }

    /* ---------- 提交 / 删除 / 隐藏 ---------- */
    function submit(ta) {
        var content = ta.value.trim();
        if (!content) { toast('请输入评论内容', true); return; }
        if (content.length > 2000) { toast('评论内容不能超过 2000 字', true); return; }
        var body = { content: content, parent_id: state.replyTo || 0 };
        if (postId) { body.post_id = parseInt(postId, 10); } else { body.slug = slug; }
        api('add', body).then(function (j) {
            if (j.ok) {
                ta.value = '';
                state.replyTo = 0;
                ta.placeholder = '友善评论（支持换行，2000 字以内）';
                toast('评论已发表');
                load();
            } else {
                toast(j.error || '发表失败', true);
            }
        });
    }
    function delComment(id) {
        if (!confirm('确定删除这条评论？')) { return; }
        api('delete', { comment_id: id }).then(function (j) {
            toast(j.ok ? '评论已删除' : (j.error || '删除失败'), !j.ok);
            if (j.ok) { load(); }
        });
    }
    function hideComment(id) {
        if (!confirm('确定隐藏这条评论？（隐藏后仅管理员可见）')) { return; }
        api('hide', { comment_id: id }).then(function (j) {
            toast(j.ok ? '评论已隐藏' : (j.error || '隐藏失败'), !j.ok);
            if (j.ok) { load(); }
        });
    }

    load();
})();
