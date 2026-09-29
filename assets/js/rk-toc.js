/* ============================================================
   rk-toc.js —— 全站共享目录生成 + 滚动高亮（唯一来源）
   建立：MainAgent ｜ 2026-09-26（TASK-014）
   用途：扫描正文 h2[id]，填充 #leftTocList，滚动时高亮当前章节。
   覆盖：4 篇静态教程页（server/minecraft、server/csgo、
        server/csgo-dedicated、board/nvidia-tesla-m40）+ 动态文章页 post.php。
   要求：页面需存在 <ul id="leftTocList"> 容器；h2 需带 id。
   ============================================================ */
(function () {
  'use strict';
  function init() {
    var list = document.getElementById('leftTocList');
    if (!list) return;
    var scope = document.querySelector('article') || document.body;
    var headings = Array.prototype.slice.call(scope.querySelectorAll('h2[id]'));
    if (!headings.length) return;

    headings.forEach(function (h) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      /* TASK-094：去掉标题内锚点带来的尾部 #，避免目录项显示成「章节名#」 */
    a.textContent = String(h.innerText || '').replace(/\s*#\s*$/, '');
      a.className = 'block px-2 py-1 rounded hover:bg-gray-700 transition-colors text-textlight';
      li.appendChild(a);
      list.appendChild(li);
    });

    if (!('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        var links = list.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) links[i].classList.remove('toc-active');
        var link = list.querySelector('a[href="#' + id + '"]');
        if (link) link.classList.add('toc-active');
      });
    }, { rootMargin: '-15% 0px -65% 0px' });
    headings.forEach(function (h) { observer.observe(h); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
