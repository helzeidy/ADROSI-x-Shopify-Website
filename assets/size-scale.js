/* ==========================================================================
   Size scale converter
   --------------------------------------------------------------------------
   Adds a "Scale" selector above the product's Size option group and relabels
   the size buttons (US -> UK / EU / JP / KR …) using an editable conversion
   table. Display-only: the radio `value` (and the variant added to cart) always
   stays the base scale (US).

   The theme re-renders the option group on every variant change, so we watch
   for that and re-apply (re-inject the selector, re-cache labels, keep the
   recorded scale/size in sync).
   ========================================================================== */
(function () {
  'use strict';

  var VERSION = 'v2';

  function parseTable(text, scales, baseScale) {
    var map = {};
    var baseIdx = scales.indexOf(baseScale);
    if (baseIdx < 0) baseIdx = 0;

    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === '#') return;
      var cells = line.split(/[|,\t]/).map(function (c) { return c.trim(); });
      if (cells[baseIdx] && cells[baseIdx].toLowerCase() === baseScale.toLowerCase()) return; // header
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

  function setup(configEl) {
    if (configEl.dataset.scaleReady) return;
    configEl.dataset.scaleReady = 'true';

    var scales = (configEl.getAttribute('data-scales') || '')
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    if (!scales.length) return;

    var baseScale = configEl.getAttribute('data-base-scale') || scales[0];
    var heading = configEl.getAttribute('data-heading') || 'Scale';
    var optionName = configEl.getAttribute('data-size-option-name') || 'Size';
    var current = configEl.getAttribute('data-default-scale') || baseScale;

    var record = configEl.hasAttribute('data-record');
    var formId = configEl.getAttribute('data-product-form-id');
    var scaleProp = configEl.getAttribute('data-scale-prop') || 'Scale';
    var sizeProp = configEl.getAttribute('data-size-prop') || 'Size';

    var tableEl = configEl.querySelector('[data-scale-table]');
    var map = parseTable(tableEl ? tableEl.textContent : '', scales, baseScale);

    var row = null;
    var observeTarget = null;
    var observer = null;
    var applyTimer = null;

    function convert(base, scale) {
      if (scale === baseScale) return base;
      if (map[base] && map[base][scale] != null) return map[base][scale];
      return base;
    }

    function buildRow() {
      row = document.createElement('div');
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
        btn.className = 'size-scale__btn';
        btn.setAttribute('data-scale', scale);
        btn.textContent = scale;
        btn.addEventListener('click', function () {
          current = scale;
          apply();
        });
        options.appendChild(btn);
      });

      row.appendChild(options);
    }

    function syncActive() {
      if (!row) return;
      var btns = row.querySelectorAll('.size-scale__btn');
      Array.prototype.forEach.call(btns, function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-scale') === current);
      });
    }

    function selectedBase(wrapper) {
      var checked = wrapper.querySelector('input[type="radio"]:checked');
      return checked ? (checked.value || '').trim() : '';
    }

    function updateProperties(wrapper) {
      if (!record) return;
      var form =
        (formId && document.getElementById(formId)) ||
        document.querySelector('form[data-product-form]') ||
        document.querySelector('form[data-type="add-to-cart-form"]');
      if (!form) return;
      var scaleInput = ensureHiddenInput(form, scaleProp);
      var sizeInput = ensureHiddenInput(form, sizeProp);
      var optionInput = ensureHiddenInput(form, '_size_option');
      var base = selectedBase(wrapper);
      scaleInput.value = current;
      sizeInput.value = base ? convert(base, current) : '';
      optionInput.value = optionName; // tells the cart which variant option to hide
    }

    function apply() {
      var wrapper = findSizeWrapper(optionName);
      if (!wrapper) return;

      if (observer) observer.disconnect();

      // Cache the original (base) label of each size option.
      var titles = wrapper.querySelectorAll('.option-title');
      Array.prototype.forEach.call(titles, function (t) {
        if (!t.dataset.baseValue) t.dataset.baseValue = (t.textContent || '').trim();
        t.textContent = convert(t.dataset.baseValue, current);
      });

      // Convert the selected-size readout too.
      var selectedDisplay = wrapper.querySelector('[data-selected-value]');
      var base = selectedBase(wrapper);
      if (selectedDisplay && base) selectedDisplay.textContent = convert(base, current);

      // (Re)inject the scale selector directly above the size group.
      if (!row) buildRow();
      if (!row.isConnected || row.nextElementSibling !== wrapper) {
        wrapper.parentNode.insertBefore(row, wrapper);
      }
      syncActive();

      updateProperties(wrapper);

      if (!observeTarget) {
        observeTarget =
          wrapper.closest('product-info') ||
          wrapper.closest('[data-product-information]') ||
          wrapper.closest('.product__wrapper') ||
          document.body;
      }
      if (observer && observeTarget && observeTarget.isConnected) {
        observer.observe(observeTarget, { childList: true, subtree: true });
      }
    }

    function scheduleApply() {
      clearTimeout(applyTimer);
      applyTimer = setTimeout(apply, 60);
    }

    observer = new MutationObserver(scheduleApply);

    if (findSizeWrapper(optionName)) {
      apply();
    } else {
      // Size option not on the page yet (or named differently) — keep watching.
      observer.observe(document.body, { childList: true, subtree: true });
      // eslint-disable-next-line no-console
      console.warn('[size-scale] ' + VERSION + ': size option "' + optionName + '" not found yet.');
    }
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-size-scale]'), setup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
