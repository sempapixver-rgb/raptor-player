/* Remote-control navigation (D-pad and Magic Remote). */

var Focus = {

  KEYS: {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    ENTER: 13,
    BACK: 461,
    BACK_ALT: 10009,
    BACK_VEWD: 8,
    BACK_ESC: 27
  },

  isBack: function (code) {
    if (code === this.KEYS.BACK || code === this.KEYS.BACK_ALT ||
        code === this.KEYS.BACK_VEWD || code === this.KEYS.BACK_ESC) return true;
    // Vewd Core exposes VK_BACK when the platform supplies a custom code.
    return !!(window.VK_BACK && code === window.VK_BACK);
  },

  list: function (root) {
    var nodes = (root || document).querySelectorAll('.focusable');
    var out = [];
    var vw = window.innerWidth || 1920;
    var vh = window.innerHeight || 1080;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.disabled) continue;
      if (node.getAttribute('aria-hidden') === 'true') continue;
      if (node.offsetParent === null) continue;
      var rect = node.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      // Off-screen items do not receive focus (avoids jumps to the hidden menu).
      if (rect.bottom <= 0 || rect.top >= vh || rect.right <= 0 || rect.left >= vw) continue;
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
    } catch (e) { /* ignore */ }
  },

  /** Moves focus in the requested direction. */
  move: function (dir) {
    var cur = this.current();
    if (!cur) {
      this.first();
      return;
    }

    var c = cur.getBoundingClientRect();
    var all = this.list();

    // From the search field, "down" goes to the first result.
    if (dir === 'down' && cur.id === 'searchInput' && window.App && App.focusFirstResult) {
      App.focusFirstResult();
      return;
    }

    var horizontal = dir === 'left' || dir === 'right';
    var best = null;
    var bestScore = Infinity;
    var loose = null;
    var looseScore = Infinity;

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

      if (score === Infinity) continue;

      // Left/right only accept candidates on the same vertical band:
      // otherwise "right" jumped from the items to the top search field.
      var alinhado = horizontal
        ? (r.bottom > c.top + 4 && r.top < c.bottom - 4)
        : (r.right > c.left + 4 && r.left < c.right - 4);

      if (alinhado) {
        if (score < bestScore) { bestScore = score; best = cand; }
      } else if (score < looseScore) {
        looseScore = score;
        loose = cand;
      }
    }

    // Horizontally only the aligned neighbor counts (avoids jumps to the top).
    // Up within items/categories also rejects a "loose jump":
    // if there is no item above, the search-bar shortcut handles it.
    var semSalto = horizontal ||
      (dir === 'up' && cur.closest && (cur.closest('#items') || cur.closest('#cats')));
    var chosen = best || (semSalto ? null : loose);

    if (chosen) {
      this.apply(chosen.el);
      this.ensureVisible(chosen.el);
      return;
    }

    // Up with no item above: go straight to the search bar
    // at the top of the screen (whether in items or categories).
    if (dir === 'up' && cur.closest && (cur.closest('#items') || cur.closest('#cats'))) {
      var busca = $('searchInput');
      if (busca && busca.offsetParent !== null) {
        this.apply(busca);
        this.ensureVisible(busca);
        return;
      }
    }

    // Left from the preview: return to the selected item.
    if (dir === 'left' && cur.closest && cur.closest('#previewPane')) {
      var linha = document.querySelector('#items .item-row.selected, #items .card-item.selected') ||
        document.querySelector('#items .item-row, #items .card-item');
      if (linha) {
        this.apply(linha);
        this.ensureVisible(linha);
        return;
      }
    }

    // Right from the items: enter the preview (even at another height).
    if (dir === 'right' && cur.closest && cur.closest('#items')) {
      var pane = $('previewPane');
      if (pane && !pane.classList.contains('hidden')) {
        var alvo = pane.querySelector('.preview-star.focusable') || pane.querySelector('.focusable');
        if (alvo) {
          this.apply(alvo);
          this.ensureVisible(alvo);
          return;
        }
      }
    }

    // Esquerda a partir dos itens: volta para o painel de categorias.
    if (dir === 'left' && cur.closest && cur.closest('#items')) {
      var painel = document.querySelector('#cats .panel-item.active') ||
        document.querySelector('#cats .panel-item');
      if (painel) {
        this.apply(painel);
        this.ensureVisible(painel);
        return;
      }
    }

    // There is no bottom menu: each tab is a closed environment, and
    // to leave it the user presses Back (returns to the main menu).
  },
  ensureVisible: function (el) {
    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch (e) {
      try { el.scrollIntoView(false); } catch (e2) { /* ignore */ }
    }
  },

  /** Enables automatic focus when the Magic Remote pointer passes over. */
  bindPointer: function () {
    document.addEventListener('mouseover', function (event) {
      var target = event.target;
      while (target && target !== document.body) {
        if (target.classList && target.classList.contains('focusable')) {
          // Bottom-menu tabs do not receive focus on pointer hover:
          // the tab changes only on click (or OK on the D-pad).
          if (target.getAttribute('data-nohover') === 'true') return;
          if (document.activeElement !== target) {
            try { target.focus(); } catch (e) { /* ignore */ }
          }
          return;
        }
        target = target.parentNode;
      }
    }, false);
  }
};

/** Screen switching with a focus stack. */
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
        try { el.focus(); } catch (e) { /* ignore */ }
      }, 30);
      return true;
    }
    return false;
  }
};
