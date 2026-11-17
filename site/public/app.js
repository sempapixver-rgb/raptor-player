(function () {
  "use strict";

  var form = document.getElementById("form");
  var codeInput = document.getElementById("code");
  var submit = document.getElementById("submit");
  var result = document.getElementById("result");
  var terms = document.getElementById("terms");

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

  // Preenche o código quando a pessoa abre a página pelo QR Code da TV.
  var params = new URLSearchParams(window.location.search);
  var fromUrl = params.get("code");
  if (fromUrl) {
    codeInput.value = formatCode(fromUrl);
    var note = document.getElementById("deviceNote");
    if (note) note.classList.remove("hidden");
    var label = document.getElementById("label");
    if (label) label.focus();
  }

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

    if (terms && !terms.checked) {
      showResult("err", "Aceite os termos de uso para cadastrar o aparelho.");
      terms.focus();
      return;
    }

    var payload = {
      code: code,
      label: document.getElementById("label").value.trim()
    };

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
          "Aparelho cadastrado! O código da TV foi registrado com sucesso."
        );
      } else {
        showResult("err", data.message || "Não foi possível cadastrar. Tente novamente.");
      }
    } catch (err) {
      showResult("err", "Falha de conexão. Tente novamente.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Ativar TV";
    }
  });
})();
