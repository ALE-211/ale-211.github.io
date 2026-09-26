/* ============================================================
   rk-navbar.js —— 全站共享顶栏组件（唯一来源）
   建立者：DeepSeek harness ｜ 2026-09-25

   用法：页面里把原来那份手写的 <header>…</header> 整块换成
       <div id="rk-navbar"></div>
       <script src="/assets/js/rk-navbar.js"></script>
   并在 <head> 末尾加：
       <link rel="stylesheet" href="/assets/css/rk-theme.css">

   设计约定（改前必读）：
   1) 顶栏 HTML **只此一处**。要改导航项、logo、账户区，改这个文件，不要再改页面。
   2) 断点只有 900px，必须与 rk-theme.css 里的 @media 保持一致。
   3) 不依赖 Tailwind：布局与颜色全部由 rk-theme.css 的 rk-* 类承担，
      即使 tailwind.js 加载失败，顶栏依然完整可用。
   4) 账户区（头像/你好/写文章）由本文件统一填充，权限门控取 /auth/status.php 的 can_write。
   ============================================================ */
(function () {
    'use strict';
    if (window.__rkNavbarLoaded) { return; }
    window.__rkNavbarLoaded = true;

    /* ---- 导航配置：新增板块只改这里 ---- */
    var NAV = [
        { href: '/index.html',          icon: 'fa-home',            label: '主页',
          test: function (p) { return p === '/' || p === '/index.html'; } },
        { href: '/board/index.html',    icon: 'fa-cogs',            label: '开发',
          test: function (p) { return p.indexOf('/board/') === 0; } },
        { href: '/download/index.html', icon: 'fa-download',        label: '下载',
          test: function (p) { return p.indexOf('/download/') === 0; } },
        { href: '/server/index.html',   icon: 'fa-server',          label: '服务器',
          test: function (p) { return p.indexOf('/server/') === 0; } },
        { href: '/blog/',               icon: 'fa-pencil-square-o', label: '博客',
          test: function (p) { return p.indexOf('/blog') === 0 || p === '/search.php' || p === '/search'; } }
    ];

    var PATH = window.location.pathname || '/';

    /* ---- 镜像站模式 ----------------------------------------------------
       由 publish-mirror.ps1 在导出时向每个页面注入 window.RK_MIRROR = true。
       镜像站（GitHub Pages）没有 PHP 后端，因此：
         · 不请求任何 /auth、/blog 接口
         · 搜索与「博客」指向主站
         · 「写文章」按钮永不出现
       —— 这样主站与镜像站共用同一份 HTML/CSS/JS，不会出现"两份不同步"。 */
    var MIRROR = !!window.RK_MIRROR;
    var MAIN   = 'https://ale211.eu.org';
    /* ---- 21-B 深浅色主题（三态：浅色 → 深色 → 跟随系统） ----
       存储键 rk-theme，值仅 'light' / 'dark'；"跟随系统"= 删除键（无键即默认）。
       按钮循环：light → dark → 跟随系统 → light … */
    var THEME_KEY = 'rk-theme';
    function applyTheme(t) {
        if (t === 'light' || t === 'dark') {
            document.documentElement.setAttribute('data-theme', t);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }
    function currentTheme() {
        var t = document.documentElement.getAttribute('data-theme');
        if (t === 'light' || t === 'dark') { return t; }
        return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    function themeCycle() {
        var cur = currentTheme();
        var next = cur === 'light' ? 'dark' : (cur === 'dark' ? null : 'light');
        if (next === null) {
            try { localStorage.removeItem(THEME_KEY); } catch (e) {}
            applyTheme(null);
        } else {
            try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
            applyTheme(next);
        }
        return currentTheme();
    }
    function themeBtnIcon(t) {
        if (t === 'light') { return 'fa-sun-o'; }
        if (t === 'dark')  { return 'fa-moon-o'; }
        return 'fa-adjust';
    }
    function updateThemeBtn() {
        var b = document.getElementById('rkThemeBtn');
        if (!b) { return; }
        var t = currentTheme();
        b.innerHTML = '<i class="fa ' + themeBtnIcon(t) + '"></i>';
        b.setAttribute('aria-label', t === 'light' ? '切换到深色' : (t === 'dark' ? '切换为跟随系统' : '切换到浅色'));
        b.title = t === 'light' ? '当前浅色，点击切换深色' : (t === 'dark' ? '当前深色，点击切换跟随系统' : '当前跟随系统，点击切换浅色');
    }

    function isActive(n) {
        try { return !!n.test(PATH); } catch (e) { return false; }
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function navLinks() {
        return NAV.map(function (n) {
            var act = isActive(n);
            /* 镜像站上「博客」是动态页面，不存在 —— 指向主站 */
            var href = (MIRROR && n.href.indexOf('/blog') === 0) ? MAIN + n.href : n.href;
            return '<a href="' + href + '"' +
                (act ? ' class="active" aria-current="page"' : '') +
                '><i class="fa ' + n.icon + '"></i>' + n.label + '</a>';
        }).join('');
    }

    function searchBox() {
        return '<form action="' + (MIRROR ? MAIN + '/search.php' : '/search.php') + '" method="get" class="rk-search" role="search">' +
            '<input type="text" name="q" placeholder="搜索文章…" aria-label="搜索文章">' +
            '<button type="submit" aria-label="搜索"><i class="fa fa-search"></i></button>' +
            '</form>';
    }

    function headerHtml() {
        return '<header class="rk-header" id="rkHeader">' +
            '<div class="rk-bar">' +
                '<a href="/index.html" class="rk-logo">' +
                    '<img src="/LOGO260721.png" alt="RickC.TechBlog">' +
                    '<span>RickC.TechBlog</span>' +
                '</a>' +
                '<nav class="rk-nav" id="rkNav" aria-label="主导航">' + navLinks() + '</nav>' +
                searchBox() +
                '<div class="rk-actions">' +
                    '<button type="button" id="rkThemeBtn" class="rk-theme-btn" aria-label="切换深浅色"><i class="fa fa-adjust"></i></button>' +
                    '<a id="rkWriteDesktop" href="/blog/admin.html" class="rk-write" style="display:none">' +
                        '<i class="fa fa-pencil"></i>写文章</a>' +
                    '<span id="rkUserDesktop"></span>' +
                '</div>' +
                '<button type="button" class="rk-burger" id="rkBurger" ' +
                    'aria-label="打开菜单" aria-expanded="false" aria-controls="rkMobile">' +
                    '<i class="fa fa-bars"></i></button>' +
            '</div>' +
            '<div class="rk-mobile" id="rkMobile">' +
                searchBox() +
                '<div id="rkUserMobile"></div>' +
                '<a id="rkWriteMobile" href="/blog/admin.html" class="rk-write" style="display:none">' +
                    '<i class="fa fa-pencil"></i>写文章</a>' +
                '<div class="rk-mobile-sep"></div>' +
                '<nav class="rk-nav-m" aria-label="移动导航">' + navLinks() + '</nav>' +
            '</div>' +
        '</header>';
    }

    function bind() {
        var burger = document.getElementById('rkBurger');
        var panel  = document.getElementById('rkMobile');

        /* 开合状态统一由这里维护：图标、aria、面板 class 三处同步 */
        function setOpen(open) {
            if (panel) { panel.classList.toggle('open', !!open); }
            if (burger) {
                burger.innerHTML = '<i class="fa ' + (open ? 'fa-times' : 'fa-bars') + '"></i>';
                burger.setAttribute('aria-expanded', open ? 'true' : 'false');
                burger.setAttribute('aria-label', open ? '收起菜单' : '打开菜单');
            }
        }
        function close() { setOpen(false); }

        if (burger) {
            burger.addEventListener('click', function () {
                setOpen(!(panel && panel.classList.contains('open')));
            });
        }
        if (panel) {
            panel.addEventListener('click', function (e) {
                var t = e.target;
                while (t && t !== panel) {
                    if (t.tagName === 'A') { close(); break; }
                    t = t.parentNode;
                }
            });
        }
        document.addEventListener('keydown', function (e) {
            if ((e.key === 'Escape' || e.keyCode === 27) && panel && panel.classList.contains('open')) { close(); }
        });

        /* 主题按钮：点击循环三态 */
        var tb = document.getElementById('rkThemeBtn');
        if (tb) {
            tb.addEventListener('click', function () {
                themeCycle();
                updateThemeBtn();
            });
        }
        /* 跟随系统：仅在用户未手动选择（无 data-theme）时跟随变化 */
        if (window.matchMedia) {
            var cmq = window.matchMedia('(prefers-color-scheme: dark)');
            var cmqOn = function () {
                if (!document.documentElement.getAttribute('data-theme')) { updateThemeBtn(); }
            };
            if (cmq.addEventListener) { cmq.addEventListener('change', cmqOn); }
            else if (cmq.addListener) { cmq.addListener(cmqOn); }
        }

        /* 视口回到桌面宽度时收起移动面板（断点与 CSS 保持一致：900px） */
        var mq = window.matchMedia('(max-width:899.98px)');
        var onChange = function () { if (!mq.matches) { close(); } };
        if (mq.addEventListener) { mq.addEventListener('change', onChange); }
        else if (mq.addListener) { mq.addListener(onChange); }
    }

    function fillAccount() {
        var d  = document.getElementById('rkUserDesktop');
        var m  = document.getElementById('rkUserMobile');
        var wd = document.getElementById('rkWriteDesktop');
        var wm = document.getElementById('rkWriteMobile');

        /* 镜像站：不请求后端，直接给出回主站的入口 */
        if (MIRROR) {
            if (d) { d.innerHTML = '<a href="' + MAIN + '/" class="rk-login">' +
                                    '<i class="fa fa-sign-in"></i> 前往主站</a>'; }
            if (m) { m.innerHTML = '<a href="' + MAIN + '/" class="rk-login">前往主站首页</a>'; }
            return;
        }

        fetch('/auth/status.php', { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (s) {
                if (s && s.logged_in) {
                    var nm = esc(s.display_name || s.username || '');
                    var av = s.avatar ? '<img src="' + esc(s.avatar) + '" alt="">' : '';
                    var inner = av + '<span>你好，' + nm + '</span>';
                    if (d) { d.innerHTML = '<a href="/auth/account.html" class="rk-user" title="账户管理">' + inner + '</a>'; }
                    if (m) { m.innerHTML = '<a href="/auth/account.html" class="rk-user">' + inner + '</a>'; }
                    if (s.can_write) {
                        if (wd) { wd.style.display = ''; }   /* 回落 CSS 默认 inline-flex */
                        if (wm) { wm.style.display = ''; }
                    }
                } else {
                    if (d) {
                        d.innerHTML = '<a href="/auth/login.html" class="rk-login"><i class="fa fa-sign-in"></i> 登录</a>' +
                                      ' <a href="/auth/register.html" class="rk-register">注册</a>';
                    }
                    if (m) {
                        m.innerHTML = '<a href="/auth/login.html" class="rk-login">登录</a> · ' +
                                      '<a href="/auth/register.html" class="rk-register">注册</a>';
                    }
                }
            })
            .catch(function () {
                /* status.php 不可用时保留占位，不隐藏任何入口（静默降级） */
            });
    }

    /* 镜像站提示条：页面里若有 #rkMirrorNotice 就展开它。
       主站（未设 RK_MIRROR）保持隐藏 —— 因此这一块可以常驻所有页面，
       由 JS 决定是否显示，不需要维护两份首页。 */
    function mirrorNotice() {
        if (!MIRROR) { return; }
        var el = document.getElementById('rkMirrorNotice');
        if (!el) {
            /* 镜像站所有页面统一显示提示条：页面里没有就由 JS 创建。
               这样不必在每个 HTML 里各塞一份（避免又多一处"多份不同步"）。 */
            el = document.createElement('div');
            el.id = 'rkMirrorNotice';
            el.style.cssText = 'max-width:1280px;margin:0 auto;padding:.75rem 1rem 0;';
            el.innerHTML =
                '<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.4);color:#fcd34d;' +
                'border-radius:.75rem;padding:.65rem 1rem;font-size:.875rem;line-height:1.6;">' +
                '<i class="fa fa-info-circle"></i> 这里是 RickC.TechBlog 的镜像站，使用完整功能请访问 ' +
                '<a href="https://ale211.eu.org" style="font-weight:600;text-decoration:underline;color:inherit;">ale211.eu.org</a>' +
                '<span style="display:block;font-size:.75rem;opacity:.75;margin-top:.25rem;">' +
                '镜像站仅提供文章阅读；评论、搜索、账户等功能请前往主站，下载页的大文件也由主站提供。</span></div>';
            var hdr = document.getElementById('rkHeader');
            if (hdr && hdr.parentNode) { hdr.parentNode.insertBefore(el, hdr.nextSibling); }
        }
        el.style.display = '';
    }

    var mounted = false;
    function render() {
        if (mounted) { return true; }
        var host = document.getElementById('rk-navbar');
        if (!host) { return false; }
        host.outerHTML = headerHtml();     /* 用 header 直接替换占位，保证 sticky 生效 */
        mounted = true;
        bind();
        fillAccount();
        updateThemeBtn();
        mirrorNotice();
        return true;
    }

    /* 脚本紧跟占位符放置时，这里就是同步渲染：后续页面脚本能立即找到元素 */
    if (!render()) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', render);
        } else {
            render();
        }
    }

    /* 便于其它脚本在极端情况下手动重建 */
    window.rkNavbar = { render: render, version: '1.1.0' };
})();
