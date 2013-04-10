// # Microfiche.js v1.3.4
//
// ## Usage
//
//     $('.my-slideshow').microfiche();
//     $('.my-slideshow').microfiche({ cyclic: true, button: false });
//     $('.my-slideshow').microfiche({ slideByPages: 1 });
//
// ## Options
//
// The following options can be passed the first time `microfiche` is called
// on an element.
//
// ### cyclic
//
// If true, microfiche wraps around at front and beginning of the slideshow.
// This option is false by default.
//
//     $('.my-slideshow').microfiche({ cyclic: true });
//
// ### buttons
//
// If true, microfiche will create previous/next buttons.
// This option is true by default.
//
//     $('.my-slideshow').microfiche({ buttons: false });
//
// ### bullets
//
// If true, microfiche will create bullets for the pages available.
// This option is also true by default.
//
//     $('.my-slideshow').microfiche({ bullets: false });
//
// ## Commands
//
// The following commands can be run on a microfiche'd element at any point,
// including in the first call.
//
// ### slideByPages
//
// Slides `n` screenfuls (negative `n` goes backwards).
//
//     $('.my-slideshow').microfiche({ slideByPages: n });
//
// ### slideToPage
//
// Slides to the `nth` screenful.
//
//     $('.my-slideshow').microfiche({ slideToPage: n });
//
// ### slideToPoint
//
// Slides to point `x` (rounded and constrained appropriately).
//
//     $('.my-slideshow).microfiche({ slideToPoint: x });
//
// ### jumpToPoint
//
// Jumps without animation to point x (again, rounded and constrained).
//
//     $('.my-slideshow').microfiche({ jumpToPoint: x });
//
// ### autoplay
//
// Automatically advances every `n` seconds.
//
//     $('.my-slideshow').microfiche({ autoplay: n });
//

(function() {

window.Microfiche = function(options) { this.initialize(options); return this; };

Microfiche.VERSION = '1.3.4';

$.extend(Microfiche.prototype, {

  // ## Default Options ##
  //
  // These may be overridden in the initializer.
  options: {
    autoplay        : false,
    buttons         : true,
    bullets         : true,
    cyclic          : false,
    keyboard        : false,
    swipe           : true,
    clickToAdvance  : false,
    minDuration     : 250,
    duration        : 500,
    maxDuration     : 500,
    dragThreshold   : 25,
    elasticity      : 0.5,
    swipeThreshold  : 0.125,
    prevButtonLabel : '&larr;',
    nextButtonLabel : '&rarr;'
  },

  // Rather than relying on the literal position of `this.film`,
  // we keep a tab on the current destination.
  x: 0,


  // ## Setup ##

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
    this.enableKeyboard();
    this.enableClick();
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

  // Prepare duplicate content at either end, for our cyclic behaviour.
  prepareCyclic: function() {
    if (!this.options.cyclic) return;

    var cloneL = this.film.clone(),
        cloneR = this.film.clone(),
        w = this.film.width();

    cloneL.prependTo(this.film).css({ position: 'absolute', left: -w + 'px' });
    cloneR.appendTo(this.film).css({ position: 'absolute', left: w + 'px' });
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

  // Create prev/next buttons and page bullets.
  createControls: function() {
    var self = this;

    this.controls = $('<span class="microfiche-controls" />').appendTo(this.el);
    this.controls.on('click', 'a, button', function(e) { self.didClickControl(e) });

    if (this.options.bullets) this.createBullets();
    if (this.options.buttons) this.createButtons();

    this.updateControls();
  },

  // Create page bullets.
  createBullets: function() {
    var container = $('<span class="microfiche-bullets" />').appendTo(this.controls);
    for (var i = 0; i < this.totalPageCount(); i++) {
      $('<button>')
      .addClass('microfiche-bullet')
      .attr('data-microfiche-page', i)
      .data('action', 'slideToPage')
      .data('arguments', [i])
      .html(i + 1)
      .appendTo(container);
    }
  },

  // Create prev/next buttons.
  createButtons: function() {
    $('<button>')
    .addClass('microfiche-button microfiche-prev-button')
    .attr('rel', 'prev')
    .data('action', 'prev')
    .data('arguments', [])
    .html(this.options.prevButtonLabel)
    .prependTo(this.controls);

    $('<button>')
    .addClass('microfiche-button microfiche-next-button')
    .attr('rel', 'next')
    .data('action', 'next')
    .data('arguments', [])
    .html(this.options.nextButtonLabel)
    .appendTo(this.controls);
  },

  // Add in the appropriate touch events. This requires a bit of scope-locking.
  enableTouch: function() {
    if (!this.options.swipe) return;

    var self = this;

    var thisTouchstart = this.touchstart,
        thisTouchmove = this.touchmove,
        thisTouchend = this.touchend;

    this.touchstart = function() { thisTouchstart.apply(self, arguments) };
    this.touchmove = function() { thisTouchmove.apply(self, arguments) };
    this.touchend = function() { thisTouchend.apply(self, arguments) };

    this.film.on('touchstart', this.touchstart);
  },

  // Add in left-right keyboard events.
  enableKeyboard: function() {
    if (!this.options.keyboard) return;

    var self = this;

    this.screen.attr('data-microfiche-keyboard', true);
    var thisOnkeydown = this.onkeydown;
    this.onkeydown = function() { thisOnkeydown.apply(self, arguments) };

    $(document).on('keydown', this.onkeydown);
  },

  // Add in mosuedown event.
  enableClick: function() {
    if (!this.options.clickToAdvance) return;

    var self = this;

    var thisOnmousedown = this.onmousedown;
    this.onmousedown = function() { thisOnmousedown.apply(self, arguments) };

    this.film.on('mousedown', this.onmousedown);
  },


  // ## User Event Handling ##

  // When anything in `this.controls` is clicked.
  didClickControl: function(e) {
    e.preventDefault();

    var control = $(e.target),
        action = control.data('action'),
        args = control.data('arguments');

    this[action].apply(this, args);
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
        this.slideByPages(1, vx);
      } else if (dx >= w * th) {
        this.slideByPages(-1, vx);
      } else {
        this.slideByPages(0);
      }
    }

  },

  // Slide centermost instance of microfiche left / right on key press.
  onkeydown: function(e) {
    if (e.keyCode !== 37 && e.keyCode !== 39 || !this.isCentral('[data-microfiche-keyboard]')) return;
    if (e.keyCode === 37) this.slideByPages(-1);
    else if (e.keyCode === 39) this.slideByPages(1);
  },

  // Advance microfiche on mousedown.
  onmousedown: function(e) {
    this.slideByPages(1);
  },

  // ## State Update ##

  // Enable/disable controls based on current position.
  updateControls: function() {
    if (this.options.bullets) this.updateBullets();
    if (this.options.buttons) this.updateButtons();
  },

  // Update selected state of bullets.
  updateBullets: function() {
    this.controls.find('.microfiche-bullet').removeClass('selected');
    this.controls.find('[data-microfiche-page="' + this.currentPageIndex() + '"]').addClass('selected');
  },

  // Update enabled state of prev/next buttons.
  updateButtons: function() {
    if (this.options.cyclic) return;
    this.controls.find('[rel="prev"]').attr('disabled', this.x <= this.min());
    this.controls.find('[rel="next"]').attr('disabled', this.x >= this.max());
  },


  // ## Helpers ##

  // Round `x` to a factor of `screenWidth`.
  round: function(x) {
    var w = this.screenWidth();
    return Math.round(x / w) * w;
  },

  // Return `x` constrained between limits `min` and `max`.
  constrain: function(x, min, max) {
    if (min === undefined) min = this.min();
    if (max === undefined) max = this.max();
    return Math.max(min, Math.min(x, max));
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

  // Returns the current page index.
  currentPageIndex: function() {
    return Math.round(this.x / this.screenWidth());
  },

  // Returns the number of pages.
  totalPageCount: function() {
    return Math.ceil(this.film.width() / this.screenWidth());
  },

  // Returns the width of the containing element.
  screenWidth: function() {
    return this.el.width();
  },

  // Returns true if this microfiche instance is closest to the center of the screen
  isCentral: function(selector) {

    var closest = $($(selector || '.microfiche-screen').sort(function(a,b){
      return Math.abs(1 - (($(window).scrollTop()+$(window).height()/2-$(a).height()/2) / $(a).offset().top)) - 
             Math.abs(1 - (($(window).scrollTop()+$(window).height()/2-$(b).height()/2) / $(b).offset().top))
    })[0]).parent().data('microfiche');

    return (closest === this);
  },

  // ## Internal Methods for Performing Transitions ##

  // Perform an instant transition to our new destination.
  jump: function() {
    this.el.trigger('microfiche:willMove');
    this.performJump();
    this.updateControls();
    this.el.trigger('microfiche:didMove');
  },

  // Default jump transform.
  performJump: function() {
    this.film.css({ left: -this.x });
  },

  // Sets up environment, but allows the real transition to be overridden.
  transition: function(duration) {
    var self = this;

    if (this.options.cyclic) this.handleWrappingTransition();

    if (duration == null) duration = this.options.duration;

    var callback = function() { self.afterTransition() };

    this.el.trigger('microfiche:willMove');

    setTimeout(function() {
      self.performTransition(duration, callback);
    });
  },

  // Handle what happens in cyclic mode if we’ve slipped off at either end.
  handleWrappingTransition: function() {
    if (this.x > this.max()) {
      this.x = this.min() - this.screenWidth();
      if (this.touchState && this.touchState.dx) this.x -= this.touchState.dx;
      this.jump();
      this.x = this.min();
      this.updateControls();
    } else if (this.x < this.min()) {
      this.x = this.max() + this.screenWidth();
      if (this.touchState && this.touchState.dx) this.x -= this.touchState.dx;
      this.jump();
      this.x = this.max();
      this.updateControls();
    }
  },

  // Default transition animation.
  performTransition: function(duration, callback) {
    this.film.stop().animate({ left: -this.x + 'px' }, duration, callback);
  },

  // Called when a transition finishes.
  afterTransition: function() {
    delete this.touchState;
    this.el.trigger('microfiche:didMove');
  },


  // ## Public API ##

  // Slides by `n` pages. If `n` is negative, it will slide in reverse.
  //
  // Also takes `vx`, which is the velocity on the x-axis. This is used
  // internally by the touch event handlers, but can be used to perform
  // a faster slide.
  slideByPages: function(n, vx) {
    var ox = this.x,
         w = this.screenWidth();

    this.x = this.constrain((Math.round(this.x / w) + n) * w);

    if (this.options.cyclic && this.x == ox) this.x += n * w;

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

  // Slides to the given `page`.
  slideToPage: function(page) {
    this.x = this.constrain(page * this.screenWidth());
    this.updateControls();
    this.transition();
  },

  // Animate to the given point (constrained to an acceptable value).
  slideToPoint: function(x) {
    this.x = this.roundAndConstrain(x);
    this.updateControls();
    this.transition();
  },

  // Jump to the given `page`
  jumpToPage: function(page) {
    this.x = this.constrain(page * this.screenWidth());
    this.updateControls();
    this.jump();
  },

  // Jump to the given point (constrained to an acceptable value).
  jumpToPoint: function(x) {
    this.x = this.roundAndConstrain(x);
    this.updateControls();
    this.jump();
  },

  // Slide to the previous screen’s-worth of slides.
  prev: function() {
    this.slideByPages(-1);
  },

  // Slide to the next screen’s-worth of slides.
  next: function() {
    this.slideByPages(1);
  },

  // Automatically call next every `n` seconds.
  autoplay: function(n) {
    if (this.autoplayTimeout) {
      clearTimeout(this.autoplayTimeout)
      delete this.autoplayTimeout;
    }

    n = +n;

    if (isNaN(n) || n <= 0) return;

    var self = this;
    this.autoplayTimeout = setTimeout(function() { self.next() }, n * 1000);
    this.el.one('microfiche:willMove', function() { self.autoplay(n) });
  },

  // Run given commands, for example:
  //
  //     microfiche.run({ slideByPages: 1 });
  //
  run: function(options) {
    for (var key in options) {
      var property = this[key];
      if ($.isFunction(property)) property.call(this, options[key]);
    }
  }

});

// ## WebKit Optimization ##
//
// A bit of feature detection for webkit transition support.
if (('WebKitCSSMatrix' in window && 'm11' in new WebKitCSSMatrix())) {
  // If we have webkit transition support, then override `prepareFilm`
  // and `transition` to take advantage of hardware acceleration.
  $.extend(Microfiche.prototype, {

    prepareFilm: function() {
      this.film.css({ WebkitTransform: 'translate3d(0px, 0px, 0px)' });
    },

    performTransition: function(duration, callback) {
      this.film.one('webkitTransitionEnd', callback).css({
        WebkitTransition: '-webkit-transform ' + duration + 'ms',
        WebkitTransform: 'translate3d(' + -this.x + 'px, 0px, 0px)'
      });
    },

    performJump: function() {
      this.film.css({
        WebkitTransition: '-webkit-transform 0ms',
        WebkitTransform: 'translate3d(' + -this.x + 'px, 0px, 0px)'
      });
    }

  });
}

// ## jQuery.fn.microfiche ##
//
// Creates microfiche elements and sends them commands.
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

