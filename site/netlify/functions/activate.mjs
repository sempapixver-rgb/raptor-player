import { getStore } from "@netlify/blobs";

const STORE = "reptor-activations";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS,
    },
  });
}

/** Remove separadores e deixa o codigo em maiusculas (AA:BB:.. -> AABB..). */
function normalizeCode(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function normalizeHost(raw) {
  let host = String(raw || "").trim();
  if (!host) return "";
  if (!/^https?:\/\//i.test(host)) host = "http://" + host;
  return host.replace(/\/+$/, "");
}

export const config = { path: "/api/activate" };

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const code = normalizeCode(data.code);
  if (code.length < 8) {
    return json(400, {
      ok: false,
      error: "invalid_code",
      message: "Codigo da TV invalido. Confira o codigo que aparece na tela.",
    });
  }

  const mode = String(data.mode || "").toUpperCase() === "M3U" ? "M3U" : "XTREAM";
  const label = String(data.label || "").trim().slice(0, 60);

  let activation;
  if (mode === "M3U") {
    const m3u = String(data.m3u || "").trim();
    if (!/^https?:\/\//i.test(m3u)) {
      return json(400, {
        ok: false,
        error: "invalid_m3u",
        message: "Informe o link completo da lista, começando com http:// ou https://.",
      });
    }
    activation = { mode, m3u, label, code };
  } else {
    const host = normalizeHost(data.host);
    const user = String(data.user || "").trim();
    const pass = String(data.pass || "").trim();
    if (!host || !user || !pass) {
      return json(400, {
        ok: false,
        error: "invalid_xtream",
        message: "Preencha servidor, usuário e senha.",
      });
    }
    activation = { mode, host, user, pass, label, code };
  }

  const record = {
    ...activation,
    status: "active",
    activatedAt: new Date().toISOString(),
  };

  try {
    const store = getStore({ name: STORE, consistency: "strong" });

    // Se o painel já cadastrou plano/validade/observação para este aparelho,
    // a nova ativação do cliente não apaga esses dados comerciais.
    const previous = await store.get(`device-${code}`, { type: "json" }).catch(() => null);
    if (previous) {
      if (previous.plan) record.plan = previous.plan;
      if (previous.expiresAt) record.expiresAt = previous.expiresAt;
      if (previous.notes) record.notes = previous.notes;
      if (previous.status === "blocked") record.status = "blocked";
    }

    await store.setJSON(`device-${code}`, record);
  } catch (err) {
    return json(500, {
      ok: false,
      error: "storage_unavailable",
      message: "Não foi possível salvar a ativação agora. Tente novamente.",
    });
  }

  return json(200, {
    ok: true,
    code,
    message: "Ativação enviada. A TV vai entrar sozinha em alguns segundos.",
  });
};
