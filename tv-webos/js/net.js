/* Camada de rede: XMLHttpRequest (funciona em qualquer versão do webOS). */

var Net = {

  UA: 'Reptor/1.0 (webOS)',

  /**
   * Requisição simples com Promise.
   * options: { url, method, headers, body, timeout, fallback }
   * fallback (padrão true): se a URL for https e falhar, tenta a mesma em http.
   */
  request: function (options) {
    var self = this;
    var url = options.url;
    var allowFallback = options.fallback !== false;

    return new Promise(function (resolve, reject) {
      self._once(options).then(resolve, function (err) {
        if (allowFallback && /^https:\/\//i.test(url)) {
          var alt = 'http://' + url.substring(8);
          var copy = {};
          for (var key in options) {
            if (Object.prototype.hasOwnProperty.call(options, key)) copy[key] = options[key];
          }
          copy.url = alt;
          copy.fallback = false;
          self._once(copy).then(resolve, function () {
            reject(err);
          });
        } else {
          reject(err);
        }
      });
    });
  },

  _once: function (options) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      var method = options.method || 'GET';
      var finished = false;

      try {
        xhr.open(method, options.url, true);
      } catch (e) {
        reject(new Error('Endereço inválido'));
        return;
      }

      xhr.timeout = options.timeout || 45000;
      xhr.responseType = options.responseType || 'text';

      if (options.headers) {
        for (var name in options.headers) {
          if (Object.prototype.hasOwnProperty.call(options.headers, name)) {
            try { xhr.setRequestHeader(name, options.headers[name]); } catch (e) { /* ignora */ }
          }
        }
      }

      function fail(message) {
        if (finished) return;
        finished = true;
        reject(new Error(message));
      }

      xhr.onload = function () {
        if (finished) return;
        finished = true;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            status: xhr.status,
            text: xhr.responseText,
            response: xhr.response
          });
        } else {
          reject(new Error('Servidor respondeu HTTP ' + xhr.status));
        }
      };

      xhr.onerror = function () { fail('Falha de rede'); };
      xhr.ontimeout = function () { fail('Tempo esgotado'); };
      xhr.onabort = function () { fail('Cancelado'); };

      try {
        xhr.send(options.body || null);
      } catch (e) {
        fail(e && e.message ? e.message : 'Falha ao enviar');
      }
    });
  },

  getText: function (url, timeout) {
    return this.request({ url: url, timeout: timeout }).then(function (r) {
      return r.text;
    });
  },

  getJSON: function (url, timeout) {
    return this.request({ url: url, timeout: timeout }).then(function (r) {
      var text = (r.text || '').replace(/^\s+/, '');
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('Resposta inválida (não é JSON)');
      }
    });
  },

  postJSON: function (url, data, timeout) {
    return this.request({
      url: url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      timeout: timeout || 20000
    }).then(function (r) {
      try {
        return JSON.parse(r.text);
      } catch (e) {
        return null;
      }
    });
  }
};
