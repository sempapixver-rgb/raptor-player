/* Grade de programação (EPG) — meuguia.tv.
   Mesma fonte usada pelo app Android. O site libera CORS, então a TV
   consegue ler direto, sem proxy. */

var Epg = {

  BASE: 'https://meuguia.tv',

  CATEGORIES: ['Filmes', 'Series', 'Esportes', 'Infantil',
    'Variedades', 'Documentarios', 'Noticias', 'Aberta'],

  TTL: 10 * 60 * 1000,

  boardCache: null,
  boardAt: 0,
  boardLoading: null,
  scheduleCache: {},

  get: function (path) {
    var url = path.indexOf('http') === 0 ? path : this.BASE + path;
    return Net.getText(url, 20000).then(function (text) {
      return text || '';
    }, function () {
      return '';
    });
  },

  /* ------------------------------------------------ grade dos canais */

  board: function (force) {
    var self = this;
    var now = Date.now();
    if (!force && this.boardCache && (now - this.boardAt) < this.TTL) {
      return Promise.resolve(this.boardCache);
    }
    if (this.boardLoading) return this.boardLoading;

    var out = [];
    var index = 0;

    var loading = new Promise(function (resolve) {
      function next() {
        if (index >= self.CATEGORIES.length) { resolve(out); return; }
        var category = self.CATEGORIES[index++];
        self.get('/programacao/categoria/' + category).then(function (html) {
          if (html) {
            var list = self.parseCategory(html);
            for (var i = 0; i < list.length; i++) out.push(list[i]);
          }
          next();
        });
      }
      next();
    }).then(function (list) {
      if (list.length) {
        self.boardCache = list;
        self.boardAt = Date.now();
      }
      self.boardLoading = null;
      return self.boardCache || [];
    }, function () {
      self.boardLoading = null;
      return self.boardCache || [];
    });

    this.boardLoading = loading;
    return loading;
  },

  parseCategory: function (html) {
    var out = [];
    var block = /href="\/programacao\/canal\/([A-Za-z0-9]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    var h2 = /<h2>([\s\S]*?)<\/h2>/i;
    var h3 = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
    var timeRe = /<strong>\s*(\d{1,2}:\d{2})\s*<\/strong>/;
    var progress = /<div class="progressbar">[\s\S]*?<\/div>/gi;

    var match;
    while ((match = block.exec(html))) {
      var code = match[1];
      var inner = match[2];
      var nameMatch = h2.exec(inner);
      if (!nameMatch) continue;
      var name = this.clean(nameMatch[1]);
      if (!name) continue;

      var programs = [];
      var pm;
      h3.lastIndex = 0;
      while ((pm = h3.exec(inner))) {
        var line = pm[1];
        var tm = timeRe.exec(line);
        if (!tm) continue;
        var rest = line.substring(line.indexOf('</strong>') + 9);
        rest = rest.replace(progress, ' ');
        var title = this.clean(rest);
        if (!title) continue;
        programs.push({
          minutes: this.toMinutes(tm[1]),
          start: tm[1],
          title: title,
          genre: ''
        });
      }

      if (programs.length) {
        out.push({ code: code, name: name, programs: programs });
      }
    }
    return out;
  },

  /* --------------------------------------------- programação do dia */

  schedule: function (code) {
    var self = this;
    var cached = this.scheduleCache[code];
    if (cached && (Date.now() - cached.at) < this.TTL) {
      return Promise.resolve(cached.list);
    }

    return this.get('/programacao/canal/' + encodeURIComponent(code)).then(function (html) {
      if (!html) return [];
      var list = self.parseSchedule(html);
      if (list.length) self.scheduleCache[code] = { at: Date.now(), list: list };
      return list;
    });
  },

  parseSchedule: function (html) {
    // A página traz vários dias (e comentários de template). Ficamos com
    // o primeiro dia real.
    var header = /<li class="subheader devicepadding">(?!<%)/g;
    var starts = [];
    var m;
    while ((m = header.exec(html))) starts.push(m.index);

    var start = starts.length ? html.indexOf('>', starts[0]) + 1 : 0;
    var end = starts.length > 1 ? starts[1] : html.length;
    var today = (start >= 0 && start <= end) ? html.substring(start, end) : html;

    var out = [];
    var block = /<div class='lileft time'>\s*(\d{1,2}:\d{2})\s*<\/div>\s*<div class="licontent">\s*<h2>([\s\S]*?)<\/h2>\s*<h3>([\s\S]*?)<\/h3>/gi;
    var pm;
    while ((pm = block.exec(today))) {
      var title = this.clean(pm[2]);
      if (!title) continue;
      out.push({
        minutes: this.toMinutes(pm[1]),
        start: pm[1],
        title: title,
        genre: this.clean(pm[3])
      });
    }
    return out;
  },

  /* --------------------------------------------------------- busca */

  find: function (entries, channelName) {
    if (!entries || !entries.length) return null;
    var target = this.normalize(channelName);
    if (!target) return null;

    var i;
    for (i = 0; i < entries.length; i++) {
      if (this.normalize(entries[i].name) === target) return entries[i];
    }

    var shortTarget = this.stripQuality(target);
    for (i = 0; i < entries.length; i++) {
      if (this.stripQuality(this.normalize(entries[i].name)) === shortTarget) return entries[i];
    }

    var packed = shortTarget.replace(/ /g, '');
    for (i = 0; i < entries.length; i++) {
      if (this.stripQuality(this.normalize(entries[i].name)).replace(/ /g, '') === packed) return entries[i];
    }

    for (i = 0; i < entries.length; i++) {
      var other = this.stripQuality(this.normalize(entries[i].name));
      if (other && (shortTarget.indexOf(other) === 0 || other.indexOf(shortTarget) === 0)) return entries[i];
    }

    for (i = 0; i < entries.length; i++) {
      var word = this.stripQuality(this.normalize(entries[i].name));
      if (word && shortTarget.indexOf(' ' + word) >= 0) return entries[i];
    }

    return null;
  },

  normalize: function (value) {
    var lower = String(value || '').toLowerCase();
    if (lower.normalize) {
      lower = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return lower.replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, '');
  },

  stripQuality: function (value) {
    return value
      .replace(/\b(fhd|uhd|hd|sd|4k|8k|h265|hevc|h264|alt|backup|raw|full)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '');
  },

  toMinutes: function (time) {
    var parts = String(time || '').split(':');
    var hour = parseInt(parts[0], 10) || 0;
    var minute = parseInt(parts[1], 10) || 0;
    return hour * 60 + minute;
  },

  clean: function (raw) {
    var text = String(raw || '');
    text = text.replace(/<[^>]*>/g, ' ');
    text = text.replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    text = text.replace(/&#(\d+);/g, function (m, code) {
      var n = parseInt(code, 10);
      return n ? String.fromCharCode(n) : ' ';
    });
    return text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  }
};
