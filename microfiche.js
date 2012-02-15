// Microfiche.js 0.1
//
// (c) 2012 Jamie White, With Associates LLP
// Microfiche may be freely distributed under the MIT license.

(function() {

var Microfiche = function(options) { this.initialize(options) };

$.extend(Microfiche.prototype, {

  x: 0,

  initialize: function(options) {
    this.el = $(options.el);
    this.createFilm();
    this.createScreen();
    this.createControls();
  },

  createFilm: function() {
    this.film = $('<div class="microfiche-film">').
    css({ position: 'absolute', whiteSpace: 'nowrap' });
    this.el.children().appendTo(this.film).css({ float: 'left' });
  },

  createScreen: function() {
    this.screen = $('<div class="microfiche-screen">').
    appendTo(this.el).append(this.film).
    height(this.film.outerHeight()).
    css({ position: 'relative', overflow: 'hidden' });
  },

  createControls: function() {
    var self = this;

    this.controls = {

      prev: $('<button class="microfiche-button prev">&larr;</button>').
            appendTo(this.el).on('click', function(e) { self.prev() }),

      next: $('<button class="microfiche-button next">&rarr;</button>').
            appendTo(this.el).on('click', function(e) { self.next() })

    };

    this.updateControlStates();
  },

  prev: function() {
    this.film.stop();

    var w  = this.screen.width(),
        xl = 0,
        x1 = this.x || Math.floor(-this.film.position().left / w) * w;
        x2 = Math.max(x1 - w, xl);

    this.x = x2;

    this.updateControlStates();

    this.film.animate({ left: -x2 + 'px' });
  },

  next: function() {
    this.film.stop();

    var w  = this.screen.width(),
        xl = this.film.width() - w,
        x1 = this.x || Math.floor(-this.film.position().left / w) * w;
        x2 = Math.min(x1 + w, xl);

    this.x = x2;

    this.updateControlStates();

    this.film.animate({ left: -x2 + 'px' });
  },

  updateControlStates: function() {
    this.controls.prev[0].disabled = !(this.x > 0);
    this.controls.next[0].disabled = !(this.x < this.film.width() - this.screen.width());
  }

});

jQuery.fn.microfiche = function() {
  return this.each(function() { new Microfiche({ el: this }) });
}

})();

