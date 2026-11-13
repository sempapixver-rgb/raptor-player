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
    var vw = window.innerWidth || 1920;
    var vh = window.innerHeight || 1080;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.disabled) continue;
      if (node.getAttribute('aria-hidden') === 'true') continue;
      if (node.offsetParent === null) continue;
      var rect = node.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      // Itens fora da tela não recebem foco (evita pulos para o menu escondido).
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

    // Do campo de busca, "baixo" vai para o primeiro resultado da lista.
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

      // Esquerda/direita só aceitam quem está na mesma faixa vertical:
      // sem isso, "direita" pulava da lista para o campo de busca do topo.
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

    // Na horizontal só vale o vizinho alinhado (evita saltos para o topo).
    // Para cima, dentro da lista/categorias, também não vale "salto solto":
    // se não há item acima, o atalho da barra de busca abaixo resolve.
    var semSalto = horizontal ||
      (dir === 'up' && cur.closest && (cur.closest('#items') || cur.closest('#cats')));
    var chosen = best || (semSalto ? null : loose);

    if (chosen) {
      this.apply(chosen.el);
      this.ensureVisible(chosen.el);
      return;
    }

    // Para cima quando não há mais item acima: vai direto para a barra de
    // busca no topo da tela (não importa se está na lista ou nas categorias).
    if (dir === 'up' && cur.closest && (cur.closest('#items') || cur.closest('#cats'))) {
      var busca = $('searchInput');
      if (busca && busca.offsetParent !== null) {
        this.apply(busca);
        this.ensureVisible(busca);
        return;
      }
    }

    // Esquerda a partir da prévia: volta para o item selecionado da lista.
    if (dir === 'left' && cur.closest && cur.closest('#previewPane')) {
      var linha = document.querySelector('#items .channel-row.selected, #items .card-item.selected') ||
        document.querySelector('#items .channel-row, #items .card-item');
      if (linha) {
        this.apply(linha);
        this.ensureVisible(linha);
        return;
      }
    }

    // Direita a partir da lista: entra na prévia (mesmo em outra altura).
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

    // Esquerda a partir da lista: volta para o painel de categorias.
    if (dir === 'left' && cur.closest && cur.closest('#items')) {
      var painel = document.querySelector('#cats .panel-item.active') ||
        document.querySelector('#cats .panel-item');
      if (painel) {
        this.apply(painel);
        this.ensureVisible(painel);
        return;
      }
    }

    // Atalho para o menu de abas: no painel de categorias (coluna da
    // esquerda) não existe nada mais à esquerda, então "esquerda" leva
    // direto para Canais / Filmes / Séries / Ajustes.
    if (dir === 'left' && cur.closest && cur.closest('#cats')) {
      var nav = document.querySelector('.nav-item.active') || document.querySelector('.nav-item');
      if (nav) {
        this.apply(nav);
        this.ensureVisible(nav);
      }
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
          // Abas do menu inferior não recebem foco ao passar o ponteiro:
          // a aba só troca quando o usuário clica (ou aperta OK no D-pad).
          if (target.getAttribute('data-nohover') === 'true') return;
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
