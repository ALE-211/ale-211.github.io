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
        } else {
            content.textContent = c.content;
        }
        body.appendChild(content);
        var foot = el('div', 'rk-c-actions');
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
        ta.placeholder = '友善评论（支持换行，2000 字以内）';
        ta.rows = 3;
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
