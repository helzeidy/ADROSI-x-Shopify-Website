/* ==========================================================================
   Width selector
   --------------------------------------------------------------------------
   The width buttons submit directly as a line item property (name=
   "properties[Width]"), so the choice is recorded with no extra JS.

   This script only handles the optional upcharge: when the "paid" width is
   selected it ticks a hidden add-on checkbox, so the add-on engine
   (product-addons.js) bundles the linked charge product into the cart. Any
   other width leaves it unticked (free).
   ========================================================================== */
(function () {
  'use strict';

  function setup(group) {
    if (group.dataset.widthReady) return;
    group.dataset.widthReady = 'true';

    var paid = group.getAttribute('data-paid-value') || '';
    var toggleId = group.getAttribute('data-charge-toggle') || '';
    var radios = group.querySelectorAll('input[type="radio"][data-width-option]');

    function sync() {
      if (!toggleId) return;
      var toggle = document.getElementById(toggleId);
      if (!toggle) return;
      var checked = group.querySelector('input[type="radio"][data-width-option]:checked');
      var value = checked ? checked.value : '';
      toggle.checked = !!(paid && value === paid);
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
