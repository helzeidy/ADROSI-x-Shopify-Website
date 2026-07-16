/* ==========================================================================
   Tabs section — horizontal tabs on top, content beneath.

   Desktop: classic tabs (one panel shown at a time, directional animation).
   Mobile:  the panels form a real swipeable carousel (scroll-snap) — the
            content follows the finger, snaps to a panel, and the active tab
            syncs both ways (tap a tab to slide there, swipe to update tabs).
   ========================================================================== */
(function () {
  'use strict';

  var MOBILE = window.matchMedia('(max-width: 749px)');

  function tabsOf(root) {
    return root.querySelectorAll('[data-tab-btn]');
  }

  function panelsOf(root) {
    return root.querySelectorAll('[data-tab-panel]');
  }

  function wrapOf(root) {
    return root.querySelector('.tabs-section__panels');
  }

  function isCarousel() {
    return MOBILE.matches;
  }

  /* Highlight a tab + keep it visible in the nav. */
  function setTabActive(root, index) {
    Array.prototype.forEach.call(tabsOf(root), function (t) {
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
    root.dataset.activeIndex = index;
  }

  function activate(root, index) {
    var prev = parseInt(root.dataset.activeIndex || '0', 10);
    setTabActive(root, index);

    var wrap = wrapOf(root);
    if (isCarousel() && wrap) {
      var target = wrap.clientWidth * index;
      if (wrap.scrollTo) {
        wrap.scrollTo({ left: target, behavior: 'smooth' });
      } else {
        wrap.scrollLeft = target;
      }
      return;
    }

    var dir = '';
    if (index > prev) dir = 'next';
    if (index < prev) dir = 'prev';

    Array.prototype.forEach.call(panelsOf(root), function (p) {
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

  /* Apply the current mode: carousel (all panels visible, snap) or tabs. */
  function applyMode(root) {
    var wrap = wrapOf(root);
    var index = parseInt(root.dataset.activeIndex || '0', 10);

    if (isCarousel()) {
      Array.prototype.forEach.call(panelsOf(root), function (p) {
        p.hidden = false;
        p.removeAttribute('data-dir');
      });
      if (wrap) wrap.scrollLeft = wrap.clientWidth * index;
    } else {
      Array.prototype.forEach.call(panelsOf(root), function (p) {
        var on = parseInt(p.getAttribute('data-tab-panel'), 10) === index;
        p.classList.toggle('is-active', on);
        p.hidden = !on;
      });
      if (wrap) wrap.scrollLeft = 0;
    }
  }

  function initRoot(root) {
    if (root.dataset.tabsReady) return;
    root.dataset.tabsReady = 'true';
    root.dataset.activeIndex = root.dataset.activeIndex || '0';
    var tabs = Array.prototype.slice.call(tabsOf(root));

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

    // Sync the active tab while the customer swipes the carousel.
    var wrap = wrapOf(root);
    if (wrap) {
      var raf = null;
      wrap.addEventListener(
        'scroll',
        function () {
          if (!isCarousel() || raf) return;
          raf = requestAnimationFrame(function () {
            raf = null;
            var count = panelsOf(root).length;
            var idx = Math.round(wrap.scrollLeft / Math.max(wrap.clientWidth, 1));
            if (idx < 0) idx = 0;
            if (idx > count - 1) idx = count - 1;
            if (String(idx) !== root.dataset.activeIndex) setTabActive(root, idx);
          });
        },
        { passive: true }
      );
    }

    applyMode(root);

    var onModeChange = function () {
      applyMode(root);
    };
    if (MOBILE.addEventListener) {
      MOBILE.addEventListener('change', onModeChange);
    } else if (MOBILE.addListener) {
      MOBILE.addListener(onModeChange);
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
