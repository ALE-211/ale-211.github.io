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
          test: function (p) { return (p.indexOf('/blog') === 0
                 && p !== '/blog/tools.php' && p !== '/blog/dashboard.php'
                 && p !== '/blog/media.php'  && p !== '/blog/admin.html')
                 || p === '/search.php' || p === '/search'; } },
        /* 工作台（统一工具中心，2026-09-27 DeepSeek）：
           站长反馈「不要跟盘丝洞一样左一个入口右一个入口，用个工具还要翻几层网页」。
           所有管理/编辑工具（文章、看板、媒体库、导出、用户权限）收口到这一项。
           ⚠️ 必须从上面「博客」的 test 里把这些路径排除掉，否则会**同时高亮两项**
              —— 站长已就「标签/归档点开时博客栏也一起高亮」报过同一个问题，别再犯。 */
        { href: '/blog/tools.php',      icon: 'fa-th-large',        label: '工作台',
          test: function (p) { return p === '/blog/tools.php' || p === '/blog/dashboard.php'
                 || p === '/blog/media.php' || p === '/blog/admin.html'
                 || p === '/auth/admin.html'; } }
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
    /* ---- 21-B 深浅色主题（TASK-029 重写，P0 修复）
       单击 = 浅/深互换（必然产生可见变化，消灭"点了没反应"死锁）；
       长按 ≈600ms = 恢复跟随系统。存储键 rk-theme 仅存 light/dark，无键=跟随系统。 */
    var THEME_KEY = 'rk-theme';
    function applyTheme(t) {
        if (t === 'light' || t === 'dark') {
            document.documentElement.setAttribute('data-theme', t);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }
    function storedTheme() {
        try {
            var t = localStorage.getItem(THEME_KEY);
            return (t === 'light' || t === 'dark') ? t : null;
        } catch (e) { return null; }
    }
    function systemTheme() {
        return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
               ? 'dark' : 'light';
    }
    function shownTheme() { return storedTheme() || systemTheme(); }
    function themeToggle() {
        var next = shownTheme() === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        applyTheme(next);
    }
    function themeFollowSystem() {
        try { localStorage.removeItem(THEME_KEY); } catch (e) {}
        applyTheme(null);
    }
    function themeBtnIcon(t) { return t === 'light' ? 'fa-sun-o' : 'fa-moon-o'; }
    function updateThemeBtn() {
        var bs = document.querySelectorAll('.rk-theme-btn');
        if (!bs.length) { return; }
        var t = shownTheme();
        var next = t === 'dark' ? '浅色' : '深色';
        bs.forEach(function (b) {
            var mobile = b.classList.contains('rk-m');
            b.innerHTML = '<i class="fa ' + themeBtnIcon(t) + '"></i>' + (mobile ? '切换深浅色' : '');
            b.setAttribute('aria-label', '切换到' + next);
            b.title = '当前' + (t === 'dark' ? '深色' : '浅色') + '，点击切换' + next + '（长按恢复跟随系统）';
        });
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
                    '<button type="button" class="rk-theme-btn" aria-label="切换深浅色"><i class="fa fa-adjust"></i></button>' +
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
                '<button type="button" class="rk-theme-btn rk-m" aria-label="切换深浅色"><i class="fa fa-adjust"></i>切换深浅色</button>' +
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

        /* 主题按钮（桌面 + 移动双实例）：单击 = 浅/深互换；长按 ≈600ms = 恢复跟随系统 */
        var tbs = document.querySelectorAll('.rk-theme-btn');
        tbs.forEach(function (tb) {
            var lpTimer = null;
            var longPress = false;
            var cancelLP = function () { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
            if (tb.addEventListener) {
                tb.addEventListener('pointerdown', function () {
                    longPress = false;
                    cancelLP();
                    lpTimer = setTimeout(function () {
                        longPress = true;
                        themeFollowSystem();
                        updateThemeBtn();
                    }, 600);
                });
                tb.addEventListener('pointerup', cancelLP);
                tb.addEventListener('pointerleave', cancelLP);
                tb.addEventListener('click', function () {
                    if (longPress) { longPress = false; return; }
                    themeToggle();
                    updateThemeBtn();
                });
            } else {
                tb.addEventListener('click', function () { themeToggle(); updateThemeBtn(); });
            }
        });
        /* 跟随系统：仅当用户未手动选择（storedTheme()===null）时跟随变化 */
        if (window.matchMedia) {
            var cmq = window.matchMedia('(prefers-color-scheme: dark)');
            var cmqOn = function () {
                if (storedTheme() === null) { updateThemeBtn(); }
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

    /* 正文图片灯箱（TASK-077）：由导航栏统一注入；仅对文章正文容器生效 */
    function loadLightbox() {
        if (window.RK_MIRROR) { return; }
        if (document.getElementById('rk-lightbox-script')) { return; }
        var s = document.createElement('script');
        s.id = 'rk-lightbox-script';
        s.src = '/assets/js/rk-lightbox.js?v=20260928v1';
        document.head.appendChild(s);
    }

    /* 站点公告栏（TASK-084）：读取 blog/api_announce.php，生效期内显示公告条；关闭后 localStorage 记住 */
    /* TASK-111（2026-10-02，DeepSeek）：修站长报的「admin 更新了公告，回主页刷新却不显示；换个没登录的浏览器刷新就显示了」。
       根因：原实现在关闭时写死 localStorage['rk-announce-closed'] = '1'，是个**永久开关** ——
             只要关过任何一条公告，之后**所有新公告都会被永久屏蔽**（与登录状态无关）。
       修法：改为记住「公告内容 + 生效期的指纹」，只屏蔽被关掉的那一条；公告内容一变就重新显示。
       兼容：老值 '1' 与新指纹永不相等 ⇒ 曾关过的人会立刻看到新公告。 */
    function rkAnnounceFp(s) {
        var h = 5381, i = s.length;
        while (i) { h = (h * 33) ^ s.charCodeAt(--i); }
        return 'a' + (h >>> 0).toString(36) + '-' + s.length;
    }
    function loadAnnounce() {
        if (window.RK_MIRROR) { return; }
        fetch('/blog/api_announce.php?action=get', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d || !d.ok || !d.enabled || !d.content) { return; }
            var fp = rkAnnounceFp(String(d.content) + '|' + String(d.start || '') + '|' + String(d.end || ''));
            try { if (localStorage.getItem('rk-announce-closed') === fp) { return; } } catch (e) {}
            var st = document.getElementById('rkAnnounceStyle');
            if (!st) {
                st = document.createElement('style');
                st.id = 'rkAnnounceStyle';
                st.textContent = '#rkAnnounceBar{position:fixed;top:0;left:0;right:0;z-index:9990;background:var(--rk-primary);color:#fff;font-size:.8rem;padding:.4rem 1rem;display:flex;align-items:center;justify-content:center;gap:.6rem;box-shadow:0 2px 10px rgba(0,0,0,.18)}#rkAnnounceBar .rk-announce-text{max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#rkAnnounceBar .rk-announce-close{background:none;border:0;color:#fff;cursor:pointer;font-size:.9rem;margin-left:auto;padding:0 .2rem}body.rk-has-announce header{top:34px !important}';
                document.head.appendChild(st);
            }
            var bar = document.createElement('div');
            bar.id = 'rkAnnounceBar';
            bar.innerHTML = '<i class="fa fa-bullhorn"></i><span class="rk-announce-text"></span><button class="rk-announce-close" title="关闭">✕</button>';
            bar.querySelector('.rk-announce-text').textContent = d.content;
            bar.querySelector('.rk-announce-close').addEventListener('click', function () {
                bar.remove();
                document.body.classList.remove('rk-has-announce');
                try { localStorage.setItem('rk-announce-closed', fp); } catch (e) {}
            });
            var hdr = document.querySelector('header');
            if (hdr && hdr.parentNode) { hdr.parentNode.insertBefore(bar, hdr); }
            else { document.body.insertBefore(bar, document.body.firstChild); }
            document.body.classList.add('rk-has-announce');
        }).catch(function () {});
    }

    /* 全站键盘快捷键（TASK-087）：由导航栏统一注入，避免 25+ 页面各引一份 */
    function loadKeys() {
        if (window.RK_MIRROR) { return; }        /* 镜像站无搜索后端，快捷键纯增强不参与 */
        if (document.getElementById('rk-keys-script')) { return; }
        var s = document.createElement('script');
        s.id = 'rk-keys-script';
        s.src = '/assets/js/rk-keys.js?v=20260928v1';
        document.head.appendChild(s);
    }

    /* TASK-091：移动端底部 tab（<900px 固定显示：首页/博客/下载/服务器/我的）
       桌面端（>=900px）完全不显示；body 预留等高 padding 防遮挡；热区 >=44px；iOS 底部横条安全区。 */
    function bottomTab() {
        if (document.getElementById('rkTabbar')) { return; }
        var st = document.createElement('style');
        st.textContent = '' +
            '.rk-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:9995;display:none;' +
            'background:var(--rk-card);border-top:1px solid var(--rk-border);' +
            'padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -6px 20px rgba(0,0,0,.08)}' +
            '.rk-tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
            'gap:2px;min-height:54px;font-size:11px;color:var(--rk-text);text-decoration:none;' +
            'transition:color .2s}' +
            '.rk-tabbar a i{font-size:17px;line-height:1}' +
            '.rk-tabbar a.active{color:var(--rk-primary)}' +
            '@media (max-width:899.98px){' +
            'body.rk-has-tab{padding-bottom:calc(56px + env(safe-area-inset-bottom))}' +
            '.rk-tabbar{display:flex}' +
            '}';
        document.head.appendChild(st);
        var mine = MIRROR ? MAIN + '/auth/login.html' : '/auth/login.html';
        var tab = document.createElement('nav');
        tab.id = 'rkTabbar';
        tab.className = 'rk-tabbar';
        tab.setAttribute('aria-label', '底部导航');
        function link(href, icon, label, act) {
            var a = document.createElement('a');
            a.href = href;
            a.innerHTML = '<i class="fa ' + icon + '"></i><span>' + label + '</span>';
            if (act) a.className = 'active';
            return a;
        }
        var p = PATH;
        tab.appendChild(link('/index.html', 'fa-home', '首页', p === '/' || p === '/index.html'));
        tab.appendChild(link('/blog/', 'fa-pencil-square-o', '博客', p.indexOf('/blog') === 0 && p !== '/blog/tools.php' && p !== '/blog/dashboard.php' && p !== '/blog/media.php' && p !== '/blog/admin.html'));
        tab.appendChild(link('/download/index.html', 'fa-download', '下载', p.indexOf('/download/') === 0));
        tab.appendChild(link('/server/index.html', 'fa-server', '服务器', p.indexOf('/server/') === 0));
        var mineA = link(mine, 'fa-user', '我的', p.indexOf('/auth/account.html') === 0);
        mineA.id = 'rkTabMine';
        tab.appendChild(mineA);
        document.body.appendChild(tab);
        document.body.classList.add('rk-has-tab');
        /* 登录后把「我的」指向账户管理（fillAccount 异步完成前保持登录页） */
        if (!MIRROR) {
            fetch('/auth/status.php', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (s) {
                if (s && s.logged_in) { mineA.href = '/auth/account.html'; }
            }).catch(function () {});
        }
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
        loadKeys();
        loadLightbox();
        loadAnnounce();
        bottomTab();
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
    window.rkNavbar = { render: render, version: '1.2.0' };
})();
