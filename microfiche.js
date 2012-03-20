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
    buttons        : true,
    minDuration    : 250,
    duration       : 500,
    maxDuration    : 500,
    dragThreshold  : 25,
    elasticity     : 0.5,
    debounce       : 200,
    swipeThreshold : 0.125
  },

  // Rather than relying on the literal position of `this.film`,
  // we keep a tab on the current destination.
  x: 0,

  // Build microfiche in steps.
  initialize: function(options) {
    this.options = $.extend({}, this.options, options);
    this.el = $(options.el);
    this.el.data('microfiche', this);
    this.createFilm();
    this.createScreen();
    this.calibrate();

    if (this.film.width() <= this.screen.width()) return;

    this.createControls();
    this.enableTouch();
    this.prepareCyclic();

    this.run(this.options);
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
    if (!this.options.buttons) return;

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

      if (!this.options.cyclic) {
        if (this.touchState.cx < this.min()) {
          var bx = this.min() - this.touchState.cx;
          bx = bx * this.options.elasticity;
          this.touchState.cx = this.min() - bx;
        }

        if (this.touchState.cx > this.max()) {
          var bx = this.touchState.cx - this.max();
          bx = bx * this.options.elasticity;
          this.touchState.cx = this.max() + bx;
        }
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
    $(document).off('touchmove', this.touchmove).
                off('touchend', this.touchend);

    if (this.touchState.isDrag) {
      var dx = this.touchState.dx,
           w = this.screenWidth(),
          vx = this.touchState.vx,
          th = this.options.swipeThreshold;

      if (dx <= -w * th) {
        this.shuttle(1, vx);
      } else if (dx >= w * th) {
        this.shuttle(-1, vx);
      } else {
        this.shuttle(0);
      }
    }

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
    if (!this.options.buttons) return;
    if (this.options.cyclic) return;

    this.controls.prev[0].disabled = this.x <= this.min();
    this.controls.next[0].disabled = this.x >= this.max();
  },

  // Microfiche shuttles by the screenful, so `direction` represents
  // screenfuls in either direction. Normally you’d use +/- 1, but larger
  // units should work fine too.
  shuttle: function(direction, vx) {
    var ox = this.x,
         w = this.screenWidth();

    this.x = this.constrain((Math.round(this.x / w) + direction) * w);

    if (this.options.cyclic && this.x == ox) this.x += direction * w;

    if (vx) {
      var duration = this.constrain(
        Math.abs((this.x - ox) / vx),
        this.options.minDuration,
        this.options.maxDuration
      );
    } else {
      var duration = this.options.duration;
    }

    this.updateControls();
    this.transition(duration);
  },

  // Return `x` constrained between limits `min` and `max`.
  constrain: function(x, min, max) {
    if (min === undefined) min = this.min();
    if (max === undefined) max = this.max();
    return Math.max(min, Math.min(x, max));
  },

  // Round `x` to a factor of `screenWidth`.
  round: function(x) {
    var w = this.screenWidth();
    return Math.round(x / w) * w;
  },

  // Round and constrain `x`.
  roundAndConstrain: function(x, min, max) {
    return this.constrain(this.round(x), min, max);
  },

  // Returns true if the given point is within our upper/lower bounds.
  withinBounds: function(x) {
    return this.min() <= x && x <= this.max();
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
  transition: function(duration) {
    var self = this;

    if (duration == null) duration = this.options.duration;

    this.film.stop().animate(
      { left: -this.x + 'px' },
      duration,
      function() { self.afterTransition() }
    );
  },

  // Perform an instant transition to our new destination.
  jump: function() {
    this.film.css({ left: -this.x });
  },

  // Returns the width of the containing element.
  screenWidth: function() {
    return this.el.width();
  },

  // Prepare duplicate content at either end, for our cyclic behaviour.
  prepareCyclic: function() {
    if (!this.options.cyclic) return;

    var cloneL = this.film.clone(),
        cloneR = this.film.clone(),
        w = this.film.width();

    cloneL.prependTo(this.film).css({ position: 'absolute', left: -w + 'px' });
    cloneR.appendTo(this.film).css({ position: 'absolute', left: w + 'px' });
  },

  // Called when a transition finishes.
  afterTransition: function() {
    if (this.x < this.min()) {
      this.x = this.max();
      this.jump();
    } else if (this.x > this.max()) {
      this.x = this.min();
      this.jump();
    }
  },

  // Run given commands.
  run: function(options) {
    for (var key in options) {
      var property = this[key];
      if ($.isFunction(property)) property.call(this, options[key]);
    }
  },

  // Animate to the given point (constrained to an acceptable value).
  slideTo: function(x) {
    this.x = this.roundAndConstrain(x);
    this.updateControls();
    this.transition();
  },

  // Jump to the given point (constrained to an acceptable value).
  jumpTo: function(x) {
    this.x = this.roundAndConstrain(x);
    this.updateControls();
    this.jump();
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

    transition: function(duration) {
      var self = this;

      if (duration == null) duration = this.options.duration;

      this.film.one(
        'webkitTransitionEnd',
        function() { self.afterTransition() }
      ).css({
        WebkitTransition: '-webkit-transform ' + duration + 'ms',
        WebkitTransform: 'translate3d(' + -this.x + 'px, 0px, 0px)'
      });
    },

    jump: function() {
      this.film.css({
        WebkitTransition: '-webkit-transform 0ms',
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

    transition: function(duration) {
      var self = this;

      if (duration == null) duration = this.options.duration;

      this.film.one(
        'mozTransitionEnd',
        function() { self.afterTransition() }
      ).css({
        MozTransition: '-moz-transform ' + duration + 'ms',
        MozTransform: 'translate(' + -this.x + 'px, 0px)'
      });
    },

    jump: function() {
      this.film.css({
        MozTransition: '-moz-transform 0ms',
        MozTransform: 'translate(' + -this.x + 'px, 0px)'
      });
    }

  });
}

// Turn selector-ed elements into Microfiche slideshows.
jQuery.fn.microfiche = function(options) {
  return this.each(function() {
    var microfiche = $(this).data('microfiche');

    if (microfiche) {
      microfiche.run(options);
    } else {
      new Microfiche($.extend({ el: this }, options));
    }
  });
}

})();

