/* ==========================================================================
   Size scale in the collection filters
   --------------------------------------------------------------------------
   Relabels the Size filter's checkboxes to the chosen scale (UK, EU, JP, …).
   Display only: the checkbox value, the filter URL and the products returned
   are always the real base (US) values, so filtering keeps working exactly as
   Shopify expects.

   Matching is by COLUMN INDEX, not scale name — the buttons are rendered in the
   same order as the conversion-table columns, so clicking one selects a column.
   Same approach as assets/size-scale.js on the product page.
   ========================================================================== */
(function () {
  'use strict';

  // The filters snippet can render more than once per page (sidebar + drawer),
  // so make sure only one instance of this script ever runs.
  if (window.__filterSizeScaleInit) return;
  window.__filterSizeScaleInit = true;

  var STORAGE_KEY = 'adorsi:size-scale';

  function norm(value) {
    // Strip zero-width characters, which are easy to paste into the table.
    return (value == null ? '' : String(value)).replace(/[ ​‌‍﻿]/g, '').trim();
  }

  function normScale(value) {
    return (value == null ? '' : String(value)).replace(/[^a-z0-9]/gi, '').toUpperCase();
  }

  /* Parse the table into { baseValue: [col0, col1, col2, …] }. */
  function parseTable(text, scaleSet) {
    var map = {};
    String(text || '')
      .split(/\r?\n/)
      .forEach(function (line) {
        line = line.trim();
        if (!line || line.charAt(0) === '#') return;

        var cells = line.split(/[|,\t]/).map(norm);
        var first = cells[0];
        if (!first) return;
        // Skip a header row (its first cell is a scale name, e.g. "US").
        if (scaleSet[normScale(first)]) return;

        map[first] = cells;
      });
    return map;
  }

  function readStoredIndex() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === null) return 0;
      var index = parseInt(stored, 10);
      return isNaN(index) || index < 0 ? 0 : index;
    } catch (e) {
      return 0;
    }
  }

  function storeIndex(index) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(index));
    } catch (e) {
      /* Private mode or blocked storage — the choice just won't persist. */
    }
  }

  function Widget(root) {
    this.root = root;
    this.buttons = Array.prototype.slice.call(root.querySelectorAll('[data-filter-scale]'));

    var tableEl = root.querySelector('[data-filter-scale-table]');
    var scales = (root.getAttribute('data-scales') || '').split(',').map(function (s) {
      return s.trim();
    });

    var scaleSet = {};
    scales.forEach(function (s) {
      if (s) scaleSet[normScale(s)] = true;
    });

    this.table = parseTable(tableEl ? tableEl.textContent : '', scaleSet);

    // Labels live outside this element, in the same filter group.
    this.group = root.closest('.filter-group') || document;

    this.buttons.forEach(
      function (button) {
        button.addEventListener('click', this.onClick.bind(this, button));
      }.bind(this)
    );

    this.apply(readStoredIndex());
  }

  Widget.prototype.onClick = function (button, evt) {
    if (evt) evt.preventDefault();
    var index = parseInt(button.getAttribute('data-scale-index'), 10) || 0;
    storeIndex(index);
    this.apply(index);
  };

  Widget.prototype.apply = function (index) {
    if (index >= this.buttons.length) index = 0;

    this.buttons.forEach(function (button, i) {
      button.classList.toggle('is-active', i === index);
      button.setAttribute('aria-pressed', i === index ? 'true' : 'false');
    });

    var table = this.table;
    var labels = this.group.querySelectorAll('[data-filter-scale-label]');

    Array.prototype.forEach.call(labels, function (label) {
      var base = norm(label.getAttribute('data-base-label'));
      var row = table[base];
      // Column 0 is the base scale, so fall back to the original label.
      var converted = row && row[index] ? row[index] : base;
      label.textContent = index === 0 ? base : converted;
    });
  };

  function init(scope) {
    var roots = (scope || document).querySelectorAll('[data-filter-size-scale]');
    Array.prototype.forEach.call(roots, function (root) {
      if (root.dataset.scaleReady) return;
      root.dataset.scaleReady = 'true';
      new Widget(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }

  // The filter sidebar is re-rendered by AJAX after every filter change, which
  // replaces the labels with fresh base values — re-init on any such change.
  // Relabelling mutates the DOM itself, so the callback is debounced to one
  // pass per frame rather than firing for every text node we touch.
  var scheduled = false;
  var observer = new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      init();
    });
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('shopify:section:load', function (e) {
    init(e.target);
  });
})();
