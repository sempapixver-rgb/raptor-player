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

/**
 * Link get.php?username=..&password=.. também responde a API Xtream.
 * Convertendo aqui, a TV e o celular não precisam baixar a lista inteira
 * (dezenas de MB) e passam a carregar só a pasta escolhida.
 */
function xtreamFromM3u(raw) {
  try {
    const url = new URL(String(raw || "").trim());
    if (!/\/get\.php$/i.test(url.pathname)) return null;
    const user = url.searchParams.get("username") || url.searchParams.get("user") || "";
    const pass = url.searchParams.get("password") || url.searchParams.get("pass") || "";
    if (!user || !pass) return null;
    return { host: url.origin, user, pass };
  } catch {
    return null;
  }
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
      message: "Invalid TV code. Check the code shown on the screen.",
    });
  }

  // O formulário público envia o código do aparelho e o endereço dos vídeos.
  // O campo "Add URL" usa o nome videoUrl (nenhum termo técnico é exibido).
  const hasConfig = data.mode !== undefined || data.host !== undefined ||
    data.user !== undefined || data.pass !== undefined ||
    data.m3u !== undefined || data.videoUrl !== undefined;

  if (!hasConfig) {
    const publicLabel = String(data.label || "").trim().slice(0, 60);
    const record = {
      code,
      label: publicLabel,
      status: "active",
      activatedAt: new Date().toISOString(),
    };
    try {
      const store = getStore({ name: STORE, consistency: "strong" });
      const previous = await store.get(`device-${code}`, { type: "json" }).catch(() => null);
      if (previous) {
        for (const key of ["mode", "host", "user", "pass", "m3u", "plan", "expiresAt", "notes"]) {
          if (previous[key] !== undefined) record[key] = previous[key];
        }
        if (previous.status === "blocked") record.status = "blocked";
      }
      await store.setJSON(`device-${code}`, record);
    } catch (err) {
      return json(500, {
        ok: false,
        error: "storage_unavailable",
        message: "We could not save that now. Please try again.",
      });
    }
    return json(200, { ok: true, code, message: "Device registered." });
  }

  const urlValue = String(data.videoUrl || data.m3u || "").trim();
  const explicitMode = String(data.mode || "").toUpperCase();
  const mode = explicitMode === "XTREAM" ? "XTREAM" : (urlValue ? "M3U" : "XTREAM");
  const label = String(data.label || "").trim().slice(0, 60);

  let activation;
  if (mode === "M3U") {
    if (!/^https?:\/\//i.test(urlValue)) {
      return json(400, {
        ok: false,
        error: "invalid_url",
        message: "Enter a complete address starting with http:// or https://.",
      });
    }
    const xtream = xtreamFromM3u(urlValue);
    activation = xtream
      ? { mode: "XTREAM", host: xtream.host, user: xtream.user, pass: xtream.pass, label, code }
      : { mode, m3u: urlValue, label, code };
  } else {
    const host = normalizeHost(data.host);
    const user = String(data.user || "").trim();
    const pass = String(data.pass || "").trim();
    if (!host || !user || !pass) {
      return json(400, {
        ok: false,
        error: "invalid_xtream",
        message: "Fill in the server, user and password.",
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
      message: "We could not save that now. Please try again.",
    });
  }

  return json(200, {
    ok: true,
    code,
    message: "Saved! Your TV will load the address automatically in a few seconds.",
  });
};
