(function() {

// Microfiche.js 0.0.0
//
// Example:
//
//     $('.my-slideshow').microfiche();
//
window.Microfiche = function(options) { this.initialize(options) };

Microfiche.VERSION = '0.0.0';

$.extend(Microfiche.prototype, {

  // The default options, which can be overridden by the initializer.
  options: {
    duration: 500
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
  },

  // We create our film element, which we’ll slide back and forth in the screen.
  // Before appending any extra elements, we detach the existing children,
  // append them to film, and tell them to float so they’ll (hopefully) lay-out
  // nicely along the horizontal.
  createFilm: function() {
    this.film = $('<div class="microfiche-film">').
    css({ position: 'absolute', overflow: 'hidden', whiteSpace: 'nowrap' });
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
            appendTo(this.el).on('click', function(e) { self.prev() }),
      next: $('<button class="microfiche-next-button">&rarr;</button>').
            appendTo(this.el).on('click', function(e) { self.next() })
    };

    this.updateControls();
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
    var w = this.screen.width();
    this.x = this.constrain((Math.round(this.x / w) + direction) * w);
    this.updateControls();
    this.transition();
  },

  // Return `x` constrained between limits `this.min` and `this.max`.
  constrain: function(x) {
    return Math.max(this.min(), Math.min(x, this.max()));
  },

  // Returns the lower limit - simply 0.
  min: function() {
    return 0;
  },

  // Returns the upper limit - the width of `this.film` less the width of
  // `this.screen`.
  max: function() {
    return this.film.width() - this.screen.width();
  },

  // Perform the actual animation to our new destination.
  transition: function() {
    this.film.animate({ left: -this.x + 'px' }, this.options.duration);
  }

});

// A bit of feature detection for webkit transition support.
var wkt = document.documentElement.style.WebkitTransition;
if (wkt !== undefined && wkt !== null) {
  // If we have webkit transition support, then override `prepareFilm`
  // and `transition` to take advantage of hardware acceleration.
  $.extend(Microfiche.prototype, {

    prepareFilm: function() {
      this.film.css({
        WebkitTransition: '-webkit-transform ' + this.options.duration + 'ms',
        WebkitTransform: 'translate3d(0px, 0px, 0px)'
      });
    },

    transition: function() {
      this.film.css({ WebkitTransform: 'translate3d(' + -this.x + 'px, 0px, 0px)' });
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
      this.film.css({
        MozTransition: '-moz-transform ' + this.options.duration + 'ms',
        MozTransform: 'translate(0px, 0px)'
      });
    },

    transition: function() {
      this.film.css({ MozTransform: 'translate(' + -this.x + 'px, 0px)' });
    }

  });
}

// Turn selector-ed elements into Microfiche slideshows.
jQuery.fn.microfiche = function() {
  return this.each(function() { new Microfiche({ el: this }) });
}

})();

