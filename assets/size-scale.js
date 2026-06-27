/* ==========================================================================
   Size scale converter
   --------------------------------------------------------------------------
   The "Scale" selector is rendered server-side (in snippets/size-scale.liquid)
   so it is always present and never flickers. This script only:
     - relabels the size buttons to the chosen scale (US -> UK / EU / JP / KR …),
       re-applying after the theme re-renders the options on variant change;
     - records the chosen scale + size as line item properties.
   Display-only: the radio value (and the variant added to cart) stays US.
   ========================================================================== */
(function () {
  'use strict';

  var VERSION = 'v3';
  var configs = {};
  var observer = null;
  var scheduled = false;

  function parseTable(text, scales, baseScale) {
    var map = {};
    var baseIdx = scales.indexOf(baseScale);
    if (baseIdx < 0) baseIdx = 0;
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === '#') return;
      var cells = line.split(/[|,\t]/).map(function (c) { return c.trim(); });
      if (cells[baseIdx] && cells[baseIdx].toLowerCase() === baseScale.toLowerCase()) return;
      var base = cells[baseIdx];
      if (!base) return;
      map[base] = {};
      scales.forEach(function (scale, i) {
        if (cells[i] !== undefined && cells[i] !== '') map[base][scale] = cells[i];
      });
    });
    return map;
  }

  function findSizeWrapper(optionName) {
    var name = (optionName || '').trim().toLowerCase();
    var wrappers = document.querySelectorAll('.selector-wrapper');
    for (var i = 0; i < wrappers.length; i++) {
      var legend = wrappers[i].querySelector('.radio__legend__option-name, .radio__legend__label');
      var text = legend ? (legend.textContent || '').trim().toLowerCase() : '';
      if (text === name || (name && text.indexOf(name) === 0)) return wrappers[i];
    }
    return document.querySelector('.selector-wrapper--size');
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

  function convert(cfg, base, scale) {
    if (scale === cfg.baseScale) return base;
    if (cfg.map[base] && cfg.map[base][scale] != null) return cfg.map[base][scale];
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
    ensureHiddenInput(form, cfg.scaleProp).value = cfg.current;
    ensureHiddenInput(form, cfg.sizeProp).value = base ? convert(cfg, base, cfg.current) : '';
    ensureHiddenInput(form, '_size_option').value = cfg.optionName;
  }

  function applyCfg(cfg) {
    var el = document.querySelector('[data-size-scale][data-block-id="' + cfg.id + '"]');
    if (el) {
      Array.prototype.forEach.call(el.querySelectorAll('[data-scale]'), function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-scale') === cfg.current);
      });
    }

    var wrapper = findSizeWrapper(cfg.optionName);
    if (!wrapper) return;

    Array.prototype.forEach.call(wrapper.querySelectorAll('.option-title'), function (t) {
      if (!t.dataset.baseValue) t.dataset.baseValue = (t.textContent || '').trim();
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
    (window.requestAnimationFrame || window.setTimeout)(function () {
      scheduled = false;
      applyAll();
    }, 0);
  }

  function setup(el) {
    var id = el.getAttribute('data-block-id');
    if (!id || configs[id]) return;
    var scales = (el.getAttribute('data-scales') || '')
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    if (!scales.length) return;
    var baseScale = el.getAttribute('data-base-scale') || scales[0];
    var tableEl = el.querySelector('[data-scale-table]');
    configs[id] = {
      id: id,
      scales: scales,
      baseScale: baseScale,
      optionName: el.getAttribute('data-size-option-name') || 'Size',
      current: el.getAttribute('data-default-scale') || baseScale,
      map: parseTable(tableEl ? tableEl.textContent : '', scales, baseScale),
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

    // Scale button clicks (delegated so they survive theme re-renders).
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-size-scale] [data-scale]');
      if (!btn) return;
      e.preventDefault();
      var el = btn.closest('[data-size-scale]');
      var id = el && el.getAttribute('data-block-id');
      if (!id || !configs[id]) return;
      configs[id].current = btn.getAttribute('data-scale');
      applyAll();
    });

    observer = new MutationObserver(schedule);
    applyAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
