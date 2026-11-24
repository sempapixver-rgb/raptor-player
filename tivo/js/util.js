/* General app utilities. */

function $(id) {
  return document.getElementById(id);
}

function show(el) {
  if (el) el.classList.remove('hidden');
}

function hide(el) {
  if (el) el.classList.add('hidden');
}

function toggle(el, on) {
  if (!el) return;
  if (on) show(el); else hide(el);
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only A-Z and 0-9, as expected by the website. */
function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Code in MAC format (AA:BB:CC:DD:EE:FF). */
function formatMac(code) {
  var clean = normalizeCode(code).slice(0, 12);
  var out = [];
  for (var i = 0; i < clean.length; i += 2) {
    out.push(clean.substr(i, 2));
  }
  return out.join(':');
}

/** Lowercase, no accents and no punctuation — for text comparison. */
function fold(value) {
  var lower = String(value || '').toLowerCase();
  if (lower.normalize) {
    lower = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  return lower.replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, '');
}

/** Compares names alphabetically, with natural number order (2 before 10). */
function compareNames(a, b) {
  var ka = fold(a && a.name);
  var kb = fold(b && b.name);
  if (!ka) return kb ? 1 : 0;
  if (!kb) return -1;

  var pa = ka.split(' ');
  var pb = kb.split(' ');
  var len = Math.min(pa.length, pb.length);
  for (var i = 0; i < len; i++) {
    var xa = pa[i];
    var xb = pb[i];
    if (xa === xb) continue;

    var na = /^\d+$/.test(xa);
    var nb = /^\d+$/.test(xb);
    if (na && nb) {
      var da = parseInt(xa, 10);
      var db = parseInt(xb, 10);
      if (da !== db) return da - db;
    } else if (na) {
      return -1;
    } else if (nb) {
      return 1;
    }
    return xa < xb ? -1 : 1;
  }
  return pa.length - pb.length;
}

/** Copy of the items in alphabetical order (does not change the original). */
function sortByName(list) {
  if (!list || !list.length) return list || [];
  var copy = list.slice();
  copy.sort(compareNames);
  return copy;
}

function fmtTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  var total = Math.floor(seconds);
  var h = Math.floor(total / 3600);
  var m = Math.floor((total % 3600) / 60);
  var s = total % 60;
  var mm = (m < 10 ? '0' : '') + m;
  var ss = (s < 10 ? '0' : '') + s;
  return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
}

var toastTimer = null;

function toast(message) {
  var box = $('toast');
  if (!box) return;
  box.textContent = message;
  show(box);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    hide(box);
  }, 3200);
}

/** Removes all children of an element. */
function clear(node) {
  while (node && node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

/** Creates an element with a class and text. */
function make(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Creates an already focusable <button>. */
function makeButton(className, text) {
  var node = make('button', className + ' focusable', text);
  node.setAttribute('tabindex', '0');
  node.type = 'button';
  return node;
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/**
 * Image queue (covers and logos).
 *
 * A TV cannot handle 60 image requests at once: the browser opens all
 * connections, the network saturates and the app looks frozen. Here we load
 * at most 4 at a time, and the old queue is discarded on page changes.
 */
var Thumbs = {

  MAX: 4,
  running: 0,
  queue: [],
  gen: 0,

  /** Discards items not started yet (page/folder change). */
  reset: function () {
    this.gen++;
    this.queue.length = 0;
  },

  /** Applies the image to the element when it is ready. */
  set: function (el, url) {
    if (!el) return;
    var clean = String(url || '').replace(/"/g, '%22');
    if (!clean) return;
    var css = 'url("' + clean + '")';
    if (el._thumbUrl === css) return;
    el._thumbUrl = css;

    var gen = this.gen;
    this.queue.push({ gen: gen, el: el, css: css, src: clean });
    this.next();
  },

  next: function () {
    var self = this;
    while (this.running < this.MAX && this.queue.length) {
      var job = this.queue.shift();
      if (job.gen !== this.gen) continue;
      this.running++;
      (function (item) {
        var img = new Image();
        var done = false;
        function finish() {
          if (done) return;
          done = true;
          self.running--;
          // Only paint if the element still wants this image.
          if (item.el._thumbUrl === item.css) item.el.style.backgroundImage = item.css;
          self.next();
        }
        img.onload = finish;
        img.onerror = finish;
        img.src = item.src;
      })(job);
    }
  }
};
