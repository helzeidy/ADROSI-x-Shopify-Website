/* ==========================================================================
   Product add-ons
   --------------------------------------------------------------------------
   Modular paid add-ons for the product page (Broadcast theme).

   Each add-on (snippets/product-addon.liquid) renders a toggle and an optional
   text field. When the customer enables one or more add-ons and adds to cart,
   this script:

     1. Intercepts the add (both the main "Add to cart" button AND the sticky
        cart bar), but ONLY when at least one add-on is active. Otherwise the
        theme adds to cart normally.
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
    cartBarButton: '[data-cart-bar-add-to-cart]',
    productForm: '[data-product-form]',
    errorsContainer: '[data-cart-errors-container]',
    errorMessage: '[data-cart-error-message]'
  };

  var theme = window.theme || {};
  var routes = theme.routes || {};
  var CART_ADD_URL = routes.cart_add_url || '/cart/add.js';
  var CART_URL = routes.cart_url || '/cart';
  var CART_TYPE = (theme.settings && theme.settings.cartType) || 'drawer';

  function addonsForForm(formId) {
    if (!formId) return [];
    return Array.prototype.slice.call(
      document.querySelectorAll(SELECTORS.addon + '[data-product-form-id="' + formId + '"]')
    );
  }

  function isActive(addon) {
    var toggle = addon.querySelector(SELECTORS.toggle);
    return !!(toggle && toggle.checked);
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
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          '[product-addons] Add-on "' +
            (data.addonTitle || 'untitled') +
            '" has no linked product, so no charge will be added. ' +
            'Set the "Add-on product" in the block settings.'
        );
        if (propName && value) mainStamp[propName] = value;
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

  function setLoading(buttons, loading) {
    buttons.forEach(function (button) {
      if (!button) return;
      button.classList.toggle('loading', loading);
      button.classList.toggle('is-loading', loading);
      button.disabled = loading;
    });
  }

  /* Core: add the main product + active add-ons in one request. */
  function handleAdd(form, buttons) {
    var addons = addonsForForm(form.id);
    var active = addons.filter(isActive);

    // Validate required text fields first.
    for (var i = 0; i < active.length; i++) {
      if (!validate(active[i])) return;
    }

    var mainItem = parseMainItem(form);
    var built = buildAddons(addons, mainItem.quantity);

    for (var key in built.mainStamp) {
      if (Object.prototype.hasOwnProperty.call(built.mainStamp, key)) {
        mainItem.properties[key] = built.mainStamp[key];
      }
    }

    var items = [mainItem].concat(built.items);
    setLoading(buttons, true);

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
        var message =
          (error && (error.description || error.message)) ||
          'Sorry, this could not be added to your cart.';
        showError(form, message);
        // eslint-disable-next-line no-console
        console.error('[product-addons] Add to cart failed:', error);
      })
      .finally(function () {
        setLoading(buttons, false);
      });
  }

  /* Resolve the product <form> for a sticky cart-bar button. */
  function formForCartBar(button) {
    var info = button.closest('product-info');
    var form = info && info.querySelector(SELECTORS.productForm);
    if (form && form.id) return form;
    // Fallback: if there is exactly one add-on form on the page, use it.
    var formIds = uniqueFormIds();
    if (formIds.length === 1) return document.getElementById(formIds[0]);
    return null;
  }

  function uniqueFormIds() {
    var ids = {};
    Array.prototype.forEach.call(document.querySelectorAll(SELECTORS.addon), function (addon) {
      if (addon.dataset.productFormId) ids[addon.dataset.productFormId] = true;
    });
    return Object.keys(ids);
  }

  function init() {
    var addons = document.querySelectorAll(SELECTORS.addon);
    // eslint-disable-next-line no-console
    console.log('[product-addons] loaded; add-ons found on page:', addons.length);
    if (!addons.length) return;

    Array.prototype.forEach.call(addons, function (addon) {
      var input = addon.querySelector(SELECTORS.input);
      var error = addon.querySelector(SELECTORS.error);
      if (input && error) {
        input.addEventListener('input', function () {
          if (input.value.trim()) error.hidden = true;
        });
      }
    });

    // 1) Main "Add to cart": a real form submit. Capture phase guarantees we
    //    run before the theme's <product-form> submit handler on the form.
    document.addEventListener(
      'submit',
      function (evt) {
        var form = evt.target;
        if (!form || !form.id) return;
        if (!addonsForForm(form.id).some(isActive)) return; // let theme handle it
        evt.preventDefault();
        evt.stopImmediatePropagation();
        handleAdd(form, [form.querySelector(SELECTORS.submit)]);
      },
      true
    );

    // 2) Sticky cart bar: it calls product-form.onSubmitHandler directly (no
    //    submit event), so intercept the click before cart-bar.js handles it.
    document.addEventListener(
      'click',
      function (evt) {
        var button = evt.target.closest && evt.target.closest(SELECTORS.cartBarButton);
        if (!button) return;
        var form = formForCartBar(button);
        if (!form || !addonsForForm(form.id).some(isActive)) return; // let theme handle it
        evt.preventDefault();
        evt.stopImmediatePropagation();
        handleAdd(form, [button, form.querySelector(SELECTORS.submit)]);
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
