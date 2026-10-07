/* ==========================================================================
   Page embed
   --------------------------------------------------------------------------
   Shows a page rendered with its own template (all its sections) inside a
   popup — used by the product size chart. Liquid can't render another
   template's sections, so the page is fetched and its <main> is moved in.

   Markup: <div data-page-embed="/pages/size-guide">fallback content</div>
   The fallback (the page's plain content) stays if the fetch fails.

   Loaded on first open of the popup, not on page load. Scripts inside the
   fetched page don't run (DOMParser marks them inert); instead a
   "page-embed:loaded" event lets section scripts (tabs-section.js) set up the
   new content. Stylesheets inside it load normally.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__pageEmbedInit) return;
  window.__pageEmbedInit = true;

  var requests = {};

  function fetchMain(url) {
    if (!requests[url]) {
      requests[url] = fetch(url, { credentials: 'same-origin' })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var main = doc.querySelector('#MainContent') || doc.querySelector('main');
          if (!main) throw new Error('No main content');
          return main;
        })
        .catch(function (error) {
          delete requests[url]; // allow a retry on the next open
          throw error;
        });
    }
    return requests[url];
  }

  function load(el) {
    var url = el.getAttribute('data-page-embed');
    if (!url || el.dataset.embedState === 'loading' || el.dataset.embedState === 'done') return;

    el.dataset.embedState = 'loading';
    el.setAttribute('aria-busy', 'true');

    fetchMain(url)
      .then(function (main) {
        var fragment = document.createDocumentFragment();
        Array.prototype.forEach.call(main.childNodes, function (node) {
          fragment.appendChild(document.importNode(node, true));
        });
        el.innerHTML = '';
        el.appendChild(fragment);
        el.dataset.embedState = 'done';
        el.classList.add('is-embedded');
        document.dispatchEvent(new CustomEvent('page-embed:loaded', { detail: { container: el } }));
      })
      .catch(function () {
        el.dataset.embedState = 'failed'; // keep the fallback content
      })
      .then(function () {
        el.removeAttribute('aria-busy');
      });
  }

  function loadWithin(scope) {
    if (!scope) return;
    Array.prototype.forEach.call(scope.querySelectorAll('[data-page-embed]'), load);
  }

  // The size chart link sits inside <popup-component> next to its <dialog>.
  function scopeFor(trigger) {
    return trigger.closest('popup-component') || trigger.parentElement;
  }

  document.addEventListener('click', function (evt) {
    var trigger = evt.target.closest && evt.target.closest('[data-popup-open]');
    if (trigger) loadWithin(scopeFor(trigger));
  });

  // Start fetching on hover/focus so the content is usually ready on open.
  ['pointerenter', 'focusin'].forEach(function (type) {
    document.addEventListener(
      type,
      function (evt) {
        var trigger = evt.target.closest && evt.target.closest('[data-popup-open]');
        if (trigger) loadWithin(scopeFor(trigger));
      },
      true
    );
  });
})();
