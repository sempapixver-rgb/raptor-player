import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

const STORE = "reptor-activations";
const MAX_DEVICES = 2000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
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

function readToken(req) {
  const auth = req.headers.get("authorization") || "";
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, "").trim();
  return (req.headers.get("x-admin-token") || "").trim();
}

function tokenOk(req) {
  const expected = String(process.env.ADMIN_TOKEN || "").trim();
  if (!expected) return { ok: false, notConfigured: true };
  const received = readToken(req);
  if (received.length !== expected.length) return { ok: false };
  try {
    return { ok: timingSafeEqual(Buffer.from(received), Buffer.from(expected)) };
  } catch {
    return { ok: false };
  }
}

/** Mantém apenas campos conhecidos para não gravar lixo no Blob. */
function cleanRecord(input, previous) {
  const record = { ...(previous || {}) };

  if (input.mode !== undefined) {
    record.mode = String(input.mode).toUpperCase() === "M3U" ? "M3U" : "XTREAM";
  }
  if (input.label !== undefined) record.label = String(input.label || "").trim().slice(0, 60);
  if (input.host !== undefined) record.host = normalizeHost(input.host);
  if (input.user !== undefined) record.user = String(input.user || "").trim();
  if (input.m3u !== undefined) record.m3u = String(input.m3u || "").trim();
  if (input.pass !== undefined && String(input.pass) !== "") {
    record.pass = String(input.pass).trim();
  }
  if (input.plan !== undefined) record.plan = String(input.plan || "").trim().slice(0, 40);
  if (input.notes !== undefined) record.notes = String(input.notes || "").trim().slice(0, 500);
  if (input.status !== undefined) {
    record.status = ["active", "blocked"].includes(String(input.status)) ? String(input.status) : "active";
  }
  if (input.expiresAt !== undefined) {
    const value = String(input.expiresAt || "").trim();
    record.expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  }
  return record;
}

function isExpired(record) {
  if (!record.expiresAt) return false;
  const end = new Date(record.expiresAt + "T23:59:59");
  return Number.isFinite(end.getTime()) && end.getTime() < Date.now();
}

/** Registro para o painel: sem expor a senha, mas sinalizando se existe. */
function publicRecord(record) {
  return {
    code: record.code,
    mode: record.mode || "XTREAM",
    label: record.label || "",
    host: record.host || "",
    user: record.user || "",
    m3u: record.m3u || "",
    hasPass: Boolean(record.pass),
    plan: record.plan || "",
    expiresAt: record.expiresAt || "",
    notes: record.notes || "",
    status: record.status || "active",
    expired: isExpired(record),
    activatedAt: record.activatedAt || "",
    updatedAt: record.updatedAt || "",
  };
}

async function listKeys(store) {
  const result = await store.list();
  const blobs = result && Array.isArray(result.blobs) ? result.blobs : [];
  return blobs.map((blob) => String(blob.key || "")).filter((key) => key.startsWith("device-"));
}

function validateActivation(record) {
  if (record.mode === "M3U") {
    if (!/^https?:\/\//i.test(record.m3u || "")) {
      return "Informe o link M3U completo, começando com http:// ou https://.";
    }
  } else if (!record.host || !record.user || !record.pass) {
    return "Preencha servidor, usuário e senha.";
  }
  return "";
}

export const config = { path: "/api/admin" };

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const auth = tokenOk(req);
  if (auth.notConfigured) {
    return json(503, {
      ok: false,
      error: "admin_not_configured",
      message: "O painel ainda não foi configurado. Defina a variável ADMIN_TOKEN no Netlify.",
    });
  }
  if (!auth.ok) {
    return json(401, { ok: false, error: "unauthorized", message: "Token inválido." });
  }

  let store;
  try {
    store = getStore({ name: STORE, consistency: "strong" });
  } catch {
    return json(500, { ok: false, error: "storage_unavailable" });
  }

  const url = new URL(req.url);

  if (req.method === "GET") {
    const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const status = String(url.searchParams.get("status") || "").trim();

    try {
      const keys = (await listKeys(store)).slice(0, MAX_DEVICES);
      const records = [];
      for (const key of keys) {
        const record = await store.get(key, { type: "json" });
        if (!record) continue;
        if (!record.code) record.code = key.replace(/^device-/, "");
        if (status === "expired" && !isExpired(record)) continue;
        if (status && status !== "expired" && (record.status || "active") !== status) continue;
        if (query) {
          const haystack = [record.code, record.label, record.host, record.user, record.plan, record.notes]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) continue;
        }
        records.push(publicRecord(record));
      }
      records.sort((a, b) =>
        String(b.updatedAt || b.activatedAt).localeCompare(String(a.updatedAt || a.activatedAt))
      );
      return json(200, { ok: true, devices: records });
    } catch {
      return json(500, {
        ok: false,
        error: "storage_unavailable",
        message: "Não foi possível ler as ativações agora.",
      });
    }
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

  const action = String(data.action || "").trim();
  const code = normalizeCode(data.code);
  if (code.length < 8) {
    return json(400, { ok: false, error: "invalid_code", message: "Código/MAC inválido." });
  }

  try {
    const key = `device-${code}`;
    const existing = await store.get(key, { type: "json" });

    if (action === "delete") {
      if (!existing) {
        return json(404, { ok: false, error: "not_found", message: "Ativação não encontrada." });
      }
      await store.delete(key);
      return json(200, { ok: true, deleted: code });
    }

    if (action === "create" && existing) {
      return json(409, {
        ok: false,
        error: "already_exists",
        message: "Já existe uma ativação para este código. Use Editar.",
      });
    }

    if (action !== "create" && action !== "update") {
      return json(400, { ok: false, error: "invalid_action" });
    }

    const record = cleanRecord(data, existing || { code });
    record.code = code;
    record.updatedAt = new Date().toISOString();
    if (!record.activatedAt) record.activatedAt = record.updatedAt;
    if (!record.status) record.status = "active";

    const problem = validateActivation(record);
    if (problem) {
      return json(400, { ok: false, error: "invalid_activation", message: problem });
    }

    await store.setJSON(key, record);
    return json(200, { ok: true, device: publicRecord(record) });
  } catch {
    return json(500, {
      ok: false,
      error: "storage_unavailable",
      message: "Não foi possível salvar agora. Tente novamente.",
    });
  }
};
