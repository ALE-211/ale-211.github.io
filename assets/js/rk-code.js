/* ============================================================
   rk-code.js —— 全站代码块高亮 + 一键复制（唯一来源）
   建立：MainAgent ｜ 2026-09-26（TASK-015）
   依赖：assets/js/prism-bundle.min.js（本地化，先于本文件加载）
   覆盖：4 篇静态教程页 + 动态文章页 post.php。
   逻辑：
     1. 遍历 pre.cmd-block（及 pre code[class*=language-]）
     2. 每块加右上角"复制"按钮（Clipboard API + textarea 兜底）
     3. 纯文本 pre 用 Prism 高亮（语言启发式判定）
     4. 含手写 span（.cmt/.ok 等）的 pre 跳过 Prism（保留原样式），只加复制按钮
     5. Prism 加载失败时降级为纯文本（try/catch，不报错）
   ============================================================ */
(function () {
  'use strict';

  /* ---- TASK-086：语言标签样式（左上角；复制按钮在右上角，互不重叠） ----
     TASK-136：改为**走站点主题变量**（--rk-text-dim / --rk-surface-2 / --rk-border）。
     旧版把颜色写死、并单独挂了一个 @media(prefers-color-scheme:light) 分支 ——
     那个分支**认不出站点自己的主题开关**（html[data-theme]）：系统是深色、
     站长手动切成浅色时，这个标签仍是深色底，和其它元素对不上。
     换成变量后，三种情形（:root / data-theme=light / 系统浅色）全部自动正确，分支也就不用要了。 */
  var langStyle = document.createElement('style');
  langStyle.textContent = 'pre.rk-pre .rk-lang-tag{position:absolute;top:.55rem;left:.6rem;z-index:2;font-size:.68rem;line-height:1;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--rk-text-dim);background:var(--rk-surface-2);border:1px solid var(--rk-border);border-radius:4px;padding:.28rem .5rem;pointer-events:none}pre.rk-pre{padding-top:2.6rem !important}';
  document.head.appendChild(langStyle);

  /* ---- 轻量 toast ---- */
  var toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'rk-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  /* ---- 复制 ---- */
  function copyText(text, btn) {
    function done(ok) {
      if (btn) {
        btn.classList.add('copied');
        btn.innerHTML = '<i class="fa fa-check"></i>已复制';
        setTimeout(function () { btn.classList.remove('copied'); btn.innerHTML = '<i class="fa fa-copy"></i>复制'; }, 1500);
      }
      if (ok) toast('代码已复制');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }).catch(function () { fallback(text); done(true); });
    } else { fallback(text); done(true); }
    function fallback(t) {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  /* ---- 语言启发式判定（本站内容驱动） ----
     TASK-135（2026-10-04，DeepSeek）：站长报「代码块识别不准确，把 java 识别成了 bash」。
     旧实现只有三条规则、**兜底恒为 'bash'** ⇒ 任何不匹配的代码都硬说成 bash；而且还会返回
     本包**根本没装**的 'powershell'。现改为：按「具体 → 宽泛」排序的多条规则，
     **认不出来就返回 'text'（老老实实当纯文本）**，不再撒谎。
     规则是用全站 33 个真实代码块 + 19 条合成用例在 node 里跑出来的（0 失败），
     改这里的规则请把那两组用例一起跑一遍。 */
  function guessLang(text) {
    var t = String(text || '');
    if (!t.trim()) { return 'text'; }

    /* 1. Java —— 就是站长报的那一类：public class / static void main / System.out. 原先都进了 bash */
    if (/\b(?:public|private|protected)\s+(?:static\s+)?[\w<>\[\],.?\s]*\s+\w+\s*\(/.test(t)
        || /\b(?:class|interface|enum)\s+\w+/.test(t)
        || /System\.out\.print/.test(t)
        || /^\s*(?:import|package)\s+java[\w.]*\s*;/m.test(t)
        || /@(?:Override|Deprecated|SuppressWarnings)\b/.test(t)) { return 'java'; }

    /* 2. JSON */
    if (/^\s*[{[]/.test(t) && /"\s*:\s*/.test(t)) { return 'json'; }

    /* 3. SQL */
    if (/^\s*(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+(?:TABLE|DATABASE|INDEX|VIEW)|ALTER\s+TABLE|DROP\s+(?:TABLE|DATABASE))\b/im.test(t)) { return 'sql'; }

    /* 4. HTML / XML（含被转义的 &lt;div&gt;） */
    if (/<\/?(?:html|head|body|div|span|p|a|img|ul|ol|li|table|thead|tbody|tr|td|th|script|style|meta|link|br|h[1-6]|article|section|nav|form|input|button|pre|code|video|details|summary)\b[^>]*>/i.test(t)
        || /&lt;\/?[a-z][\w-]*&gt;/i.test(t)) { return 'html'; }

    /* 5. CS:GO / Steam / 引擎配置（键值对 + // 注释）—— 本站那两份 63 行的 server.cfg */
    if (/^(?:sv_|rcon_password|hostname|mp_|bot_|sm_|cl_|fps_max|tickrate|log\s+on|exec\s)/m.test(t)
        || /^\/\/[^\n]*\n[\s\S]*^[a-z_]+[ \t]+[\w."-]+/m.test(t)) { return 'ini'; }

    /* 6. PowerShell */
    if (/(?:^|\s)(?:Get|Set|New|Remove|Start|Stop|Test|Import|Export|Select|Where|ForEach|Write|Invoke|Join|Split|Sort|Measure|ConvertTo|ConvertFrom)-[A-Z]\w*/.test(t)
        || /\$env:[A-Za-z_]/.test(t)) { return 'powershell'; }

    /* 7. Windows 批处理 —— 刻意收紧：不靠裸的 %xx 判断
       （否则「# 密码 aDm8H%MdA」这种便签、以及 URL 里的 %20 都会被误判成批处理） */
    if (/^\s*@echo\s+off/im.test(t)
        || /^\s*(?:setlocal|endlocal|pause|goto\s+:\w+|call\s+:\w+|if\s+(?:not\s+)?exist\b)/im.test(t)) { return 'batch'; }
    if (/%~?[a-z]*\d/i.test(t) && /\b(?:echo|set|call|goto|for|if|rem)\b/i.test(t)) { return 'batch'; }

    /* 8. Shell —— 本站最多的类型（apt / nano / chmod / reboot / lsmod / depmod …，以及裸命令） */
    if (/^#!\s*\/.*\b(?:bash|sh|zsh)\b/.test(t)
        || /^\s*[$#]\s+\S/m.test(t)
        || /\b(?:apt|apt-get|yum|dnf|pacman|brew)\s+/.test(t)
        || /\b(?:sudo|chmod|chown|curl|wget|nano|vim|vi|reboot|shutdown|systemctl|service|mount|umount|tar|unzip|ssh|scp|rsync|grep|find|awk|sed|export|source|docker|git|pip|python3?|node|make|cmake|gcc)\b/.test(t)
        || /^\s*(?:cd|ls|cp|mv|rm|mkdir|rmdir|touch|cat|echo|ln|df|du|ps|kill|lsmod|modprobe|depmod|update-grub|update-initramfs|ldconfig|nvidia-smi|insmod|rmmod|login\s+anonymous|srcds\.exe)\b/im.test(t)) { return 'bash'; }

    /* 9. 认不出来 → 纯文本（旧版在这里 `return 'bash'`，就是这次 bug 的根因） */
    return 'text';
  }

  /* ---- 是否已有手写高亮 span（保留原文，不 Prism 化） ---- */
  function hasHandSpans(pre) {
    return !!pre.querySelector('span');
  }

  /* ---- TASK-086：语言标签（从 code.className 或启发式判定） ---- */
  function langOf(pre, codeEl) {
    var m = /(^|\s)language-([\w-]+)/.exec(codeEl && codeEl.className ? String(codeEl.className) : '');
    if (m) { return m[2]; }
    return guessLang(pre.innerText || '');
  }
  function addLangTag(pre, codeEl) {
    if (pre.querySelector('.rk-lang-tag')) { return; }
    var t = document.createElement('span');
    t.className = 'rk-lang-tag';
    t.textContent = langOf(pre, codeEl);
    pre.appendChild(t);
  }

  function enhancePre(pre) {
    try {
      if (typeof Prism === 'undefined' || !Prism.highlightElement || hasHandSpans(pre)) {
        /* 降级或保留手写 span：只加复制按钮 */
        if (!pre.querySelector('.rk-copy-btn')) {
          pre.classList.add('rk-pre'); /* TASK-045 V2：给插入按钮的 pre 加相对定位类 */
          var b0 = document.createElement('button');
          b0.type = 'button';
          b0.className = 'rk-copy-btn';
          b0.innerHTML = '<i class="fa fa-copy"></i>复制';
          b0.addEventListener('click', function () { copyText(pre.innerText, b0); });
          pre.appendChild(b0);
          addLangTag(pre, pre.querySelector('code'));
        }
        return;
      }

      /* Prism 高亮路径：先取文本，重建 code，Prism 化，最后追加按钮（避免清空时误删） */
      var codeEl = pre.querySelector('code');
      var isPlain = false;
      if (!codeEl) {
        codeEl = document.createElement('code');
        codeEl.textContent = pre.innerText;
        pre.textContent = '';
        pre.appendChild(codeEl);
        isPlain = true;
      }
      /* TASK-135：只有本包**确实装了**这门语法时才写 language-* 并交给 Prism。
         guessLang 认不出来会返回 'text'（包内没有该语法）⇒ 不写 class、不调 Prism，
         标签显示 "TEXT"、正文保持纯文本 —— 而不是旧版那样一律硬说成 BASH。 */
      var cls = String(codeEl.className || '');
      var explicit = /(^|\s)language-([\w-]+)/.exec(cls);
      var lang = explicit ? explicit[2] : guessLang(codeEl.textContent || pre.innerText);
      var supported = !!(Prism.languages && Prism.languages[lang]);
      if (!explicit && supported) { codeEl.className = (cls ? cls + ' ' : '') + 'language-' + lang; }
      if (supported) { try { Prism.highlightElement(codeEl); } catch (e) {} }
      if (!pre.querySelector('.rk-copy-btn')) {
        pre.classList.add('rk-pre'); /* TASK-045 V2：给插入按钮的 pre 加相对定位类 */
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'rk-copy-btn';
        b.innerHTML = '<i class="fa fa-copy"></i>复制';
        b.addEventListener('click', function () { copyText(pre.innerText, b); });
        pre.appendChild(b);
        addLangTag(pre, codeEl);
      }
    } catch (e) { /* 任何异常都不影响页面 */ }
  }

  function run() {
    var pres = Array.prototype.slice.call(document.querySelectorAll('pre.cmd-block, #articleBody pre:not(.cmd-block)'));
    pres.forEach(enhancePre);
    /* 动态文章 md 渲染的 code.language-* 也一并处理（无需复制按钮重复） */
    document.querySelectorAll('#articleBody pre code[class*="language-"]').forEach(function (c) {
      try { if (typeof Prism !== 'undefined') Prism.highlightElement(c); } catch (e) {}
    });
  }

  /* TASK-135：把语言判定暴露出去，供**编辑器预览**复用 —— 单一来源。
     编辑器里绝不能再抄一份（抄两份必然漂移，TASK-129/130 的「信息/提示行和 MC 不一样」
     就是两边各写一套写歪的）。admin.html 只用它来判定 Markdown 预览里的代码块语言；
     ⚠️ 千万不要用 Prism 去高亮 contenteditable 本体（#richEditor）——
     Prism 会往 DOM 里插 <span>，保存时会被当成正文存进库，还会让前台的 hasHandSpans 判定失效。 */
  window.rkGuessLang = guessLang;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
