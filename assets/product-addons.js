/* ==========================================================================
   Product add-ons
   --------------------------------------------------------------------------
   Modular paid add-ons for the product page (Broadcast theme).

   Each add-on (snippets/product-addon.liquid) renders a toggle and an optional
   text field. When the customer enables one or more add-ons and submits the
   product form, this script:

     1. Intercepts the submit (capture phase, before the theme's <product-form>),
        but ONLY when at least one add-on is active. Otherwise the theme adds to
        cart normally.
     2. Builds a single /cart/add.js request containing the main product plus
        each active add-on product (the paid line item), carrying the custom
        text as a line item property.
     3. Triggers the theme's own cart refresh ('theme:cart:refresh'), which
        re-renders the cart and opens the drawer.

   Adding more add-ons later requires no code changes: just add another
   "Add-on option" block in the theme editor and point it at a hidden product.
   ========================================================================== */
(function () {
  'use strict';

  var SELECTORS = {
    addon: '[data-product-addon]',
    toggle: '[data-addon-toggle]',
    input: '[data-addon-input]',
    reveal: '[data-addon-reveal]',
    error: '[data-addon-error]',
    submit: '[type="submit"]',
    errorsContainer: '[data-cart-errors-container]',
    errorMessage: '[data-cart-error-message]'
  };

  var theme = window.theme || {};
  var routes = theme.routes || {};
  var CART_ADD_URL = routes.cart_add_url || '/cart/add.js';
  var CART_URL = routes.cart_url || '/cart';
  var CART_TYPE = (theme.settings && theme.settings.cartType) || 'drawer';

  function addonsForForm(formId) {
    return Array.prototype.slice.call(
      document.querySelectorAll(SELECTORS.addon + '[data-product-form-id="' + formId + '"]')
    );
  }

  function isActive(addon) {
    var toggle = addon.querySelector(SELECTORS.toggle);
    return !!(toggle && toggle.checked);
  }

  function syncReveal(addon) {
    var reveal = addon.querySelector(SELECTORS.reveal);
    var active = isActive(addon);
    addon.classList.toggle('is-active', active);
    if (reveal) reveal.hidden = !active;
  }

  /* Validate a single active add-on's required text field. */
  function validate(addon) {
    if (!isActive(addon)) return true;
    var input = addon.querySelector(SELECTORS.input);
    var error = addon.querySelector(SELECTORS.error);
    if (input && input.required && !input.value.trim()) {
      if (error) error.hidden = false;
      input.focus();
      return false;
    }
    if (error) error.hidden = true;
    return true;
  }

  /* Parse the main product line item from the form's own fields. */
  function parseMainItem(form) {
    var fd = new FormData(form);
    var item = {
      id: fd.get('id'),
      quantity: parseInt(fd.get('quantity'), 10) || 1,
      properties: {}
    };
    var sellingPlan = fd.get('selling_plan');
    if (sellingPlan) item.selling_plan = sellingPlan;

    fd.forEach(function (value, key) {
      var match = key.match(/^properties\[(.+)\]$/);
      if (match && value !== '') item.properties[match[1]] = value;
    });
    return item;
  }

  /* Build add-on line items + any properties to stamp onto the main line. */
  function buildAddons(addons, quantity) {
    var items = [];
    var mainStamp = {};

    addons.forEach(function (addon) {
      if (!isActive(addon)) return;

      var data = addon.dataset;
      var input = addon.querySelector(SELECTORS.input);
      var value = input ? input.value.trim() : '';
      var propName = data.propertyName;

      if (data.stampMain === 'true' && propName && value) {
        mainStamp[propName] = value;
      }

      if (data.variantId) {
        var properties = {};
        if (data.addonForTitle) properties._addon_for = data.addonForTitle;
        if (propName && value) properties[propName] = value;
        items.push({
          id: data.variantId,
          quantity: quantity,
          properties: properties
        });
      } else if (propName && value) {
        // No charge product configured yet: at least keep the text on the main line.
        mainStamp[propName] = value;
      }
    });

    return { items: items, mainStamp: mainStamp };
  }

  function showError(form, message) {
    var container = form.querySelector(SELECTORS.errorsContainer);
    var messageEl = form.querySelector(SELECTORS.errorMessage);
    if (messageEl) messageEl.textContent = message;
    if (container) container.classList.add('is-visible');
  }

  function setLoading(button, loading) {
    if (!button) return;
    button.classList.toggle('loading', loading);
    button.disabled = loading;
  }

  function onSubmit(form, evt) {
    var addons = addonsForForm(form.id);
    var active = addons.filter(isActive);
    if (!active.length) return; // No add-ons selected: let the theme handle it.

    // Validate required text fields before we take over.
    for (var i = 0; i < active.length; i++) {
      if (!validate(active[i])) {
        evt.preventDefault();
        evt.stopImmediatePropagation();
        return;
      }
    }

    evt.preventDefault();
    evt.stopImmediatePropagation();

    var mainItem = parseMainItem(form);
    var built = buildAddons(addons, mainItem.quantity);

    for (var key in built.mainStamp) {
      if (Object.prototype.hasOwnProperty.call(built.mainStamp, key)) {
        mainItem.properties[key] = built.mainStamp[key];
      }
    }

    var items = [mainItem].concat(built.items);
    var button = form.querySelector(SELECTORS.submit);
    setLoading(button, true);

    fetch(CART_ADD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/javascript'
      },
      body: JSON.stringify({ items: items })
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok || data.status) throw data;
          return data;
        });
      })
      .then(function () {
        if (CART_TYPE === 'page') {
          window.location = CART_URL;
          return;
        }
        // The theme re-renders the cart and opens the drawer on this event.
        document.dispatchEvent(new CustomEvent('theme:cart:refresh', { bubbles: true }));
      })
      .catch(function (error) {
        var message = (error && (error.description || error.message)) || 'Sorry, this could not be added to your cart.';
        showError(form, message);
        // eslint-disable-next-line no-console
        console.error('[product-addons] Add to cart failed:', error);
      })
      .finally(function () {
        setLoading(button, false);
      });
  }

  function init() {
    var addons = document.querySelectorAll(SELECTORS.addon);
    if (!addons.length) return;

    var formIds = {};

    Array.prototype.forEach.call(addons, function (addon) {
      syncReveal(addon);

      var toggle = addon.querySelector(SELECTORS.toggle);
      if (toggle) {
        toggle.addEventListener('change', function () {
          syncReveal(addon);
        });
      }

      var input = addon.querySelector(SELECTORS.input);
      var error = addon.querySelector(SELECTORS.error);
      if (input && error) {
        input.addEventListener('input', function () {
          if (input.value.trim()) error.hidden = true;
        });
      }

      if (addon.dataset.productFormId) formIds[addon.dataset.productFormId] = true;
    });

    // One capture-phase listener on the document guarantees we run before the
    // theme's <product-form> submit handler (which lives on the form itself).
    document.addEventListener(
      'submit',
      function (evt) {
        var form = evt.target;
        if (!form || !form.id || !formIds[form.id]) return;
        onSubmit(form, evt);
      },
      true
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
