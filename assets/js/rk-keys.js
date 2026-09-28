/* ============================================================
   rk-keys.js —— 全站键盘快捷键（TASK-087 共享唯一来源）
   建立者：Doubao MainAgent ｜ 2026-09-28

   功能：
     · `/`  聚焦顶栏搜索框
     · `Esc` 失焦搜索 / 关闭灯箱（触发 rk-lightbox-close 事件，TASK-077 监听）
     · `g` + 1 秒内按 h/b/d/s → 首页 / 博客 / 下载 / 服务器
     · 文章页 `j` / `k` → 上一篇 / 下一篇（读取 .rk-prev a / .rk-next a，TASK-078 提供）
     · `?`  弹出快捷键帮助浮层（再按 ? 或 Esc 关闭）

   安全约定：
     · 在 input/textarea/[contenteditable] 内一律不触发
     · 带 Ctrl/Cmd/Alt 的组合键一律放行（不劫持浏览器快捷键）
     · 样式走 --rk-* 令牌，零硬编码色
     · 镜像站（window.RK_MIRROR）禁用（搜索/跳转仍可用，但本功能为纯增强，不参与）
   ============================================================ */
(function () {
    'use strict';

    /* ---- 帮助浮层样式（令牌） ---- */
    var css = '' +
        '.rk-keys-help{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99998;' +
        'background:var(--rk-card);border:1px solid var(--rk-border);border-radius:1rem;' +
        'box-shadow:0 20px 60px rgba(0,0,0,.45);padding:1.4rem 1.6rem;min-width:19rem;max-width:90vw;' +
        'font-family:inherit;color:var(--rk-text)}' +
        '.rk-keys-help h3{margin:0 0 .9rem;font-size:1rem;font-weight:700;color:var(--rk-title)}' +
        '.rk-keys-help table{width:100%;border-collapse:collapse;font-size:.82rem}' +
        '.rk-keys-help td{padding:.34rem 0;border-bottom:1px solid rgb(var(--rk-border-rgb)/.4)}' +
        '.rk-keys-help kbd{display:inline-block;padding:.08rem .45rem;border-radius:.35rem;font-size:.74rem;' +
        'background:var(--rk-surface-2);border:1px solid var(--rk-border);color:var(--rk-title);font-family:inherit;margin-right:.35rem}' +
        '.rk-keys-help .rk-keys-close{position:absolute;top:.7rem;right:.9rem;cursor:pointer;color:var(--rk-text);opacity:.7}' +
        '.rk-keys-help .rk-keys-close:hover{opacity:1}' +
        '.rk-keys-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99997}';
    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    /* ---- 辅助 ---- */
    function isTyping(e) {
        var t = e.target;
        if (!t) return false;
        var tag = (t.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (t.isContentEditable) return true;
        return false;
    }
    function isCombo(e) { return e.ctrlKey || e.metaKey || e.altKey; }

    /* ---- 搜索框 ---- */
    function focusSearch() {
        var inp = document.querySelector('.rk-search input[name="q"]');
        if (inp) { inp.focus(); inp.select(); return true; }
        return false;
    }

    /* ---- 帮助浮层 ---- */
    var helpOpen = false;
    function buildHelp() {
        var rows = [
            ['/', '聚焦搜索框'],
            ['Esc', '失焦搜索 / 关闭灯箱 / 关闭帮助'],
            ['g h', '前往首页'],
            ['g b', '前往博客'],
            ['g d', '前往下载'],
            ['g s', '前往服务器'],
            ['j / k', '上一篇 / 下一篇（文章页）'],
            ['?', '显示 / 关闭本帮助']
        ];
        var ov = document.createElement('div');
        ov.className = 'rk-keys-overlay';
        var box = document.createElement('div');
        box.className = 'rk-keys-help';
        box.innerHTML = '<span class="rk-keys-close" title="关闭">✕</span><h3>键盘快捷键</h3><table></table>';
        var tb = box.querySelector('table');
        rows.forEach(function (r) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td><kbd>' + r[0] + '</kbd></td><td>' + r[1] + '</td>';
            tb.appendChild(tr);
        });
        function close() {
            if (ov.parentNode) ov.parentNode.removeChild(ov);
            helpOpen = false;
        }
        box.querySelector('.rk-keys-close').onclick = close;
        ov.onclick = close;
        ov.appendChild(box);
        document.body.appendChild(ov);
        helpOpen = true;
        return close;
    }
    var closeHelp = null;

    /* ---- g 连击 ---- */
    var gPending = 0;
    function gNav(e) {
        var k = e.key.toLowerCase();
        var map = { h: '/', b: '/blog/', d: '/download/', s: '/server/' };
        if (map[k]) { location.href = map[k]; }
        gPending = 0;
    }

    /* ---- 文章页 j/k（TASK-078 输出 .rk-prev/.rk-next 容器） ---- */
    function articleNav(e) {
        var links = document.querySelectorAll('.rk-prev a, .rk-next a');
        if (!links.length) return;
        var dir = e.key.toLowerCase() === 'j' ? '.rk-prev a' : '.rk-next a';
        var a = document.querySelector(dir);
        if (a && a.href) { location.href = a.href; }
    }

    document.addEventListener('keydown', function (e) {
        if (isTyping(e)) return;      /* 输入区不触发 */
        if (isCombo(e)) return;       /* 组合键放行 */
        var k = e.key.toLowerCase();

        if (gPending > 0) {
            e.preventDefault();
            gNav(e);
            return;
        }
        if (k === 'g') {
            gPending = 1;
            setTimeout(function () { gPending = 0; }, 1000);
            return;
        }
        if (k === '/') {
            e.preventDefault();
            focusSearch();
            return;
        }
        if (k === 'escape') {
            if (helpOpen && closeHelp) { closeHelp(); e.preventDefault(); return; }
            var act = document.activeElement;
            if (act && act.blur) act.blur();
            /* 通知灯箱（TASK-077）关闭 */
            window.dispatchEvent(new CustomEvent('rk-lightbox-close'));
            return;
        }
        if (k === '?') {
            e.preventDefault();
            if (helpOpen && closeHelp) { closeHelp(); }
            else { closeHelp = buildHelp(); }
            return;
        }
        if (k === 'j' || k === 'k') {
            e.preventDefault();
            articleNav(e);
            return;
        }
    });
})();
