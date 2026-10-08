/* ============================================================
   rk-sidebar.js —— 侧栏「随页面滚，滚到底自动停住」（TASK-155）
   v20261004v2（TASK-159）：支持**多个** .rk-sidebar（文章页现在是左右双栏）
   建立：DeepSeek ｜ 2026-10-04

   站长三轮反馈的最终形态：「都随页面滚，但是左侧栏到底自动停住」。
     · 「ffb board 前台出现了两个滚动条，应该只有一个」 ⇒ 侧栏不能自己长出第二条滚动条
     · 「往下滚文章左侧栏全部滚完消失不自动停下来」     ⇒ 但也不能整个滚走
     · 「都随页面滚，但是左侧栏到底自动停住」           ⇒ 本脚本
   几何事实：侧栏在长文章上必然比视口高（实测 FFB 那篇整栏 1300px、视口 900px）
   ⇒「全都同时看得见」不可能，所以只能"先随页面滚，滚到它底边贴住视口底就钉住"。

   为什么必须有这点 JS：需要把 sticky 的 top 设成
       top = 视口高 - 16 - 侧栏高      （侧栏比视口高时是**负数**）
   而 CSS **读不到元素自身的高度**（top 里的百分比是相对包含块，不是自身）⇒ 纯 CSS 无解。

   v2 变更（TASK-159）：文章页改为左右双栏（#rkAsideLeft / #rkAsideRight 都是 .rk-sidebar），
   原来只处理第一个的写法会让右栏完全不工作 ⇒ 改成遍历所有 .rk-sidebar，
   每个独立测量、独立写自己的 --rk-aside-top。

   行为：
     · 侧栏比视口矮 ⇒ 算出的 top 会大于兜底值 ⇒ 取 min ⇒ 退化成**普通吸顶**（不再下拉）
     · 侧栏比视口高 ⇒ top 为负 ⇒ 先照常随页面滚，底边一贴住视口底就**停住**并常驻
     · 脚本没跑（禁用 JS / 加载失败）⇒ CSS 里的兜底 `top: 6rem` 生效 ⇒ 普通吸顶，不坏
     · 右栏在 1024-1279px 落到正文下方通栏时，它所在 grid 行的高度等于它自身 ⇒ sticky 无效果，无害
   宽度 <1024px（Tailwind 的 lg 断点）时不做任何事：那是不分栏的单列布局。
   ============================================================ */
(function () {
  'use strict';

  var TOP_GAP = 16;   /* 停住时侧栏底边与视口底留的间距（px） */

  function setup(a) {
    var mq = window.matchMedia('(min-width: 1024px)');
    /* 兜底值只读一次：它来自 CSS 的 `top: var(--rk-aside-top, 6rem)` 里那个 6rem，
       getComputedStyle 会把 rem 解析成 px。之后再读就会被自己设进去的值污染。 */
    var base = parseFloat(window.getComputedStyle(a).top);
    if (!(base > 0)) base = 102;   /* 6rem @ 17px 根字号 */
    var raf = null;

    function measure() {
      raf = null;
      if (!mq.matches) { a.style.removeProperty('--rk-aside-top'); return; }
      var vh = window.innerHeight;
      var h = a.offsetHeight;
      if (!h) return;
      /* 底边贴住视口底时的 top；比兜底值大就说明侧栏塞得下 ⇒ 用兜底值（普通吸顶） */
      var t = Math.min(base, vh - TOP_GAP - h);
      a.style.setProperty('--rk-aside-top', Math.round(t) + 'px');
    }
    function upd() {
      /* 合并到一帧里：resize / ResizeObserver 可能连着触发很多次 */
      if (raf !== null) return;
      raf = (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(measure);
    }

    measure();                                   /* 立即算一次，避免首屏闪 */
    window.addEventListener('resize', upd, { passive: true });
    window.addEventListener('load', upd);
    /* 正文里的图片/字体/代码块懒加载完，侧栏高度可能变（继续阅读卡是异步填的） */
    if (window.ResizeObserver) { try { new ResizeObserver(upd).observe(a); } catch (e) {} }
    setTimeout(measure, 800);
    setTimeout(measure, 2500);
    /* 说明：不需要额外钩子 —— 继续阅读卡是 rk-reading-progress.js 异步填进 #rkContinueReading 的，
       填上之后 aside 的高度会变，上面的 ResizeObserver 自然会再量一次。 */
  }

  function init() {
    /* TASK-159：文章页有左右两个 .rk-sidebar（#rkAsideLeft / #rkAsideRight），
       静态教程页同理；列表页只有一个 ⇒ 统一遍历，每个独立工作 */
    var els = document.querySelectorAll('.rk-sidebar');
    for (var i = 0; i < els.length; i++) setup(els[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
