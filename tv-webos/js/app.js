/* Raptor Player â€” webOS. Controlador principal. */

var APP_VERSION = '1.2.2';

/* Itens por pÃ¡gina: evita milhares de elementos na memÃ³ria da TV. */
var PAGE_SIZE = 60;

/* VÃ­deos pÃºblicos de demonstraÃ§Ã£o (CC-BY, Blender Foundation), em MP4/H.264.
   Servem para testar o player sem lista, login ou credencial. */
var DEMO_ITEMS = [
  { url: 'https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/demo-1.mp4', title: 'Exemplo 1 Â· Sintel (720p)' },
  { url: 'https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/demo-2.mp4', title: 'Exemplo 2 Â· Big Buck Bunny (trailer)' },
  { url: 'https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/demo-3.mp4', title: 'Exemplo 3 Â· Sintel (trailer)' },
  { url: 'https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/demo-4.mp4', title: 'Exemplo 4 Â· Ãguas-vivas (720p)' }
];

var App = {

  session: null,
  source: null,
  section: MediaKind.LIVE,
  activeCat: null,
  filter: 'all',
  catCache: {},
  itemCache: {},
  cacheOrder: [],
  lastCat: {},
  sectionToken: 0,
  page: 0,
  currentList: [],
  baseList: [],
  searchQuery: '',
  searchTimer: null,
  typing: false,
  searchIndex: {},
  searchToken: 0,
  searchLoading: false,
  detail: null,
  detailItem: null,
  infoReturn: null,

  selected: null,
  previewUrl: null,
  previewTimer: null,
  previewDebounce: null,
  synopsisDebounce: null,
  previewFailed: false,
  epgPrograms: null,
  epgToken: 0,
  epgTimer: null,

  playing: null,
  playingSeason: null,
  playingEpIndex: -1,
  demoMode: false,
  demoIndex: -1,
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
    this.bindSearch();
    this.bindSettings();
    this.bindPreview();

    $('btnRefresh').addEventListener('click', function () {
      self.reloadContent();
    });

    var btnMenu = $('btnMenu');
    if (btnMenu) btnMenu.addEventListener('click', function () { self.openMenu(); });

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

      // Termos de uso: as setas rolam o texto; no fim, o foco desce para o botÃ£o.
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

      // Player com a barra escondida: a primeira tecla sÃ³ mostra os controles.
      if (self.isPlayerOpen() && $('playerOverlay').classList.contains('hidden') &&
          $('playerError').classList.contains('hidden') &&
          (code === 13 || code === 37 || code === 38 || code === 39 || code === 40)) {
        event.preventDefault();
        Player.showOverlay();
        Player.scheduleHide();
        return;
      }

      // Barra de tempo do player: esquerda/direita avancam ou voltam 30 s.
      if (self.isPlayerOpen() && active && active.id === 'progress') {
        if (code === 37) { event.preventDefault(); Player.seek(-30); Player.scheduleHide(); return; }
        if (code === 39) { event.preventDefault(); Player.seek(30); Player.scheduleHide(); return; }
        if (code === 13) { event.preventDefault(); Player.toggle(); Player.scheduleHide(); return; }
      }
      if (code === 37 || code === 38 || code === 39 || code === 40) {
        var digitando = document.activeElement && document.activeElement.id === 'searchInput';
        // Com o campo de busca em foco, as setas editam o texto; sÃ³ "baixo"
        // sai do campo e vai para o primeiro resultado.
        if (digitando && code === 40) {
          event.preventDefault();
          self.focusFirstResult();
          return;
        }
        if (digitando) return;
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

  /* ============================================================= busca */

  bindSearch: function () {
    var self = this;
    var input = $('searchInput');
    var box = $('searchBox');
    var clearBtn = $('btnClearSearch');
    if (!input) return;

    input.addEventListener('focus', function () {
      self.typing = true;
      if (box) box.classList.add('search-on');
    });
    input.addEventListener('blur', function () {
      self.typing = false;
      if (box) box.classList.remove('search-on');
    });

    input.addEventListener('input', function () {
      if (self.searchTimer) clearTimeout(self.searchTimer);
      self.searchTimer = setTimeout(function () {
        self.searchTimer = null;
        self.applySearch(input.value);
      }, 180);
    });

    // Nada de interceptar OK/Enter: o teclado virtual da LG usa essa tecla
    // para fechar sozinho. A lista jÃ¡ filtra enquanto o usuÃ¡rio digita e a
    // seta para baixo leva ao primeiro resultado.

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        self.clearSearch(true);
      });
    }
  },

  /** Sai do campo de busca e foca o primeiro resultado (sem cair na estrela). */
  focusFirstResult: function () {
    var holder = $('items');
    var first = holder ? holder.querySelector('.card-item, .channel-row') : null;
    var entry = this.currentList[0];
    if (entry && this.section !== MediaKind.SERIES) this.selectEntry(entry, true);
    if (first) {
      try { first.focus(); } catch (e) { /* ignora */ }
    }
  },

  /** Filtra uma lista pelo nome digitado (usa o Ã­ndice jÃ¡ normalizado). */
  filterFrom: function (list) {
    var q = fold(this.searchQuery);
    if (!q) return list || [];
    var out = [];
    for (var i = 0; i < (list || []).length; i++) {
      var entry = list[i];
      var key = entry && entry._search;
      if (key == null) key = fold(entry && entry.name);
      if (key.indexOf(q) !== -1) out.push(entry);
    }
    return out;
  },

  /** Filtra a lista carregada (pasta atual) pelo nome digitado. */
  filteredList: function (list) {
    return this.filterFrom(list);
  },

  /**
   * Busca em TODAS as pastas da aba atual: carrega a lista completa uma vez
   * (sÃ³ com os campos necessÃ¡rios) e guarda como Ã­ndice. SÃ³ a aba atual fica
   * na memÃ³ria, para nÃ£o pesar na TV.
   */
  loadSearchIndex: function (kind) {
    var self = this;
    if (!this.source || !this.source.items) return;

    var token = ++this.searchToken;
    this.searchLoading = true;
    this.updateSearchUi();

    this.source.items(kind, null).then(function (all) {
      if (token !== self.searchToken) return;
      self.searchLoading = false;

      if (!all || !all.length) {
        self.updateSearchUi();
        return;
      }

      var index = [];
      for (var i = 0; i < all.length; i++) {
        var entry = all[i];
        if (!entry) continue;
        // ProjeÃ§Ã£o enxuta: sinopse e outros campos longos ficam de fora.
        index.push({
          id: entry.id,
          name: entry.name,
          logo: entry.logo,
          categoryId: entry.categoryId,
          kind: entry.kind,
          containerExtension: entry.containerExtension,
          rating: entry.rating,
          year: entry.year,
          directUrl: null,
          _search: fold(entry.name)
        });
      }
      all.length = 0;
      self.searchIndex = {};
      self.searchIndex[kind] = index;

      if (self.section !== kind || !self.searchQuery) {
        self.updateSearchUi();
        return;
      }

      self.page = 0;
      self.currentList = self.filterFrom(index);
      self.updateSearchUi();
      self.renderItems(self.currentList, false, true);

      if (self.typing) {
        var input = $('searchInput');
        if (input) { try { input.focus(); } catch (e) { /* ignora */ } }
      }
    }, function () {
      if (token !== self.searchToken) return;
      self.searchLoading = false;
      self.updateSearchUi();
    });
  },

  applySearch: function (value) {
    var input = $('searchInput');
    this.searchQuery = String(value || '').replace(/^\s+|\s+$/g, '');
    this.page = 0;

    var q = fold(this.searchQuery);
    var index = this.searchIndex[this.section];

    if (!q) {
      this.currentList = this.baseList;
    } else {
      // Enquanto o Ã­ndice nÃ£o chega, filtra a pasta aberta; depois passa a
      // procurar em todas as pastas da aba.
      this.currentList = this.filterFrom(index || this.baseList);
      if (!index && q.length >= 2) this.loadSearchIndex(this.section);
    }

    // O item selecionado pode ter saÃ­do do filtro: limpa a prÃ©via.
    if (this.selected && this.indexOfSelected() < 0) {
      this.selected = null;
      this.stopPreview();
      this.hidePreviewCover();
    }

    this.updateSearchUi();

    // Digitando: mantÃ©m o foco no campo (teclado aberto) e nÃ£o seleciona
    // sozinho. O primeiro resultado sÃ³ ganha foco com OK ou seta para baixo.
    var digitando = this.typing || document.activeElement === input;
    this.renderItems(this.currentList, false, digitando);

    if (digitando && input) {
      try { input.focus(); } catch (e) { /* ignora */ }
    }
  },

  updateSearchUi: function () {
    var input = $('searchInput');
    var clearBtn = $('btnClearSearch');
    var sub = $('tabSub');
    var active = Boolean(this.searchQuery);

    if (input && input.value !== this.searchQuery && document.activeElement !== input) {
      input.value = this.searchQuery;
    }
    if (clearBtn) toggle(clearBtn, active);

    if (!sub) return;
    if (active) {
      var total = this.currentList.length;
      var onde;
      if (this.searchLoading) onde = ' Â· buscando em todas as pastasâ€¦';
      else if (this.searchIndex[this.section]) onde = ' Â· todas as pastas';
      else onde = ' Â· nesta pasta';
      sub.textContent = 'Busca: "' + this.searchQuery + '" Â· ' + total +
        (total === 1 ? ' resultado' : ' resultados') + onde;
    } else {
      sub.textContent = this.session ? sessionName(this.session) : '';
    }
  },

  clearSearch: function (focusInput) {
    this.searchQuery = '';
    if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
    var input = $('searchInput');
    if (input) input.value = '';
    this.page = 0;
    this.currentList = this.filteredList(this.baseList);
    this.updateSearchUi();
    this.renderItems(this.currentList, false, Boolean(focusInput));
    if (focusInput && input) {
      try { input.focus(); } catch (e) { /* ignora */ }
    }
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
      this.openMenu('settings');
      return;
    }
    if (!$('screen-menu').classList.contains('hidden')) {
      this.exitApp();
      return;
    }
    if (!$('screen-home').classList.contains('hidden')) {
      var focused = document.activeElement;
      if (focused && focused.id === 'searchInput') {
        if (this.searchQuery) {
          this.clearSearch(false);
          try { focused.blur(); } catch (e) { /* ignora */ }
          this.focusFirstResult();
          return;
        }
        this.openMenu();
        return;
      }
      if (this.searchQuery) {
        this.clearSearch(false);
        return;
      }
      // Sai da aba e volta para o menu principal (cada aba Ã© fechada).
      this.openMenu();
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
    toast('Use o botÃ£o Voltar da TV para sair.');
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

    var btnUrl = $('btnVideoUrl');
    if (btnUrl) btnUrl.addEventListener('click', function () { self.useVideoUrl(); });

    var btnDemo = $('btnDemo');
    if (btnDemo) btnDemo.addEventListener('click', function () { self.startDemo(); });

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
      holder.textContent = 'QR indisponÃ­vel';
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

  /** Atalho na tela de ativaÃ§Ã£o: a pessoa cola a URL dos vÃ­deos. */
  useVideoUrl: function () {
    var self = this;
    var input = $('inVideoUrl');
    var raw = input ? input.value.trim() : '';
    var box = $('urlError');
    if (box) box.textContent = '';

    if (!raw) {
      if (box) box.textContent = 'Cole a URL dos vÃ­deos.';
      return;
    }

    var url = normalizeRemoteUrl(raw);
    if (!/^https?:\/\//i.test(url)) {
      if (box) box.textContent = 'A URL deve comeÃ§ar com http:// ou https://.';
      return;
    }

    this.stopPolling();
    if (box) box.textContent = 'Conectandoâ€¦';

    var session = { mode: 'M3U', m3uUrl: url, baseUrl: '', username: '', password: '', label: '' };
    createSource(session).check().then(function (message) {
      if (message) {
        if (box) box.textContent = message;
        return;
      }
      Store.setSession(session);
      Store.saveList(session);
      self.enterHome(session);
    }, function (err) {
      if (box) box.textContent = 'Falha: ' + (err.message || 'erro de rede');
    });
  },

  checkNow: function () {
    this.checkActivation(true);
  },

  checkActivation: function (manual) {
    var self = this;
    if (!this.code || this.pollBusy) return;

    this.pollBusy = true;
    if (manual) this.setStatus('Verificandoâ€¦', '');

    Activation.fetch(this.code).then(function (session) {
      self.pollBusy = false;
      if (session) {
        self.stopPolling();
        self.setStatus('Ativado! Abrindoâ€¦', 'ok');
        Store.setSession(session);
        Store.saveList(session);
        toast('TV ativada. Bem-vindo!');
        setTimeout(function () { self.enterHome(session); }, 900);
      } else {
        self.setStatus('Aguardando ativaÃ§Ã£oâ€¦', '');
        if (manual) toast('Ainda nÃ£o hÃ¡ ativaÃ§Ã£o para este cÃ³digo.');
      }
    }, function () {
      self.pollBusy = false;
      if (manual) {
        self.setStatus('Site indisponÃ­vel. Tentando de novoâ€¦', 'err');
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
        error.textContent = 'Preencha servidor, usuÃ¡rio e senha.';
        return;
      }
      session = { mode: 'XTREAM', baseUrl: host, username: user, password: pass, m3uUrl: '', label: '' };
    }

    error.textContent = 'Conectandoâ€¦';

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

  /* =============================================================== menu */

  /** Menu principal: Canais, Filmes, SÃ©ries e Ajustes. */
  buildMenu: function () {
    var self = this;
    var holder = $('menuCards');
    if (!holder) return;
    clear(holder);

    var entries = [
      { kind: MediaKind.LIVE, label: 'Canais', sub: 'Ao vivo e programaÃ§Ã£o' },
      { kind: MediaKind.VOD, label: 'Filmes', sub: 'CatÃ¡logo completo' },
      { kind: MediaKind.SERIES, label: 'SÃ©ries', sub: 'Temporadas e episÃ³dios' },
      { action: 'settings', label: 'Ajustes', sub: 'Conta, lista e player' }
    ];

    for (var i = 0; i < entries.length; i++) {
      (function (entry, index) {
        var card = makeButton('menu-card', '');
        card.setAttribute('data-kind', entry.kind || entry.action || '');
        card.appendChild(make('span', 'num', pad2(index + 1)));
        card.appendChild(make('span', 'label', entry.label));
        card.appendChild(make('span', 'sub', entry.sub));
        card.addEventListener('click', function () {
          if (entry.kind) self.enterSection(entry.kind);
          else self.openSettings();
        });
        holder.appendChild(card);
      })(entries[i], i);
    }
  },

  openMenu: function (focusKind) {
    var self = this;
    this.stopPreview();
    Screens.show('screen-menu');
    this.buildMenu();
    var alvoKind = focusKind || this.section;
    setTimeout(function () {
      var cards = $('menuCards').querySelectorAll('.menu-card');
      if (!cards.length) return;
      var alvo = cards[0];
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].getAttribute('data-kind') === alvoKind) alvo = cards[i];
      }
      try { alvo.focus(); } catch (e) { /* ignora */ }
    }, 40);
  },

  /** Entra na aba escolhida: a home passa a mostrar sÃ³ aquele conteÃºdo. */
  enterSection: function (kind) {
    this.typing = false;
    try {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    } catch (e) { /* ignora */ }
    Screens.show('screen-home');
    this.setSection(kind);
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

    // Cada aba Ã© um ambiente fechado: o app abre no menu principal.
    this.preload();
    this.openMenu();
  },

  /** Recarrega categorias e itens (botÃ£o âŸ³ Atualizar do topo). */
  reloadContent: function () {
    this.catCache = {};
    this.itemCache = {};
    this.cacheOrder = [];
    this.page = 0;
    this.currentList = [];
    toast('ConteÃºdo recarregado.');
    this.setSection(this.section);
  },

  /**
   * Adianta as pastas das outras abas (respostas pequenas do servidor).
   * Assim Canais, Filmes e SÃ©ries abrem sem "Carregandoâ€¦".
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
      var first = $('items').querySelector('.card-item, .channel-row');
      if (first) { try { first.focus(); } catch (e) { /* ignora */ } }
    }, 40);
    // Ao voltar do player, religa a prÃ©via do canal escolhido.
    var self = this;
    setTimeout(function () {
      if (self.section === MediaKind.LIVE && self.selected) {
        self.renderPreview(self.selected);
      }
    }, 350);
  },

  setSection: function (kind) {
    var self = this;
    var token = ++this.sectionToken;
    this.section = kind;
    this.activeCat = null;
    this.filter = 'all';
    this.page = 0;
    this.currentList = [];
    this.baseList = [];
    this.searchQuery = '';
    this.searchToken++;
    this.searchLoading = false;
    this.searchIndex = {};
    if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
    var searchInput = $('searchInput');
    if (searchInput) searchInput.value = '';
    var clearBtn = $('btnClearSearch');
    if (clearBtn) hide(clearBtn);
    this.selected = null;
    this.epgPrograms = null;
    this.epgToken++;
    this.stopPreview();

    // Cada aba Ã© uma pasta independente: limpa na hora a lista e as
    // categorias da aba anterior, senÃ£o o conteÃºdo antigo fica na tela
    // (ou uma resposta atrasada o traz de volta).
    var holder = $('items');
    if (holder) clear(holder);
    var cats = $('cats');
    if (cats) clear(cats);
    hide($('emptyState'));
    show($('loading'));

    // Em SÃ©ries a tela de detalhe jÃ¡ mostra tudo: a prÃ©via lateral sobra.
    toggle($('previewPane'), kind !== MediaKind.SERIES);

    $('tabTitle').textContent = kind === MediaKind.LIVE ? 'Canais'
      : kind === MediaKind.VOD ? 'Filmes' : 'SÃ©ries';
    $('tabSub').textContent = this.session ? sessionName(this.session) : '';
    $('panelLabel').textContent = 'CATEGORIAS';

    if (this.catCache[kind]) {
      this.renderCats(this.catCache[kind]);
      this.afterCats(kind, this.catCache[kind]);
      return;
    }

    this.source.categories(kind).then(function (list) {
      self.catCache[kind] = list || [];
      if (self.section !== kind || token !== self.sectionToken) return;
      self.renderCats(self.catCache[kind]);
      self.afterCats(kind, self.catCache[kind]);
    }, function () {
      if (self.section !== kind || token !== self.sectionToken) return;
      self.renderCats([]);
      self.afterCats(kind, []);
    });
  },

  /** Depois das pastas: volta para a pasta usada antes na mesma aba. */
  afterCats: function (kind, list) {
    var salva = this.lastCat[kind];
    var use = null;
    for (var i = 0; i < (list || []).length; i++) {
      if (salva && list[i].id === salva) { use = salva; break; }
    }
    // Canais: sem pasta salva abre em "Tudo"; com pasta salva, volta nela.
    if (kind === MediaKind.LIVE) {
      this.selectCat(use);
      return;
    }
    // Nunca pedir "todos os filmes/sÃ©ries": sÃ£o mais de 8 MB e derrubam a TV.
    if (!list || !list.length) {
      this.currentList = [];
      this.renderItems([]);
      return;
    }
    this.selectCat(use || list[0].id);
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

    // "Tudo" sÃ³ nos canais. Em filmes/sÃ©ries a lista completa passa de
    // 8 MB e nÃ£o cabe na memÃ³ria da TV: o usuÃ¡rio escolhe a pasta.
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
    if (this.searchQuery) this.clearSearch(false);
    this.filter = filter;
    this.activeCat = null;
    this.page = 0;
    this.markPanel();
    this.loadItems(null);
  },

  selectCat: function (catId) {
    if (this.searchQuery) this.clearSearch(false);
    this.filter = 'all';
    this.activeCat = catId;
    if (catId) this.lastCat[this.section] = catId;
    this.page = 0;
    this.markPanel();
    this.loadItems(catId);
  },

  /** Marca no painel o item que estÃ¡ ativo. */
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
    var kind = this.section;
    var token = this.sectionToken;
    var cat = catId || '';
    var key = kind + '|' + cat;
    this.page = 0;
    show($('loading'));
    hide($('emptyState'));

    // Troca de pasta Ã© como abrir outra pasta: a lista antiga sai da tela
    // imediatamente (nada de item da pasta anterior clicÃ¡vel durante o load).
    this.baseList = [];
    this.currentList = [];
    this.selected = null;
    this.stopPreview();
    var holder = $('items');
    if (holder) clear(holder);

    if (this.filter !== 'all') {
      var saved = this.filter === 'favorites' ? Store.favorites() : Store.recents();
      var list = [];
      for (var i = 0; i < saved.length; i++) {
        if (saved[i].kind === kind) list.push(saved[i]);
      }
      // Favoritos seguem a ordenaÃ§Ã£o escolhida; "recentes" fica por data de uso.
      if (this.filter === 'favorites' && Store.sortMode() === 'az') list = sortByName(list);
      this.baseList = list;
      this.currentList = this.filteredList(list);
      this.updateSearchUi();
      this.renderItems(this.currentList);
      return;
    }

    if (this.itemCache[key]) {
      this.baseList = this.itemCache[key];
      this.currentList = this.filteredList(this.baseList);
      this.updateSearchUi();
      this.renderItems(this.currentList);
      return;
    }

    this.source.items(kind, catId).then(function (list) {
      list = list || [];
      if (Store.sortMode() === 'az') list = sortByName(list);
      self.itemCache[key] = list;
      self.cacheOrder.push(key);
      self.trimCache();

      // Resposta de uma aba/pasta que jÃ¡ nÃ£o estÃ¡ aberta: guarda no cache,
      // mas nÃ£o mexe na tela (era isso que misturava Canais com Filmes).
      if (self.section !== kind || self.sectionToken !== token ||
          (self.activeCat || '') !== cat) return;

      self.baseList = self.itemCache[key];
      self.currentList = self.filteredList(self.baseList);
      self.updateSearchUi();
      self.renderItems(self.currentList);
    }, function (err) {
      if (self.section !== kind || self.sectionToken !== token ||
          (self.activeCat || '') !== cat) return;
      hide($('loading'));
      $('emptyState').classList.remove('hidden');
      $('emptyState').querySelector('.empty-sub').textContent = err.message || 'Falha ao carregar.';
    });
  },

  /** MantÃ©m no mÃ¡ximo 8 pastas em memÃ³ria (TV tem pouca RAM). */
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
    Thumbs.reset();
    hide($('loading'));

    if (!list || !list.length) {
      show($('emptyState'));
      this.selected = null;
      this.stopPreview();
      var title = 'Nada por aqui ainda';
      var sub = 'Escolha outra pasta na lista ao lado.';
      if (this.searchQuery) {
        title = 'Nenhum resultado';
        sub = 'Nenhum nome combina com "' + this.searchQuery + '". Limpe a busca ou tente outra palavra.';
      } else if (this.filter === 'favorites') {
        title = 'Nenhum favorito ainda';
        sub = 'Aperte a estrela â˜† de um item para salvar aqui.';
      } else if (this.filter === 'recents') {
        title = 'Nada visto ainda';
        sub = 'Os itens que vocÃª abrir aparecem nesta lista.';
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

    // SÃ³ move o foco quando a home estÃ¡ visÃ­vel e o usuÃ¡rio NÃƒO estÃ¡
    // digitando na busca (senÃ£o o teclado da TV fecharia a cada letra).
    if (!$('screen-home').classList.contains('hidden') && !this.typing) {
      var first = holder.querySelector('.card-item, .channel-row');
      if (first) {
        try { first.focus(); } catch (e) { /* ignora */ }
      }
    }

    // Como no Android, o primeiro item jÃ¡ aparece na prÃ©via lateral.
    if (!skipAutoSelect && this.section !== MediaKind.SERIES && list[start] &&
        !$('screen-home').classList.contains('hidden')) {
      this.selectEntry(list[start], true);
    }
  },

  /** Linha de canal: nÃºmero, logo, nome e estrela. */
  buildChannelRow: function (entry, index) {
    var self = this;
    var row = make('div', 'channel-row focusable');
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'button');
    row.setAttribute('data-id', entry.id);

    row.appendChild(make('span', 'num', String(index + 1)));

    var logo = make('span', 'logo');
    if (entry.logo) {
      Thumbs.set(logo, entry.logo);
    }
    row.appendChild(logo);

    row.appendChild(make('span', 'name', entry.name));

    var favorite = Store.isFavorite(entry);
    var star = make('span', 'star focusable', favorite ? 'â˜…' : 'â˜†');
    star.setAttribute('tabindex', '0');
    star.style.color = favorite ? '#FFC107' : '#A8C2B0';
    star.addEventListener('click', function (event) {
      if (event && event.stopPropagation) event.stopPropagation();
      var now = Store.toggleFavorite(entry);
      star.textContent = now ? 'â˜…' : 'â˜†';
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

  /** Barra "Voltar / PrÃ³ximo" entre as pÃ¡ginas da pasta. */
  buildPager: function (total) {
    var self = this;
    var row = make('div', 'pager');

    var prev = makeButton('pager-btn', 'â—€ Voltar');
    prev.setAttribute('data-page', 'prev');
    if (this.page === 0) prev.disabled = true;
    prev.addEventListener('click', function () {
      self.goPage(-1);
    });

    var label = make('span', 'pager-info', 'PÃ¡gina ' + (this.page + 1) + ' de ' + total);

    var next = makeButton('pager-btn', 'PrÃ³ximo â–¶');
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

  /* ======================================================= prÃ©via lateral */

  bindPreview: function () {
    var self = this;

    var pv = $('previewVideo');
    pv.addEventListener('playing', function () {
      self.previewFailed = false;
      self.hidePreviewCover();
      self.previewStatus('', false);
    });
    pv.addEventListener('waiting', function () {
      if (self.previewUrl && !self.previewFailed && pv.currentTime === 0) {
        self.previewStatus('Carregandoâ€¦', false);
      }
    });
    pv.addEventListener('stalled', function () {
      if (self.previewUrl && !self.previewFailed && pv.currentTime === 0) {
        self.previewStatus('Carregandoâ€¦', false);
      }
    });
    pv.addEventListener('error', function () {
      if (self.previewUrl) {
        self.previewFailed = true;
        self.previewStatus('PrÃ©via indisponÃ­vel neste canal.', true);
      }
    });

    $('btnWatch').addEventListener('click', function () {
      var entry = self.ensureSelection();
      if (entry) self.playEntry(entry);
    });

    $('btnPrevItem').addEventListener('click', function () { self.stepItem(-1); });
    $('btnNextItem').addEventListener('click', function () { self.stepItem(1); });

    $('btnFavItem').addEventListener('click', function () {
      var entry = self.ensureSelection();
      if (!entry) return;
      var now = Store.toggleFavorite(entry);
      if (self.selected && String(self.selected.id) === String(entry.id)) self.updateFavStar();
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

    // MantÃ©m AGORA / A SEGUIR atualizados sem nova requisiÃ§Ã£o.
    setInterval(function () {
      if (self.section === MediaKind.LIVE &&
          !$('screen-home').classList.contains('hidden')) {
        self.renderEpg(self.epgPrograms);
      }
    }, 60000);
  },

  /**
   * Garante um item selecionado para os botÃµes da prÃ©via (â˜† e Assistir).
   * Se nada estiver selecionado, usa o primeiro item da lista visÃ­vel.
   */
  ensureSelection: function () {
    if (this.selected) return this.selected;
    var node = document.querySelector('#items [data-id]');
    var id = node ? node.getAttribute('data-id') : null;
    for (var i = 0; i < this.currentList.length; i++) {
      if (id != null && String(this.currentList[i].id) === String(id)) {
        this.selectEntry(this.currentList[i], true);
        return this.currentList[i];
      }
    }
    var first = this.currentList[0];
    if (first) this.selectEntry(first, true);
    return first || null;
  },

  selectEntry: function (entry, silent) {
    if (!entry || this.section === MediaKind.SERIES) return;
    this.selected = entry;

    // Anterior/PrÃ³ximo percorre a lista inteira: se o item cair em outra
    // pÃ¡gina, vira a pÃ¡gina sozinho (como no app Android).
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
      if (entry.rating) meta.push('â˜… ' + Number(entry.rating).toFixed(1));
    }
    $('previewMeta').textContent = meta.join('   Â·   ');

    var plot = entry.plot || '';
    toggle($('previewPlot'), !live && !!plot);
    $('previewPlot').textContent = plot;

    if (live) {
      this.epgPrograms = null;
      this.epgToken++;

      var url = this.source.playUrl(entry);
      var video = $('previewVideo');
      var jaRodando = !!url && this.previewUrl === url && video &&
        video.readyState >= 2 && !video.paused;

      if (jaRodando) {
        this.hidePreviewCover();
        this.previewStatus('', false);
      } else {
        this.showPreviewCover(entry);
        this.previewStatus('Conectandoâ€¦', false);
      }
      // SÃ³ conecta depois que o usuÃ¡rio para de navegar: abrir um stream por
      // linha (segurando a seta) derrubava a TV.
      this.scheduleLivePreview(entry, url);
    } else {
      this.stopPreview();
      this.epgPrograms = null;
      this.epgToken++;
      this.vodToken++;
      this.hidePreviewCover();
      $('previewPoster').style.backgroundImage = entry.logo
        ? 'url("' + String(entry.logo).replace(/"/g, '%22') + '")'
        : '';
      show($('previewPoster'));
      this.scheduleSynopsis(entry);
    }

    this.updateFavStar();
    this.updateStepButtons();
  },

  /**
   * Abre a prÃ©via do canal sÃ³ quando a navegaÃ§Ã£o para.
   * Sem isso, cada linha visitada abria um stream novo â€” segurando a seta a
   * TV chegava a abrir dezenas de conexÃµes e travava.
   */
  scheduleLivePreview: function (entry, url) {
    var self = this;
    if (this.previewDebounce) {
      clearTimeout(this.previewDebounce);
      this.previewDebounce = null;
    }
    if (!url) return;
    this.previewDebounce = setTimeout(function () {
      self.previewDebounce = null;
      if (self.section !== MediaKind.LIVE) return;
      if (!self.selected || String(self.selected.id) !== String(entry.id)) return;
      self.startPreview(url);
      self.loadEpg(entry);
    }, 450);
  },

  /** Sinopse tambÃ©m espera a navegaÃ§Ã£o parar (uma requisiÃ§Ã£o por item). */
  scheduleSynopsis: function (entry) {
    var self = this;
    if (this.synopsisDebounce) {
      clearTimeout(this.synopsisDebounce);
      this.synopsisDebounce = null;
    }
    this.synopsisDebounce = setTimeout(function () {
      self.synopsisDebounce = null;
      if (self.section === MediaKind.LIVE) return;
      if (!self.selected || String(self.selected.id) !== String(entry.id)) return;
      self.loadSynopsis(entry);
    }, 300);
  },

  /** Sinopse do filme: a lista do servidor nÃ£o traz o texto, sÃ³ o detalhe. */
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

    $('previewPlot').textContent = 'Carregando sinopseâ€¦';
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
    el.textContent = 'Sinopse nÃ£o disponÃ­vel para este tÃ­tulo.';
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
    if (entry.rating) meta.push('â˜… ' + Number(entry.rating).toFixed(1));
    if (info && info.genre) meta.push(String(info.genre).split(',')[0]);
    if (meta.length) $('previewMeta').textContent = meta.join('   Â·   ');
  },

  updateFavStar: function () {
    var star = $('btnFavItem');
    if (!star) return;
    var favorite = this.selected ? Store.isFavorite(this.selected) : false;
    star.textContent = favorite ? 'â˜…' : 'â˜†';
    star.style.color = favorite ? '#FFC107' : '#FFFFFF';
  },

  updateStepButtons: function () {
    var index = this.indexOfSelected();
    var prev = $('btnPrevItem');
    var next = $('btnNextItem');
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index < 0 || index >= this.currentList.length - 1;
  },

  /** Capa com o logo do canal enquanto o vÃ­deo conecta (evita a tela preta). */
  showPreviewCover: function (entry) {
    var poster = $('previewPoster');
    if (!poster) return;
    poster.style.backgroundImage = (entry && entry.logo)
      ? 'url("' + String(entry.logo).replace(/"/g, '%22') + '")'
      : '';
    show(poster);
  },

  hidePreviewCover: function () {
    hide($('previewPoster'));
  },

  previewStatus: function (text, isError) {
    var el = $('previewStatus');
    if (!el) return;
    if (!text) {
      hide(el);
      return;
    }
    el.textContent = text;
    el.className = 'preview-status' + (isError ? ' error' : '');
    show(el);
  },

  startPreview: function (url) {
    // Com o player aberto, um segundo video decodificando trava a TV.
    if (!url || (window.App && App.isPlayerOpen())) return;
    if (this.previewUrl === url) {
      var atual = $('previewVideo');
      if (atual && atual.readyState >= 2 && !atual.paused) return;
    }
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

    var self = this;
    this.previewTimer = setTimeout(function () {
      self.previewTimer = null;
      if (!self.previewUrl || self.previewUrl !== url) return;
      var v = $('previewVideo');
      if (!v) return;
      if (v.readyState < 2) {
        self.previewFailed = true;
        self.previewStatus('PrÃ©via indisponÃ­vel neste canal.', true);
      }
    }, 9000);
  },

  stopPreview: function () {
    this.previewUrl = null;
    this.previewFailed = false;
    if (this.previewDebounce) {
      clearTimeout(this.previewDebounce);
      this.previewDebounce = null;
    }
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    var video = $('previewVideo');
    if (video) {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (e) { /* ignora */ }
    }
    this.previewStatus('', false);
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
    now.textContent = 'Consultando programaÃ§Ã£oâ€¦';
    clear($('epgList'));

    Epg.board().then(function (board) {
      if (token !== self.epgToken) return null;
      var found = Epg.find(board, entry.name);
      if (!found) {
        now.className = 'epg-now dim';
        now.textContent = 'ProgramaÃ§Ã£o nÃ£o encontrada para este canal.';
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
      now.textContent = 'ProgramaÃ§Ã£o indisponÃ­vel agora.';
    });
  },

  renderEpg: function (programs) {
    var now = $('epgNow');
    var list = $('epgList');
    if (!now || !list) return;

    clear(list);

    if (!programs || !programs.length) {
      now.className = 'epg-now dim';
      now.textContent = 'ProgramaÃ§Ã£o indisponÃ­vel para este canal.';
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
      Thumbs.set(thumb, entry.logo);
    } else {
      thumb.textContent = (entry.name || '?').charAt(0).toUpperCase();
    }

    if (entry.rating && Number(entry.rating) > 0) {
      thumb.appendChild(make('span', 'badge', Number(entry.rating).toFixed(1)));
    }

    // Estrela de favorito, como no app Android.
    var favorite = Store.isFavorite(entry);
    var star = make('span', 'star focusable', favorite ? 'â˜…' : 'â˜†');
    star.setAttribute('tabindex', '0');
    star.style.color = favorite ? '#FFC107' : '#FFFFFF';
    star.addEventListener('click', function (event) {
      if (event && event.stopPropagation) event.stopPropagation();
      var now = Store.toggleFavorite(entry);
      star.textContent = now ? 'â˜…' : 'â˜†';
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
    $('detailPlot').textContent = 'Carregandoâ€¦';
    $('detailPoster').style.backgroundImage = entry.logo ? 'url("' + String(entry.logo).replace(/"/g, '%22') + '")' : '';
    clear($('seasonTabs'));
    clear($('episodes'));
    $('episodes').textContent = 'Carregandoâ€¦';

    this.source.seriesInfo(entry.id).then(function (detail) {
      if (!detail) {
        $('detailPlot').textContent = 'NÃ£o foi possÃ­vel carregar esta sÃ©rie.';
        $('episodes').textContent = '';
        return;
      }
      self.detail = detail;
      self.renderDetail(detail);
    }, function () {
      $('detailPlot').textContent = 'NÃ£o foi possÃ­vel carregar esta sÃ©rie.';
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
    $('detailPlot').textContent = detail.plot || 'Sem descriÃ§Ã£o.';
    if (detail.cover) {
      $('detailPoster').style.backgroundImage = 'url("' + String(detail.cover).replace(/"/g, '%22') + '")';
    }

    var meta = [];
    if (detail.genre) meta.push(detail.genre);
    if (detail.releaseDate) meta.push(String(detail.releaseDate).substring(0, 4));
    if (detail.rating) meta.push('â˜… ' + detail.rating.toFixed(1));
    var total = 0;
    for (var i = 0; i < detail.seasons.length; i++) total += detail.seasons[i].episodes.length;
    meta.push(total + (total === 1 ? ' episÃ³dio' : ' episÃ³dios'));
    $('detailMeta').textContent = meta.join('   Â·   ');

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
      $('episodes').textContent = 'Nenhum episÃ³dio disponÃ­vel.';
    }

    setTimeout(function () {
      if (App.isPlayerOpen() || $('screen-detail').classList.contains('hidden')) return;
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
      holder.textContent = 'Nenhum episÃ³dio nesta temporada.';
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

  /** Entra no modo demonstraÃ§Ã£o: reproduz os clipes pÃºblicos em sequÃªncia. */
  startDemo: function () {
    this.demoMode = true;
    this.stopPolling();
    this.playDemo(0);
  },

  /** Abre o clipe de Ã­ndice informado. Devolve false quando a fila acabou. */
  playDemo: function (index) {
    if (index < 0 || index >= DEMO_ITEMS.length) return false;
    this.demoIndex = index;
    var item = DEMO_ITEMS[index];
    this.playing = null;
    this.playingSeason = null;
    this.playingEpIndex = -1;
    Player.open(item.url, item.title, false);
    this.updatePlayerNav();
    return true;
  },

  playEntry: function (entry) {
    var url = this.source.playUrl(entry);
    if (!url) {
      toast('NÃ£o foi possÃ­vel montar o endereÃ§o deste item.');
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
      toast('NÃ£o foi possÃ­vel montar o endereÃ§o deste episÃ³dio.');
      return false;
    }
    this.playing = null;
    this.playingSeason = season || null;
    this.playingEpIndex = typeof index === 'number' ? index : -1;
    var name = this.detail ? this.detail.name : 'EpisÃ³dio';
    Player.open(url, name + ' - T' + episode.season + ' E' + episode.number + ' - ' + episode.title, false);
    this.updatePlayerNav();
    return true;
  },

  /**
   * Chamado quando o vÃ­deo termina.
   * SÃ©rie: abre o prÃ³ximo episÃ³dio sozinho (e a temporada seguinte, se acabar a atual).
   * Devolve true quando jÃ¡ comeÃ§ou outro vÃ­deo.
   */
  onPlaybackEnded: function () {
    if (this.demoMode) return this.playDemo(this.demoIndex + 1);
    if (!this.playingSeason) return false;

    var season = this.playingSeason;
    var eps = season.episodes || [];
    var next = this.playingEpIndex + 1;

    if (next >= 0 && next < eps.length) {
      return this.playEpisode(eps[next], season, next);
    }

    var following = this.seasonAfter(season);
    if (following && following.episodes && following.episodes.length) {
      if (App.isPlayerOpen()) {
        this.renderEpisodes(following);
        var tabs = seasonTabs;
        var buttons = tabs ? tabs.getElementsByTagName('button') : [];
        var seasons = (this.detail && this.detail.seasons) || [];
        for (var i = 0; i < buttons.length; i++) {
          if (seasons[i] && seasons[i].number === following.number) buttons[i].classList.add('active');
          else buttons[i].classList.remove('active');
        }
      } else {
        this.showSeason(following);
      }
      return this.playEpisode(following.episodes[0], following, 0);
    }

    return false;
  },

  /** PrÃ³xima temporada (pelo nÃºmero) dentro da sÃ©rie aberta. */
  seasonAfter: function (season) {
    var seasons = (this.detail && this.detail.seasons) || [];
    for (var i = 0; i < seasons.length; i++) {
      if (seasons[i].number === season.number) {
        return i + 1 < seasons.length ? seasons[i + 1] : null;
      }
    }
    return null;
  },

  /** Marca a aba da temporada e redesenha os episÃ³dios na tela de detalhe. */
  showSeason: function (season) {
    var tabs = $('seasonTabs');
    var buttons = tabs.getElementsByTagName('button');
    var seasons = (this.detail && this.detail.seasons) || [];
    for (var i = 0; i < buttons.length; i++) {
      if (seasons[i] && seasons[i].number === season.number) buttons[i].classList.add('active');
      else buttons[i].classList.remove('active');
    }
    this.renderEpisodes(season);
  },

  /** Anterior/PrÃ³ximo com o vÃ­deo rodando: canal, filme ou episÃ³dio. */
  stepPlayback: function (delta) {
    if (this.demoMode) {
      this.playDemo(this.demoIndex + delta);
      return;
    }
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

    if (this.demoMode) {
      hasPrev = this.demoIndex > 0;
      hasNext = this.demoIndex >= 0 && this.demoIndex < DEMO_ITEMS.length - 1;
      prev.disabled = !hasPrev;
      next.disabled = !hasNext;
      toggle(prev.parentNode, true);
      return;
    }

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
    var fromDemo = this.demoMode;
    Player.close();
    this.playing = null;
    this.playingSeason = null;
    this.playingEpIndex = -1;

    if (fromDemo) {
      this.demoMode = false;
      this.demoIndex = -1;
      this.showLogin();
      return;
    }

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
    $('btnBackSettings').addEventListener('click', function () { self.openMenu('settings'); });
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
      toast(next === 'az' ? 'Listas em ordem alfabÃ©tica (Aâ€“Z).' : 'Listas na ordem do servidor.');
    });

    $('setClearFav').addEventListener('click', function () {
      Store.clearFavorites();
      self.renderCats(self.catCache[self.section] || []);
      toast('Favoritos apagados.');
    });

    $('setClearHist').addEventListener('click', function () {
      Store.clearRecents();
      self.renderCats(self.catCache[self.section] || []);
      toast('HistÃ³rico apagado.');
    });

    $('setTerms').addEventListener('click', function () {
      Screens.show('screen-terms');
      Focus.first($('screen-terms'));
    });

    $('setAbout').addEventListener('click', function () {
      self.openInfo('Sobre o Raptor', self.aboutHtml());
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

  /** Janela simples de informaÃ§Ã£o (Sobre / Privacidade). */
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
    var code = this.code || Store.cachedCode() || 'â€”';
    return '<p><b>Raptor Player</b> â€” VIDEO PLAYER para TV.</p>' +
      '<p>VersÃ£o: <b>' + APP_VERSION + '</b><br>' +
      'Aparelho: <b>' + esc(Device.modelName()) + '</b><br>' +
      'CÃ³digo: <b>' + esc(code) + '</b></p>' +
      '<p>AtivaÃ§Ã£o e gerenciamento: <b>raptor-player.netlify.app</b></p>';
  },

  privacyHtml: function () {
    return '<p>O Raptor Player guarda apenas no prÃ³prio aparelho:</p>' +
      '<p>â€¢ o cÃ³digo de identificaÃ§Ã£o da TV;<br>' +
      'â€¢ as listas que vocÃª cadastrou;<br>' +
      'â€¢ favoritos e itens vistos recentemente;<br>' +
      'â€¢ o aceite dos termos de uso.</p>' +
      '<p>Nenhum dado Ã© enviado a terceiros. A ativaÃ§Ã£o consulta apenas o site oficial para verificar se este aparelho foi liberado.</p>';
  },

  openSettings: function () {
    var self = this;
    this.stopPreview();
    this.epgToken++;
    Screens.show('screen-settings');

    var name = this.session ? sessionName(this.session) : 'â€”';
    var mode = this.session ? (this.session.mode === 'M3U' ? 'M3U' : 'XTREAM') : 'â€”';

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
        listLines.push('UsuÃ¡rio: <b>' + esc(this.session.username || 'â€”') + '</b>');
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

    $('acctInfo').textContent = 'Consultandoâ€¦';
    if (!this.source || !this.source.account) {
      $('acctInfo').textContent = 'Lista M3U (sem dados de conta).';
    } else {
      this.source.account().then(function (info) {
        if (!info) {
          $('acctInfo').textContent = 'NÃ£o foi possÃ­vel consultar a conta.';
          return;
        }
        var lines = [];
        if (info.username) lines.push('UsuÃ¡rio: <b>' + esc(info.username) + '</b>');
        if (info.status) lines.push('Status: <b>' + esc(info.status) + '</b>');
        if (info.expiresAt) lines.push('Vence em: <b>' + esc(formatExpiry(info.expiresAt)) + '</b>');
        if (info.maxConnections) lines.push('ConexÃµes: <b>' + esc(info.activeConnections || '0') + ' / ' + esc(info.maxConnections) + '</b>');
        $('acctInfo').innerHTML = lines.length ? lines.join('<br>') : 'Sem dados.';
      });
    }

    setTimeout(function () {
      var first = $('setSwitch') || $('screen-settings').querySelector('.focusable');
      if (first) { try { first.focus(); } catch (e) { /* ignora */ } }
    }, 40);
  },

  deviceHtml: function () {
    return 'CÃ³digo: <b>' + esc(this.code || Store.cachedCode() || 'â€”') + '</b><br>' +
      'Modelo: <b>' + esc(Device.modelName()) + '</b><br>' +
      'VersÃ£o: <b>' + APP_VERSION + '</b>';
  },

  updateSortCard: function () {
    var az = Store.sortMode() === 'az';
    var state = $('sortState');
    if (state) state.textContent = az ? 'Aâ€“Z (alfabÃ©tica)' : 'Ordem do servidor';
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
  currentTitle: '',
  isLive: false,
  tryingHls: false,
  loadTimer: null,
  started: false,
  wantPlay: false,
  autoPlayTries: 0,
  autoPlayTimer: null,
  playPending: false,
  playPendingTimer: null,
  autoRetries: 0,
  attempt: 0,

  /** Liga os eventos do <video> uma Ãºnica vez. */
  bindVideo: function () {
    var self = this;
    this.video = $('video');

    this.video.addEventListener('error', function () {
      if (!App.isPlayerOpen() || !self.currentUrl) return;
      self.onError();
    }, false);

    // Alguns modelos da LG sÃ³ comeÃ§am a tocar se pedirmos play() de novo
    // quando os primeiros dados chegam. Sem isso o vÃ­deo fica parado.
    this.video.addEventListener('loadeddata', function () { self.onReady(); }, false);
    this.video.addEventListener('canplay', function () { self.onReady(); }, false);
    this.video.addEventListener('playing', function () {
      self.started = true;
      self.hideLoading();
      self.clearWatchdog();
      self.scheduleHide();
    }, false);
    this.video.addEventListener('waiting', function () {
      if (!self.started) self.showLoading();
    }, false);

    this.video.addEventListener('timeupdate', function () { self.onTime(); }, false);
    this.video.addEventListener('loadedmetadata', function () { self.onTime(); }, false);
    this.video.addEventListener('ended', function () {
      // SÃ©rie emenda o prÃ³ximo episÃ³dio; se nÃ£o houver, sÃ³ mostra os controles.
      if (App.onPlaybackEnded && App.onPlaybackEnded()) return;
      self.showOverlay();
    }, false);
    this.video.addEventListener('click', function () { self.toggleOverlay(); }, false);
  },

  open: function (url, title, isLive) {
    if (!this.video) this.bindVideo();

    Screens.show('screen-player');
    hide($('playerError'));
    hide($('playerOverlay'));

    this.currentTitle = title || '';
    $('playerTitle').textContent = this.currentTitle;
    var badge = $('playerBadge');
    badge.textContent = isLive ? 'AO VIVO' : 'VÃDEO';
    badge.className = 'player-badge' + (isLive ? '' : ' vod');
    toggle($('progress'), !isLive);
    toggle($('skipBackRow'), !isLive);
    toggle($('skipFwdRow'), !isLive);

    this.currentUrl = url;
    this.isLive = isLive;
    this.tryingHls = false;
    this.started = false;
    this.wantPlay = true;
    this.autoPlayTries = 0;
    this.autoRetries = 0;
    this.settlePlay();
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
    this.clearWatchdog();

    this.destroyHls();
    var video = this.video;
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) { /* ignora */ }

    this.showOverlay();
    this.showLoading();

    video.src = url;
    this.tryPlay();
    this.armWatchdog();

    setTimeout(function () {
      var button = $('btnPlay');
      if (button) { try { button.focus(); } catch (e) { /* ignora */ } }
    }, 60);
  },

  /** Pede o play e, se a TV recusar, tenta de novo sozinho em instantes. */
  /** Libera o sinal de "play em andamento" (inclusive em caso de erro). */
  settlePlay: function () {
    if (this.playPendingTimer) {
      clearTimeout(this.playPendingTimer);
      this.playPendingTimer = null;
    }
    this.playPending = false;
  },

  tryPlay: function () {
    var self = this;
    if (!this.video || !this.currentUrl) return;
    // Nunca deixe duas chamadas play() disputarem o mesmo video: isso
    // trava a decodificacao em alguns modelos da LG.
    if (this.playPending) return;
    if (!this.video.paused) { this.onStarted(); return; }
    this.playPending = true;
    // Em alguns modelos a promise do play() nunca resolve (nem rejeita)
    // quando o video falha. Esse timer impede que o travamento fique preso.
    this.playPendingTimer = setTimeout(function () {
      self.settlePlay();
    }, 8000);
    var started;
    try {
      started = this.video.play();
    } catch (e) {
      this.settlePlay();
      this.scheduleAutoPlay();
      return;
    }
    if (started && started.then) {
      started.then(function () {
        self.settlePlay();
        self.onStarted();
      }, function () {
        // Autoplay recusado: mantem os controles e insiste sem o usuario.
        self.settlePlay();
        self.showOverlay();
        self.scheduleAutoPlay();
      });
    } else {
      this.settlePlay();
      this.onStarted();
    }
  },

  /** Play aceito: cancela as novas tentativas e libera o watchdog. */
  onStarted: function () {
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
    this.started = true;
    this.autoPlayTries = 0;
    this.hideLoading();
    this.clearWatchdog();
    this.scheduleHide();
  },

  /** Repete o play algumas vezes: alguns modelos so tocam apos os dados. */
  scheduleAutoPlay: function () {
    var self = this;
    if (!this.wantPlay || !this.currentUrl || this.autoPlayTimer) return;
    this.autoPlayTries = this.autoPlayTries || 0;
    if (this.autoPlayTries >= 8) return;
    var delay = 700 + this.autoPlayTries * 500;
    this.autoPlayTries += 1;
    this.autoPlayTimer = setTimeout(function () {
      self.autoPlayTimer = null;
      if (!self.wantPlay || !self.currentUrl || !App.isPlayerOpen()) return;
      if (self.video && self.video.paused) self.tryPlay();
    }, delay);
  },

  /** Chegaram dados suficientes: se ainda estiver parado, insiste no play. */
  onReady: function () {
    if (!this.currentUrl) return;
    if (!this.started) this.hideLoading();
    if (this.wantPlay && this.video && this.video.paused) this.tryPlay();
  },

  /**
   * Tela preta nunca mais: se o vÃ­deo nÃ£o trouxe imagem, reconecta sozinho
   * (o mesmo endereÃ§o costuma abrir na hora na tentativa seguinte) e, se
   * ainda assim nÃ£o vier nada, avisa com o botÃ£o "Tentar de novo".
   */
  armWatchdog: function () {
    var self = this;
    this.clearWatchdog();
    this.loadTimer = setTimeout(function () {
      self.loadTimer = null;
      if (!App.isPlayerOpen() || !self.currentUrl) return;
      var video = self.video;
      if (!video) return;

      if (video.readyState >= 2) {
        // Tem dados: sÃ³ nÃ£o comeÃ§ou (play recusado ou travado).
        if (self.wantPlay && video.paused) self.tryPlay();
        return;
      }

      if (self.autoRetries < 3) {
        self.autoRetries += 1;
        self.reconnect();
        return;
      }

      self.showError('O servidor demorou para responder. Toque em "Tentar de novo".');
    }, 15000);
  },

  /** Recarrega o mesmo endereÃ§o mantendo o tÃ­tulo e o tipo (ao vivo/vÃ­deo). */
  reconnect: function () {
    var video = this.video;
    if (!video || !this.currentUrl) return;

    this.started = false;
    this.tryingHls = false;
    this.settlePlay();
    this.autoPlayTries = 0;
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
    this.destroyHls();
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) { /* ignora */ }

    // O servidor Ã s vezes deixa a conexÃ£o anterior presa e nunca entrega os
    // dados. Um parÃ¢metro novo forÃ§a uma conexÃ£o limpa (sÃ³ em filmes/sÃ©ries:
    // em canal ao vivo ele poderia quebrar a lista HLS).
    var url = this.currentUrl;
    if (!this.isLive) {
      url += (url.indexOf('?') < 0 ? '?' : '&') + 'r=' + Date.now();
    }

    this.showLoading('Conectando de novoâ€¦');
    video.src = url;
    this.tryPlay();
    this.armWatchdog();
  },

  clearWatchdog: function () {
    if (this.loadTimer) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
  },

  showLoading: function (text) {
    $('playerLoadingText').textContent = text || 'Carregandoâ€¦';
    show($('playerLoading'));
  },

  hideLoading: function () {
    hide($('playerLoading'));
  },

  /** Tenta abrir o mesmo endereÃ§o de novo (botÃ£o do aviso de erro). */
  retry: function () {
    if (!this.currentUrl) return;
    this.open(this.currentUrl, this.currentTitle, this.isLive);
  },

  onError: function () {
    this.settlePlay();
    if (this.tryingHls || !this.currentUrl) {
      this.showError('Verifique se o link ainda estÃ¡ disponÃ­vel.');
      return;
    }
    if (window.Hls && Hls.isSupported()) {
      this.tryingHls = true;
      this.startHls(this.currentUrl);
    } else {
      this.showError('Este formato nÃ£o Ã© suportado nesta TV.');
    }
  },

  startHls: function (url) {
    var self = this;
    this.destroyHls();

    var hls = new Hls({ enableWorker: false, lowLatencyMode: false });
    this.hls = hls;

    hls.on(Hls.Events.ERROR, function (event, data) {
      if (data && data.fatal) {
        self.showError('NÃ£o foi possÃ­vel abrir este vÃ­deo.');
      }
    });

    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      self.tryPlay();
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
    this.settlePlay();
    this.clearWatchdog();
    this.hideLoading();
    hide($('playerOverlay'));
    $('playerErrorSub').textContent = message || '';
    show($('playerError'));
    setTimeout(function () {
      var button = $('btnRetryPlay');
      if (button) { try { button.focus(); } catch (e) { /* ignora */ } }
    }, 10);
  },

  play: function () {
    if (!this.video) return;
    this.wantPlay = true;
    this.tryPlay();
    this.updatePlayButton();
    this.scheduleHide();
  },

  pause: function () {
    if (!this.video) return;
    this.wantPlay = false;
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
    button.textContent = this.video.paused ? 'â–¶' : 'âšâš';
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

  /** Clique na barra: pula direto para a posicao tocada. */
  seekToRatio: function (ratio) {
    if (!this.video || this.isLive) return;
    var total = this.video.duration;
    if (!isFinite(total) || total <= 0) return;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    this.video.currentTime = total * ratio;
    this.onTime();
    this.showOverlay();
    this.scheduleHide();
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
    this.clearWatchdog();
    this.hideLoading();
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.settlePlay();
    this.started = false;
    this.wantPlay = false;
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

/* ========================================================== inicializaÃ§Ã£o */

document.addEventListener('DOMContentLoaded', function () {
  Player.bindVideo();
  $('btnPlay').addEventListener('click', function () { Player.toggle(); });
  $('btnRetryPlay').addEventListener('click', function () { Player.retry(); });
  var progressBar = $('progressBar');
  if (progressBar) {
    progressBar.addEventListener('click', function (event) {
      var rect = progressBar.getBoundingClientRect();
      if (!rect.width) return;
      Player.seekToRatio((event.clientX - rect.left) / rect.width);
    });
  }
  var skipButtons = document.querySelectorAll('.pbtn.skip[data-seek]');
  for (var si = 0; si < skipButtons.length; si++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var delta = parseInt(btn.getAttribute('data-seek'), 10) || 0;
        Player.seek(delta);
      });
    })(skipButtons[si]);
  }
  App.init();
});
