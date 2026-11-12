/* Reptor Player — webOS. Controlador principal. */

var APP_VERSION = '1.0.7';

/* Itens por página: evita milhares de elementos na memória da TV. */
var PAGE_SIZE = 60;

var App = {

  session: null,
  source: null,
  section: MediaKind.LIVE,
  activeCat: null,
  filter: 'all',
  catCache: {},
  itemCache: {},
  cacheOrder: [],
  page: 0,
  currentList: [],
  detail: null,
  detailItem: null,
  infoReturn: null,

  selected: null,
  previewUrl: null,
  epgPrograms: null,
  epgToken: 0,
  epgTimer: null,

  playing: null,
  playingSeason: null,
  playingEpIndex: -1,
  vodCache: {},
  vodToken: 0,

  code: null,
  pollTimer: null,
  pollTries: 0,
  pollBusy: false,

  /* =============================================================== boot */

  init: function () {
    this.bindKeys();
    Focus.bindPointer();
    this.startClock();

    var self = this;
    $('btnAccept').addEventListener('click', function () {
      Store.acceptTerms();
      if (self.session) self.openSettings();
      else self.boot();
    });

    this.bindLogin();
    this.bindSettings();
    this.bindPreview();

    $('btnRefresh').addEventListener('click', function () {
      self.reloadContent();
    });

    if (!Store.termsAccepted()) {
      Screens.show('screen-terms');
      Focus.first($('screen-terms'));
    } else {
      this.boot();
    }
  },

  boot: function () {
    var session = Store.session();
    if (session) {
      this.enterHome(session);
    } else {
      this.showLogin();
    }
  },

  startClock: function () {
    var self = this;
    function tick() {
      var now = new Date();
      var text = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
      var clock = $('clock');
      if (clock) clock.textContent = text;
    }
    tick();
    setInterval(tick, 15000);
  },

  /* ============================================================ teclado */

  bindKeys: function () {
    var self = this;

    document.addEventListener('keydown', function (event) {
      var code = event.keyCode;

      if (code === 461) {
        event.preventDefault();
        self.back();
        return;
      }

      var active = document.activeElement;

      // Termos de uso: as setas rolam o texto; no fim, o foco desce para o botão.
      if (active && active.id === 'termsScroll' && (code === 38 || code === 40)) {
        event.preventDefault();
        if (code === 40) {
          if (active.scrollTop + active.clientHeight >= active.scrollHeight - 2) Focus.move('down');
          else active.scrollTop += 90;
        } else {
          if (active.scrollTop <= 0) Focus.move('up');
          else active.scrollTop -= 90;
        }
        return;
      }

      // Player com a barra escondida: a primeira tecla só mostra os controles.
      if (self.isPlayerOpen() && $('playerOverlay').classList.contains('hidden') &&
          (code === 13 || code === 37 || code === 38 || code === 39 || code === 40)) {
        event.preventDefault();
        Player.showOverlay();
        Player.scheduleHide();
        return;
      }

      if (code === 37 || code === 38 || code === 39 || code === 40) {
        event.preventDefault();
        Focus.move(code === 37 ? 'left' : code === 39 ? 'right' : code === 38 ? 'up' : 'down');
        return;
      }

      if (code === 13) {
        var active = document.activeElement;
        var tag = active && active.tagName ? active.tagName.toUpperCase() : '';
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A') return;
        if (active && active.classList && active.classList.contains('focusable')) {
          event.preventDefault();
          active.click();
        }
        return;
      }

      if (!self.isPlayerOpen()) return;

      if (code === 415) { event.preventDefault(); Player.play(); }
      else if (code === 19) { event.preventDefault(); Player.pause(); }
      else if (code === 417) { event.preventDefault(); Player.seek(30); }
      else if (code === 412) { event.preventDefault(); Player.seek(-30); }
      else if (code === 413) { event.preventDefault(); self.closePlayer(); }
    }, false);
  },

  back: function () {
    if (this.isPlayerOpen()) {
      this.closePlayer();
      return;
    }
    if (!$('infoModal').classList.contains('hidden')) {
      this.closeInfo();
      return;
    }
    if (!$('screen-terms').classList.contains('hidden')) {
      if (this.session) this.openSettings();
      else this.exitApp();
      return;
    }
    if (!$('screen-detail').classList.contains('hidden')) {
      this.goHome();
      return;
    }
    if (!$('screen-settings').classList.contains('hidden')) {
      this.goHome();
      return;
    }
    if (!$('screen-home').classList.contains('hidden')) {
      this.exitApp();
      return;
    }
    this.exitApp();
  },

  exitApp: function () {
    try {
      if (window.webOS && webOS.platformBack) {
        webOS.platformBack();
        return;
      }
    } catch (e) { /* ignora */ }
    toast('Use o botão Voltar da TV para sair.');
  },

  isPlayerOpen: function () {
    return !$('screen-player').classList.contains('hidden');
  },

  /* ============================================================== login */

  bindLogin: function () {
    var self = this;

    var tabs = $('loginTabs').getElementsByTagName('button');
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        tab.addEventListener('click', function () {
          self.setLoginMode(tab.getAttribute('data-mode'));
        });
      })(tabs[i]);
    }

    $('btnCheck').addEventListener('click', function () {
      self.checkNow();
    });

    $('loginForm').addEventListener('submit', function (event) {
      event.preventDefault();
      self.submitLogin();
    });
  },

  loginMode: 'XTREAM',

  setLoginMode: function (mode) {
    this.loginMode = mode;
    var tabs = $('loginTabs').getElementsByTagName('button');
    for (var i = 0; i < tabs.length; i++) {
      var tab = tabs[i];
      if (tab.getAttribute('data-mode') === mode) tab.classList.add('active');
      else tab.classList.remove('active');
    }
    var xtream = mode === 'XTREAM';
    toggle($('fieldHost'), xtream);
    toggle($('fieldUser'), xtream);
    toggle($('fieldPass'), xtream);
    toggle($('fieldM3u'), !xtream);
    $('loginError').textContent = '';
  },

  showLogin: function () {
    var self = this;
    Screens.show('screen-login');
    this.stopPolling();
    this.renderSaved();

    Device.code().then(function (code) {
      self.code = code;
      self.renderActivation(code);
      self.startPolling();
      var active = document.activeElement;
      if (!active || active === document.body) {
        try { $('btnCheck').focus(); } catch (e) { /* ignora */ }
      }
    });

    setTimeout(function () {
      var active = document.activeElement;
      if (!active || active === document.body) {
        try { $('inHost').focus(); } catch (e) { /* ignora */ }
      }
    }, 80);
  },

  renderActivation: function (code) {
    $('macCode').textContent = code;
    $('siteUrl').textContent = Activation.SITE_BASE.replace(/^https?:\/\//, '');

    var holder = $('qrHolder');
    clear(holder);
    try {
      new QRCode(holder, {
        text: Activation.siteLink(code),
        width: 212,
        height: 212,
        colorDark: '#0B0F0C',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      holder.textContent = 'QR indisponível';
    }
  },

  setStatus: function (text, state) {
    var box = $('actStatus');
    box.className = 'status' + (state ? ' ' + state : '');
    $('actStatusText').textContent = text;
  },

  startPolling: function () {
    var self = this;
    this.stopPolling();
    this.pollTries = 0;

    function schedule() {
      var delay = self.pollTries < 20 ? 5000 : 20000;
      self.pollTimer = setTimeout(function () {
        self.pollTries++;
        self.checkActivation(false);
        schedule();
      }, delay);
    }
    schedule();
  },

  stopPolling: function () {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  },

  checkNow: function () {
    this.checkActivation(true);
  },

  checkActivation: function (manual) {
    var self = this;
    if (!this.code || this.pollBusy) return;

    this.pollBusy = true;
    if (manual) this.setStatus('Verificando…', '');

    Activation.fetch(this.code).then(function (session) {
      self.pollBusy = false;
      if (session) {
        self.stopPolling();
        self.setStatus('Ativado! Abrindo…', 'ok');
        Store.setSession(session);
        Store.saveList(session);
        toast('TV ativada. Bem-vindo!');
        setTimeout(function () { self.enterHome(session); }, 900);
      } else {
        self.setStatus('Aguardando ativação…', '');
        if (manual) toast('Ainda não há ativação para este código.');
      }
    }, function () {
      self.pollBusy = false;
      if (manual) {
        self.setStatus('Site indisponível. Tentando de novo…', 'err');
      }
    });
  },

  renderSaved: function () {
    var box = $('savedBox');
    var list = Store.savedLists();
    var holder = $('savedList');
    clear(holder);

    if (!list.length) {
      hide(box);
      return;
    }

    var self = this;
    for (var i = 0; i < list.length; i++) {
      (function (session) {
        var button = makeButton('saved-item', sessionName(session));
        button.addEventListener('click', function () {
          Store.setSession(session);
          self.enterHome(session);
        });
        holder.appendChild(button);
      })(list[i]);
    }
    show(box);
  },

  submitLogin: function () {
    var self = this;
    var error = $('loginError');
    error.textContent = '';

    var session;

    if (this.loginMode === 'M3U') {
      var link = $('inM3u').value.trim();
      if (!link) {
        error.textContent = 'Informe o link da lista M3U.';
        return;
      }
      session = { mode: 'M3U', m3uUrl: normalizeRemoteUrl(link), baseUrl: '', username: '', password: '', label: '' };
    } else {
      var host = normalizeBase($('inHost').value);
      var user = $('inUser').value.trim();
      var pass = $('inPass').value;
      if (!host || !user || !pass) {
        error.textContent = 'Preencha servidor, usuário e senha.';
        return;
      }
      session = { mode: 'XTREAM', baseUrl: host, username: user, password: pass, m3uUrl: '', label: '' };
    }

    error.textContent = 'Conectando…';

    var source = createSource(session);
    source.check().then(function (message) {
      if (message) {
        error.textContent = message;
        return;
      }
      Store.setSession(session);
      Store.saveList(session);
      self.enterHome(session);
    }, function (err) {
      error.textContent = 'Falha: ' + (err.message || 'erro de rede');
    });
  },

  /* =============================================================== home */

  enterHome: function (session) {
    this.stopPolling();
    this.session = session;
    this.source = createSource(session);
    this.catCache = {};
    this.itemCache = {};
    this.cacheOrder = [];
    this.page = 0;
    this.currentList = [];
    this.selected = null;
    this.epgPrograms = null;
    this.epgToken++;
    this.stopPreview();

    Screens.show('screen-home');
    this.renderNav();
    this.setSection(MediaKind.LIVE);
    this.preload();
  },

  /** Recarrega categorias e itens (botão ⟳ Atualizar do topo). */
  reloadContent: function () {
    this.catCache = {};
    this.itemCache = {};
    this.cacheOrder = [];
    this.page = 0;
    this.currentList = [];
    toast('Conteúdo recarregado.');
    this.setSection(this.section);
  },

  /**
   * Adianta as pastas das outras abas (respostas pequenas do servidor).
   * Assim Canais, Filmes e Séries abrem sem "Carregando…".
   */
  preload: function () {
    var self = this;
    if (!this.source || !this.source.categories) return;
    var kinds = [MediaKind.VOD, MediaKind.SERIES];
    for (var i = 0; i < kinds.length; i++) {
      (function (kind) {
        if (self.catCache[kind]) return;
        self.source.categories(kind).then(function (list) {
          self.catCache[kind] = list || [];
        }, function () { /* ignora */ });
      })(kinds[i]);
    }
  },

  goHome: function () {
    Screens.show('screen-home');
    setTimeout(function () {
      var active = document.querySelector('.nav-item.active');
      if (active) { try { active.focus(); } catch (e) { /* ignora */ } }
    }, 40);
    // Ao voltar do player, religa a prévia do canal escolhido.
    var self = this;
    setTimeout(function () {
      if (self.section === MediaKind.LIVE && self.selected) {
        self.renderPreview(self.selected);
      }
    }, 350);
  },

  /** Menu inferior, igual ao app Android. */
  renderNav: function () {
    var self = this;
    var nav = $('bottomnav');
    clear(nav);

    var entries = [
      { kind: MediaKind.LIVE, label: 'Canais' },
      { kind: MediaKind.VOD, label: 'Filmes' },
      { kind: MediaKind.SERIES, label: 'Séries' },
      { action: 'settings', label: 'Ajustes' }
    ];

    for (var i = 0; i < entries.length; i++) {
      (function (entry) {
        var button = makeButton('nav-item focusable', entry.label);
        button.setAttribute('data-kind', entry.kind || entry.action || '');
        // O ponteiro do Magic Remote não foca as abas: só troca ao clicar.
        button.setAttribute('data-nohover', 'true');
        if (entry.kind === self.section) button.classList.add('active');

        button.addEventListener('click', function () {
          if (entry.kind) self.setSection(entry.kind);
          else self.openSettings();
        });

        nav.appendChild(button);
      })(entries[i]);
    }
  },

  setSection: function (kind) {
    var self = this;
    this.section = kind;
    this.activeCat = null;
    this.filter = 'all';
    this.page = 0;
    this.currentList = [];
    this.selected = null;
    this.epgPrograms = null;
    this.epgToken++;
    this.stopPreview();

    // Em Séries a tela de detalhe já mostra tudo: a prévia lateral sobra.
    toggle($('previewPane'), kind !== MediaKind.SERIES);

    var navItems = document.querySelectorAll('.nav-item');
    for (var i = 0; i < navItems.length; i++) {
      if (navItems[i].getAttribute('data-kind') === kind) navItems[i].classList.add('active');
      else navItems[i].classList.remove('active');
    }

    $('tabTitle').textContent = kind === MediaKind.LIVE ? 'Canais'
      : kind === MediaKind.VOD ? 'Filmes' : 'Séries';
    $('tabSub').textContent = this.session ? sessionName(this.session) : '';
    $('panelLabel').textContent = 'CATEGORIAS';

    hide($('emptyState'));
    show($('loading'));

    if (this.catCache[kind]) {
      this.renderCats(this.catCache[kind]);
      this.afterCats(kind, this.catCache[kind]);
      return;
    }

    this.source.categories(kind).then(function (list) {
      self.catCache[kind] = list || [];
      self.renderCats(self.catCache[kind]);
      self.afterCats(kind, self.catCache[kind]);
    }, function () {
      self.renderCats([]);
      self.afterCats(kind, []);
    });
  },

  /** Depois das pastas: escolhe a primeira quando não existe "Tudo". */
  afterCats: function (kind, list) {
    if (kind === MediaKind.LIVE) {
      this.selectCat(null);
      return;
    }
    // Nunca pedir "todos os filmes/séries": são mais de 8 MB e derrubam a TV.
    if (!list || !list.length) {
      this.currentList = [];
      this.renderItems([]);
      return;
    }
    this.selectCat(list[0].id);
  },

  renderCats: function (list) {
    var self = this;
    var holder = $('cats');
    clear(holder);

    holder.appendChild(this.panelItem('Tudo', null,
      this.filter === 'all' && this.activeCat === null,
      function () { self.selectFilter('all'); }));

    holder.appendChild(this.panelItem('Favoritos', Store.favorites().length,
      this.filter === 'favorites',
      function () { self.selectFilter('favorites'); }));

    holder.appendChild(this.panelItem('Visto recentemente', Store.recents().length,
      this.filter === 'recents',
      function () { self.selectFilter('recents'); }));

    // "Tudo" só nos canais. Em filmes/séries a lista completa passa de
    // 8 MB e não cabe na memória da TV: o usuário escolhe a pasta.
    for (var i = 0; i < list.length; i++) {
      (function (cat) {
        var item = self.panelItem(cat.name, null, false,
          function () { self.selectCat(cat.id); });
        item.setAttribute('data-cat', cat.id);
        holder.appendChild(item);
      })(list[i]);
    }

    this.markPanel();
  },

  /** Item do painel lateral (Tudo, Favoritos, Recentes ou uma pasta). */
  panelItem: function (label, count, selected, onClick) {
    var button = makeButton('panel-item', '');
    button.appendChild(make('span', 'label', label));
    if (count) button.appendChild(make('span', 'count', String(count)));
    if (selected) button.classList.add('active');
    button.addEventListener('click', onClick);
    return button;
  },

  selectFilter: function (filter) {
    this.filter = filter;
    this.activeCat = null;
    this.page = 0;
    this.markPanel();
    this.loadItems(null);
  },

  selectCat: function (catId) {
    this.filter = 'all';
    this.activeCat = catId;
    this.page = 0;
    this.markPanel();
    this.loadItems(catId);
  },

  /** Marca no painel o item que está ativo. */
  markPanel: function () {
    var buttons = $('cats').getElementsByTagName('button');
    for (var i = 0; i < buttons.length; i++) {
      var label = buttons[i].getElementsByTagName('span')[0];
      var name = label ? label.textContent : '';
      var catId = buttons[i].getAttribute('data-cat') || '';
      var on = false;

      if (name === 'Tudo') on = this.filter === 'all' && this.activeCat === null;
      else if (name === 'Favoritos') on = this.filter === 'favorites';
      else if (name === 'Visto recentemente') on = this.filter === 'recents';
      else on = this.filter === 'all' && (this.activeCat || '') === catId;

      if (on) buttons[i].classList.add('active');
      else buttons[i].classList.remove('active');
    }
  },

  loadItems: function (catId) {
    var self = this;
    var key = this.section + '|' + (catId || '');
    this.page = 0;
    show($('loading'));
    hide($('emptyState'));

    if (this.filter !== 'all') {
      var saved = this.filter === 'favorites' ? Store.favorites() : Store.recents();
      var list = [];
      for (var i = 0; i < saved.length; i++) {
        if (saved[i].kind === this.section) list.push(saved[i]);
      }
      // Favoritos seguem a ordenação escolhida; "recentes" fica por data de uso.
      if (this.filter === 'favorites' && Store.sortMode() === 'az') list = sortByName(list);
      this.currentList = list;
      this.renderItems(list);
      return;
    }

    if (this.itemCache[key]) {
      this.currentList = this.itemCache[key];
      this.renderItems(this.currentList);
      return;
    }

    this.source.items(this.section, catId).then(function (list) {
      list = list || [];
      if (Store.sortMode() === 'az') list = sortByName(list);
      self.itemCache[key] = list;
      self.cacheOrder.push(key);
      self.trimCache();
      self.currentList = self.itemCache[key];
      self.renderItems(self.currentList);
    }, function (err) {
      hide($('loading'));
      $('emptyState').classList.remove('hidden');
      $('emptyState').querySelector('.empty-sub').textContent = err.message || 'Falha ao carregar.';
    });
  },

  /** Mantém no máximo 8 pastas em memória (TV tem pouca RAM). */
  trimCache: function () {
    while (this.cacheOrder.length > 8) {
      var old = this.cacheOrder.shift();
      if (old !== this.section + '|' + (this.activeCat || '')) delete this.itemCache[old];
    }
  },

  goPage: function (delta) {
    var total = Math.ceil(this.currentList.length / PAGE_SIZE);
    var next = this.page + delta;
    if (next < 0 || next >= total) return;
    this.page = next;
    this.renderItems(this.currentList, true);
    try { $('items').scrollTop = 0; } catch (e) { /* ignora */ }
  },

  renderItems: function (list, keepPage, skipAutoSelect) {
    var self = this;
    var holder = $('items');
    clear(holder);
    hide($('loading'));

    if (!list || !list.length) {
      show($('emptyState'));
      var title = 'Nada por aqui ainda';
      var sub = 'Escolha outra pasta na lista ao lado.';
      if (this.filter === 'favorites') {
        title = 'Nenhum favorito ainda';
        sub = 'Aperte a estrela ☆ de um item para salvar aqui.';
      } else if (this.filter === 'recents') {
        title = 'Nada visto ainda';
        sub = 'Os itens que você abrir aparecem nesta lista.';
      }
      $('emptyState').querySelector('.empty-title').textContent = title;
      $('emptyState').querySelector('.empty-sub').textContent = sub;
      return;
    }

    hide($('emptyState'));

    if (!keepPage) this.page = 0;
    var total = Math.ceil(list.length / PAGE_SIZE);
    if (this.page >= total) this.page = total - 1;
    if (this.page < 0) this.page = 0;

    var start = this.page * PAGE_SIZE;
    var end = Math.min(start + PAGE_SIZE, list.length);

    var frag = document.createDocumentFragment();
    for (var i = start; i < end; i++) {
      frag.appendChild(this.section === MediaKind.LIVE
        ? this.buildChannelRow(list[i], i)
        : this.buildCard(list[i]));
    }
    holder.appendChild(frag);

    if (total > 1) holder.appendChild(this.buildPager(total));

    // Só move o foco quando a home está visível (recarga em segundo plano
    // não deve roubar o foco dos Ajustes).
    if (!$('screen-home').classList.contains('hidden')) {
      var first = holder.querySelector('.card-item, .channel-row');
      if (first) {
        try { first.focus(); } catch (e) { /* ignora */ }
      }
    }

    // Como no Android, o primeiro item já aparece na prévia lateral.
    if (!skipAutoSelect && this.section !== MediaKind.SERIES && list[start] &&
        !$('screen-home').classList.contains('hidden')) {
      this.selectEntry(list[start], true);
    }
  },

  /** Linha de canal: número, logo, nome e estrela. */
  buildChannelRow: function (entry, index) {
    var self = this;
    var row = make('div', 'channel-row focusable');
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'button');
    row.setAttribute('data-id', entry.id);

    row.appendChild(make('span', 'num', String(index + 1)));

    var logo = make('span', 'logo');
    if (entry.logo) {
      logo.style.backgroundImage = 'url("' + String(entry.logo).replace(/"/g, '%22') + '")';
    }
    row.appendChild(logo);

    row.appendChild(make('span', 'name', entry.name));

    var favorite = Store.isFavorite(entry);
    var star = make('span', 'star focusable', favorite ? '★' : '☆');
    star.setAttribute('tabindex', '0');
    star.style.color = favorite ? '#FFC107' : '#A8C2B0';
    star.addEventListener('click', function (event) {
      if (event && event.stopPropagation) event.stopPropagation();
      var now = Store.toggleFavorite(entry);
      star.textContent = now ? '★' : '☆';
      star.style.color = now ? '#FFC107' : '#A8C2B0';
      toast(now ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.');
    });
    row.appendChild(star);

    row.addEventListener('click', function () {
      if (self.selected && self.selected.id === entry.id) self.playEntry(entry);
      else self.selectEntry(entry);
    });

    return row;
  },

  /** Barra "Voltar / Próximo" entre as páginas da pasta. */
  buildPager: function (total) {
    var self = this;
    var row = make('div', 'pager');

    var prev = makeButton('pager-btn', '◀ Voltar');
    prev.setAttribute('data-page', 'prev');
    if (this.page === 0) prev.disabled = true;
    prev.addEventListener('click', function () {
      self.goPage(-1);
    });

    var label = make('span', 'pager-info', 'Página ' + (this.page + 1) + ' de ' + total);

    var next = makeButton('pager-btn', 'Próximo ▶');
    next.setAttribute('data-page', 'next');
    if (this.page >= total - 1) next.disabled = true;
    next.addEventListener('click', function () {
      self.goPage(1);
    });

    row.appendChild(prev);
    row.appendChild(label);
    row.appendChild(next);
    return row;
  },

  /* ======================================================= prévia lateral */

  bindPreview: function () {
    var self = this;

    $('btnWatch').addEventListener('click', function () {
      if (self.selected) self.playEntry(self.selected);
    });

    $('btnPrevItem').addEventListener('click', function () { self.stepItem(-1); });
    $('btnNextItem').addEventListener('click', function () { self.stepItem(1); });

    $('btnFavItem').addEventListener('click', function () {
      if (!self.selected) return;
      var now = Store.toggleFavorite(self.selected);
      self.updateFavStar();
      toast(now ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.');
    });

    $('btnPrevPlay').addEventListener('click', function () {
      self.stepPlayback(-1);
      self.keepPlayerFocus('btnPrevPlay');
    });
    $('btnNextPlay').addEventListener('click', function () {
      self.stepPlayback(1);
      self.keepPlayerFocus('btnNextPlay');
    });

    // Mantém AGORA / A SEGUIR atualizados sem nova requisição.
    setInterval(function () {
      if (self.section === MediaKind.LIVE &&
          !$('screen-home').classList.contains('hidden')) {
        self.renderEpg(self.epgPrograms);
      }
    }, 60000);
  },

  selectEntry: function (entry, silent) {
    if (!entry || this.section === MediaKind.SERIES) return;
    this.selected = entry;

    // Anterior/Próximo percorre a lista inteira: se o item cair em outra
    // página, vira a página sozinho (como no app Android).
    var index = this.indexOfSelected();
    var page = index < 0 ? this.page : Math.floor(index / PAGE_SIZE);
    if (page !== this.page) {
      this.page = page;
      this.renderItems(this.currentList, true, true);
      try { $('items').scrollTop = 0; } catch (e) { /* ignora */ }
    }

    this.markSelected();
    this.renderPreview(entry);
    if (!silent) {
      var node = document.querySelector('#items [data-id="' + entry.id + '"]');
      if (node) {
        try { node.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignora */ }
      }
    }
  },

  markSelected: function () {
    var nodes = document.querySelectorAll('#items [data-id]');
    var id = this.selected ? this.selected.id : null;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute('data-id') === id) nodes[i].classList.add('selected');
      else nodes[i].classList.remove('selected');
    }
  },

  indexOfSelected: function () {
    var id = this.selected ? this.selected.id : null;
    if (!id) return -1;
    for (var i = 0; i < this.currentList.length; i++) {
      if (this.currentList[i].id === id) return i;
    }
    return -1;
  },

  stepItem: function (delta) {
    var index = this.indexOfSelected();
    if (index < 0) return;
    var next = index + delta;
    if (next < 0 || next >= this.currentList.length) return;
    this.selectEntry(this.currentList[next]);
  },

  categoryName: function (entry) {
    var list = this.catCache[this.section] || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(entry.categoryId)) return list[i].name;
    }
    return '';
  },

  renderPreview: function (entry) {
    var live = entry.kind === MediaKind.LIVE;

    toggle($('previewVideo'), live);
    toggle($('previewPoster'), !live);
    toggle($('previewExtra'), live);

    $('previewBadge').textContent = live ? 'AO VIVO' : 'FILME';
    $('previewBadge').className = 'preview-badge' + (live ? '' : ' vod');
    $('previewTitle').textContent = entry.name;

    var meta = [];
    if (live) {
      var cat = this.categoryName(entry);
      if (cat) meta.push(cat);
      meta.push('Ao vivo');
    } else {
      if (entry.year) meta.push(String(entry.year));
      if (entry.rating) meta.push('★ ' + Number(entry.rating).toFixed(1));
    }
    $('previewMeta').textContent = meta.join('   ·   ');

    var plot = entry.plot || '';
    toggle($('previewPlot'), !live && !!plot);
    $('previewPlot').textContent = plot;

    if (live) {
      this.epgPrograms = null;
      this.epgToken++;
      this.startPreview(this.source.playUrl(entry));
      this.loadEpg(entry);
    } else {
      this.stopPreview();
      this.epgPrograms = null;
      this.epgToken++;
      this.vodToken++;
      $('previewPoster').style.backgroundImage = entry.logo
        ? 'url("' + String(entry.logo).replace(/"/g, '%22') + '")'
        : '';
      this.loadSynopsis(entry);
    }

    this.updateFavStar();
    this.updateStepButtons();
  },

  /** Sinopse do filme: a lista do servidor não traz o texto, só o detalhe. */
  loadSynopsis: function (entry) {
    var self = this;
    var token = ++this.vodToken;

    if (this.vodCache[entry.id]) {
      this.showSynopsis(entry, this.vodCache[entry.id]);
      return;
    }
    if (entry.plot) {
      show($('previewPlot'));
      return;
    }
    if (!this.source || !this.source.vodInfo) {
      this.showNoSynopsis();
      return;
    }

    $('previewPlot').textContent = 'Carregando sinopse…';
    show($('previewPlot'));

    this.source.vodInfo(entry.id).then(function (info) {
      if (token !== self.vodToken) return;
      if (!info || !info.plot) {
        self.showNoSynopsis();
        return;
      }
      self.vodCache[entry.id] = info;
      entry.plot = info.plot;
      if (!entry.year && info.year) entry.year = info.year;
      if (!entry.rating && info.rating) entry.rating = info.rating;
      self.showSynopsis(entry, info);
    }, function () {
      if (token !== self.vodToken) return;
      self.showNoSynopsis();
    });
  },

  showNoSynopsis: function () {
    var el = $('previewPlot');
    if (!el) return;
    el.textContent = 'Sinopse não disponível para este título.';
    show(el);
  },

  showSynopsis: function (entry, info) {
    var plot = (info && info.plot) || entry.plot || '';
    if (!plot) {
      this.showNoSynopsis();
      return;
    }
    $('previewPlot').textContent = plot;
    show($('previewPlot'));

    var meta = [];
    if (entry.year) meta.push(String(entry.year));
    if (entry.rating) meta.push('★ ' + Number(entry.rating).toFixed(1));
    if (info && info.genre) meta.push(String(info.genre).split(',')[0]);
    if (meta.length) $('previewMeta').textContent = meta.join('   ·   ');
  },

  updateFavStar: function () {
    var star = $('btnFavItem');
    if (!star) return;
    var favorite = this.selected ? Store.isFavorite(this.selected) : false;
    star.textContent = favorite ? '★' : '☆';
    star.style.color = favorite ? '#FFC107' : '#FFFFFF';
  },

  updateStepButtons: function () {
    var index = this.indexOfSelected();
    var prev = $('btnPrevItem');
    var next = $('btnNextItem');
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index < 0 || index >= this.currentList.length - 1;
  },

  startPreview: function (url) {
    if (!url) return;
    if (this.previewUrl === url) return;
    this.stopPreview();

    var video = $('previewVideo');
    if (!video) return;
    this.previewUrl = url;
    try {
      video.muted = true;
      video.src = url;
      var started = video.play();
      if (started && started.catch) started.catch(function () { /* ignora */ });
    } catch (e) { /* ignora */ }
  },

  stopPreview: function () {
    this.previewUrl = null;
    var video = $('previewVideo');
    if (!video) return;
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) { /* ignora */ }
  },

  nowMinutes: function () {
    var now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  },

  loadEpg: function (entry) {
    var self = this;
    var token = ++this.epgToken;
    this.epgPrograms = null;

    var now = $('epgNow');
    now.className = 'epg-now dim';
    now.textContent = 'Consultando programação…';
    clear($('epgList'));

    Epg.board().then(function (board) {
      if (token !== self.epgToken) return null;
      var found = Epg.find(board, entry.name);
      if (!found) {
        now.className = 'epg-now dim';
        now.textContent = 'Programação não encontrada para este canal.';
        return null;
      }
      return Epg.schedule(found.code).then(function (day) {
        if (token !== self.epgToken) return;
        var programs = (day && day.length) ? day : found.programs;
        self.epgPrograms = programs;
        self.renderEpg(programs);
      });
    }, function () {
      if (token !== self.epgToken) return;
      now.className = 'epg-now dim';
      now.textContent = 'Programação indisponível agora.';
    });
  },

  renderEpg: function (programs) {
    var now = $('epgNow');
    var list = $('epgList');
    if (!now || !list) return;

    clear(list);

    if (!programs || !programs.length) {
      now.className = 'epg-now dim';
      now.textContent = 'Programação indisponível para este canal.';
      return;
    }

    var minutes = this.nowMinutes();
    var current = null;
    var upcoming = [];

    for (var i = 0; i < programs.length; i++) {
      var program = programs[i];
      if (program.minutes <= minutes) {
        current = program;
      } else {
        upcoming.push(program);
        if (upcoming.length >= 5) break;
      }
    }

    if (current) {
      now.className = 'epg-now';
      clear(now);
      now.appendChild(make('span', 't', current.start));
      now.appendChild(document.createTextNode(current.title));
      if (current.genre) now.appendChild(make('span', 'g', current.genre));
    } else {
      now.className = 'epg-now dim';
      now.textContent = 'Sem programa agora.';
    }

    for (var j = 0; j < upcoming.length; j++) {
      var row = make('div', 'epg-item');
      row.appendChild(make('span', 't', upcoming[j].start));
      row.appendChild(make('span', 'n', upcoming[j].title));
      list.appendChild(row);
    }
  },

  buildCard: function (entry) {
    var self = this;
    var card = make('div', 'card-item focusable' + (entry.kind === MediaKind.LIVE ? ' live' : ''));
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('data-id', entry.id);

    var thumb = make('div', 'thumb');
    if (entry.logo) {
      thumb.style.backgroundImage = 'url("' + String(entry.logo).replace(/"/g, '%22') + '")';
    } else {
      thumb.textContent = (entry.name || '?').charAt(0).toUpperCase();
    }

    if (entry.rating && Number(entry.rating) > 0) {
      thumb.appendChild(make('span', 'badge', Number(entry.rating).toFixed(1)));
    }

    // Estrela de favorito, como no app Android.
    var favorite = Store.isFavorite(entry);
    var star = make('span', 'star focusable', favorite ? '★' : '☆');
    star.setAttribute('tabindex', '0');
    star.style.color = favorite ? '#FFC107' : '#FFFFFF';
    star.addEventListener('click', function (event) {
      if (event && event.stopPropagation) event.stopPropagation();
      var now = Store.toggleFavorite(entry);
      star.textContent = now ? '★' : '☆';
      star.style.color = now ? '#FFC107' : '#FFFFFF';
      toast(now ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.');
    });
    thumb.appendChild(star);

    var name = make('div', 'name', entry.name);
    card.appendChild(thumb);
    card.appendChild(name);

    card.addEventListener('click', function () {
      if (entry.kind === MediaKind.SERIES) {
        self.openDetail(entry);
      } else if (self.selected && self.selected.id === entry.id) {
        self.playEntry(entry);
      } else {
        self.selectEntry(entry);
      }
    });

    return card;
  },

  /* ============================================================= detalhe */

  openDetail: function (entry) {
    var self = this;
    this.detailItem = entry;
    this.stopPreview();
    this.updateDetailNav();

    Screens.show('screen-detail');
    $('detailTitle').textContent = entry.name;
    $('detailMeta').textContent = '';
    $('detailPlot').textContent = 'Carregando…';
    $('detailPoster').style.backgroundImage = entry.logo ? 'url("' + String(entry.logo).replace(/"/g, '%22') + '")' : '';
    clear($('seasonTabs'));
    clear($('episodes'));
    $('episodes').textContent = 'Carregando…';

    this.source.seriesInfo(entry.id).then(function (detail) {
      if (!detail) {
        $('detailPlot').textContent = 'Não foi possível carregar esta série.';
        $('episodes').textContent = '';
        return;
      }
      self.detail = detail;
      self.renderDetail(detail);
    }, function () {
      $('detailPlot').textContent = 'Não foi possível carregar esta série.';
      $('episodes').textContent = '';
    });
  },

  updateDetailNav: function () {
    var index = -1;
    if (this.detailItem) {
      for (var i = 0; i < this.currentList.length; i++) {
        if (this.currentList[i].id === this.detailItem.id) { index = i; break; }
      }
    }
    var prev = $('btnPrevSerie');
    var next = $('btnNextSerie');
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index < 0 || index >= this.currentList.length - 1;
  },

  stepDetail: function (delta) {
    var index = -1;
    if (this.detailItem) {
      for (var i = 0; i < this.currentList.length; i++) {
        if (this.currentList[i].id === this.detailItem.id) { index = i; break; }
      }
    }
    if (index < 0) return;
    var next = index + delta;
    if (next < 0 || next >= this.currentList.length) return;
    this.openDetail(this.currentList[next]);
  },

  renderDetail: function (detail) {
    var self = this;

    $('detailTitle').textContent = detail.name;
    $('detailPlot').textContent = detail.plot || 'Sem descrição.';
    if (detail.cover) {
      $('detailPoster').style.backgroundImage = 'url("' + String(detail.cover).replace(/"/g, '%22') + '")';
    }

    var meta = [];
    if (detail.genre) meta.push(detail.genre);
    if (detail.releaseDate) meta.push(String(detail.releaseDate).substring(0, 4));
    if (detail.rating) meta.push('★ ' + detail.rating.toFixed(1));
    var total = 0;
    for (var i = 0; i < detail.seasons.length; i++) total += detail.seasons[i].episodes.length;
    meta.push(total + (total === 1 ? ' episódio' : ' episódios'));
    $('detailMeta').textContent = meta.join('   ·   ');

    var tabs = $('seasonTabs');
    clear(tabs);
    if (detail.seasons.length > 1) {
      for (var s = 0; s < detail.seasons.length; s++) {
        (function (season, index) {
          var button = makeButton('season' + (index === 0 ? ' active' : ''), 'Temporada ' + season.number);
          button.addEventListener('click', function () {
            var all = tabs.getElementsByTagName('button');
            for (var k = 0; k < all.length; k++) all[k].classList.remove('active');
            button.classList.add('active');
            self.renderEpisodes(season);
          });
          tabs.appendChild(button);
        })(detail.seasons[s], s);
      }
    }

    if (detail.seasons.length) {
      this.renderEpisodes(detail.seasons[0]);
    } else {
      $('episodes').textContent = 'Nenhum episódio disponível.';
    }

    setTimeout(function () {
      var first = document.querySelector('#episodes .episode') ||
        document.querySelector('#seasonTabs .season');
      if (first) { try { first.focus(); } catch (e) { /* ignora */ } }
    }, 40);
  },

  renderEpisodes: function (season) {
    var self = this;
    var holder = $('episodes');
    clear(holder);

    if (!season.episodes.length) {
      holder.textContent = 'Nenhum episódio nesta temporada.';
      return;
    }

    for (var i = 0; i < season.episodes.length; i++) {
      (function (episode, index) {
        var button = makeButton('episode', '');
        button.appendChild(make('span', 'num', 'T' + episode.season + ' E' + episode.number));
        button.appendChild(make('span', 'ep-name', episode.title));
        button.addEventListener('click', function () {
          self.playEpisode(episode, season, index);
        });
        holder.appendChild(button);
      })(season.episodes[i], i);
    }
  },

  /* ============================================================== player */

  playEntry: function (entry) {
    var url = this.source.playUrl(entry);
    if (!url) {
      toast('Não foi possível montar o endereço deste item.');
      return;
    }
    this.playing = entry;
    this.playingSeason = null;
    this.playingEpIndex = -1;
    this.selected = entry;
    this.stopPreview();
    Player.open(url, entry.name, entry.kind === MediaKind.LIVE);
    this.updatePlayerNav();
    Store.addRecent(entry);
  },

  playEpisode: function (episode, season, index) {
    var url = this.source.episodeUrl(episode);
    if (!url) {
      toast('Não foi possível montar o endereço deste episódio.');
      return;
    }
    this.playing = null;
    this.playingSeason = season || null;
    this.playingEpIndex = typeof index === 'number' ? index : -1;
    var name = this.detail ? this.detail.name : 'Episódio';
    Player.open(url, name + ' · T' + episode.season + ' E' + episode.number + ' — ' + episode.title, false);
    this.updatePlayerNav();
  },

  /** Anterior/Próximo com o vídeo rodando: canal, filme ou episódio. */
  stepPlayback: function (delta) {
    if (this.playingSeason) {
      var eps = this.playingSeason.episodes || [];
      var i = this.playingEpIndex + delta;
      if (i < 0 || i >= eps.length) return;
      this.playEpisode(eps[i], this.playingSeason, i);
      return;
    }

    var entry = this.playing;
    if (!entry) return;

    var index = -1;
    for (var k = 0; k < this.currentList.length; k++) {
      if (this.currentList[k].id === entry.id) { index = k; break; }
    }
    if (index < 0) return;

    var next = index + delta;
    if (next < 0 || next >= this.currentList.length) return;

    var target = this.currentList[next];
    this.selected = target;

    var page = Math.floor(next / PAGE_SIZE);
    if (page !== this.page) {
      this.page = page;
      this.renderItems(this.currentList, true, true);
    }
    this.markSelected();
    this.updateStepButtons();
    this.playEntry(target);
  },

  updatePlayerNav: function () {
    var prev = $('btnPrevPlay');
    var next = $('btnNextPlay');
    if (!prev || !next) return;

    var hasPrev = false;
    var hasNext = false;

    if (this.playingSeason) {
      var eps = this.playingSeason.episodes || [];
      hasPrev = this.playingEpIndex > 0;
      hasNext = this.playingEpIndex >= 0 && this.playingEpIndex < eps.length - 1;
    } else if (this.playing) {
      var index = -1;
      for (var i = 0; i < this.currentList.length; i++) {
        if (this.currentList[i].id === this.playing.id) { index = i; break; }
      }
      hasPrev = index > 0;
      hasNext = index >= 0 && index < this.currentList.length - 1;
    }

    prev.disabled = !hasPrev;
    next.disabled = !hasNext;
    toggle(prev.parentNode, !!(this.playing || this.playingSeason));
  },

  keepPlayerFocus: function (id) {
    setTimeout(function () {
      var button = $(id);
      if (button && !button.disabled) {
        try { button.focus(); } catch (e) { /* ignora */ }
      }
    }, 220);
  },

  closePlayer: function () {
    var fromDetail = !!(this.playingSeason && this.detail);
    Player.close();
    this.playing = null;
    this.playingSeason = null;
    this.playingEpIndex = -1;

    if (fromDetail) {
      Screens.show('screen-detail');
      setTimeout(function () {
        var first = document.querySelector('#episodes .episode');
        if (first) { try { first.focus(); } catch (e) { /* ignora */ } }
      }, 40);
    } else {
      this.goHome();
    }
  },

  /* ============================================================ ajustes */

  bindSettings: function () {
    var self = this;
    $('btnBackDetail').addEventListener('click', function () { self.goHome(); });
    $('btnBackSettings').addEventListener('click', function () { self.goHome(); });
    $('btnPrevSerie').addEventListener('click', function () { self.stepDetail(-1); });
    $('btnNextSerie').addEventListener('click', function () { self.stepDetail(1); });

    $('setSwitch').addEventListener('click', function () {
      self.showLogin();
    });

    $('setRefresh').addEventListener('click', function () {
      self.reloadContent();
      self.goHome();
    });

    $('setSort').addEventListener('click', function () {
      var next = Store.sortMode() === 'az' ? 'server' : 'az';
      Store.setSortMode(next);
      self.itemCache = {};
      self.cacheOrder = [];
      self.updateSortCard();
      self.setSection(self.section);
      toast(next === 'az' ? 'Listas em ordem alfabética (A–Z).' : 'Listas na ordem do servidor.');
    });

    $('setClearFav').addEventListener('click', function () {
      Store.clearFavorites();
      self.renderCats(self.catCache[self.section] || []);
      toast('Favoritos apagados.');
    });

    $('setClearHist').addEventListener('click', function () {
      Store.clearRecents();
      self.renderCats(self.catCache[self.section] || []);
      toast('Histórico apagado.');
    });

    $('setTerms').addEventListener('click', function () {
      Screens.show('screen-terms');
      Focus.first($('screen-terms'));
    });

    $('setAbout').addEventListener('click', function () {
      self.openInfo('Sobre o Reptor', self.aboutHtml());
    });

    $('setPrivacy').addEventListener('click', function () {
      self.openInfo('Privacidade', self.privacyHtml());
    });

    $('btnInfoClose').addEventListener('click', function () {
      self.closeInfo();
    });

    $('setLogout').addEventListener('click', function () {
      Store.clearSession();
      self.session = null;
      self.source = null;
      self.showLogin();
    });
  },

  /** Janela simples de informação (Sobre / Privacidade). */
  openInfo: function (title, html) {
    this.infoReturn = document.activeElement;
    $('infoTitle').textContent = title;
    $('infoBody').innerHTML = html;
    $('infoModal').classList.remove('hidden');
    setTimeout(function () {
      try { $('btnInfoClose').focus(); } catch (e) { /* ignora */ }
    }, 30);
  },

  closeInfo: function () {
    $('infoModal').classList.add('hidden');
    var back = this.infoReturn;
    if (back) {
      setTimeout(function () {
        try { back.focus(); } catch (e) { /* ignora */ }
      }, 30);
    }
  },

  aboutHtml: function () {
    var code = this.code || Store.cachedCode() || '—';
    return '<p><b>Reptor Player</b> — VIDEO PLAYER para TV.</p>' +
      '<p>Versão: <b>' + APP_VERSION + '</b><br>' +
      'Aparelho: <b>' + esc(Device.modelName()) + '</b><br>' +
      'Código: <b>' + esc(code) + '</b></p>' +
      '<p>Ativação e gerenciamento: <b>reptor-player.netlify.app</b></p>';
  },

  privacyHtml: function () {
    return '<p>O Reptor Player guarda apenas no próprio aparelho:</p>' +
      '<p>• o código de identificação da TV;<br>' +
      '• as listas que você cadastrou;<br>' +
      '• favoritos e itens vistos recentemente;<br>' +
      '• o aceite dos termos de uso.</p>' +
      '<p>Nenhum dado é enviado a terceiros. A ativação consulta apenas o site oficial para verificar se este aparelho foi liberado.</p>';
  },

  openSettings: function () {
    var self = this;
    this.stopPreview();
    this.epgToken++;
    Screens.show('screen-settings');

    var name = this.session ? sessionName(this.session) : '—';
    var mode = this.session ? (this.session.mode === 'M3U' ? 'M3U' : 'XTREAM') : '—';

    $('setSub').textContent = name;
    $('setMode').textContent = mode;
    this.updateSortCard();

    var listLines = [];
    if (this.session) {
      listLines.push('Lista: <b>' + esc(name) + '</b>');
      if (this.session.mode === 'M3U') {
        listLines.push('Tipo: <b>M3U</b>');
      } else {
        listLines.push('Servidor: <b>' + esc(normalizeBase(this.session.baseUrl)) + '</b>');
        listLines.push('Usuário: <b>' + esc(this.session.username || '—') + '</b>');
      }
    }
    $('activeList').innerHTML = listLines.length ? listLines.join('<br>') : 'Nenhuma lista ativa.';

    $('deviceInfo').innerHTML = this.deviceHtml();

    if (!this.code) {
      var self2 = this;
      Device.code().then(function (code) {
        self2.code = code;
        if (!$('screen-settings').classList.contains('hidden')) {
          $('deviceInfo').innerHTML = self2.deviceHtml();
        }
      });
    }

    $('acctInfo').textContent = 'Consultando…';
    if (!this.source || !this.source.account) {
      $('acctInfo').textContent = 'Lista M3U (sem dados de conta).';
    } else {
      this.source.account().then(function (info) {
        if (!info) {
          $('acctInfo').textContent = 'Não foi possível consultar a conta.';
          return;
        }
        var lines = [];
        if (info.username) lines.push('Usuário: <b>' + esc(info.username) + '</b>');
        if (info.status) lines.push('Status: <b>' + esc(info.status) + '</b>');
        if (info.expiresAt) lines.push('Vence em: <b>' + esc(formatExpiry(info.expiresAt)) + '</b>');
        if (info.maxConnections) lines.push('Conexões: <b>' + esc(info.activeConnections || '0') + ' / ' + esc(info.maxConnections) + '</b>');
        $('acctInfo').innerHTML = lines.length ? lines.join('<br>') : 'Sem dados.';
      });
    }

    setTimeout(function () {
      var first = $('setSwitch') || $('screen-settings').querySelector('.focusable');
      if (first) { try { first.focus(); } catch (e) { /* ignora */ } }
    }, 40);
  },

  deviceHtml: function () {
    return 'Código: <b>' + esc(this.code || Store.cachedCode() || '—') + '</b><br>' +
      'Modelo: <b>' + esc(Device.modelName()) + '</b><br>' +
      'Versão: <b>' + APP_VERSION + '</b>';
  },

  updateSortCard: function () {
    var az = Store.sortMode() === 'az';
    var state = $('sortState');
    if (state) state.textContent = az ? 'A–Z (alfabética)' : 'Ordem do servidor';
    var card = $('setSort');
    if (card) card.setAttribute('data-mode', az ? 'az' : 'server');
  }
};

function formatExpiry(value) {
  var numeric = parseInt(value, 10);
  if (!numeric || numeric <= 0) return 'ilimitado';
  var date = new Date(numeric * 1000);
  return pad2(date.getDate()) + '/' + pad2(date.getMonth() + 1) + '/' + date.getFullYear();
}

/* =============================================================== PLAYER */

var Player = {

  video: null,
  hls: null,
  hideTimer: null,
  currentUrl: null,
  isLive: false,
  tryingHls: false,

  /** Liga os eventos do <video> uma única vez. */
  bindVideo: function () {
    var self = this;
    this.video = $('video');

    this.video.addEventListener('error', function () {
      if (!App.isPlayerOpen() || !self.currentUrl) return;
      self.onError();
    }, false);

    this.video.addEventListener('timeupdate', function () { self.onTime(); }, false);
    this.video.addEventListener('loadedmetadata', function () { self.onTime(); }, false);
    this.video.addEventListener('ended', function () { self.showOverlay(); }, false);
    this.video.addEventListener('click', function () { self.toggleOverlay(); }, false);
  },

  open: function (url, title, isLive) {
    var self = this;
    if (!this.video) this.bindVideo();

    Screens.show('screen-player');
    hide($('playerError'));
    hide($('playerOverlay'));

    $('playerTitle').textContent = title || '';
    var badge = $('playerBadge');
    badge.textContent = isLive ? 'AO VIVO' : 'VÍDEO';
    badge.className = 'player-badge' + (isLive ? '' : ' vod');
    toggle($('progress'), !isLive);

    this.currentUrl = url;
    this.isLive = isLive;
    this.tryingHls = false;

    this.destroyHls();
    var video = this.video;
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) { /* ignora */ }

    this.showOverlay();

    video.src = url;
    var started = video.play();
    if (started && started.then) {
      started.then(function () { self.scheduleHide(); }, function () { self.showOverlay(); });
    } else {
      this.scheduleHide();
    }

    setTimeout(function () {
      var button = $('btnPlay');
      if (button) { try { button.focus(); } catch (e) { /* ignora */ } }
    }, 60);
  },

  onError: function () {
    if (this.tryingHls || !this.currentUrl) {
      this.showError('Verifique se o link ainda está disponível.');
      return;
    }
    if (window.Hls && Hls.isSupported()) {
      this.tryingHls = true;
      this.startHls(this.currentUrl);
    } else {
      this.showError('Este formato não é suportado nesta TV.');
    }
  },

  startHls: function (url) {
    var self = this;
    this.destroyHls();

    var hls = new Hls({ enableWorker: false, lowLatencyMode: false });
    this.hls = hls;

    hls.on(Hls.Events.ERROR, function (event, data) {
      if (data && data.fatal) {
        self.showError('Não foi possível abrir este vídeo.');
      }
    });

    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      var started = self.video.play();
      if (started && started.then) {
        started.then(function () { self.scheduleHide(); }, function () { /* ignora */ });
      }
    });

    hls.loadSource(url);
    hls.attachMedia(this.video);
  },

  destroyHls: function () {
    if (this.hls) {
      try { this.hls.destroy(); } catch (e) { /* ignora */ }
      this.hls = null;
    }
  },

  showError: function (message) {
    hide($('playerOverlay'));
    $('playerErrorSub').textContent = message || '';
    show($('playerError'));
    setTimeout(function () {
      var back = $('playerError');
      if (back) back.setAttribute('tabindex', '0');
    }, 10);
  },

  play: function () {
    if (!this.video) return;
    this.video.play();
    this.updatePlayButton();
    this.scheduleHide();
  },

  pause: function () {
    if (!this.video) return;
    this.video.pause();
    this.updatePlayButton();
    this.showOverlay();
  },

  toggle: function () {
    if (!this.video) return;
    if (this.video.paused) this.play(); else this.pause();
  },

  updatePlayButton: function () {
    var button = $('btnPlay');
    if (!button || !this.video) return;
    button.textContent = this.video.paused ? '▶' : '❚❚';
  },

  seek: function (delta) {
    if (!this.video || this.isLive) return;
    var target = this.video.currentTime + delta;
    if (target < 0) target = 0;
    if (isFinite(this.video.duration) && target > this.video.duration) target = this.video.duration;
    this.video.currentTime = target;
    this.onTime();
    this.showOverlay();
  },

  onTime: function () {
    if (!this.video || this.isLive) return;
    var duration = this.video.duration;
    var now = this.video.currentTime || 0;
    $('timeNow').textContent = fmtTime(now);
    $('timeEnd').textContent = isFinite(duration) ? fmtTime(duration) : '--:--';
    var percent = isFinite(duration) && duration > 0 ? (now / duration) * 100 : 0;
    $('progressFill').style.width = percent + '%';
  },

  showOverlay: function () {
    show($('playerOverlay'));
    this.updatePlayButton();
    if (this.hideTimer) clearTimeout(this.hideTimer);
  },

  scheduleHide: function () {
    var self = this;
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(function () {
      if (self.video && !self.video.paused) hide($('playerOverlay'));
    }, 4500);
  },

  toggleOverlay: function () {
    var overlay = $('playerOverlay');
    if (overlay.classList.contains('hidden')) this.showOverlay();
    else hide(overlay);
  },

  close: function () {
    this.destroyHls();
    if (this.video) {
      try {
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
      } catch (e) { /* ignora */ }
    }
    hide($('playerOverlay'));
    hide($('playerError'));
    this.currentUrl = null;
  }
};

/* ========================================================== inicialização */

document.addEventListener('DOMContentLoaded', function () {
  Player.bindVideo();
  $('btnPlay').addEventListener('click', function () { Player.toggle(); });
  $('btnRew').addEventListener('click', function () { Player.seek(-10); });
  $('btnFwd').addEventListener('click', function () { Player.seek(10); });
  App.init();
});
