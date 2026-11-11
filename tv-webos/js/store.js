/* Persistência local e identidade do aparelho. */

var Store = {

  PREFIX: 'reptor.',

  get: function (key, fallback) {
    try {
      var raw = window.localStorage.getItem(this.PREFIX + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },

  set: function (key, value) {
    try {
      window.localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
    } catch (e) { /* sem espaço: ignora */ }
  },

  remove: function (key) {
    try { window.localStorage.removeItem(this.PREFIX + key); } catch (e) { /* ignora */ }
  },

  /* ---------------------------------------------------------- sessão */

  session: function () {
    var value = this.get('session', null);
    if (!value || !value.mode) return null;
    return value;
  },

  setSession: function (session) {
    this.set('session', session);
  },

  clearSession: function () {
    this.remove('session');
  },

  /* ----------------------------------------------------- listas salvas */

  savedLists: function () {
    var list = this.get('lists', []);
    return list && list.length ? list : [];
  },

  saveList: function (session) {
    var list = this.savedLists();
    var key = sessionKey(session);
    var next = [];
    for (var i = 0; i < list.length; i++) {
      if (sessionKey(list[i]) !== key) next.push(list[i]);
    }
    next.unshift(session);
    if (next.length > 8) next = next.slice(0, 8);
    this.set('lists', next);
  },

  removeList: function (session) {
    var key = sessionKey(session);
    var list = this.savedLists();
    var next = [];
    for (var i = 0; i < list.length; i++) {
      if (sessionKey(list[i]) !== key) next.push(list[i]);
    }
    this.set('lists', next);
  },

  /* ------------------------------------------------------------ termos */

  termsAccepted: function () {
    return this.get('terms', 0) >= 2;
  },

  acceptTerms: function () {
    this.set('terms', 2);
  },

  /* ------------------------------------------------------------ código */

  cachedCode: function () {
    return this.get('deviceCode', null);
  },

  cacheCode: function (code) {
    this.set('deviceCode', code);
  }
};

/** Identidade usada para não duplicar listas salvas. */
function sessionKey(session) {
  if (!session) return '';
  return [
    session.mode,
    session.mode === 'M3U' ? (session.m3uUrl || '') : (session.baseUrl || ''),
    session.username || ''
  ].join('|');
}

/** Nome amigável da lista. */
function sessionName(session) {
  if (!session) return '';
  if (session.label) return session.label;
  if (session.mode === 'M3U') {
    var name = String(session.m3uUrl || '').split('?')[0].split('/').pop();
    return name || 'Lista M3U';
  }
  return String(session.baseUrl || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '') || 'Xtream';
}

/** Normaliza o servidor digitado. */
function normalizeBase(raw) {
  var base = String(raw || '').trim();
  if (!base) return '';
  if (!/^https?:\/\//i.test(base)) base = 'http://' + base;
  base = base.split('?')[0].split('#')[0].replace(/\/+$/, '');
  var suffixes = ['/player_api.php', '/get.php', '/panel_api.php', '/xmltv.php'];
  for (var i = 0; i < suffixes.length; i++) {
    var suffix = suffixes[i];
    if (base.toLowerCase().lastIndexOf(suffix) === base.length - suffix.length) {
      base = base.substring(0, base.length - suffix.length).replace(/\/+$/, '');
      break;
    }
  }
  return base;
}

/* ============================================================== LUNA */

/** Chamada a serviço do webOS com timeout curto. */
function lunaRequest(service, method, params) {
  return new Promise(function (resolve) {
    if (!window.webOS || !webOS.service || !webOS.service.request) {
      resolve(null);
      return;
    }
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      resolve(null);
    }, 4000);

    function finish(value) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    }

    try {
      webOS.service.request(service, {
        method: method,
        parameters: params || {},
        onSuccess: function (res) { finish(res || null); },
        onFailure: function () { finish(null); }
      });
    } catch (e) {
      finish(null);
    }
  });
}

/* ========================================================= APARELHO */

var Device = {

  /** MAC real, se o sistema informar. */
  macAddress: function () {
    var services = [
      { service: 'luna://com.webos.service.connectionmanager/', method: 'getinfo' },
      { service: 'luna://com.webos.service.networkinterface/', method: 'getNetworkStatus' }
    ];

    function extract(res) {
      if (!res) return null;
      var groups = ['wired', 'wifi', 'wiredInfo', 'wifiInfo'];
      for (var i = 0; i < groups.length; i++) {
        var group = res[groups[i]];
        if (group && group.macAddress) {
          var mac = String(group.macAddress).toUpperCase();
          if (/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac) &&
              mac !== '00:00:00:00:00:00' && mac !== '02:00:00:00:00:00') {
            return mac;
          }
        }
      }
      return null;
    }

    var chain = Promise.resolve(null);
    services.forEach(function (item) {
      chain = chain.then(function (found) {
        if (found) return found;
        return lunaRequest(item.service, item.method, {}).then(extract);
      });
    });
    return chain;
  },

  deviceId: function () {
    return lunaRequest('luna://com.webos.service.sm/', 'getDeviceId', {}).then(function (res) {
      return res && res.deviceId ? String(res.deviceId) : null;
    });
  },

  modelName: function () {
    try {
      if (window.webOS && webOS.deviceInfo) {
        var info = webOS.deviceInfo();
        if (info && info.modelName) return String(info.modelName);
      }
    } catch (e) { /* ignora */ }
    return 'webOS';
  },

  /**
   * Código estável no formato MAC. Usa o MAC real quando disponível;
   * caso contrário deriva um código fixo do aparelho.
   */
  code: function () {
    var cached = Store.cachedCode();
    if (cached) return Promise.resolve(cached);

    var self = this;
    return this.macAddress().then(function (mac) {
      if (mac) {
        Store.cacheCode(mac);
        return mac;
      }
      return self.deviceId().then(function (id) {
        var seed = id;
        if (!seed) {
          seed = Store.get('deviceSeed', null);
          if (!seed) {
            seed = 'webos-' + self.modelName() + '-' + Math.random() + '-' + (new Date().getTime());
            Store.set('deviceSeed', seed);
          }
        }
        var digest = sha256Hex(seed + '|' + self.modelName());
        var parts = [];
        for (var i = 0; i < 6; i++) {
          parts.push(digest.substr(i * 2, 2).toUpperCase());
        }
        var code = parts.join(':');
        Store.cacheCode(code);
        return code;
      });
    });
  }
};

/* ========================================================= ATIVAÇÃO */

var Activation = {

  SITE_BASE: 'https://reptor-player.netlify.app',

  siteLink: function (code) {
    return this.SITE_BASE + '/?code=' + normalizeCode(code);
  },

  /** Consulta a ativação no site. Resolve null quando ainda não existe. */
  fetch: function (code) {
    var url = this.SITE_BASE + '/api/device?code=' + normalizeCode(code);
    return Net.getJSON(url, 12000).then(function (root) {
      if (!root || !root.ok || !root.activation) return null;
      var a = root.activation;
      var label = a.label || 'Ativado pelo site';

      if (String(a.mode || '').toUpperCase() === 'M3U') {
        if (!a.m3u) return null;
        return {
          mode: 'M3U',
          m3uUrl: a.m3u,
          label: label,
          baseUrl: '',
          username: '',
          password: ''
        };
      }

      if (!a.host || !a.user || !a.pass) return null;
      return {
        mode: 'XTREAM',
        baseUrl: a.host,
        username: a.user,
        password: a.pass,
        m3uUrl: '',
        label: label
      };
    }, function () {
      return null;
    });
  }
};
