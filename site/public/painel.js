(function () {
  "use strict";

  var TOKEN_KEY = "reptor_admin_token";

  var loginView = document.getElementById("loginView");
  var panelView = document.getElementById("panelView");
  var logoutBtn = document.getElementById("logout");

  var loginForm = document.getElementById("loginForm");
  var tokenInput = document.getElementById("token");
  var loginResult = document.getElementById("loginResult");

  var devicesBox = document.getElementById("devices");
  var emptyBox = document.getElementById("empty");
  var listResult = document.getElementById("listResult");
  var searchInput = document.getElementById("search");
  var statusFilter = document.getElementById("statusFilter");
  var reloadBtn = document.getElementById("reload");
  var newBtn = document.getElementById("newBtn");

  var modal = document.getElementById("modal");
  var modalTitle = document.getElementById("modalTitle");
  var deviceForm = document.getElementById("deviceForm");
  var formResult = document.getElementById("formResult");

  var fCode = document.getElementById("fCode");
  var fLabel = document.getElementById("fLabel");
  var fHost = document.getElementById("fHost");
  var fUser = document.getElementById("fUser");
  var fPass = document.getElementById("fPass");
  var fM3u = document.getElementById("fM3u");
  var fPlan = document.getElementById("fPlan");
  var fExpires = document.getElementById("fExpires");
  var fNotes = document.getElementById("fNotes");
  var fBlocked = document.getElementById("fBlocked");
  var passNote = document.getElementById("passNote");
  var fPanelXtream = document.getElementById("fPanelXtream");
  var fPanelM3u = document.getElementById("fPanelM3u");

  var state = {
    token: "",
    devices: [],
    editing: null,
    mode: "XTREAM",
  };

  /* ------------------------------------------------------------ utilidades */

  function formatMac(value) {
    var clean = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    var parts = [];
    for (var i = 0; i < clean.length; i += 2) parts.push(clean.slice(i, i + 2));
    return parts.join(":");
  }

  function normalizeCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function showResult(el, kind, message) {
    el.className = "result " + kind;
    el.textContent = message;
    el.classList.remove("hidden");
  }

  function hideResult(el) {
    el.classList.add("hidden");
    el.textContent = "";
  }

  function api(query, options) {
    var headers = { "Content-Type": "application/json" };
    if (state.token) headers.Authorization = "Bearer " + state.token;
    return fetch("/api/admin" + (query || ""), {
      method: (options && options.method) || "GET",
      headers: headers,
      body: options && options.body ? JSON.stringify(options.body) : undefined,
    }).then(function (response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          return { ok: response.ok, status: response.status, data: data };
        });
    });
  }

  function formatDate(value) {
    if (!value) return "—";
    var parts = String(value).split("-");
    if (parts.length !== 3) return value;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function statusOf(device) {
    if (device.status === "blocked") return "blocked";
    if (device.expired) return "expired";
    return "active";
  }

  function statusLabel(status) {
    if (status === "blocked") return "Bloqueado";
    if (status === "expired") return "Expirado";
    return "Ativo";
  }

  /* ------------------------------------------------------------ login */

  function showLogin() {
    loginView.classList.remove("hidden");
    panelView.classList.add("hidden");
    logoutBtn.classList.add("hidden");
  }

  function showPanel() {
    loginView.classList.add("hidden");
    panelView.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    hideResult(loginResult);
    var token = tokenInput.value.trim();
    if (!token) {
      showResult(loginResult, "err", "Informe o token de acesso.");
      return;
    }
    state.token = token;
    showResult(loginResult, "ok", "Verificando…");
    api("", null)
      .then(function (res) {
        if (res.ok && res.data.ok) {
          sessionStorage.setItem(TOKEN_KEY, token);
          showPanel();
          loadDevices();
        } else {
          state.token = "";
          sessionStorage.removeItem(TOKEN_KEY);
          showResult(
            loginResult,
            "err",
            (res.data && res.data.message) || "Token inválido. Confira e tente novamente."
          );
        }
      })
      .catch(function () {
        state.token = "";
        showResult(loginResult, "err", "Falha de conexão com o servidor.");
      });
  });

  logoutBtn.addEventListener("click", function () {
    state.token = "";
    state.devices = [];
    sessionStorage.removeItem(TOKEN_KEY);
    tokenInput.value = "";
    devicesBox.textContent = "";
    showLogin();
  });

  /* ------------------------------------------------------------ lista */

  function loadDevices() {
    hideResult(listResult);
    api("", null)
      .then(function (res) {
        if (res.status === 401) {
          logoutBtn.click();
          return;
        }
        if (!res.ok || !res.data.ok) {
          showResult(listResult, "err", (res.data && res.data.message) || "Não foi possível carregar as ativações.");
          return;
        }
        state.devices = res.data.devices || [];
        render();
      })
      .catch(function () {
        showResult(listResult, "err", "Falha de conexão com o servidor.");
      });
  }

  function render() {
    var all = state.devices;
    var query = searchInput.value.trim().toLowerCase();
    var filter = statusFilter.value;

    var active = 0;
    var blocked = 0;
    var expired = 0;
    all.forEach(function (device) {
      var st = statusOf(device);
      if (st === "active") active++;
      else if (st === "blocked") blocked++;
      else expired++;
    });

    document.getElementById("statTotal").textContent = String(all.length);
    document.getElementById("statActive").textContent = String(active);
    document.getElementById("statBlocked").textContent = String(blocked);
    document.getElementById("statExpired").textContent = String(expired);

    var visible = all.filter(function (device) {
      if (filter && statusOf(device) !== filter) return false;
      if (!query) return true;
      return [device.code, device.label, device.host, device.user, device.plan, device.notes]
        .join(" ")
        .toLowerCase()
        .indexOf(query) !== -1;
    });

    devicesBox.textContent = "";
    emptyBox.classList.toggle("hidden", visible.length !== 0);

    visible.forEach(function (device) {
      devicesBox.appendChild(buildDevice(device));
    });
  }

  function buildDevice(device) {
    var status = statusOf(device);
    var row = document.createElement("article");
    row.className = "device";

    var idBox = document.createElement("div");
    var mac = document.createElement("div");
    mac.className = "mac";
    mac.textContent = formatMac(device.code);
    var name = document.createElement("div");
    name.className = "name";
    name.textContent = device.label || "Sem nome";
    idBox.appendChild(mac);
    idBox.appendChild(name);

    var access = document.createElement("div");
    access.className = "meta";
    var accessType = document.createElement("b");
    accessType.textContent = device.mode === "M3U" ? "Link M3U" : "Xtream Codes";
    access.appendChild(accessType);
    var host = document.createElement("div");
    host.textContent = device.mode === "M3U" ? "Lista vinculada" : device.host || "—";
    access.appendChild(host);

    var plan = document.createElement("div");
    plan.className = "meta";
    var planName = document.createElement("b");
    planName.textContent = device.plan || "Sem plano";
    plan.appendChild(planName);
    var validity = document.createElement("div");
    validity.textContent = device.expiresAt ? "até " + formatDate(device.expiresAt) : "sem validade";
    plan.appendChild(validity);

    var statusBox = document.createElement("div");
    var badge = document.createElement("span");
    badge.className = "badge " + status;
    badge.textContent = statusLabel(status);
    statusBox.appendChild(badge);

    var actions = document.createElement("div");
    actions.className = "actions";

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", function () {
      openModal(device);
    });
    actions.appendChild(editBtn);

    var toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.textContent = device.status === "blocked" ? "Desbloquear" : "Bloquear";
    toggleBtn.addEventListener("click", function () {
      toggleBlock(device);
    });
    actions.appendChild(toggleBtn);

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "danger";
    delBtn.textContent = "Excluir";
    delBtn.addEventListener("click", function () {
      removeDevice(device);
    });
    actions.appendChild(delBtn);

    row.appendChild(idBox);
    row.appendChild(access);
    row.appendChild(plan);
    row.appendChild(statusBox);
    row.appendChild(actions);
    return row;
  }

  function toggleBlock(device) {
    var blocked = device.status !== "blocked";
    api("", {
      method: "POST",
      body: { action: "update", code: device.code, status: blocked ? "blocked" : "active" },
    })
      .then(function (res) {
        if (!res.ok || !res.data.ok) {
          showResult(listResult, "err", (res.data && res.data.message) || "Não foi possível atualizar.");
          return;
        }
        loadDevices();
      })
      .catch(function () {
        showResult(listResult, "err", "Falha de conexão com o servidor.");
      });
  }

  function removeDevice(device) {
    if (!window.confirm("Excluir a ativação do aparelho " + formatMac(device.code) + "?")) return;
    api("", { method: "POST", body: { action: "delete", code: device.code } })
      .then(function (res) {
        if (!res.ok || !res.data.ok) {
          showResult(listResult, "err", (res.data && res.data.message) || "Não foi possível excluir.");
          return;
        }
        showResult(listResult, "ok", "Ativação excluída.");
        loadDevices();
      })
      .catch(function () {
        showResult(listResult, "err", "Falha de conexão com o servidor.");
      });
  }

  /* ------------------------------------------------------------ modal */

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll("#deviceForm .tab").forEach(function (tab) {
      var active = tab.dataset.mode === mode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    fPanelXtream.classList.toggle("hidden", mode !== "XTREAM");
    fPanelM3u.classList.toggle("hidden", mode !== "M3U");
  }

  document.querySelectorAll("#deviceForm .tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      setMode(tab.dataset.mode);
    });
  });

  function openModal(device) {
    state.editing = device || null;
    hideResult(formResult);
    modalTitle.textContent = device ? "Editar ativação" : "Nova ativação";

    fCode.value = device ? formatMac(device.code) : "";
    fCode.disabled = Boolean(device);
    fLabel.value = device ? device.label || "" : "";
    fHost.value = device ? device.host || "" : "";
    fUser.value = device ? device.user || "" : "";
    fPass.value = "";
    fM3u.value = device ? device.m3u || "" : "";
    fPlan.value = device ? device.plan || "" : "";
    fExpires.value = device ? device.expiresAt || "" : "";
    fNotes.value = device ? device.notes || "" : "";
    fBlocked.checked = Boolean(device && device.status === "blocked");
    passNote.classList.toggle("hidden", !device);

    setMode(device ? device.mode : "XTREAM");
    modal.classList.remove("hidden");
    (device ? fLabel : fCode).focus();
  }

  function closeModal() {
    modal.classList.add("hidden");
    state.editing = null;
  }

  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("cancelModal").addEventListener("click", closeModal);
  modal.addEventListener("click", function (event) {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  fCode.addEventListener("input", function () {
    var pos = fCode.selectionStart;
    var before = fCode.value.length;
    fCode.value = formatMac(fCode.value);
    var after = fCode.value.length;
    if (pos !== null) fCode.setSelectionRange(pos + (after - before), pos + (after - before));
  });

  newBtn.addEventListener("click", function () {
    openModal(null);
  });

  deviceForm.addEventListener("submit", function (event) {
    event.preventDefault();
    hideResult(formResult);

    var code = normalizeCode(fCode.value);
    if (code.length < 8) {
      showResult(formResult, "err", "Confira o código/MAC do aparelho.");
      return;
    }

    var payload = {
      action: state.editing ? "update" : "create",
      code: code,
      mode: state.mode,
      label: fLabel.value.trim(),
      plan: fPlan.value,
      expiresAt: fExpires.value,
      notes: fNotes.value.trim(),
      status: fBlocked.checked ? "blocked" : "active",
    };

    if (state.mode === "M3U") {
      payload.m3u = fM3u.value.trim();
      if (!/^https?:\/\//i.test(payload.m3u)) {
        showResult(formResult, "err", "Informe o link M3U completo, começando com http:// ou https://.");
        return;
      }
    } else {
      payload.host = fHost.value.trim();
      payload.user = fUser.value.trim();
      payload.pass = fPass.value.trim();
      if (!payload.host || !payload.user || (!payload.pass && !state.editing)) {
        showResult(formResult, "err", "Preencha servidor, usuário e senha.");
        return;
      }
    }

    var saveBtn = document.getElementById("saveDevice");
    var wasEditing = Boolean(state.editing);
    saveBtn.disabled = true;
    saveBtn.textContent = "Salvando…";

    api("", { method: "POST", body: payload })
      .then(function (res) {
        if (!res.ok || !res.data.ok) {
          showResult(formResult, "err", (res.data && res.data.message) || "Não foi possível salvar.");
          return;
        }
        closeModal();
        showResult(listResult, "ok", wasEditing ? "Ativação atualizada." : "Ativação criada.");
        loadDevices();
      })
      .catch(function () {
        showResult(formResult, "err", "Falha de conexão com o servidor.");
      })
      .finally(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = "Salvar";
      });
  });

  /* ------------------------------------------------------------ filtros */

  var searchTimer = null;
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 180);
  });
  statusFilter.addEventListener("change", render);
  reloadBtn.addEventListener("click", loadDevices);

  /* ------------------------------------------------------------ início */

  var saved = sessionStorage.getItem(TOKEN_KEY);
  if (saved) {
    state.token = saved;
    api("", null)
      .then(function (res) {
        if (res.ok && res.data.ok) {
          showPanel();
          loadDevices();
        } else {
          state.token = "";
          sessionStorage.removeItem(TOKEN_KEY);
          showLogin();
        }
      })
      .catch(function () {
        showLogin();
      });
  } else {
    showLogin();
  }
})();
