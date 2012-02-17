(function() {

// # Microfiche.js v0.9.0
//
// ## Usage
//
//     $('.my-slideshow').microfiche();
//
window.Microfiche = function(options) { this.initialize(options); return this; };

Microfiche.VERSION = '0.9.0';

$.extend(Microfiche.prototype, {

  // The default options, which can be overridden by the initializer.
  options: {
    minDuration: 250,
    duration: 500,
    maxDuration: 500,
    dragThreshold: 10
  },

  // Rather than relying on the literal position of `this.film`,
  // we keep a tab on the current destination.
  x: 0,

  // Build microfiche in steps.
  initialize: function(options) {
    this.options = $.extend({}, this.options, options);
    this.el = $(options.el);
    this.createFilm();
    this.createScreen();
    this.calibrate();
    this.createControls();
    this.enableTouch();
  },

  // We create our film element, which we’ll slide back and forth in the screen.
  // Before appending any extra elements, we detach the existing children,
  // append them to film, and tell them to float so they’ll (hopefully) lay-out
  // nicely along the horizontal.
  createFilm: function() {
    this.film = $('<div class="microfiche-film">').
    css({ position: 'absolute' });
    this.el.children().appendTo(this.film).css({ float: 'left' });
    this.prepareFilm && this.prepareFilm();
  },

  // The screen is created and appended to our element, then the film is
  // appended to the screen. Screen manually takes its height from film.
  createScreen: function() {
    this.screen = $('<div class="microfiche-screen">').
    css({ position: 'relative', overflow: 'hidden' }).
    appendTo(this.el).
    append(this.film);
  },


  // This slightly strange process tries to ensure we don’t get any wrapping
  // in `this.film`, then fixes the dimensions of `this.film` and `this.screen`.
  calibrate: function() {
    this.screen.width(100000);

    var w = this.film.width(),
        h = this.film.height();

    this.film.width(w).height(h);
    this.screen.width('auto').height(h);
  },

  // We keep controls in a Hash called `this.controls`. There’s a bit of
  // jQuery chaining here, so look closesly when adding extra controls.
  // For the time being, we’re binding control elements directly to their
  // respective actions.
  createControls: function() {
    var self = this;

    this.controls = {
      prev: $('<button class="microfiche-prev-button">&larr;</button>').
            appendTo(this.el).on('click touchstart', function(e) { e.preventDefault(); self.prev() }),
      next: $('<button class="microfiche-next-button">&rarr;</button>').
            appendTo(this.el).on('click touchstart', function(e) { e.preventDefault(); self.next() })
    };

    this.updateControls();
  },

  // Add in the appropriate touch events. This requires a bit of scope-locking.
  enableTouch: function() {
    var self = this;

    var thisTouchstart = this.touchstart,
        thisTouchmove = this.touchmove,
        thisTouchend = this.touchend;

    this.touchstart = function() { thisTouchstart.apply(self, arguments) };
    this.touchmove = function() { thisTouchmove.apply(self, arguments) };
    this.touchend = function() { thisTouchend.apply(self, arguments) };

    this.film.on('touchstart', this.touchstart);
  },

  // When touch starts, record the origin point and time.
  touchstart: function(e) {
    var touches = e.originalEvent.targetTouches;

    if (!touches || touches.length > 1) return;

    this.touchState = {
      then   : new Date(),
      ox     : touches[0].pageX,
      oy     : touches[0].pageY,
      isDrag : false
    }

    $(document).on('touchmove', this.touchmove).
                on('touchend', this.touchend);
  },

  // Touchmove begins by getting the deltas on both axis.
  //
  // If we’re not already in drag-mode, we check to see if the horizontal
  // delta is above the treshold. If the vertical delta crosses the threshold,
  // we duck out altogether.
  //
  // After that, we ask `this.film` to follow the touch, and record a few
  // details about position and velocity for good measure.
  touchmove: function(e) {
    var t = e.originalEvent.targetTouches[0],
        dx = t.pageX - this.touchState.ox,
        dy = t.pageY - this.touchState.oy;

    if (!this.touchState.isDrag) {
      if (Math.abs(dy) >= this.options.dragThreshold) {
        this.touchend();
        return;
      } else if (Math.abs(dx) >= this.options.dragThreshold) {
        this.touchState.isDrag = true;
      }
    }

    if (this.touchState.isDrag) {
      e.preventDefault();

      var now = new Date(),
          t = now - this.touchState.then;

      this.touchState.vx = (dx - this.touchState.dx) / t;
      this.touchState.vy = (dy - this.touchState.dy) / t;
      this.touchState.dx = dx;
      this.touchState.dy = dy;
      this.touchState.then = now;

      this.touchState.cx = this.x - dx;

      if (this.touchState.cx < this.min()) {
        var bx = this.min() - this.touchState.cx;
        bx = bx * 0.5;
        this.touchState.cx = this.min() - bx;
      }

      if (this.touchState.cx > this.max()) {
        var bx = this.touchState.cx - this.max();
        bx = bx * 0.5;
        this.touchState.cx = this.max() + bx;
      }

      this.film.css({
        WebkitTransition: 'none',
        WebkitTransform: 'translate3d(' + -this.touchState.cx + 'px, 0px, 0px)'
      });
    }
  },

  // When the touch is finished, we unbind events. If the touch was decided
  // to be a drag, we’ll deduce the new target value for x, ensure Microfiche
  // knows about it, and animate into place.
  touchend: function(e) {
    if (this.touchState.isDrag) {
      var dx = this.touchState.dx,
          vx = this.touchState.vx,
          cx = this.touchState.cx,
          fx = dx < 0 ? Math.ceil : Math.floor,
           w = this.screenWidth(),
           x = this.constrain(fx(cx / w) * w),
           d = x - cx,
           t = this.constrain(Math.abs(d / vx), this.options.minDuration,
                                                this.options.maxDuration);

      this.x = x;

      this.film.css({
        WebkitTransition: '-webkit-transform ' + t + 'ms',
        WebkitTransform: 'translate3d(' + -x + 'px, 0px, 0px)'
      });

      this.updateControls();
    }

    $(document).off('touchmove', this.touchmove).
                off('touchend', this.touchend);
  },

  // Slide to the previous screen’s-worth of slides.
  prev: function() {
    this.shuttle(-1);
  },

  // Slide to the next screen’s-worth of slides.
  next: function() {
    this.shuttle(1);
  },

  // Enable/disable controls based on current position.
  updateControls: function() {
    this.controls.prev[0].disabled = this.x === this.min();
    this.controls.next[0].disabled = this.x === this.max();
  },

  // Microfiche shuttles by the screenful, so `direction` represents
  // screenfuls in either direction. Normally you’d use +/- 1, but larger
  // units should work fine too.
  shuttle: function(direction) {
    this.film.stop();
    var w = this.screenWidth();
    this.x = this.constrain((Math.round(this.x / w) + direction) * w);
    this.updateControls();
    this.transition();
  },

  // Return `x` constrained between limits `min` and `max`.
  constrain: function(x, min, max) {
    if (min === undefined) min = this.min();
    if (max === undefined) max = this.max();
    return Math.max(min, Math.min(x, max));
  },

  // Returns the lower limit - simply 0.
  min: function() {
    return 0;
  },

  // Returns the upper limit - the width of `this.film` less the width of
  // `this.screen`.
  max: function() {
    return this.film.width() - this.screenWidth();
  },

  // Perform the actual animation to our new destination.
  transition: function() {
    this.film.animate({ left: -this.x + 'px' }, this.options.duration);
  },

  screenWidth: function() {
    return this.el.width();
  }

});

// A bit of feature detection for webkit transition support.
var wkt = document.documentElement.style.WebkitTransition;
if (wkt !== undefined && wkt !== null) {
  // If we have webkit transition support, then override `prepareFilm`
  // and `transition` to take advantage of hardware acceleration.
  $.extend(Microfiche.prototype, {

    prepareFilm: function() {
      this.film.css({ WebkitTransform: 'translate3d(0px, 0px, 0px)' });
    },

    transition: function() {
      this.film.css({
        WebkitTransition: '-webkit-transform ' + this.options.duration + 'ms',
        WebkitTransform: 'translate3d(' + -this.x + 'px, 0px, 0px)'
      });
    }

  });
}

// A bit of feature detection for moz transition support.
var moz = document.documentElement.style.MozTransition;
if (moz !== undefined && moz !== null) {
  // If we have moz transition support, then override `prepareFilm`
  // and `transition` to take advantage of hardware acceleration.
  $.extend(Microfiche.prototype, {

    prepareFilm: function() {
      this.film.css({ MozTransform: 'translate(0px, 0px)' });
    },

    transition: function() {
      this.film.css({
        MozTransition: '-moz-transform ' + this.options.duration + 'ms',
        MozTransform: 'translate(' + -this.x + 'px, 0px)'
      });
    }

  });
}

// Turn selector-ed elements into Microfiche slideshows.
jQuery.fn.microfiche = function(options) {
  return this.each(function() {
    new Microfiche($.extend({ el: this }, options));
  });
}

})();

