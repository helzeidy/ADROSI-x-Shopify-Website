/* ==========================================================================
   Timeline scroll
   --------------------------------------------------------------------------
   Drives the pinned timeline: as the page scrolls through the section's track,
   exactly ONE step is marked active (panel + image + dot). Desktop only —
   on mobile the section is a plain stacked list and this script stays idle.
   ========================================================================== */
(function () {
  'use strict';

  var DESKTOP = window.matchMedia('(min-width: 750px)');

  function TimelineScroll(root) {
    this.root = root;
    this.track = root.querySelector('[data-tls-track]');
    this.rail = root.querySelector('[data-tls-rail]');
    this.panels = Array.prototype.slice.call(root.querySelectorAll('[data-tls-panel]'));
    this.figures = Array.prototype.slice.call(root.querySelectorAll('[data-tls-figure]'));
    this.dots = Array.prototype.slice.call(root.querySelectorAll('[data-tls-dot]'));
    this.count = this.panels.length;
    this.index = -1;
    this.ticking = false;

    if (!this.track || this.count === 0) return;

    this.onScroll = this.onScroll.bind(this);
    this.update = this.update.bind(this);

    this.placeDots();
    this.setActive(0, 0);

    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll, { passive: true });

    this.dots.forEach(
      function (dot, i) {
        dot.addEventListener('click', this.scrollToStep.bind(this, i));
      }.bind(this)
    );

    this.update();
  }

  /* Space the dots evenly down the rail, one per step. */
  TimelineScroll.prototype.placeDots = function () {
    var count = this.count;
    this.dots.forEach(function (dot, i) {
      var pct = count === 1 ? 0 : (i / (count - 1)) * 100;
      dot.style.top = pct + '%';
    });
  };

  TimelineScroll.prototype.onScroll = function () {
    if (this.ticking) return;
    this.ticking = true;
    window.requestAnimationFrame(this.update);
  };

  TimelineScroll.prototype.update = function () {
    this.ticking = false;
    if (!DESKTOP.matches) {
      this.setActive(0, 0);
      return;
    }

    var rect = this.track.getBoundingClientRect();
    var scrollable = this.track.offsetHeight - window.innerHeight;
    if (scrollable <= 0) {
      this.setActive(0, 0);
      return;
    }

    var progress = -rect.top / scrollable;
    if (progress < 0) progress = 0;
    if (progress > 1) progress = 1;

    // Exactly one active step, evenly divided across the track.
    var index = Math.floor(progress * this.count);
    if (index > this.count - 1) index = this.count - 1;
    if (index < 0) index = 0;

    this.setActive(index, progress);
  };

  TimelineScroll.prototype.setActive = function (index, progress) {
    if (this.rail) {
      this.rail.style.setProperty('--tls-progress', progress * 100 + '%');
    }
    if (index === this.index) return;
    this.index = index;

    this.panels.forEach(function (panel, i) {
      panel.classList.toggle('is-active', i === index);
    });
    this.figures.forEach(function (figure, i) {
      figure.classList.toggle('is-active', i === index);
    });
    this.dots.forEach(function (dot, i) {
      dot.classList.toggle('is-active', i === index);
      dot.classList.toggle('is-past', i < index);
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
  };

  TimelineScroll.prototype.scrollToStep = function (index, evt) {
    if (evt) evt.preventDefault();
    if (!DESKTOP.matches) return;
    var scrollable = this.track.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return;
    var top = this.track.getBoundingClientRect().top + window.scrollY;
    // Land in the middle of the requested step's slice.
    var target = top + scrollable * ((index + 0.5) / this.count);
    window.scrollTo({ top: target, behavior: 'smooth' });
  };

  function init(scope) {
    var roots = (scope || document).querySelectorAll('[data-timeline-scroll]');
    Array.prototype.forEach.call(roots, function (root) {
      if (root.dataset.tlsReady) return;
      root.dataset.tlsReady = 'true';
      new TimelineScroll(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }

  // Theme editor: re-init when the section is re-rendered.
  document.addEventListener('shopify:section:load', function (e) {
    init(e.target);
  });
})();
