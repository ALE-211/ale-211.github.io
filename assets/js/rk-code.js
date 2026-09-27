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

  /* ---- 语言启发式判定（本站内容驱动） ---- */
  function guessLang(text) {
    if (/sv_|rcon_password|hostname |mp_friendlyfire|bot_quota|sv_pure/.test(text)) return 'ini';   /* server.cfg 键值对 */
    if (/@echo|pause|title |setlocal|start /.test(text)) return 'powershell';                       /* .bat 近似 */
    if (/apt |curl |lsmod|nano |grub-|depmod|ldconfig|nvidia-smi|update-initramfs|sudo |reboot|chmod /.test(text)) return 'bash';
    return 'bash';
  }

  /* ---- 是否已有手写高亮 span（保留原文，不 Prism 化） ---- */
  function hasHandSpans(pre) {
    return !!pre.querySelector('span');
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
      if (isPlain || !/(^|\s)language-/.test(codeEl.className || '')) {
        var lang = guessLang(codeEl.textContent || pre.innerText);
        codeEl.className = 'language-' + lang;
      }
      try { Prism.highlightElement(codeEl); } catch (e) {}
      if (!pre.querySelector('.rk-copy-btn')) {
        pre.classList.add('rk-pre'); /* TASK-045 V2：给插入按钮的 pre 加相对定位类 */
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'rk-copy-btn';
        b.innerHTML = '<i class="fa fa-copy"></i>复制';
        b.addEventListener('click', function () { copyText(pre.innerText, b); });
        pre.appendChild(b);
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
