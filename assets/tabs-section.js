/* ==========================================================================
   Tabs section — horizontal tabs on top, swapping content beneath.
   Delegated + keyboard accessible. On touch devices the content can be swiped
   left/right like a carousel to move between tabs.
   ========================================================================== */
(function () {
  'use strict';

  function activate(root, index) {
    var tabs = root.querySelectorAll('[data-tab-btn]');
    var panels = root.querySelectorAll('[data-tab-panel]');
    var prev = parseInt(root.dataset.activeIndex || '0', 10);
    var dir = '';
    if (index > prev) dir = 'next';
    if (index < prev) dir = 'prev';
    root.dataset.activeIndex = index;

    Array.prototype.forEach.call(tabs, function (t) {
      var on = parseInt(t.getAttribute('data-tab-btn'), 10) === index;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && t.scrollIntoView) {
        try {
          t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } catch (e) {
          /* older browsers: ignore */
        }
      }
    });

    Array.prototype.forEach.call(panels, function (p) {
      var on = parseInt(p.getAttribute('data-tab-panel'), 10) === index;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
      if (on) {
        if (dir) {
          p.setAttribute('data-dir', dir);
        } else {
          p.removeAttribute('data-dir');
        }
      }
    });
  }

  function initRoot(root) {
    if (root.dataset.tabsReady) return;
    root.dataset.tabsReady = 'true';
    root.dataset.activeIndex = root.dataset.activeIndex || '0';
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-tab-btn]'));

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activate(root, parseInt(tab.getAttribute('data-tab-btn'), 10));
      });
      tab.addEventListener('keydown', function (e) {
        var i = parseInt(tab.getAttribute('data-tab-btn'), 10);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          var next = tabs[(i + 1) % tabs.length];
          activate(root, parseInt(next.getAttribute('data-tab-btn'), 10));
          next.focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          var prev = tabs[(i - 1 + tabs.length) % tabs.length];
          activate(root, parseInt(prev.getAttribute('data-tab-btn'), 10));
          prev.focus();
        }
      });
    });

    // Carousel-style swipe on the content (mobile/touch).
    var panelsWrap = root.querySelector('[data-tab-panels]') || root.querySelector('.tabs-section__panels');
    if (panelsWrap) {
      var startX = 0;
      var startY = 0;
      var tracking = false;

      panelsWrap.addEventListener(
        'touchstart',
        function (e) {
          if (e.touches.length !== 1) return;
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
          tracking = true;
        },
        { passive: true }
      );

      panelsWrap.addEventListener(
        'touchend',
        function (e) {
          if (!tracking) return;
          tracking = false;
          var touch = e.changedTouches[0];
          var dx = touch.clientX - startX;
          var dy = touch.clientY - startY;
          // Require a clearly horizontal swipe so normal page scrolling wins.
          if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

          var current = parseInt(root.dataset.activeIndex || '0', 10);
          var count = root.querySelectorAll('[data-tab-panel]').length;
          var next = dx < 0 ? current + 1 : current - 1;
          if (next < 0 || next >= count) return;
          activate(root, next);
        },
        { passive: true }
      );
    }
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-tabs]'), initRoot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-init when a section is added/edited in the theme editor.
  document.addEventListener('shopify:section:load', init);
})();
