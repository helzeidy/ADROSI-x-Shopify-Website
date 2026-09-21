/* ==========================================================================
   HubSpot form popup
   --------------------------------------------------------------------------
   Opens a native <dialog> and, on first open, loads HubSpot's embed script and
   builds the form inside it. Later opens reuse the same form.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__hubspotPopupInit) return;
  window.__hubspotPopupInit = true;

  var SCRIPT_URL = 'https://js.hsforms.net/forms/embed/v2.js';
  var scriptPromise = null;

  function loadHubspot() {
    if (window.hbspt && window.hbspt.forms) return Promise.resolve();
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        scriptPromise = null; // allow a retry on the next open
        reject(new Error('HubSpot script failed to load'));
      };
      document.head.appendChild(script);
    });
    return scriptPromise;
  }

  /* Fill a hidden HubSpot field with the product, if the block asks for it. */
  function prefillProduct(dialog, formEl) {
    var fieldName = dialog.getAttribute('data-product-field');
    if (!fieldName || !formEl) return;
    var input = formEl.querySelector('[name="' + fieldName + '"]');
    if (!input) return;
    input.value = dialog.getAttribute('data-product-value') || '';
    // HubSpot's forms listen for these to register the value.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function buildForm(dialog) {
    if (dialog.dataset.hubspotBuilt) return;
    dialog.dataset.hubspotBuilt = 'true';

    var loading = dialog.querySelector('[data-hubspot-loading]');

    loadHubspot()
      .then(function () {
        window.hbspt.forms.create({
          region: dialog.getAttribute('data-region') || 'na1',
          portalId: dialog.getAttribute('data-portal-id'),
          formId: dialog.getAttribute('data-form-id'),
          target: dialog.getAttribute('data-target'),
          onFormReady: function (form) {
            if (loading) loading.remove();
            // v2 passes a jQuery object on some accounts, a DOM node on others.
            var el = form && form.jquery ? form[0] : form;
            prefillProduct(dialog, el);
          }
        });
      })
      .catch(function () {
        delete dialog.dataset.hubspotBuilt;
        if (loading) loading.textContent = 'The form could not load. Please check your connection and try again.';
      });
  }

  function open(dialog) {
    // Product blocks can sit inside the product <form>; HubSpot builds its own
    // <form>, and nested forms misbehave on submit. Move the dialog to <body>.
    if (dialog.parentNode !== document.body) {
      document.body.appendChild(dialog);
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', ''); // very old browsers
    }
    document.documentElement.classList.add('hubspot-popup-open');
    buildForm(dialog);
  }

  function close(dialog) {
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  document.addEventListener('click', function (evt) {
    var opener = evt.target.closest('[data-hubspot-open]');
    if (opener) {
      evt.preventDefault();
      var dialog = document.getElementById(opener.getAttribute('data-hubspot-open'));
      if (dialog) open(dialog);
      return;
    }

    var closer = evt.target.closest('[data-hubspot-close]');
    if (closer) {
      evt.preventDefault();
      close(closer.closest('[data-hubspot-dialog]'));
      return;
    }

    // Click on the backdrop (the dialog element itself, outside its content).
    if (evt.target.matches && evt.target.matches('[data-hubspot-dialog]')) {
      close(evt.target);
    }
  });

  // Inline forms (the "HubSpot form" section set to show the form on the page)
  // carry the same data attributes as a dialog, so buildForm works for both.
  // They're built straight away rather than on click.
  function initInline(scope) {
    var forms = (scope || document).querySelectorAll('[data-hubspot-inline]');
    Array.prototype.forEach.call(forms, buildForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initInline();
    });
  } else {
    initInline();
  }

  // Theme editor: the section is re-rendered when its settings change.
  document.addEventListener('shopify:section:load', function (evt) {
    initInline(evt.target);
  });

  // Covers Esc, the close button and backdrop clicks alike.
  document.addEventListener(
    'close',
    function (evt) {
      if (evt.target.matches && evt.target.matches('[data-hubspot-dialog]')) {
        document.documentElement.classList.remove('hubspot-popup-open');
      }
    },
    true
  );
})();
