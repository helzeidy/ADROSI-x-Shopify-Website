/* ==========================================================================
   Width selector
   --------------------------------------------------------------------------
   The width buttons submit directly as a line item property (name=
   "properties[Width]"), so the choice is recorded with no extra JS.

   This script handles the optional upcharges: each paid width has a hidden
   charge carrier (a add-on element). When a paid width is selected, its
   matching carrier's checkbox is ticked so the add-on engine
   (product-addons.js) bundles that charge product; all others are unticked.
   ========================================================================== */
(function () {
  'use strict';

  function norm(s) {
    return (s || '').trim().toLowerCase();
  }

  function setup(group) {
    if (group.dataset.widthReady) return;
    group.dataset.widthReady = 'true';

    var block = group.closest('.product-width') || group.parentNode;
    var carriers = block.querySelectorAll('[data-width-charge]');
    var radios = group.querySelectorAll('input[type="radio"][data-width-option]');

    function sync() {
      var checked = group.querySelector('input[type="radio"][data-width-option]:checked');
      var value = checked ? norm(checked.value) : '';
      Array.prototype.forEach.call(carriers, function (carrier) {
        var toggle = carrier.querySelector('[data-addon-toggle]');
        if (!toggle) return;
        toggle.checked = value !== '' && norm(carrier.getAttribute('data-for-value')) === value;
      });
    }

    Array.prototype.forEach.call(radios, function (radio) {
      radio.addEventListener('change', sync);
    });

    sync();
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-width-selector]'), setup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
