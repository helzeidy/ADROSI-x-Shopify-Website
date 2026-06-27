/* ==========================================================================
   Size scale converter
   --------------------------------------------------------------------------
   The "Scale" selector is rendered server-side so it never flickers. This
   script relabels the size buttons to the chosen scale and records the choice.

   Matching is done by COLUMN INDEX, not by scale name: the scale buttons are in
   the same order as the conversion-table columns (US=0, UK=1, EU=2, …), so a
   click selects a column index and each size's label becomes that column's
   value. No string matching of scale names — that avoids the invisible-char
   pitfalls entirely.

   Display-only: the radio value (and the variant added to cart) stays US.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__sizeScaleInit) return;
  window.__sizeScaleInit = true;

  var VERSION = 'v7';
  var configs = {};
  var observer = null;
  var scheduled = false;

  function norm(s) {
    return (s == null ? '' : String(s)).replace(/[ ​‌‍﻿]/g, '').trim();
  }

  function normScale(s) {
    return (s == null ? '' : String(s)).replace(/[^a-z0-9]/gi, '').toUpperCase();
  }

  /* Parse the table into { baseSizeValue: [col0, col1, col2, …] }. */
  function parseTable(text, scaleSet) {
    var map = {};
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === '#') return;
      var cells = line.split(/[|,\t]/).map(function (c) { return norm(c); });
      var first = cells[0];
      if (!first) return;
      if (scaleSet[normScale(first)]) return; // header row (first cell is a scale name)
      map[first] = cells;
    });
    return map;
  }

  function findSizeWrappers(optionName) {
    var name = (optionName || '').trim().toLowerCase();
    var found = [];
    var wrappers = document.querySelectorAll('.selector-wrapper');
    for (var i = 0; i < wrappers.length; i++) {
      var legend = wrappers[i].querySelector('.radio__legend__option-name, .radio__legend__label');
      var text = legend ? (legend.textContent || '').trim().toLowerCase() : '';
      if (text === name || (name && text.indexOf(name) === 0)) found.push(wrappers[i]);
    }
    if (!found.length) {
      var fallback = document.querySelector('.selector-wrapper--size');
      if (fallback) found.push(fallback);
    }
    return found;
  }

  function ensureHiddenInput(form, propName) {
    var existing = form.querySelector('input[data-size-scale-prop="' + propName + '"]');
    if (existing) return existing;
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'properties[' + propName + ']';
    input.setAttribute('data-size-scale-prop', propName);
    form.appendChild(input);
    return input;
  }

  /* Convert a base size to the value in the chosen column index. */
  function convert(cfg, base, idx) {
    if (idx === cfg.baseIndex) return base;
    var row = cfg.map[base];
    if (row && row[idx] != null && row[idx] !== '') return row[idx];
    return base;
  }

  function updateProperties(cfg, wrapper) {
    if (!cfg.record) return;
    var form =
      (cfg.formId && document.getElementById(cfg.formId)) ||
      document.querySelector('form[data-product-form]') ||
      document.querySelector('form[data-type="add-to-cart-form"]');
    if (!form) return;
    var checked = wrapper.querySelector('input[type="radio"]:checked');
    var base = checked ? (checked.value || '').trim() : '';
    ensureHiddenInput(form, cfg.scaleProp).value = cfg.scales[cfg.current] || '';
    ensureHiddenInput(form, cfg.sizeProp).value = base ? convert(cfg, base, cfg.current) : '';
    ensureHiddenInput(form, '_size_option').value = cfg.optionName;
  }

  function applyCfg(cfg) {
    var els = document.querySelectorAll('[data-size-scale][data-block-id="' + cfg.id + '"]');
    Array.prototype.forEach.call(els, function (el) {
      Array.prototype.forEach.call(el.querySelectorAll('[data-scale]'), function (b) {
        var idx = parseInt(b.getAttribute('data-scale-index'), 10);
        // Restore the selected radio (the theme fills the checked box).
        if (b.checked !== (idx === cfg.current)) b.checked = idx === cfg.current;
        b.classList.toggle('is-active', idx === cfg.current);
        if (!b.getAttribute('data-scale-bound')) {
          b.setAttribute('data-scale-bound', '1');
          b.addEventListener('change', function () {
            cfg.clicks = (cfg.clicks || 0) + 1;
            cfg.current = parseInt(b.getAttribute('data-scale-index'), 10) || 0;
            applyAll();
          });
        }
      });
    });

    var debugEl = els[0] ? els[0].querySelector('[data-scale-debug]') : null;
    var wrappers = findSizeWrappers(cfg.optionName);
    if (!wrappers.length) {
      if (debugEl) debugEl.textContent = VERSION + ' · Size option "' + cfg.optionName + '" NOT found.';
      return;
    }

    var bases = [];
    var matched = 0;
    Array.prototype.forEach.call(wrappers, function (wrapper) {
      Array.prototype.forEach.call(wrapper.querySelectorAll('.option-title'), function (t) {
        if (!t.dataset.baseValue) t.dataset.baseValue = (t.textContent || '').trim();
        bases.push(t.dataset.baseValue);
        if (cfg.map[t.dataset.baseValue]) matched++;
        var converted = convert(cfg, t.dataset.baseValue, cfg.current);
        if (t.textContent !== converted) t.textContent = converted;
      });

      var selectedDisplay = wrapper.querySelector('[data-selected-value]');
      if (selectedDisplay) {
        var checked = wrapper.querySelector('input[type="radio"]:checked');
        if (checked) {
          var conv = convert(cfg, (checked.value || '').trim(), cfg.current);
          if (selectedDisplay.textContent !== conv) selectedDisplay.textContent = conv;
        }
      }

      updateProperties(cfg, wrapper);
    });

    if (debugEl) {
      var sample = bases[0];
      debugEl.textContent =
        VERSION +
        ' · scale=' + (cfg.scales[cfg.current] || '?') + ' (col ' + cfg.current + ')' +
        ' · clicks=' + (cfg.clicks || 0) +
        ' · matched ' + matched + '/' + bases.length +
        ' · sample ' + sample + '→' + convert(cfg, sample, cfg.current);
    }
  }

  function applyAll() {
    if (observer) observer.disconnect();
    for (var id in configs) {
      if (Object.prototype.hasOwnProperty.call(configs, id)) applyCfg(configs[id]);
    }
    if (observer) observer.observe(document.body, { childList: true, subtree: true });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    var run = function () {
      scheduled = false;
      applyAll();
    };
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(run);
    } else {
      window.setTimeout(run, 16);
    }
  }

  function setup(el) {
    var id = el.getAttribute('data-block-id');
    if (!id || configs[id]) return;
    var scales = (el.getAttribute('data-scales') || '')
      .split(',')
      .map(function (s) { return norm(s); })
      .filter(Boolean);
    if (!scales.length) return;

    var scaleSet = {};
    scales.forEach(function (s) { scaleSet[normScale(s)] = true; });

    var baseScale = norm(el.getAttribute('data-base-scale')) || scales[0];
    var baseIndex = 0;
    for (var i = 0; i < scales.length; i++) {
      if (normScale(scales[i]) === normScale(baseScale)) { baseIndex = i; break; }
    }

    var defaultScale = norm(el.getAttribute('data-default-scale')) || baseScale;
    var current = baseIndex;
    for (var j = 0; j < scales.length; j++) {
      if (normScale(scales[j]) === normScale(defaultScale)) { current = j; break; }
    }

    var tableEl = el.querySelector('[data-scale-table]');
    configs[id] = {
      id: id,
      scales: scales,
      baseIndex: baseIndex,
      current: current,
      optionName: el.getAttribute('data-size-option-name') || 'Size',
      map: parseTable(tableEl ? tableEl.textContent : '', scaleSet),
      record: el.hasAttribute('data-record'),
      formId: el.getAttribute('data-product-form-id'),
      scaleProp: el.getAttribute('data-scale-prop') || 'Scale',
      sizeProp: el.getAttribute('data-size-prop') || 'Size'
    };
  }

  function init() {
    var els = document.querySelectorAll('[data-size-scale]');
    if (!els.length) return;
    Array.prototype.forEach.call(els, setup);

    observer = new MutationObserver(schedule);
    applyAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
