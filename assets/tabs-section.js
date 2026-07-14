/* ==========================================================================
   Tabs section — horizontal tabs on top, swapping content beneath.
   Delegated + keyboard accessible. Works for any number of tab sections.
   ========================================================================== */
(function () {
  'use strict';

  function activate(root, index) {
    var tabs = root.querySelectorAll('[data-tab-btn]');
    var panels = root.querySelectorAll('[data-tab-panel]');
    Array.prototype.forEach.call(tabs, function (t) {
      var on = parseInt(t.getAttribute('data-tab-btn'), 10) === index;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    Array.prototype.forEach.call(panels, function (p) {
      var on = parseInt(p.getAttribute('data-tab-panel'), 10) === index;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
  }

  function initRoot(root) {
    if (root.dataset.tabsReady) return;
    root.dataset.tabsReady = 'true';
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
