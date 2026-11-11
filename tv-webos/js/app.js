/* Reptor Player — webOS. Controlador principal. */

var App = {

  session: null,
  source: null,
  section: MediaKind.LIVE,
  activeCat: null,
  catCache: {},
  itemCache: {},
  detail: null,
  detailItem: null,

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
      self.boot();
    });

    this.bindLogin();
    this.bindSettings();

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

    Screens.show('screen-home');
    this.renderRail();
    this.setSection(MediaKind.LIVE);
  },

  goHome: function () {
    Screens.show('screen-home');
    setTimeout(function () {
      var active = document.querySelector('.rail-item.active');
      if (active) { try { active.focus(); } catch (e) { /* ignora */ } }
    }, 40);
  },

  renderRail: function () {
    var self = this;
    var rail = $('rail');
    clear(rail);

    var entries = [
      { kind: MediaKind.LIVE, label: 'Canais' },
      { kind: MediaKind.VOD, label: 'Filmes' },
      { kind: MediaKind.SERIES, label: 'Séries' },
      { sep: true },
      { action: 'settings', label: 'Ajustes' },
      { action: 'exit', label: 'Sair' }
    ];

    for (var i = 0; i < entries.length; i++) {
      (function (entry) {
        if (entry.sep) {
          rail.appendChild(make('div', 'rail-sep'));
          return;
        }
        var button = makeButton('rail-item', entry.label);
        button.setAttribute('data-kind', entry.kind || entry.action || '');
        if (entry.kind === self.section) button.classList.add('active');

        button.addEventListener('click', function () {
          if (entry.kind) {
            self.setSection(entry.kind);
          } else if (entry.action === 'settings') {
            self.openSettings();
          } else {
            self.exitApp();
          }
        });

        rail.appendChild(button);
      })(entries[i]);
    }
  },

  setSection: function (kind) {
    var self = this;
    this.section = kind;
    this.activeCat = null;

    var items = document.querySelectorAll('.rail-item');
    for (var i = 0; i < items.length; i++) {
      if (items[i].getAttribute('data-kind') === kind) items[i].classList.add('active');
      else items[i].classList.remove('active');
    }

    $('crumbs').textContent = kind === MediaKind.LIVE ? 'Canais'
      : kind === MediaKind.VOD ? 'Filmes' : 'Séries';

    hide($('emptyState'));
    show($('loading'));

    if (this.catCache[kind]) {
      this.renderCats(this.catCache[kind]);
      this.loadItems(null);
      return;
    }

    this.source.categories(kind).then(function (list) {
      self.catCache[kind] = list;
      self.renderCats(list);
      self.loadItems(null);
    }, function () {
      self.renderCats([]);
      self.loadItems(null);
    });
  },

  renderCats: function (list) {
    var self = this;
    var holder = $('cats');
    clear(holder);

    var all = makeButton('cat active', 'Todas');
    all.setAttribute('data-cat', '');
    all.addEventListener('click', function () {
      self.selectCat(null);
    });
    holder.appendChild(all);

    for (var i = 0; i < list.length; i++) {
      (function (cat) {
        var button = makeButton('cat', cat.name);
        button.setAttribute('data-cat', cat.id);
        button.addEventListener('click', function () {
          self.selectCat(cat.id);
        });
        holder.appendChild(button);
      })(list[i]);
    }
  },

  selectCat: function (catId) {
    this.activeCat = catId;

    var buttons = $('cats').getElementsByTagName('button');
    for (var i = 0; i < buttons.length; i++) {
      var value = buttons[i].getAttribute('data-cat') || '';
      if ((catId || '') === value) buttons[i].classList.add('active');
      else buttons[i].classList.remove('active');
    }

    this.loadItems(catId);
  },

  loadItems: function (catId) {
    var self = this;
    var key = this.section + '|' + (catId || '');
    show($('loading'));
    hide($('emptyState'));

    if (this.itemCache[key]) {
      this.renderItems(this.itemCache[key]);
      return;
    }

    this.source.items(this.section, catId).then(function (list) {
      self.itemCache[key] = list;
      self.renderItems(list);
    }, function (err) {
      hide($('loading'));
      $('emptyState').classList.remove('hidden');
      $('emptyState').querySelector('.empty-sub').textContent = err.message || 'Falha ao carregar.';
    });
  },

  renderItems: function (list) {
    var self = this;
    var holder = $('items');
    clear(holder);
    hide($('loading'));

    if (!list || !list.length) {
      show($('emptyState'));
      $('emptyState').querySelector('.empty-title').textContent = 'Nada por aqui ainda';
      $('emptyState').querySelector('.empty-sub').textContent = 'Escolha outra pasta na lista ao lado.';
      return;
    }

    hide($('emptyState'));

    var frag = document.createDocumentFragment();
    for (var i = 0; i < list.length; i++) {
      frag.appendChild(this.buildCard(list[i]));
    }
    holder.appendChild(frag);

    var first = holder.querySelector('.card-item');
    if (first) {
      try { first.focus(); } catch (e) { /* ignora */ }
    }
  },

  buildCard: function (entry) {
    var self = this;
    var card = make('button', 'card-item focusable' + (entry.kind === MediaKind.LIVE ? ' live' : ''));
    card.setAttribute('tabindex', '0');
    card.type = 'button';

    var thumb = make('div', 'thumb');
    if (entry.logo) {
      thumb.style.backgroundImage = 'url("' + String(entry.logo).replace(/"/g, '%22') + '")';
    } else {
      thumb.textContent = (entry.name || '?').charAt(0).toUpperCase();
    }

    var name = make('div', 'name', entry.name);
    card.appendChild(thumb);
    card.appendChild(name);

    card.addEventListener('click', function () {
      if (entry.kind === MediaKind.SERIES) {
        self.openDetail(entry);
      } else {
        self.playEntry(entry);
      }
    });

    return card;
  },

  /* ============================================================= detalhe */

  openDetail: function (entry) {
    var self = this;
    this.detailItem = entry;

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
      (function (episode) {
        var button = makeButton('episode', '');
        button.appendChild(make('span', 'num', 'T' + episode.season + ' E' + episode.number));
        button.appendChild(make('span', 'ep-name', episode.title));
        button.addEventListener('click', function () {
          self.playEpisode(episode);
        });
        holder.appendChild(button);
      })(season.episodes[i]);
    }
  },

  /* ============================================================== player */

  playEntry: function (entry) {
    var url = this.source.playUrl(entry);
    if (!url) {
      toast('Não foi possível montar o endereço deste item.');
      return;
    }
    Player.open(url, entry.name, entry.kind === MediaKind.LIVE);
  },

  playEpisode: function (episode) {
    var url = this.source.episodeUrl(episode);
    if (!url) {
      toast('Não foi possível montar o endereço deste episódio.');
      return;
    }
    var name = this.detail ? this.detail.name : 'Episódio';
    Player.open(url, name + ' · T' + episode.season + ' E' + episode.number + ' — ' + episode.title, false);
  },

  closePlayer: function () {
    Player.close();
    if (this.detail && !$('screen-detail').classList.contains('hidden')) {
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

    $('btnReload').addEventListener('click', function () {
      self.catCache = {};
      self.itemCache = {};
      toast('Conteúdo recarregado.');
      self.setSection(self.section);
    });

    $('btnTerms').addEventListener('click', function () {
      Screens.show('screen-terms');
      Focus.first($('screen-terms'));
    });

    $('btnLogout').addEventListener('click', function () {
      Store.clearSession();
      self.session = null;
      self.source = null;
      self.showLogin();
    });
  },

  openSettings: function () {
    var self = this;
    Screens.show('screen-settings');

    $('activeList').textContent = this.session ? sessionName(this.session) : '—';
    $('deviceInfo').innerHTML = 'Código: <b>' + esc(this.code || Store.cachedCode() || '—') + '</b><br>' +
      'Modelo: <b>' + esc(Device.modelName()) + '</b><br>' +
      'Versão: <b>1.0.0</b>';

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
      var first = $('screen-settings').querySelector('.focusable');
      if (first) { try { first.focus(); } catch (e) { /* ignora */ } }
    }, 40);
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
