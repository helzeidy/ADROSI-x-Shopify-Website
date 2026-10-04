/* ==========================================================================
   Sticky subcollection tabs
   --------------------------------------------------------------------------
   1. Publishes the tabs' height as --subcollections-sticky-height so the
      Filters bar and filter sidebar stack below them (see subcollections.css).
   2. Slides the tabs up and away once the product grid has scrolled past,
      so they don't hang over the sections further down the page.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__subcollectionsStickyInit) return;
  window.__subcollectionsStickyInit = true;

  var root = document.documentElement;
  var VAR = '--subcollections-sticky-height';
  var state = null;
  var ticking = false;

  function measure() {
    if (!state) return;
    root.style.setProperty(VAR, state.wrapper.offsetHeight + 'px');
    update();
  }

  function update() {
    ticking = false;
    if (!state || !state.boundary) return;

    var stuckAt = parseFloat(getComputedStyle(state.wrapper).top) || 0;
    var height = state.wrapper.offsetHeight;
    var gridBottom = state.boundary.getBoundingClientRect().bottom;

    // Negative once the end of the product grid reaches the bottom of the tabs.
    var shift = Math.min(0, gridBottom - stuckAt - height);
    state.tabs.style.transform = shift < 0 ? 'translateY(' + shift + 'px)' : '';
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  function init() {
    var tabs = document.querySelector('.subcollections--sticky');

    if (!tabs) {
      // Sticky switched off (or no tabs on this page): clear the offset so the
      // Filters bar goes back to sitting directly under the header.
      root.style.removeProperty(VAR);
      state = null;
      return;
    }

    var nav = document.querySelector('.collection__nav');
    state = {
      tabs: tabs,
      wrapper: tabs.closest('.shopify-section') || tabs,
      boundary: nav ? nav.closest('.shopify-section') : null
    };

    if (window.ResizeObserver) {
      new ResizeObserver(measure).observe(state.wrapper);
    }
    measure();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Theme editor re-renders sections when settings change.
  document.addEventListener('shopify:section:load', init);
  document.addEventListener('shopify:section:unload', function () {
    window.setTimeout(init, 0);
  });
})();
