/* TASK-103：站内通知铃铛——登录态显示铃铛 + 未读红点，轮询 45s，页面隐藏时暂停 */
(function () {
    'use strict';
    var POLL = 45000;
    var timer = null;

    function el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }

    function ensureBell() {
        var mount = document.getElementById('rk-navbar-user') || document.querySelector('.hd-actions');
        if (!mount || mount.querySelector('.rk-bell')) return;
        var bell = el('a', 'rk-bell', '<i class="fa fa-bell-o"></i><span class="rk-bell-dot" style="display:none"></span>');
        bell.href = '/blog/notifications.php';
        bell.style.cssText = 'position:relative;margin-right:.5rem;color:var(--rk-text);font-size:1.05rem;text-decoration:none';
        bell.querySelector('.rk-bell-dot').style.cssText =
            'position:absolute;top:-4px;right:-6px;background:#ef4444;color:#fff;font-size:.6rem;line-height:1rem;min-width:1rem;height:1rem;border-radius:9999px;text-align:center;display:none';
        mount.insertBefore(bell, mount.firstChild);
        poll();
        timer = setInterval(poll, POLL);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') { clearInterval(timer); timer = null; }
            else if (!timer) { poll(); timer = setInterval(poll, POLL); }
        });
    }

    function poll() {
        if (document.visibilityState === 'hidden') return;
        fetch('/blog/api_notifications.php?action=unread', { cache: 'no-store' })
            .then(function (r) {
                if (r.status === 401) return null; // 未登录不显示铃铛
                return r.json();
            })
            .then(function (j) {
                if (!j || !j.ok) return;
                var dot = document.querySelector('.rk-bell-dot');
                if (!dot) return;
                dot.style.display = j.unread > 0 ? 'block' : 'none';
                dot.textContent = j.unread > 99 ? '99+' : j.unread;
            })
            .catch(function () {});
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureBell);
    else ensureBell();
})();
