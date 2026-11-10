(function () {
  "use strict";

  var form = document.getElementById("form");
  var codeInput = document.getElementById("code");
  var submit = document.getElementById("submit");
  var result = document.getElementById("result");
  var mode = "XTREAM";

  var panelXtream = document.getElementById("panel-xtream");
  var panelM3u = document.getElementById("panel-m3u");

  function formatCode(value) {
    var clean = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    var parts = [];
    for (var i = 0; i < clean.length; i += 2) parts.push(clean.slice(i, i + 2));
    return parts.join(":");
  }

  function normalizeCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  codeInput.addEventListener("input", function () {
    var pos = codeInput.selectionStart;
    var before = codeInput.value.length;
    codeInput.value = formatCode(codeInput.value);
    var after = codeInput.value.length;
    if (pos !== null) {
      codeInput.setSelectionRange(pos + (after - before), pos + (after - before));
    }
  });

  // Preenche o codigo quando o cliente abre pelo QR Code da TV.
  var params = new URLSearchParams(window.location.search);
  var fromUrl = params.get("code");
  if (fromUrl) {
    codeInput.value = formatCode(fromUrl);
    var note = document.getElementById("deviceNote");
    if (note) note.classList.remove("hidden");
    var next = document.getElementById("host");
    if (next) next.focus();
  }

  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      mode = tab.dataset.mode;
      document.querySelectorAll(".tab").forEach(function (other) {
        var active = other === tab;
        other.classList.toggle("active", active);
        other.setAttribute("aria-selected", active ? "true" : "false");
      });
      panelXtream.classList.toggle("hidden", mode !== "XTREAM");
      panelM3u.classList.toggle("hidden", mode !== "M3U");
      hideResult();
    });
  });

  function showResult(kind, message) {
    result.className = "result " + kind;
    result.textContent = message;
    result.classList.remove("hidden");
  }

  function hideResult() {
    result.classList.add("hidden");
    result.textContent = "";
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideResult();

    var code = normalizeCode(codeInput.value);
    if (code.length < 8) {
      showResult("err", "Confira o código da TV. Ele tem 12 caracteres, como AA:BB:CC:DD:EE:FF.");
      codeInput.focus();
      return;
    }

    var payload = {
      code: code,
      mode: mode,
      label: document.getElementById("label").value.trim()
    };

    if (mode === "M3U") {
      var m3u = document.getElementById("m3u").value.trim();
      if (!/^https?:\/\//i.test(m3u)) {
        showResult("err", "Informe o link completo da lista, começando com http:// ou https://.");
        return;
      }
      payload.m3u = m3u;
    } else {
      var host = document.getElementById("host").value.trim();
      var user = document.getElementById("user").value.trim();
      var pass = document.getElementById("pass").value.trim();
      if (!host || !user || !pass) {
        showResult("err", "Preencha servidor, usuário e senha.");
        return;
      }
      payload.host = host;
      payload.user = user;
      payload.pass = pass;
    }

    submit.disabled = true;
    submit.textContent = "Ativando...";

    try {
      var response = await fetch("/api/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      var data = await response.json().catch(function () { return {}; });

      if (response.ok && data.ok) {
        showResult(
          "ok",
          "Ativação enviada! Na TV, toque em “Verificar agora” ou feche e abra o app. " +
          "Ele entra sozinho com a configuração que você acabou de enviar."
        );
      } else {
        showResult("err", data.message || "Não foi possível ativar. Tente novamente.");
      }
    } catch (err) {
      showResult("err", "Falha de conexão com o servidor de ativação. Tente novamente.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Ativar TV";
    }
  });
})();
