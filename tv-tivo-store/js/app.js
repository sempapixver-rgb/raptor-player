/* Raptor Player — store edition.
   Device identification only (MAC code + QR) and public sample videos.
   No manual sign-in and no access details. */

var APP_VERSION = '1.2.2';

var SITE_BASE = 'https://raptor-player.netlify.app';

/* Four public clips (CC-BY), in MP4/H.264, hosted in the developer's
   releases. They let reviewers test the player with no account or credentials. */
var DEMO_ITEMS = [
  { url: 'https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/demo-1.mp4', title: 'Sample 1 · Sintel (720p)' },
  { url: 'https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/demo-2.mp4', title: 'Sample 2 · Big Buck Bunny (trailer)' },
  { url: 'https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/demo-3.mp4', title: 'Sample 3 · Sintel (trailer)' },
  { url: 'https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/demo-4.mp4', title: 'Sample 4 · Jellyfish (720p)' }
];

/* ------------------------------------------------------------ identidade */

var Device = {

  get: function (key, fallback) {
    try {
      var raw = window.localStorage.getItem('raptor.' + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },

  set: function (key, value) {
    try {
      window.localStorage.setItem('raptor.' + key, JSON.stringify(value));
    } catch (e) { /* ignore */ }
  },

  luna: function (service, method, params) {
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
  },

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
        return Device.luna(item.service, item.method, {}).then(extract);
      });
    });
    return chain;
  },

  deviceId: function () {
    return Device.luna('luna://com.webos.service.sm/', 'getDeviceId', {}).then(function (res) {
      return res && res.deviceId ? String(res.deviceId) : null;
    });
  },

  modelName: function () {
    try {
      if (window.webOS && webOS.deviceInfo) {
        var info = webOS.deviceInfo();
        if (info && info.modelName) return String(info.modelName);
      }
      var ua = navigator.userAgent || '';
      var model = ua.match(/Model\/([^\s]+)/i);
      if (model && model[1]) return String(model[1]).replace(/[^\w.-]/g, '');
    } catch (e) { /* ignore */ }
    return 'TiVo';
  },

  /* Stable code in MAC format: uses the real MAC when available; otherwise
     derives a fixed code from the device. */
  code: function () {
    var cached = Device.get('deviceCode', null);
    if (cached) return Promise.resolve(cached);

    return Device.macAddress().then(function (mac) {
      if (mac) {
        Device.set('deviceCode', mac);
        return mac;
      }
      return Device.deviceId().then(function (id) {
        var seed = id;
        if (!seed) {
          seed = Device.get('deviceSeed', null);
          if (!seed) {
            seed = 'tivo-' + Device.modelName() + '-' + Math.random() + '-' + (new Date().getTime());
            Device.set('deviceSeed', seed);
          }
        }
        var digest = sha256Hex(seed + '|' + Device.modelName());
        var parts = [];
        for (var i = 0; i < 6; i++) {
          parts.push(digest.substr(i * 2, 2).toUpperCase());
        }
        var code = parts.join(':');
        Device.set('deviceCode', code);
        return code;
      });
    });
  },

  termsAccepted: function () {
    return Device.get('terms', 0) >= 3;
  },

  acceptTerms: function () {
    Device.set('terms', 3);
  }
};

function siteLink(code) {
  return SITE_BASE + '/?code=' + normalizeCode(code);
}

/* ------------------------------------------------------------------ app */

var App = {

  code: null,
  demoMode: false,
  demoIndex: -1,

  init: function () {
    this.bindKeys();
    Focus.bindPointer();
    this.startClock();

    var self = this;
    $('btnAccept').addEventListener('click', function () {
      Device.acceptTerms();
      self.boot();
    });

    $('btnActivate').addEventListener('click', function () { self.showActivateQr(); });
    $('btnActivateClose').addEventListener('click', function () { self.closeActivateQr(); });
    $('btnDemo').addEventListener('click', function () { self.startDemo(); });

    if (!Device.termsAccepted()) {
      Screens.show('screen-terms');
      Focus.first($('screen-terms'));
    } else {
      this.boot();
    }
  },

  boot: function () {
    this.showLogin();
  },

  startClock: function () {
    function tick() {
      var now = new Date();
      var clock = $('clock');
      if (clock) clock.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    }
    tick();
    setInterval(tick, 15000);
  },

  /* ------------------------------------------------------------- teclado */

  bindKeys: function () {
    var self = this;

    document.addEventListener('keydown', function (event) {
      var code = event.keyCode;

      if (Focus.isBack(code)) {
        event.preventDefault();
        self.back();
        return;
      }

      var active = document.activeElement;

      // Terms: arrows scroll the text; at the end focus moves to the button.
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

      // Player with hidden controls: the first key only reveals the bar.
      if (self.isPlayerOpen() && $('playerOverlay').classList.contains('hidden') &&
          $('playerError').classList.contains('hidden') &&
          (code === 13 || code === 37 || code === 38 || code === 39 || code === 40)) {
        event.preventDefault();
        Player.showOverlay();
        Player.scheduleHide();
        return;
      }

      // Time bar only shows progress. OK pauses/resumes.
      if (self.isPlayerOpen() && active && active.id === 'progress') {
        if (code === 13) { event.preventDefault(); Player.toggle(); Player.scheduleHide(); return; }
      }

      if (code === 37 || code === 38 || code === 39 || code === 40) {
        event.preventDefault();
        Focus.move(code === 37 ? 'left' : code === 39 ? 'right' : code === 38 ? 'up' : 'down');
        return;
      }

      if (code === 13) {
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
      else if (code === 417 || code === 412) { event.preventDefault(); }
      else if (code === 413) { event.preventDefault(); self.closePlayer(); }
    }, false);
  },

  back: function () {
    var modal = $('activateModal');
    if (modal && !modal.classList.contains('hidden')) {
      this.closeActivateQr();
      return;
    }
    if (this.isPlayerOpen()) {
      this.closePlayer();
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
    } catch (e) { /* ignore */ }
    try {
      // Vewd Core (TiVo OS) closes the app when the web app calls window.close().
      if (typeof window.close === 'function') {
        window.close();
        return;
      }
    } catch (e) { /* ignore */ }
    toast('Use the TV back button to exit.');
  },

  isPlayerOpen: function () {
    return !$('screen-player').classList.contains('hidden');
  },

  /* -------------------------------------------------------- registration */

  showLogin: function () {
    var self = this;
    Screens.show('screen-login');

    Device.code().then(function (code) {
      self.code = code;
      self.renderActivation(code);
      self.setStatus('Code ready for registration.', '');
      var active = document.activeElement;
      if (!active || active === document.body) {
        try { $('btnActivate').focus(); } catch (e) { /* ignore */ }
      }
    });
  },

  renderActivation: function (code) {
    $('macCode').textContent = code;
    $('siteUrl').textContent = SITE_BASE.replace(/^https?:\/\//, '');

    var holder = $('qrHolder');
    clear(holder);
    try {
      new QRCode(holder, {
        text: siteLink(code),
        width: 212,
        height: 212,
        colorDark: '#0B0F0C',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      holder.textContent = 'QR unavailable';
    }
  },

  /* Opens the QR code in focus, with the device code. */
  showActivateQr: function () {
    var modal = $('activateModal');
    if (!modal || !this.code) return;
    var holder = $('qrBig');
    clear(holder);
    try {
      new QRCode(holder, {
        text: siteLink(this.code),
        width: 420,
        height: 420,
        colorDark: '#0B0F0C',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      holder.textContent = 'QR unavailable';
    }
    $('activateCode').textContent = this.code;
    show(modal);
    try { $('btnActivateClose').focus(); } catch (e) { /* ignore */ }
  },

  closeActivateQr: function () {
    var modal = $('activateModal');
    if (modal) hide(modal);
    try { $('btnActivate').focus(); } catch (e) { /* ignore */ }
  },

  setStatus: function (text, state) {
    var box = $('actStatus');
    box.className = 'status' + (state ? ' ' + state : '');
    $('actStatusText').textContent = text;
  },

  /* ------------------------------------------------------------- samples */

  startDemo: function () {
    this.demoMode = true;
    this.playDemo(0);
  },

  playDemo: function (index) {
    if (index < 0 || index >= DEMO_ITEMS.length) return false;
    this.demoIndex = index;
    var item = DEMO_ITEMS[index];
    Player.open(item.url, item.title, false);
    this.updatePlayerNav();
    return true;
  },

  onPlaybackEnded: function () {
    if (this.demoMode) return this.playDemo(this.demoIndex + 1);
    return false;
  },

  stepPlayback: function (delta) {
    if (this.demoMode) {
      this.playDemo(this.demoIndex + delta);
      return;
    }
  },

  updatePlayerNav: function () {
    var prev = $('btnPrevPlay');
    var next = $('btnNextPlay');
    if (!prev || !next) return;
    prev.disabled = this.demoIndex <= 0;
    next.disabled = this.demoIndex < 0 || this.demoIndex >= DEMO_ITEMS.length - 1;
    show(prev.parentNode);
  },

  keepPlayerFocus: function (id) {
    setTimeout(function () {
      var button = $(id);
      if (button && !button.disabled) {
        try { button.focus(); } catch (e) { /* ignore */ }
      }
    }, 220);
  },

  closePlayer: function () {
    var fromDemo = this.demoMode;
    Player.close();

    if (fromDemo) {
      this.demoMode = false;
      this.demoIndex = -1;
      this.showLogin();
    }
  }
};

/* ================================================================ player */

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

  /* Wires the <video> events once. */
  bindVideo: function () {
    var self = this;
    this.video = $('video');

    this.video.addEventListener('error', function () {
      if (!App.isPlayerOpen() || !self.currentUrl) return;
      self.onError();
    }, false);

    /* Some models only start playing if play() is called again when
       the first data arrives. */
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
    $('playerBadge').textContent = 'VIDEO';

    this.currentUrl = url;
    this.isLive = !!isLive;
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
    } catch (e) { /* ignore */ }

    this.showOverlay();
    this.showLoading();

    video.src = url;
    this.tryPlay();
    this.armWatchdog();

    setTimeout(function () {
      var button = $('btnPlay');
      if (button) { try { button.focus(); } catch (e) { /* ignore */ } }
    }, 60);
  },

  /* Libera o sinal de "play em andamento" (inclusive em caso de erro). */
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
    /* Never let two play() calls compete for the same video. */
    if (this.playPending) return;
    if (!this.video.paused) { this.onStarted(); return; }
    this.playPending = true;
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
        self.settlePlay();
        self.showOverlay();
        self.scheduleAutoPlay();
      });
    } else {
      this.settlePlay();
      this.onStarted();
    }
  },

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

  onReady: function () {
    if (!this.currentUrl) return;
    if (!this.started) this.hideLoading();
    if (this.wantPlay && this.video && this.video.paused) this.tryPlay();
  },

  /* No more black screen: if the video shows no image, reconnect automatically. */
  armWatchdog: function () {
    var self = this;
    this.clearWatchdog();
    this.loadTimer = setTimeout(function () {
      self.loadTimer = null;
      if (!App.isPlayerOpen() || !self.currentUrl) return;
      var video = self.video;
      if (!video) return;

      if (video.readyState >= 2) {
        if (self.wantPlay && video.paused) self.tryPlay();
        return;
      }

      if (self.autoRetries < 3) {
        self.autoRetries += 1;
        self.reconnect();
        return;
      }

      self.showError('The video took too long to respond. Select "Try again".');
    }, 15000);
  },

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
    } catch (e) { /* ignore */ }

    // The provider sometimes keeps the previous connection stuck and never
    // delivers data. A fresh parameter forces a clean connection (VOD only:
    // on a live channel it could break the HLS playlist).
    var url = this.currentUrl;
    if (!this.isLive) {
      url += (url.indexOf('?') < 0 ? '?' : '&') + 'r=' + Date.now();
    }

    this.showLoading('Connecting again…');
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
    $('playerLoadingText').textContent = text || 'Loading…';
    show($('playerLoading'));
  },

  hideLoading: function () {
    hide($('playerLoading'));
  },

  retry: function () {
    if (!this.currentUrl) return;
    this.open(this.currentUrl, this.currentTitle, this.isLive);
  },

  onError: function () {
    this.settlePlay();
    if (this.tryingHls || !this.currentUrl) {
      this.showError('Check that the video is still available.');
      return;
    }
    if (window.Hls && Hls.isSupported()) {
      this.tryingHls = true;
      this.startHls(this.currentUrl);
    } else {
      this.showError('This format is not supported on this TV.');
    }
  },

  startHls: function (url) {
    var self = this;
    this.destroyHls();

    var hls = new Hls({ enableWorker: false, lowLatencyMode: false });
    this.hls = hls;

    hls.on(Hls.Events.ERROR, function (event, data) {
      if (data && data.fatal) {
        self.showError('We could not open this video.');
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
      try { this.hls.destroy(); } catch (e) { /* ignore */ }
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
      if (button) { try { button.focus(); } catch (e) { /* ignore */ } }
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

  /* Bar click: jump straight to the tapped position. */
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
      } catch (e) { /* ignore */ }
    }
    hide($('playerOverlay'));
    hide($('playerError'));
    this.currentUrl = null;
  }
};

/* ====================================================== initialization */

document.addEventListener('DOMContentLoaded', function () {
  Player.bindVideo();
  $('btnPlay').addEventListener('click', function () { Player.toggle(); });
  $('btnRetryPlay').addEventListener('click', function () { Player.retry(); });
  $('btnPrevPlay').addEventListener('click', function () {
    App.stepPlayback(-1);
    App.keepPlayerFocus('btnPrevPlay');
  });
  $('btnNextPlay').addEventListener('click', function () {
    App.stepPlayback(1);
    App.keepPlayerFocus('btnNextPlay');
  });
  // The time bar is display-only: no seek by click or by buttons.
  App.init();
});
