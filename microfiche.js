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

  // Rather than relying on the literal position of `this.film`,
  // we keep a tab on the current destination.
  x: 0,

  // Build the microfiche in steps.
  initialize: function(options) {
    this.el = $(options.el);
    this.createFilm();
    this.createScreen();
    this.createControls();
  },

  // We create our film element, which we’ll slide back and forth in the screen.
  // Before appending any extra elements, we detach the existing children,
  // append them to film, and tell them to float so they’ll (hopefully) lay-out
  // nicely along the horizontal.
  createFilm: function() {
    this.film = $('<div class="microfiche-film">').
    css({ position: 'absolute', whiteSpace: 'nowrap' });
    this.el.children().appendTo(this.film).css({ float: 'left' });
  },

  // The screen is created and appended to our element, then the film is
  // appended to the screen. Screen manually takes its height from film.
  createScreen: function() {
    this.screen = $('<div class="microfiche-screen">').
    appendTo(this.el).append(this.film).
    height(this.film.outerHeight()).
    css({ position: 'relative', overflow: 'hidden' });
  },

  // We keep controls in a Hash called `this.controls`. There’s a bit of
  // jQuery chaining here, so look closesly when adding extra controls.
  // For the time being, we’re binding control elements directly to their
  // respective actions.
  createControls: function() {
    var self = this;

    this.controls = {
      prev: $('<button class="microfiche-button prev">&larr;</button>').
            appendTo(this.el).on('click', function(e) { self.prev() }),
      next: $('<button class="microfiche-button next">&rarr;</button>').
            appendTo(this.el).on('click', function(e) { self.next() })
    };
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
    this.film.animate({ left: -this.x + 'px' });
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
  }

});

// Turn selector-ed elements into Microfiche slideshows.
jQuery.fn.microfiche = function() {
  return this.each(function() { new Microfiche({ el: this }) });
}

})();

