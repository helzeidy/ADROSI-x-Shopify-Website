/* ==========================================================================
   Featured posts carousel
   --------------------------------------------------------------------------
   Arrows and dots for a scroll-snap track. The track is natively scrollable,
   so touch swiping and trackpads already work without this file — this only
   adds the controls and keeps them in sync with the scroll position.
   ========================================================================== */
(function () {
  'use strict';

  function Carousel(root) {
    this.root = root;
    this.track = root.querySelector('[data-fpc-track]');
    this.slides = Array.prototype.slice.call(root.querySelectorAll('[data-fpc-slide]'));
    this.prev = root.querySelector('[data-fpc-prev]');
    this.next = root.querySelector('[data-fpc-next]');
    this.dots = Array.prototype.slice.call(root.querySelectorAll('[data-fpc-dot]'));
    this.index = 0;
    this.ticking = false;

    if (!this.track || this.slides.length === 0) return;

    this.onScroll = this.onScroll.bind(this);
    this.sync = this.sync.bind(this);

    this.track.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll, { passive: true });

    if (this.prev) {
      this.prev.addEventListener('click', this.go.bind(this, -1));
    }
    if (this.next) {
      this.next.addEventListener('click', this.go.bind(this, 1));
    }

    this.dots.forEach(
      function (dot, i) {
        dot.addEventListener('click', this.scrollToIndex.bind(this, i));
      }.bind(this)
    );

    this.sync();
  }

  Carousel.prototype.onScroll = function () {
    if (this.ticking) return;
    this.ticking = true;
    window.requestAnimationFrame(this.sync);
  };

  /* Which slide is nearest the centre of the viewport? */
  Carousel.prototype.currentIndex = function () {
    var trackRect = this.track.getBoundingClientRect();
    var centre = trackRect.left + trackRect.width / 2;
    var best = 0;
    var bestDistance = Infinity;

    this.slides.forEach(function (slide, i) {
      var rect = slide.getBoundingClientRect();
      var distance = Math.abs(rect.left + rect.width / 2 - centre);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });

    return best;
  };

  Carousel.prototype.sync = function () {
    this.ticking = false;
    this.index = this.currentIndex();

    this.dots.forEach(
      function (dot, i) {
        dot.classList.toggle('is-active', i === this.index);
        dot.setAttribute('aria-current', i === this.index ? 'true' : 'false');
      }.bind(this)
    );

    // Disable arrows at the ends rather than wrapping, so the track never
    // fights the user's own scrolling.
    var maxScroll = this.track.scrollWidth - this.track.clientWidth;
    if (this.prev) {
      this.prev.disabled = this.track.scrollLeft <= 1;
    }
    if (this.next) {
      this.next.disabled = this.track.scrollLeft >= maxScroll - 1;
    }
  };

  Carousel.prototype.scrollToIndex = function (index, evt) {
    if (evt) evt.preventDefault();
    var slide = this.slides[index];
    if (!slide) return;

    var trackRect = this.track.getBoundingClientRect();
    var slideRect = slide.getBoundingClientRect();
    // Centre the target slide in the track.
    var delta = slideRect.left + slideRect.width / 2 - (trackRect.left + trackRect.width / 2);

    this.track.scrollTo({ left: this.track.scrollLeft + delta, behavior: 'smooth' });
  };

  Carousel.prototype.go = function (direction, evt) {
    if (evt) evt.preventDefault();
    var target = this.currentIndex() + direction;
    if (target < 0) target = 0;
    if (target > this.slides.length - 1) target = this.slides.length - 1;
    this.scrollToIndex(target);
  };

  function init(scope) {
    var roots = (scope || document).querySelectorAll('[data-featured-posts-carousel]');
    Array.prototype.forEach.call(roots, function (root) {
      if (root.dataset.fpcReady) return;
      root.dataset.fpcReady = 'true';
      new Carousel(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (e) {
    init(e.target);
  });
})();
