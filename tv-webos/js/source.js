/* Fontes de conteúdo: Xtream Codes e lista M3U. */

var MediaKind = { LIVE: 'LIVE', VOD: 'VOD', SERIES: 'SERIES' };

function createSource(session) {
  if (session.mode === 'M3U') return new M3uSource(session);
  return new XtreamSource(session);
}

/* ======================================================== XTREAM CODES */

function XtreamSource(session) {
  this.session = session;
  this.baseUrl = normalizeBase(session.baseUrl);
  this.user = session.username || '';
  this.pass = session.password || '';
}

XtreamSource.prototype.apiUrl = function (action, extra) {
  var url = this.baseUrl + '/player_api.php?username=' + encodeURIComponent(this.user) +
    '&password=' + encodeURIComponent(this.pass);
  if (action) url += '&action=' + action;
  if (extra) {
    for (var key in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) {
        url += '&' + key + '=' + encodeURIComponent(extra[key]);
      }
    }
  }
  return url;
};

XtreamSource.prototype._get = function (url) {
  var self = this;
  return Net.request({ url: url, timeout: 45000, fallback: false }).then(function (r) {
    return r.text;
  }, function (err) {
    if (/^https:\/\//i.test(self.baseUrl)) {
      var altBase = 'http://' + self.baseUrl.substring(8);
      var altUrl = url.replace(self.baseUrl, altBase);
      return Net.getText(altUrl, 45000).then(function (text) {
        self.baseUrl = altBase;
        return text;
      });
    }
    throw err;
  });
};

XtreamSource.prototype._json = function (url) {
  return this._get(url).then(function (text) {
    var clean = String(text || '').replace(/^\s+/, '');
    if (!clean) return null;
    try {
      return JSON.parse(clean);
    } catch (e) {
      return null;
    }
  });
};

XtreamSource.prototype.check = function () {
  var self = this;
  return this._get(this.apiUrl(null)).then(function (text) {
    var clean = String(text || '').replace(/^\s+/, '');
    if (!clean) return 'Resposta vazia do servidor';
    var obj;
    try { obj = JSON.parse(clean); } catch (e) { return 'Resposta inválida (não é JSON)'; }
    if (!obj || !obj.user_info) return 'Usuário ou senha inválidos';
    var status = String(obj.user_info.status || '').toLowerCase();
    if (status === 'disabled' || status === 'banned' || status === 'expired') {
      return obj.user_info.message || ('Conta ' + status);
    }
    return '';
  }, function (err) {
    return 'Não foi possível conectar: ' + (err.message || 'erro de rede');
  });
};

XtreamSource.prototype.account = function () {
  return this._json(this.apiUrl(null)).then(function (obj) {
    if (!obj || !obj.user_info) return null;
    var info = obj.user_info;
    return {
      username: info.username || '',
      status: info.status || '',
      expiresAt: info.exp_date || '',
      maxConnections: info.max_connections || '',
      activeConnections: info.active_cons || '',
      isTrial: String(info.is_trial) === '1'
    };
  }, function () { return null; });
};

XtreamSource.prototype.categories = function (kind) {
  var action = kind === MediaKind.LIVE ? 'get_live_categories'
    : kind === MediaKind.VOD ? 'get_vod_categories'
      : 'get_series_categories';

  return this._json(this.apiUrl(action)).then(function (arr) {
    var out = [];
    if (!arr || !arr.length) return out;
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i];
      if (!item || !item.category_id) continue;
      out.push({ id: String(item.category_id), name: item.category_name || 'Sem nome' });
    }
    return out;
  }, function () { return []; });
};

XtreamSource.prototype.items = function (kind, categoryId) {
  var action = kind === MediaKind.LIVE ? 'get_live_streams'
    : kind === MediaKind.VOD ? 'get_vod_streams'
      : 'get_series';
  var idKey = kind === MediaKind.SERIES ? 'series_id' : 'stream_id';
  var logoKey = kind === MediaKind.SERIES ? 'cover' : 'stream_icon';

  var extra = null;
  if (categoryId) {
    extra = { category_id: categoryId };
  }

  return this._json(this.apiUrl(action, extra)).then(function (arr) {
    var out = [];
    if (!arr || !arr.length) return out;
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      if (!obj || !obj[idKey]) continue;
      out.push({
        id: String(obj[idKey]),
        name: obj.name || 'Sem título',
        logo: obj[logoKey] || null,
        categoryId: obj.category_id ? String(obj.category_id) : null,
        kind: kind,
        containerExtension: obj.container_extension || null,
        rating: parseFloat(obj.rating) || null,
        plot: obj.plot || null,
        year: obj.year || null,
        directUrl: null
      });
    }
    return out;
  }, function () { return []; });
};

XtreamSource.prototype.seriesInfo = function (seriesId) {
  var url = this.apiUrl('get_series_info', { series_id: seriesId });
  return this._json(url).then(function (obj) {
    if (!obj) return null;
    var info = obj.info || {};
    var bySeason = {};
    var seasons = [];

    function addEpisode(ep, seasonFromKey) {
      if (!ep || !ep.id) return;
      var ext = ep.container_extension || 'mp4';
      var season = parseInt(ep.season, 10);
      if (!season || season <= 0) season = seasonFromKey || 1;
      var number = parseInt(ep.episode_num, 10) || 0;
      var epInfo = ep.info || {};
      var title = epInfo.name || ep.title || ('Episódio ' + number);
      var bucket = bySeason[season];
      if (!bucket) { bucket = bySeason[season] = []; }
      bucket.push({
        id: String(ep.id),
        title: title,
        season: season,
        number: number,
        url: null,
        ext: ext,
        plot: epInfo.plot || null,
        duration: epInfo.duration || null,
        logo: epInfo.movie_image || null
      });
    }

    var episodes = obj.episodes;
    if (episodes && typeof episodes === 'object') {
      if (Object.prototype.toString.call(episodes) === '[object Array]') {
        for (var i = 0; i < episodes.length; i++) addEpisode(episodes[i], null);
      } else {
        for (var key in episodes) {
          if (!Object.prototype.hasOwnProperty.call(episodes, key)) continue;
          var list = episodes[key];
          if (!list || !list.length) continue;
          var seasonFromKey = parseInt(key, 10) || null;
          for (var j = 0; j < list.length; j++) addEpisode(list[j], seasonFromKey);
        }
      }
    }

    for (var s in bySeason) {
      if (!Object.prototype.hasOwnProperty.call(bySeason, s)) continue;
      var eps = bySeason[s];
      eps.sort(function (a, b) { return a.number - b.number; });
      seasons.push({ number: parseInt(s, 10), episodes: eps });
    }
    seasons.sort(function (a, b) { return a.number - b.number; });

    return {
      id: String(seriesId),
      name: info.name || 'Série',
      cover: info.cover || null,
      plot: info.plot || null,
      cast: info.cast || null,
      genre: info.genre || null,
      releaseDate: info.releaseDate || null,
      rating: parseFloat(info.rating) || null,
      seasons: seasons
    };
  }, function () { return null; });
};

XtreamSource.prototype.liveUrl = function (streamId) {
  return this.baseUrl + '/live/' + encodeURIComponent(this.user) + '/' +
    encodeURIComponent(this.pass) + '/' + streamId + '.m3u8';
};

XtreamSource.prototype.vodUrl = function (entry) {
  var ext = entry.containerExtension || 'mp4';
  return this.baseUrl + '/movie/' + encodeURIComponent(this.user) + '/' +
    encodeURIComponent(this.pass) + '/' + entry.id + '.' + ext;
};

XtreamSource.prototype.episodeUrl = function (episode) {
  var ext = episode.ext || 'mp4';
  return this.baseUrl + '/series/' + encodeURIComponent(this.user) + '/' +
    encodeURIComponent(this.pass) + '/' + episode.id + '.' + ext;
};

XtreamSource.prototype.playUrl = function (entry) {
  if (entry.kind === MediaKind.LIVE) return this.liveUrl(entry.id);
  if (entry.kind === MediaKind.VOD) return this.vodUrl(entry);
  return null;
};

/* ================================================================ M3U */

function M3uSource(session) {
  this.url = normalizeRemoteUrl(session.m3uUrl);
  this.entries = null;
  this.series = null;
  this.pending = null;
}

function normalizeRemoteUrl(raw) {
  var text = String(raw || '').trim();
  if (/^(https?|file):/i.test(text)) return text;
  return 'http://' + text;
}

M3uSource.prototype.load = function () {
  var self = this;
  if (this.entries) return Promise.resolve(this.entries);
  if (this.pending) return this.pending;

  this.pending = Net.getText(this.url, 180000).then(function (text) {
    var list = parseM3u(text);
    self.entries = list;
    self.pending = null;
    return list;
  }, function (err) {
    self.pending = null;
    throw err;
  });

  return this.pending;
};

M3uSource.prototype.check = function () {
  return this.load().then(function (list) {
    return list.length ? '' : 'Lista vazia ou inválida';
  }, function (err) {
    return 'Não foi possível carregar a lista: ' + (err.message || 'erro de rede');
  });
};

M3uSource.prototype.account = function () {
  return Promise.resolve(null);
};

M3uSource.prototype.seriesMap = function () {
  var self = this;
  return this.load().then(function (list) {
    if (!self.series) self.series = buildSeries(list);
    return self.series;
  });
};

M3uSource.prototype.categories = function (kind) {
  var self = this;
  if (kind === MediaKind.SERIES) {
    return this.seriesMap().then(function (map) {
      var seen = {};
      var out = [];
      for (var id in map) {
        if (!Object.prototype.hasOwnProperty.call(map, id)) continue;
        var genres = map[id].genres || [];
        for (var i = 0; i < genres.length; i++) {
          if (!seen[genres[i]]) {
            seen[genres[i]] = true;
            out.push({ id: genres[i], name: genres[i] });
          }
        }
      }
      out.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
      return out;
    });
  }

  return this.load().then(function (list) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item.kind !== kind || !item.categoryId) continue;
      if (seen[item.categoryId]) continue;
      seen[item.categoryId] = true;
      out.push({ id: item.categoryId, name: item.categoryId });
    }
    return out;
  });
};

M3uSource.prototype.items = function (kind, categoryId) {
  var self = this;
  if (kind === MediaKind.SERIES) {
    return this.seriesMap().then(function (map) {
      var out = [];
      for (var id in map) {
        if (!Object.prototype.hasOwnProperty.call(map, id)) continue;
        var detail = map[id];
        var genres = detail.genres || [];
        if (categoryId) {
          var found = false;
          for (var g = 0; g < genres.length; g++) {
            if (genres[g] === categoryId) { found = true; break; }
          }
          if (!found) continue;
        }
        out.push({
          id: detail.id,
          name: detail.name,
          logo: detail.cover,
          categoryId: categoryId || genres[0] || null,
          kind: MediaKind.SERIES,
          containerExtension: null,
          rating: detail.rating,
          plot: detail.plot,
          year: null,
          directUrl: null
        });
      }
      out.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
      return out;
    });
  }

  return this.load().then(function (list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item.kind !== kind) continue;
      if (categoryId && item.categoryId !== categoryId) continue;
      out.push(item);
    }
    return out;
  });
};

M3uSource.prototype.seriesInfo = function (seriesId) {
  return this.seriesMap().then(function (map) {
    return map[seriesId] || null;
  });
};

M3uSource.prototype.playUrl = function (entry) {
  return entry.directUrl || null;
};

M3uSource.prototype.episodeUrl = function (episode) {
  return episode.url || null;
};

/* -------------------------------------------------------- parser M3U */

var ATTR_RE = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

var EPISODE_PATTERNS = [
  /^(.*?)[\s._\-\[\]]*[Ss](\d{1,2})[\s._\-]*[Ee](\d{1,3})(?:\D.*)?$/,
  /^(.*?)[\s._\-\[\]]*(\d{1,2})\s*[xX]\s*(\d{1,3})(?:\D.*)?$/,
  /^(.*?)[\s._\-]*[Tt]emporada\s*(\d{1,2})[\s._\-]*[Ee]p(?:is[oó]dio)?\s*(\d{1,3})(?:\D.*)?$/
];

function splitEpisode(title) {
  var text = String(title || '').replace(/^\s+|\s+$/g, '');
  for (var i = 0; i < EPISODE_PATTERNS.length; i++) {
    var match = EPISODE_PATTERNS[i].exec(text);
    if (!match) continue;
    var serie = match[1].replace(/[\s\-._]+$/, '');
    var season = parseInt(match[2], 10);
    var episode = parseInt(match[3], 10);
    if (!serie || isNaN(season) || isNaN(episode)) continue;
    return { serie: serie, season: season, episode: episode };
  }
  return null;
}

function isLiveCategory(group) {
  var g = fold(group);
  if (!g) return false;

  var movieAndSeries = ['filmes e series', 'filmes series', 'filmes serie',
    'series e filmes', 'series filmes', 'filmes & series', 'series & filmes'];
  for (var i = 0; i < movieAndSeries.length; i++) {
    if (g.indexOf(movieAndSeries[i]) >= 0) return true;
  }

  if (g === 'filme' || g === 'filmes' || g.indexOf('filme ') === 0 || g.indexOf('filmes ') === 0) {
    return false;
  }

  var liveWords = ['canais', 'canal ', 'ao vivo', 'futebol', 'esporte', 'noticia', 'infantil',
    'documentario', 'variedade', 'aberta', 'assinatura', 'ppv', 'adulto',
    'jogos brasileirao', 'brasileirao', 'campeonato', 'copa', 'nba', 'nfl', 'ufc',
    'luta', 'combate', 'premiere', 'radio', '24h', '24 horas', 'live'];

  for (var j = 0; j < liveWords.length; j++) {
    if (g.indexOf(liveWords[j]) >= 0) return true;
  }
  return false;
}

function classifyUrl(url, group, title) {
  var u = String(url || '').toLowerCase();
  var g = fold(group);

  if (isLiveCategory(g)) return MediaKind.LIVE;
  if (u.indexOf('/series/') >= 0) return MediaKind.SERIES;
  if (u.indexOf('/movie/') >= 0) return MediaKind.VOD;
  if (u.indexOf('/live/') >= 0) return MediaKind.LIVE;

  if (splitEpisode(title)) return MediaKind.SERIES;

  var seriesWords = ['serie', 'temporada', 'novela', 'anime', 'dorama', 'shows', 'show '];
  for (var i = 0; i < seriesWords.length; i++) {
    if (g.indexOf(seriesWords[i]) >= 0) return MediaKind.SERIES;
  }

  var vodWords = ['filme', 'movie', 'vod', 'cinema', 'lancamento', 'trailer'];
  for (var j = 0; j < vodWords.length; j++) {
    if (g.indexOf(vodWords[j]) >= 0) return MediaKind.VOD;
  }

  var liveWords = ['ao vivo', 'live', 'noticia', 'infantil', 'documentario'];
  for (var k = 0; k < liveWords.length; k++) {
    if (g.indexOf(liveWords[k]) >= 0) return MediaKind.LIVE;
  }

  var clean = u.split('?')[0];
  if (/\.(mp4|mkv|avi|mov|webm)$/.test(clean)) return MediaKind.VOD;
  return MediaKind.LIVE;
}

/** Percorre o texto linha a linha sem split (listas grandes). */
function parseM3u(text) {
  var out = [];
  var name = null;
  var logo = null;
  var group = null;
  var pos = 0;
  var len = text.length;

  while (pos < len) {
    var nl = text.indexOf('\n', pos);
    if (nl < 0) nl = len;
    var line = text.substring(pos, nl).replace(/\r$/, '');
    pos = nl + 1;

    var trimmed = line.replace(/^\s+|\s+$/g, '');
    if (!trimmed) continue;

    if (trimmed.lastIndexOf('#EXTINF', 0) === 0) {
      var attrs = {};
      ATTR_RE.lastIndex = 0;
      var m;
      while ((m = ATTR_RE.exec(trimmed)) !== null) {
        attrs[m[1].toLowerCase()] = m[2];
      }
      logo = attrs['tvg-logo'] || null;
      group = attrs['group-title'] || attrs['tvg-group'] || null;
      var comma = trimmed.lastIndexOf(',');
      name = comma >= 0 ? trimmed.substring(comma + 1).replace(/^\s+|\s+$/g, '') : '';
      if (!name) name = 'Sem título';
      continue;
    }

    if (trimmed.charAt(0) === '#') continue;

    if (name !== null) {
      out.push({
        id: 'm3u-' + out.length,
        name: name,
        logo: logo,
        categoryId: group,
        kind: classifyUrl(trimmed, group, name),
        containerExtension: null,
        rating: null,
        plot: null,
        year: null,
        directUrl: trimmed
      });
      name = null;
      logo = null;
      group = null;
    }
  }

  return out;
}

/* -------------------------------------------------- séries a partir M3U */

function hashKey(value) {
  var hash = 5381;
  for (var i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

function buildSeries(entries) {
  var buckets = {};
  var order = [];
  var loose = 0;

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (entry.kind !== MediaKind.SERIES) continue;

    var parts = splitEpisode(entry.name);
    if (!parts) {
      loose++;
      parts = { serie: entry.name.replace(/^\s+|\s+$/g, ''), season: 1, episode: loose };
    }

    var key = fold(parts.serie);
    if (!key) continue;

    var bucket = buckets[key];
    if (!bucket) {
      bucket = buckets[key] = {
        title: parts.serie,
        cover: null,
        genres: [],
        episodes: {},
        count: 0
      };
      order.push(key);
    }

    if (!bucket.cover && entry.logo) bucket.cover = entry.logo;
    if (entry.categoryId && bucket.genres.indexOf(entry.categoryId) < 0) {
      bucket.genres.push(entry.categoryId);
    }

    var number = parts.episode > 0 ? parts.episode : (bucket.count + 1);
    var title = episodeTitle(entry.name, parts.serie, parts.season, number);
    var dedupe = entry.directUrl || ('s' + parts.season + 'e' + number + '-' + title.toLowerCase());

    if (!bucket.episodes[dedupe]) {
      bucket.count++;
      bucket.episodes[dedupe] = {
        id: entry.id,
        title: title,
        season: parts.season,
        number: number,
        url: entry.directUrl || '',
        ext: null,
        plot: null,
        duration: null,
        logo: entry.logo
      };
    }
  }

  var map = {};
  for (var n = 0; n < order.length; n++) {
    var item = buckets[order[n]];
    var bySeason = {};
    for (var dedupeKey in item.episodes) {
      if (!Object.prototype.hasOwnProperty.call(item.episodes, dedupeKey)) continue;
      var ep = item.episodes[dedupeKey];
      if (!bySeason[ep.season]) bySeason[ep.season] = [];
      bySeason[ep.season].push(ep);
    }

    var seasons = [];
    for (var s in bySeason) {
      if (!Object.prototype.hasOwnProperty.call(bySeason, s)) continue;
      bySeason[s].sort(function (a, b) {
        if (a.number !== b.number) return a.number - b.number;
        return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
      });
      seasons.push({ number: parseInt(s, 10), episodes: bySeason[s] });
    }
    seasons.sort(function (a, b) { return a.number - b.number; });

    var id = 's-' + hashKey(order[n]);
    map[id] = {
      id: id,
      name: item.title,
      cover: item.cover,
      plot: null,
      cast: null,
      genre: item.genres[0] || null,
      genres: item.genres,
      releaseDate: null,
      rating: null,
      seasons: seasons
    };
  }

  return map;
}

function episodeTitle(full, serie, season, number) {
  var trimmed = full;
  if (trimmed.lastIndexOf(serie, 0) === 0) trimmed = trimmed.substring(serie.length);
  trimmed = trimmed.replace(/^[\s\-._]+|[\s\-._]+$/g, '');
  return trimmed || ('T' + season + ' E' + number);
}
