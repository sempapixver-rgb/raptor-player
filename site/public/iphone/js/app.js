/* Raptor Player — versão instalável no iPhone (Safari → Adicionar à Tela Inicial).
   Camada de dados reaproveitada do app webOS; aqui só a interface móvel. */

var PAGE = 60;

var DEMO = [
  { url: 'https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/demo-1.mp4', title: 'Exemplo 1 · Sintel (720p)' },
  { url: 'https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/demo-2.mp4', title: 'Exemplo 2 · Big Buck Bunny (trailer)' },
  { url: 'https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/demo-3.mp4', title: 'Exemplo 3 · Sintel (trailer)' },
  { url: 'https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/demo-4.mp4', title: 'Exemplo 4 · Águas-vivas (720p)' }
];

var App = {
  session: null,
  source: null,
  tab: 'channels',
  cats: { LIVE: null, VOD: null, SERIES: null },
  view: { LIVE: [], VOD: [], SERIES: [] },
  pages: { LIVE: 0, VOD: 0, SERIES: 0 },
  filters: { LIVE: 0, VOD: 0, SERIES: 0 },
  queries: { LIVE: '', VOD: '', SERIES: '' },
  sort: 'server',
  selectedChannel: null,
  epgCache: {},
  pollCount: 0,
  pollTimer: null,
  // player
  queue: [],
  pIndex: 0,
  pUrl: '',
  hls: null,
  controlsTimer: null,
  lastSave: 0,
  detail: null
};

/* ============================================================== INÍCIO */

document.addEventListener('DOMContentLoaded', function () {
  bind();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  if (!Store.termsAccepted()) {
    show('screen-terms');
    return;
  }
  restoreLocalPlaylist();
  var session = Store.session();
  if (session) enter(session);
  else {
    show('screen-login');
    startActivation();
    loadSavedLists();
  }
  setInterval(updateClock, 30000);
  updateClock();
});

function updateClock() {
  var d = new Date();
  var el = $('clock');
  if (el) el.textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

function restoreLocalPlaylist() {
  var s = Store.session();
  if (s && s.mode === 'M3U' && /^local:/.test(s.m3uUrl)) {
    var text = Store.get('localM3u', '');
    if (text) {
      s.m3uUrl = URL.createObjectURL(new Blob([text], { type: 'application/vnd.apple.mpegurl' }));
      Store.setSession(s);
    }
  }
}

function show(id) {
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) screens[i].classList.add('hidden');
  var target = $(id);
  if (target) target.classList.remove('hidden');
  if (id === 'screen-main') window.scrollTo(0, 0);
}

function bind() {
  $('terms-accept').onclick = function () { Store.acceptTerms(); show('screen-login'); startActivation(); loadSavedLists(); };
  $('terms-decline').onclick = function () {
    toast('É necessário aceitar os termos para usar o Raptor.');
  };

  $('login-mode').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-mode]');
    if (!b) return;
    var buttons = this.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) buttons[i].classList.remove('active');
    b.classList.add('active');
    toggle($('xtream-fields'), b.dataset.mode === 'XTREAM');
    toggle($('m3u-fields'), b.dataset.mode === 'M3U');
    hide($('login-error'));
  });

  $('smart-paste').onclick = function () {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (t) { $('smart-link').value = t; smartDetect(); },
        function () { toast('Não foi possível colar. Use o campo de texto.'); });
    } else toast('Toque e segure no campo para colar.');
  };
  $('smart-link').addEventListener('input', smartDetect);
  $('activation-check').onclick = function () { checkActivation(true); };
  $('import-btn').onclick = function () { $('file-input').click(); };
  $('file-input').onchange = function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      Store.set('localM3u', String(reader.result || ''));
      $('m3u-url').value = 'local:' + file.name;
      setMode('M3U');
      toast('Arquivo importado. Toque em Entrar.');
    };
    reader.readAsText(file);
  };
  $('login-submit').onclick = submitLogin;
  $('demo-btn').onclick = function () { openPlayer(DEMO.slice(), 0, true); };

  $('main-tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (b) setTab(b.dataset.tab);
  });
  $('refresh-btn').onclick = function () {
    App.cats = { LIVE: null, VOD: null, SERIES: null };
    renderTab();
    toast('Catálogo será recarregado.');
  };
  $('tab-content').addEventListener('click', onTabClick);
  $('tab-content').addEventListener('input', onTabInput);
  $('series-back').onclick = function () { show('screen-main'); };
  $('series-content').addEventListener('click', onSeriesClick);

  $('player-close').onclick = closePlayer;
  $('play-btn').onclick = function () { togglePlay(); showControls(); };
  $('prev-btn').onclick = function () { goItem(-1); };
  $('next-btn').onclick = function () { goItem(1); };
  $('speed-btn').onclick = cycleSpeed;
  $('player-tap').onclick = function () { toggle($('player-ui'), $('player-ui').classList.contains('hidden')); showControls(); };
  $('player-retry').onclick = function () { hide($('player-error')); loadVideo(App.pUrl, true); };
  $('seek').addEventListener('input', function () {
    var d = video().duration;
    if (isFinite(d) && d > 0) video().currentTime = d * (parseFloat(this.value) / 100);
  });
  var skips = document.querySelectorAll('[data-skip]');
  for (var i = 0; i < skips.length; i++) {
    skips[i].onclick = function () { skipSeconds(parseFloat(this.dataset.skip)); };
  }
  video().addEventListener('timeupdate', onTime);
  video().addEventListener('loadedmetadata', onTime);
  video().addEventListener('playing', function () { $('play-btn').textContent = '❚❚'; hide($('buffering')); showControls(); });
  video().addEventListener('pause', function () { $('play-btn').textContent = '▶'; });
  video().addEventListener('waiting', function () { show($('buffering')); });
  video().addEventListener('ended', function () {
    if (App.autoAdvance && App.queue.length > 1 && App.pIndex < App.queue.length - 1) goItem(1);
  });
  video().addEventListener('error', function () {
    if (App.hls) return;
    playerError('Não foi possível reproduzir este vídeo.');
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && App.pUrl) savePosition();
  });
}

/* ============================================================== LOGIN */

function setMode(mode) {
  var buttons = $('login-mode').querySelectorAll('button');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle('active', buttons[i].dataset.mode === mode);
  }
  toggle($('xtream-fields'), mode === 'XTREAM');
  toggle($('m3u-fields'), mode === 'M3U');
}

function smartDetect() {
  var found = detectSmartLink($('smart-link').value);
  if (!found) return;
  if (found.base && !found.session) {
    setMode('XTREAM');
    $('host').value = found.base;
    $('smart-hint').textContent = 'Servidor Xtream detectado.';
    show($('smart-hint'));
    return;
  }
  if (!found.session) return;
  var s = found.session;
  if (found.mode === 'XTREAM') {
    setMode('XTREAM');
    if (s.baseUrl) $('host').value = s.baseUrl;
    if (s.username) $('user').value = s.username;
    if (s.password) $('pass').value = s.password;
    $('smart-hint').textContent = s.username ? 'Xtream detectado: servidor, usuário e senha preenchidos.'
      : 'Servidor Xtream detectado.';
  } else {
    setMode('M3U');
    $('m3u-url').value = s.m3uUrl;
    $('smart-hint').textContent = 'Lista M3U detectada.';
  }
  show($('smart-hint'));
}

function loadSavedLists() {
  var lists = Store.savedLists();
  var box = $('saved-lists');
  if (!lists.length) { hide(box); return; }
  show(box);
  var html = '';
  for (var i = 0; i < Math.min(6, lists.length); i++) {
    html += '<div class="saved-item">' +
      '<button class="grow" data-open="' + i + '"><b>' + esc(sessionName(lists[i])) + '</b>' +
      '<div class="sub">' + (lists[i].mode === 'XTREAM' ? 'Xtream Codes' : 'Lista M3U') + '</div></button>' +
      '<button class="link" data-remove="' + i + '">Remover</button></div>';
  }
  var items = $('saved-list-items');
  items.innerHTML = html;
  items.onclick = function (e) {
    var open = e.target.closest('[data-open]');
    var remove = e.target.closest('[data-remove]');
    if (open) login(lists[parseInt(open.dataset.open, 10)]);
    if (remove) { Store.removeList(lists[parseInt(remove.dataset.remove, 10)]); loadSavedLists(); }
  };
}

function submitLogin() {
  var btn = $('login-submit');
  var mode = $('login-mode').querySelector('button.active').dataset.mode;
  var session;
  if (mode === 'XTREAM') {
    var host = $('host').value.trim(), user = $('user').value.trim(), pass = $('pass').value.trim();
    if (!host || !user || !pass) { loginError('Preencha servidor, usuário e senha.'); return; }
    session = { mode: 'XTREAM', baseUrl: normalizeBase(host), username: user, password: pass, m3uUrl: '', label: '' };
  } else {
    var url = $('m3u-url').value.trim();
    if (!url) { loginError('Informe a URL da lista ou importe um arquivo .m3u.'); return; }
    session = { mode: 'M3U', m3uUrl: url, baseUrl: '', username: '', password: '', label: '' };
  }
  if (mixedBlocked(session.mode === 'M3U' ? session.m3uUrl : session.baseUrl)) {
    loginError(mixedMessage());
    return;
  }
  btn.disabled = true; btn.textContent = 'Conectando…';
  hide($('login-error'));
  createSource(session).check().then(function (error) {
    btn.disabled = false; btn.textContent = 'Entrar';
    if (error) loginError(error); else login(session);
  });
}

function loginError(text) {
  var el = $('login-error');
  el.textContent = text; show(el);
}

function login(session) {
  Store.saveList(session);
  Store.setSession(session);
  enter(session);
}

function enter(session) {
  App.session = session;
  App.source = createSource(session);
  App.cats = { LIVE: null, VOD: null, SERIES: null };
  App.view = { LIVE: [], VOD: [], SERIES: [] };
  show('screen-main');
  setTab('channels');
  if (session.label) $('account-line').textContent = session.label + ' · ' + sessionName(session);
  else $('account-line').textContent = sessionName(session);
}

function startActivation() {
  if (App.pollTimer) clearInterval(App.pollTimer);
  Device.code().then(function (code) {
    $('device-code').textContent = formatMac(code);
    var box = $('qr-box');
    box.innerHTML = '';
    try {
      new QRCode(box, { text: Activation.siteLink(code), width: 92, height: 92,
        colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    } catch (e) { box.textContent = 'QR indisponível'; }
    checkActivation(false);
    App.pollTimer = setInterval(function () { checkActivation(false); }, 5000);
  });
}

function checkActivation(manual) {
  var code = normalizeCode($('device-code').textContent);
  if (!code || code === '—') return;
  if (manual) $('activation-status').textContent = 'Verificando ativação…';
  Activation.fetch(code).then(function (session) {
    if (!session) {
      if (manual) {
        App.pollCount = 20;
        $('activation-status').textContent = 'Ainda não encontrei. Confira o código no site.';
      }
      return;
    }
    $('activation-status').textContent = 'Ativação recebida. Entrando…';
    if (App.pollTimer) clearInterval(App.pollTimer);
    login(session);
  });
}

/* =============================================================== TABS */

function setTab(tab) {
  App.tab = tab;
  var buttons = $('main-tabs').querySelectorAll('button');
  for (var i = 0; i < buttons.length; i++) buttons[i].classList.toggle('active', buttons[i].dataset.tab === tab);
  $('tab-title').textContent = tab === 'channels' ? 'Canais ao vivo'
    : tab === 'movies' ? 'Filmes' : tab === 'series' ? 'Séries' : 'Ajustes';
  renderTab();
}

function renderTab() {
  var kind = App.tab === 'channels' ? MediaKind.LIVE
    : App.tab === 'movies' ? MediaKind.VOD
      : App.tab === 'series' ? MediaKind.SERIES : null;
  if (App.tab === 'settings') { renderSettings(); return; }
  if (!App.source) return;
  var box = $('tab-content');
  box.innerHTML = '<div class="state"><div class="spinner"></div>Carregando…</div>';
  var needCategories = !App.cats[kind];
  var catPromise = needCategories ? App.source.categories(kind) : Promise.resolve(App.cats[kind]);
  catPromise.then(function (cats) {
    if (needCategories) App.cats[kind] = cats;
    if (App.tab === 'channels') renderChannels(cats);
    else if (App.tab === 'movies') renderMovies(cats);
    else if (App.tab === 'series') renderSeries(cats);
  });
}

function currentKind() {
  return App.tab === 'channels' ? MediaKind.LIVE : App.tab === 'movies' ? MediaKind.VOD : MediaKind.SERIES;
}

function filteredItems(kind) {
  var filter = App.filters[kind];
  var base;
  if (filter === 1) {
    base = Store.favorites().filter(function (e) { return e.kind === kind; });
  } else if (filter === 2) {
    base = Store.recents().filter(function (e) { return e.kind === kind; });
  } else {
    base = App.view[kind] || [];
  }
  var q = fold(App.queries[kind]);
  if (q) base = base.filter(function (e) { return fold(e.name).indexOf(q) >= 0; });
  if (App.sort === 'az' && kind !== MediaKind.LIVE) base = sortByName(base);
  return base;
}

function visibleItems(kind) {
  var list = filteredItems(kind);
  var start = Math.min(App.pages[kind] * PAGE, Math.max(0, list.length - 1));
  return { list: list, page: list.slice(start, start + PAGE), total: Math.max(1, Math.ceil(list.length / PAGE)) };
}

function searchHeader(kind, placeholder, showSort) {
  var q = App.queries[kind];
  var h = '<div class="searchbar"><span>⌕</span><input type="search" data-search="' + kind +
    '" placeholder="' + esc(placeholder) + '" value="' + esc(q) + '"></div>' +
    '<div class="filters">';
  var names = ['Todos', 'Favoritos', 'Recentes'];
  for (var i = 0; i < names.length; i++) {
    h += '<button data-filter="' + i + '" class="' + (App.filters[kind] === i ? 'active' : '') + '">' + names[i] + '</button>';
  }
  h += '</div>';
  if (showSort) h += '<div class="meta">' + (App.sort === 'az' ? 'Ordem: A-Z' : 'Ordem: servidor') +
    ' <button class="link" data-action="sort">alterar</button></div>';
  return h;
}

function chips(cats, kind, showAll) {
  var sel = App.category ? App.category[kind] : null;
  var h = '<div class="chip-row">';
  if (showAll) h += '<button class="chip ' + (!sel ? 'active' : '') + '" data-cat="">Tudo</button>';
  for (var i = 0; i < cats.length; i++) {
    h += '<button class="chip ' + (sel === cats[i].id ? 'active' : '') + '" data-cat="' +
      esc(cats[i].id) + '">' + esc(cats[i].name) + '</button>';
  }
  return h + '</div>';
}

function loadView(kind, cats) {
  var category = App.category ? App.category[kind] : null;
  var query = App.queries[kind];
  var source = App.source;
  var filter = App.filters[kind];
  var promise;
  if (filter === 1) promise = Promise.resolve(Store.favorites().filter(function (e) { return e.kind === kind; }));
  else if (filter === 2) promise = Promise.resolve(Store.recents().filter(function (e) { return e.kind === kind; }));
  else if (query.length >= 2) promise = source.items(kind, null);
  else if (kind === MediaKind.SERIES) promise = source.items(kind, category);
  else promise = source.items(kind, category || (cats && cats.length ? cats[0].id : null));
  return promise.then(function (list) {
    App.view[kind] = list || [];
    // A categoria padrão acompanha a primeira pasta, como no Android.
    if (!category && kind !== MediaKind.SERIES && cats && cats.length) {
      App.category = App.category || {};
      App.category[kind] = cats[0].id;
    }
  });
}

function renderChannels(cats) {
  var kind = MediaKind.LIVE;
  loadView(kind, cats).then(function () {
    if (App.tab !== 'channels') return;
    var v = visibleItems(kind);
    var h = searchHeader(kind, 'Buscar canais', false) + chips(cats, kind, true);
    h += '<div class="meta">' + v.list.length + (App.queries[kind] ? ' resultados' : ' canais') + '</div>';
    if (!v.page.length) h += '<div class="state"><span class="big">⌕</span>' + emptyText(kind) + '</div>';
    for (var i = 0; i < v.page.length; i++) {
      var e = v.page[i];
      var number = App.pages[kind] * PAGE + i + 1;
      h += '<div class="channel"><span class="num">' + number + '</span>' +
        (e.logo ? '<img class="logo" src="' + esc(e.logo) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '<span class="logo"></span>') +
        '<button class="name" data-play="' + i + '">' + esc(e.name) + '</button>' +
        '<button class="star ' + (Store.isFavorite(e) ? 'on' : '') + '" data-fav="' + i + '">' +
        (Store.isFavorite(e) ? '★' : '☆') + '</button></div>';
    }
    if (v.total > 1) h += pager(v);
    if (App.selectedChannel) h += epgPanel(App.selectedChannel);
    $('tab-content').innerHTML = h;
    refocusSearch(kind);
  });
}

/** Mantém o teclado e o cursor no campo de busca depois de redesenhar a lista. */
function refocusSearch(kind) {
  if (App.refocus !== kind) return;
  App.refocus = null;
  var input = document.querySelector('[data-search="' + kind + '"]');
  if (!input) return;
  input.focus();
  try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
}

function epgPanel(entry) {
  var data = App.epgCache[entryKey(entry)];
  var h = '<div class="epg"><div class="row"><h3 class="grow">' + esc(entry.name) + '</h3>' +
    '<span class="chip" style="border-color:var(--live);color:#ff8a80">AO VIVO</span></div>' +
    '<button class="btn primary wide" data-watch="' + esc(entry.id) + '">▶ Assistir</button>';
  if (!data) return h + '<p class="dim tiny">Carregando programação…</p></div>';
  if (!data.length) return h + '<p class="dim tiny">Programação indisponível para este canal.</p></div>';
  var now = new Date().getHours() * 60 + new Date().getMinutes();
  var idx = 0;
  for (var i = 0; i < data.length; i++) if (data[i].minutes <= now) idx = i;
  h += '<p class="label">AGORA</p><p class="now">' + esc(data[idx].title) + '</p><p class="label">A SEGUIR</p>';
  for (var j = idx + 1; j < Math.min(data.length, idx + 4); j++) {
    h += '<div class="next"><span class="green">' + esc(data[j].start) + '</span><span>' + esc(data[j].title) + '</span></div>';
  }
  return h + '</div>';
}

function loadEpg(entry) {
  var key = entryKey(entry);
  if (App.epgCache[key]) { renderChannels(App.cats.LIVE || []); return; }
  Epg.board().then(function (board) {
    var match = Epg.find(board, entry.name);
    if (!match) { App.epgCache[key] = []; renderChannels(App.cats.LIVE || []); return; }
    return Epg.schedule(match.code).then(function (list) {
      App.epgCache[key] = list || [];
      renderChannels(App.cats.LIVE || []);
    });
  });
}

function renderMovies(cats) {
  var kind = MediaKind.VOD;
  loadView(kind, cats).then(function () {
    if (App.tab !== 'movies') return;
    var v = visibleItems(kind);
    var h = searchHeader(kind, 'Buscar filmes', true) + chips(cats, kind, false);
    h += '<div class="meta">' + v.list.length + ' títulos</div>';
    if (!v.page.length) h += '<div class="state"><span class="big">⌕</span>' + emptyText(kind) + '</div>';
    else h += posterGrid(v.page, kind);
    if (v.total > 1) h += pager(v);
    $('tab-content').innerHTML = h;
    refocusSearch(kind);
  });
}

function renderSeries(cats) {
  var kind = MediaKind.SERIES;
  loadView(kind, cats).then(function () {
    if (App.tab !== 'series') return;
    var v = visibleItems(kind);
    var h = searchHeader(kind, 'Buscar séries', false) + chips(cats, kind, true);
    h += '<div class="meta">' + v.list.length + ' séries</div>';
    if (!v.page.length) h += '<div class="state"><span class="big">⌕</span>' + emptyText(kind) + '</div>';
    else h += posterGrid(v.page, kind);
    if (v.total > 1) h += pager(v);
    $('tab-content').innerHTML = h;
    refocusSearch(kind);
  });
}

function posterGrid(items, kind) {
  var h = '<div class="grid">';
  for (var i = 0; i < items.length; i++) {
    var e = items[i];
    h += '<div><div class="poster" data-open="' + i + '">' +
      (e.logo ? '<img class="cover" src="' + esc(e.logo) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '<div class="ph">▣</div>') +
      (e.rating ? '<span class="rating">' + Number(e.rating).toFixed(1) + '</span>' : '') +
      '<span class="play">▶</span>' +
      (Store.isFavorite(e) ? '<span class="poster-fav">★</span>' : '') +
      '</div><div class="row"><span class="grow poster-name">' + esc(e.name) + '</span>' +
      '<button class="star ' + (Store.isFavorite(e) ? 'on' : '') + '" data-fav="' + i + '">' +
      (Store.isFavorite(e) ? '★' : '☆') + '</button></div></div>';
  }
  return h + '</div>';
}

function emptyText(kind) {
  var q = App.queries[kind];
  if (q) return 'Nenhum resultado para “' + esc(q) + '”.';
  if (App.filters[kind] === 1) return kind === MediaKind.LIVE ? 'Nenhum canal favorito.'
    : kind === MediaKind.VOD ? 'Nenhum filme favorito.' : 'Nenhuma série favorita.';
  if (App.filters[kind] === 2) return kind === MediaKind.LIVE ? 'Nenhum canal visto ainda.'
    : kind === MediaKind.VOD ? 'Nenhum filme visto ainda.' : 'Nenhuma série vista ainda.';
  return kind === MediaKind.LIVE ? 'Nenhum canal nesta categoria.'
    : kind === MediaKind.VOD ? 'Nenhum filme nesta categoria.' : 'Nenhuma série nesta categoria.';
}

function pager(v) {
  return '<div class="pager"><button class="btn mini ghost" data-page="-1" ' + (App.pages[currentKind()] <= 0 ? 'disabled' : '') + '>◀ Voltar</button>' +
    '<span>Página ' + (App.pages[currentKind()] + 1) + ' de ' + v.total + '</span>' +
    '<button class="btn mini ghost" data-page="1" ' + (App.pages[currentKind()] >= v.total - 1 ? 'disabled' : '') + '>Próximo ▶</button></div>';
}

function onTabInput(e) {
  var q = e.target.dataset.search;
  if (!q) return;
  App.queries[q] = e.target.value.trim();
  App.pages[q] = 0;
  App.refocus = q;
  renderTab();
}

function onTabClick(e) {
  var kind = currentKind();
  var cat = e.target.closest('[data-cat]');
  if (cat) {
    App.category = App.category || {};
    App.category[kind] = cat.dataset.cat || null;
    App.pages[kind] = 0;
    renderTab(); return;
  }
  var filter = e.target.closest('[data-filter]');
  if (filter) { App.filters[kind] = parseInt(filter.dataset.filter, 10); App.pages[kind] = 0; renderTab(); return; }
  var page = e.target.closest('[data-page]');
  if (page) { App.pages[kind] = Math.max(0, App.pages[kind] + parseInt(page.dataset.page, 10)); renderTab(); return; }
  if (e.target.closest('[data-action="sort"]')) {
    App.sort = App.sort === 'az' ? 'server' : 'az';
    Store.setSortMode(App.sort); renderTab(); return;
  }
  var fav = e.target.closest('[data-fav]');
  if (fav) {
    var v = visibleItems(kind);
    var entry = v.page[parseInt(fav.dataset.fav, 10)];
    if (entry) { Store.toggleFavorite(entry); renderTab(); }
    return;
  }
  var play = e.target.closest('[data-play]');
  if (play) {
    var v2 = visibleItems(kind);
    var selected = v2.page[parseInt(play.dataset.play, 10)];
    if (selected) {
      App.selectedChannel = selected;
      loadEpg(selected);
      playEntry(selected, v2.page);
    }
    return;
  }
  var watch = e.target.closest('[data-watch]');
  if (watch) {
    var found = null;
    for (var i = 0; i < App.view.LIVE.length; i++) if (App.view.LIVE[i].id === watch.dataset.watch) found = App.view.LIVE[i];
    if (found) playEntry(found, App.view.LIVE);
    return;
  }
  var open = e.target.closest('[data-open]');
  if (open) {
    var v3 = visibleItems(kind);
    var item = v3.page[parseInt(open.dataset.open, 10)];
    if (!item) return;
    if (kind === MediaKind.SERIES) openSeries(item);
    else playEntry(item, v3.page);
  }
}

/* ========================================================= SÉRIES */

function openSeries(entry) {
  App.seriesEntry = entry;
  show('screen-series');
  $('series-title').textContent = entry.name;
  $('series-meta').textContent = '';
  $('series-content').innerHTML = '<div class="state"><div class="spinner"></div>Carregando temporadas e episódios…</div>';
  App.source.seriesInfo(entry.id).then(function (detail) {
    if (!detail) {
      $('series-content').innerHTML = '<div class="state">Não foi possível abrir esta série.</div>';
      return;
    }
    App.detail = detail;
    renderSeriesDetail(entry, detail, 0);
  });
}

function renderSeriesDetail(entry, detail, seasonIndex) {
  var seasons = detail.seasons || [];
  var totalEps = 0;
  for (var s = 0; s < seasons.length; s++) totalEps += seasons[s].episodes.length;
  var h = '<div class="row top gap">' +
    (detail.cover || entry.logo ? '<img class="detail-cover" src="' + esc(detail.cover || entry.logo) + '" alt="">' : '<div class="detail-cover"></div>') +
    '<div class="grow"><h2 style="margin-top:0">' + esc(detail.name) + '</h2>' +
    '<p class="dim tiny">' + esc(detail.genre || '') + (detail.releaseDate ? ' · ' + esc(detail.releaseDate) : '') + '</p>' +
    (detail.rating ? '<p class="star on">' + '★ ' + Number(detail.rating).toFixed(1) + '</p>' : '') +
    '<p class="dim tiny">' + seasons.length + ' temporada(s) · ' + totalEps + ' episódios</p>' +
    '<button class="link" data-fav-series="' + esc(entry.id) + '">' +
    (Store.isFavorite(entry) ? '★ Favorito' : '☆ Favoritar') + '</button></div></div>';
  if (detail.plot) h += '<p class="dim small">' + esc(detail.plot) + '</p>';
  if (detail.cast) h += '<p class="dim tiny">Elenco: ' + esc(detail.cast) + '</p>';

  if (!seasons.length) {
    h += '<div class="state">Esta série não tem episódios disponíveis na lista.</div>';
  } else {
    h += '<div class="chip-row">';
    for (var i = 0; i < seasons.length; i++) {
      h += '<button class="season ' + (i === seasonIndex ? 'active' : '') + '" data-season="' + i + '">T' +
        seasons[i].number + ' · ' + seasons[i].episodes.length + ' ep.</button>';
    }
    h += '</div><p class="label">EPISÓDIOS · TEMPORADA ' + seasons[seasonIndex].number + '</p>';
    var eps = seasons[seasonIndex].episodes;
    for (var j = 0; j < eps.length; j++) {
      var ep = eps[j];
      h += '<button class="episode" data-episode="' + j + '"><span class="n">' + ep.number + '</span>' +
        '<span class="grow"><b>' + esc(ep.title) + '</b><br><span class="sub">T' + ep.season + ' E' + ep.number +
        (ep.duration ? ' · ' + esc(ep.duration) : '') + '</span></span><span class="green">▶</span></button>';
    }
  }
  $('series-content').innerHTML = h;

  // Como no Android: o primeiro episódio começa automaticamente.
  if (!App.detail.autoStarted) {
    App.detail.autoStarted = true;
    var firstSeason = seasons[0];
    if (firstSeason && firstSeason.episodes.length) {
      playEpisode(detail, firstSeason.episodes[0], entry);
    }
  }
}

function onSeriesClick(e) {
  var season = e.target.closest('[data-season]');
  if (season && App.detail) {
    renderSeriesDetail(App.seriesEntry, App.detail, parseInt(season.dataset.season, 10));
    return;
  }
  var fav = e.target.closest('[data-fav-series]');
  if (fav && App.seriesEntry) {
    Store.toggleFavorite(App.seriesEntry);
    if (App.detail) {
      var activeChip = document.querySelector('.season.active');
      var currentSeason = activeChip ? parseInt(activeChip.dataset.season, 10) : 0;
      renderSeriesDetail(App.seriesEntry, App.detail, currentSeason);
    }
    return;
  }
  var ep = e.target.closest('[data-episode]');
  if (ep && App.detail) {
    var seasons = App.detail.seasons;
    var active = document.querySelector('.season.active');
    var idx = active ? parseInt(active.dataset.season, 10) : 0;
    playEpisode(App.detail, seasons[idx].episodes[parseInt(ep.dataset.episode, 10)], App.seriesEntry);
  }
}

function playEpisode(detail, episode, entry) {
  var all = [];
  for (var s = 0; s < detail.seasons.length; s++) {
    var eps = detail.seasons[s].episodes;
    for (var i = 0; i < eps.length; i++) {
      var url = App.source.episodeUrl(eps[i]);
      if (!url) continue;
      all.push({
        url: url,
        title: detail.name + ' · T' + eps[i].season + 'E' + eps[i].number + ' · ' + eps[i].title
      });
    }
  }
  if (!all.length) { toast('Episódio sem link de reprodução.'); return; }
  var start = 0;
  for (var k = 0; k < all.length; k++) if (all[k].url === App.source.episodeUrl(episode)) start = k;
  Store.addRecent(entry || { id: detail.id, name: detail.name, logo: detail.cover, kind: MediaKind.SERIES });
  openPlayer(all, start, true);
}

/* ============================================================ AJUSTES */

function renderSettings() {
  var s = Store.session();
  var h = '<div class="card"><p class="label">CONTA</p>';
  if (s && s.mode === 'XTREAM') {
    h += '<p class="dim small">Verificando conta…</p>';
    App.source.account().then(function (info) {
      if (App.tab !== 'settings') return;
      var box = $('tab-content');
      if (!box) return;
      var old = box.querySelector('#account-info');
      if (!old) return;
      old.innerHTML = info
        ? '<b>' + esc(info.username) + '</b><p class="dim tiny">Status: ' + esc(info.status) +
          (info.isTrial ? ' (teste)' : '') + '</p><p class="dim tiny">Validade: ' + esc(info.expiresAt) +
          '</p><p class="dim tiny">Conexões: ' + esc(info.activeConnections) + '/' + esc(info.maxConnections) + '</p>'
        : '<p class="dim small">Não foi possível ler os dados da conta.</p>';
    });
    h += '<div id="account-info"></div>';
  } else {
    h += '<p class="dim small">Lista M3U — sem dados de conta.</p>';
  }
  if (s && s.label) h += '<p class="dim tiny">' + esc(s.label) + '</p>';
  h += '<p class="dim tiny">ID do aparelho: ' + formatMac(Store.cachedCode() || '') + '</p></div>';

  var actions = [
    ['person', 'Minha conta', 'Status e validade da lista'],
    ['swap', 'Trocar lista', 'Escolher outra lista salva'],
    ['refresh', 'Atualizar catálogo', 'Recarregar canais, filmes e séries'],
    ['star', 'Limpar favoritos', 'Remover todos os favoritos'],
    ['clock', 'Limpar histórico', 'Remover o histórico'],
    ['doc', 'Termos de uso', 'Player de vídeo: não fornece conteúdo'],
    ['info', 'Sobre o Raptor', 'Versão e informações'],
    ['screen', 'Formato de tela', 'Retrato no iPhone, paisagem no player'],
    ['lock', 'Privacidade', 'Nada é enviado a terceiros']
  ];
  h += '<div class="settings-grid">';
  for (var i = 0; i < actions.length; i++) {
    h += '<button class="setting" data-setting="' + i + '"><span class="ic">' + actions[i][0] +
      '</span><span class="grow"><span class="t">' + actions[i][1] + '</span><br><span class="s">' +
      actions[i][2] + '</span></span><span class="dim">›</span></button>';
  }
  h += '</div>';
  $('tab-content').innerHTML = h;
}

$('tab-content').addEventListener('click', function (e) {
  var b = e.target.closest('[data-setting]');
  if (!b) return;
  var i = parseInt(b.dataset.setting, 10);
  if (i === 1) { Store.clearSession(); App.source = null; show('screen-login'); startActivation(); loadSavedLists(); }
  if (i === 2) { $('refresh-btn').click(); }
  if (i === 3) { Store.clearFavorites(); toast('Favoritos removidos.'); }
  if (i === 4) { Store.clearRecents(); toast('Histórico removido.'); }
  if (i === 5) {
    window.alert('Termo de uso e responsabilidade\n\n' + 'O Raptor Player é apenas um tocador de vídeo. ' +
      'Todo o conteúdo vem de listas informadas pelo usuário, que é o único responsável por ele. ' +
      'Nenhum dado é vendido ou compartilhado.');
  }
  if (i === 6) toast('Raptor Player 1.2 · Salvo apenas neste aparelho.');
  if (i === 7) toast('O app usa retrato; o player abre em tela cheia e pode girar.');
  if (i === 8) toast('Listas e credenciais ficam somente neste aparelho.');
});

/* ============================================================ PLAYER */

function video() { return $('video'); }

/** Abre um item usando a página visível como fila (como no Android). */
function playEntry(entry, pageItems) {
  if (!entry || !App.source) return;
  var list = pageItems && pageItems.length ? pageItems : [entry];
  var queue = [];
  for (var i = 0; i < list.length; i++) {
    var url = App.source.playUrl(list[i]);
    if (!url) continue;
    if (mixedBlocked(url)) { playerError(mixedMessage()); show('player'); return; }
    queue.push({ url: url, title: list[i].name });
  }
  if (!queue.length) { toast('Item sem link de reprodução.'); return; }
  var start = 0;
  for (var j = 0; j < list.length; j++) {
    if (list[j].id === entry.id) {
      var own = App.source.playUrl(list[j]);
      for (var k = 0; k < queue.length; k++) if (queue[k].url === own) { start = k; break; }
      break;
    }
  }
  Store.addRecent(entry);
  openPlayer(queue, start, false);
}

function openPlayer(queue, index, autoAdvance) {
  App.queue = queue.slice();
  App.pIndex = Math.max(0, Math.min(index || 0, App.queue.length - 1));
  App.autoAdvance = !!autoAdvance;
  show('player');
  if (screen.orientation && screen.orientation.lock) {
    try { screen.orientation.lock('any').catch(function () {}); } catch (e) {}
  }
  showControls();
  loadCurrent();
}

function loadCurrent() {
  var item = App.queue[App.pIndex];
  if (!item) { closePlayer(); return; }
  App.pUrl = item.url;
  $('player-title').textContent = item.title;
  toggle($('player-queue'), App.queue.length > 1);
  $('player-queue').textContent = (App.pIndex + 1) + ' de ' + App.queue.length;
  $('prev-btn').disabled = App.pIndex <= 0;
  $('next-btn').disabled = App.pIndex >= App.queue.length - 1;
  hide($('player-error'));
  loadVideo(item.url, false);
}

function loadVideo(url, retry) {
  savePosition();
  var v = video();
  if (App.hls) { App.hls.destroy(); App.hls = null; }
  v.pause();
  if (!/^https?:\/\//i.test(url)) { playerError('Link de vídeo inválido.'); return; }
  if (mixedBlocked(url)) { playerError(mixedMessage()); return; }

  var isHls = /\.m3u8(\?|$)/i.test(url) || /\/live\//i.test(url);
  if (isHls && !v.canPlayType('application/vnd.apple.mpegurl') && window.Hls && Hls.isSupported()) {
    App.hls = new Hls({ enableWorker: true, lowLatencyMode: false });
    App.hls.loadSource(url);
    App.hls.attachMedia(v);
    App.hls.on(Hls.Events.ERROR, function (evt, data) {
      if (data && data.fatal) playerError('Não foi possível reproduzir este vídeo.');
    });
  } else {
    v.src = url;
  }
  v.load();

  var saved = Store.get('pos:' + hashKey(url), 0);
  var seekOnce = function () {
    if (saved > 5 && isFinite(v.duration) && v.duration > 0) {
      try { v.currentTime = Math.min(saved, v.duration - 1); } catch (e) {}
    }
    v.removeEventListener('loadedmetadata', seekOnce);
  };
  v.addEventListener('loadedmetadata', seekOnce);
  v.play().catch(function () { /* aguarda gesto do usuário */ });
  App.lastSave = Date.now();
  onTime();
}

function playerError(text) {
  $('player-error-text').textContent = text;
  show($('player-error'));
  hide($('buffering'));
}

function togglePlay() {
  var v = video();
  if (v.paused) v.play().catch(function () {}); else v.pause();
}

function goItem(delta) {
  var target = Math.max(0, Math.min(App.queue.length - 1, App.pIndex + delta));
  if (target === App.pIndex) return;
  App.pIndex = target;
  loadCurrent();
  showControls();
}

function skipSeconds(seconds) {
  var v = video();
  if (!isFinite(v.duration) || v.duration <= 0) return;
  v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
  showControls();
}

function cycleSpeed() {
  var speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  var current = video().playbackRate || 1;
  var next = speeds[0];
  for (var i = 0; i < speeds.length; i++) if (speeds[i] > current + 0.01) { next = speeds[i]; break; }
  video().playbackRate = next;
  $('speed-btn').textContent = String(next).replace(/\.00$/, '') + 'x';
  showControls();
}

function onTime() {
  var v = video();
  var d = v.duration;
  var live = !isFinite(d) || d <= 0;
  toggle($('live-badge'), live);
  toggle($('seek-wrap'), !live);
  if (!live) {
    $('seek').value = (v.currentTime / d) * 100;
    $('dur').textContent = fmtTime(d);
  }
  $('pos').textContent = fmtTime(v.currentTime);
  if (!v.paused && Date.now() - App.lastSave > 10000) { savePosition(); App.lastSave = Date.now(); }
}

function savePosition() {
  if (!App.pUrl) return;
  var t = video().currentTime;
  if (isFinite(t) && t > 0) Store.set('pos:' + hashKey(App.pUrl), Math.floor(t));
}

function closePlayer() {
  savePosition();
  var v = video();
  v.pause();
  v.removeAttribute('src');
  v.load();
  if (App.hls) { App.hls.destroy(); App.hls = null; }
  App.pUrl = '';
  hide($('player'));
  if (screen.orientation && screen.orientation.unlock) {
    try { screen.orientation.unlock(); } catch (e) {}
  }
}

function showControls() {
  show($('player-ui'));
  if (App.controlsTimer) clearTimeout(App.controlsTimer);
  if (!video().paused) {
    App.controlsTimer = setTimeout(function () { hide($('player-ui')); }, 4500);
  }
}

/* =============================================================== UTIL */

function toast(message) {
  var el = $('toast');
  el.textContent = message; show(el);
  if (toast._t) clearTimeout(toast._t);
  toast._t = setTimeout(function () { hide(el); }, 3500);
}
