/* ==========================================================================
   Size scale converter
   --------------------------------------------------------------------------
   Adds a "Scale" selector above the product's Size option group and relabels
   the size buttons (US -> UK / EU / JP / KR …) using an editable conversion
   table. Display-only: the radio `value` (and therefore the variant added to
   cart) always stays the base scale (US).
   ========================================================================== */
(function () {
  'use strict';

  var VERSION = 'v1';

  function parseTable(text, scales, baseScale) {
    var map = {};
    var baseIdx = scales.indexOf(baseScale);
    if (baseIdx < 0) baseIdx = 0;

    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === '#') return;

      var cells = line.split(/[|,\t]/).map(function (c) { return c.trim(); });
      // Skip an optional header row (base column equals the base scale name).
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

  /* Find the Size option group by its legend label. */
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

  /* Create (once) a hidden line item property input on the product form. */
  function ensureHiddenInput(form, propName) {
    var name = 'properties[' + propName + ']';
    var existing = form.querySelector('input[data-size-scale-prop="' + propName + '"]');
    if (existing) return existing;
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.setAttribute('data-size-scale-prop', propName);
    form.appendChild(input);
    return input;
  }

  function setup(configEl) {
    if (configEl.dataset.scaleReady) return;
    configEl.dataset.scaleReady = 'true';

    var scales = (configEl.getAttribute('data-scales') || '')
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    if (!scales.length) return;

    var baseScale = configEl.getAttribute('data-base-scale') || scales[0];
    var defaultScale = configEl.getAttribute('data-default-scale') || baseScale;
    var heading = configEl.getAttribute('data-heading') || 'Scale';
    var optionName = configEl.getAttribute('data-size-option-name') || 'Size';

    var tableEl = configEl.querySelector('[data-scale-table]');
    var map = parseTable(tableEl ? tableEl.textContent : '', scales, baseScale);

    var sizeWrapper = findSizeWrapper(optionName);
    if (!sizeWrapper) {
      // eslint-disable-next-line no-console
      console.warn('[size-scale] ' + VERSION + ': size option "' + optionName + '" not found on page.');
      return;
    }

    // Cache the original (base) label of each size option.
    var titles = sizeWrapper.querySelectorAll('.option-title');
    Array.prototype.forEach.call(titles, function (t) {
      if (!t.dataset.baseValue) t.dataset.baseValue = (t.textContent || '').trim();
    });
    var selectedDisplay = sizeWrapper.querySelector('[data-selected-value]');

    var current = defaultScale;

    // Optional: record the chosen scale + size as line item properties.
    var scaleInput = null;
    var sizeInput = null;
    if (configEl.hasAttribute('data-record')) {
      var formId = configEl.getAttribute('data-product-form-id');
      var form =
        (formId && document.getElementById(formId)) ||
        document.querySelector('form[data-product-form]') ||
        document.querySelector('form[data-type="add-to-cart-form"]');
      if (form) {
        scaleInput = ensureHiddenInput(form, configEl.getAttribute('data-scale-prop') || 'Scale');
        sizeInput = ensureHiddenInput(form, configEl.getAttribute('data-size-prop') || 'Size');
      }
    }

    function convert(base, scale) {
      if (scale === baseScale) return base;
      if (map[base] && map[base][scale] != null) return map[base][scale];
      return base; // no mapping: fall back to the base value
    }

    function selectedBase() {
      var checked = sizeWrapper.querySelector('input[type="radio"]:checked');
      return checked ? (checked.value || '').trim() : '';
    }

    function updateProperties() {
      if (!scaleInput || !sizeInput) return;
      var base = selectedBase();
      scaleInput.value = current;
      sizeInput.value = base ? convert(base, current) : '';
    }

    function updateSelected() {
      if (selectedDisplay) {
        var base = selectedBase();
        if (base) selectedDisplay.textContent = convert(base, current);
      }
      updateProperties();
    }

    function relabel() {
      Array.prototype.forEach.call(titles, function (t) {
        t.textContent = convert(t.dataset.baseValue, current);
      });
      updateSelected();
    }

    // Build the Scale selector UI.
    var row = document.createElement('div');
    row.className = 'size-scale__row';

    var label = document.createElement('span');
    label.className = 'size-scale__heading';
    label.textContent = heading;
    row.appendChild(label);

    var options = document.createElement('div');
    options.className = 'size-scale__options';

    scales.forEach(function (scale) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'size-scale__btn' + (scale === current ? ' is-active' : '');
      btn.setAttribute('data-scale', scale);
      btn.textContent = scale;
      btn.addEventListener('click', function () {
        current = scale;
        Array.prototype.forEach.call(options.children, function (c) {
          c.classList.toggle('is-active', c === btn);
        });
        relabel();
      });
      options.appendChild(btn);
    });

    row.appendChild(options);
    sizeWrapper.parentNode.insertBefore(row, sizeWrapper);

    // Keep the selected-size readout converted when the customer changes size.
    sizeWrapper.addEventListener('change', function () {
      // Run after the theme has updated its own selected-value text.
      setTimeout(updateSelected, 0);
    });

    relabel();
  }

  function init() {
    var configEls = document.querySelectorAll('[data-size-scale]');
    Array.prototype.forEach.call(configEls, setup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
