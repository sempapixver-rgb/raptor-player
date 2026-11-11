/* Navegação por controle remoto (D-pad e Magic Remote). */

var Focus = {

  KEYS: {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    ENTER: 13,
    BACK: 461
  },

  list: function (root) {
    var nodes = (root || document).querySelectorAll('.focusable');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.disabled) continue;
      if (node.getAttribute('aria-hidden') === 'true') continue;
      if (node.offsetParent === null) continue;
      var rect = node.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      out.push({ el: node, r: rect });
    }
    return out;
  },

  current: function () {
    var active = document.activeElement;
    if (active && active.classList && active.classList.contains('focusable')) return active;
    return null;
  },

  first: function (root) {
    var all = this.list(root);
    if (!all.length) return null;
    this.apply(all[0].el);
    return all[0].el;
  },

  apply: function (el) {
    if (!el) return;
    try {
      el.focus();
    } catch (e) { /* ignora */ }
  },

  /** Move o foco na direção pedida. */
  move: function (dir) {
    var cur = this.current();
    if (!cur) {
      this.first();
      return;
    }

    var c = cur.getBoundingClientRect();
    var all = this.list();
    var best = null;
    var bestScore = Infinity;

    var curCx = c.left + c.width / 2;
    var curCy = c.top + c.height / 2;

    for (var i = 0; i < all.length; i++) {
      var cand = all[i];
      if (cand.el === cur) continue;

      var r = cand.r;
      var score = Infinity;

      if (dir === 'left' && r.right <= c.left + 6) {
        score = (c.left - r.right) + 3 * Math.abs(r.top + r.height / 2 - curCy);
      } else if (dir === 'right' && r.left >= c.right - 6) {
        score = (r.left - c.right) + 3 * Math.abs(r.top + r.height / 2 - curCy);
      } else if (dir === 'up' && r.bottom <= c.top + 6) {
        score = (c.top - r.bottom) + 3 * Math.abs(r.left + r.width / 2 - curCx);
      } else if (dir === 'down' && r.top >= c.bottom - 6) {
        score = (r.top - c.bottom) + 3 * Math.abs(r.left + r.width / 2 - curCx);
      }

      if (score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    if (best) {
      this.apply(best.el);
      this.ensureVisible(best.el);
    }
  },

  ensureVisible: function (el) {
    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch (e) {
      try { el.scrollIntoView(false); } catch (e2) { /* ignora */ }
    }
  },

  /** Liga o foco automático ao passar o ponteiro do Magic Remote. */
  bindPointer: function () {
    document.addEventListener('mouseover', function (event) {
      var target = event.target;
      while (target && target !== document.body) {
        if (target.classList && target.classList.contains('focusable')) {
          if (document.activeElement !== target) {
            try { target.focus(); } catch (e) { /* ignora */ }
          }
          return;
        }
        target = target.parentNode;
      }
    }, false);
  }
};

/** Troca de tela com pilha de foco. */
var Screens = {

  stack: [],

  show: function (id) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.add('hidden');
    }
    var target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
    return target;
  },

  pushFocus: function () {
    this.stack.push(Focus.current());
  },

  popFocus: function () {
    var el = this.stack.pop();
    if (el) {
      setTimeout(function () {
        try { el.focus(); } catch (e) { /* ignora */ }
      }, 30);
      return true;
    }
    return false;
  }
};
