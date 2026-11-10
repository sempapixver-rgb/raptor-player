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

function normalizeCode(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

export const config = { path: "/api/device" };

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "GET") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  const url = new URL(req.url);
  const code = normalizeCode(url.searchParams.get("code"));
  if (code.length < 8) {
    return json(400, { ok: false, error: "invalid_code" });
  }

  let record = null;
  try {
    const store = getStore({ name: STORE, consistency: "strong" });
    record = await store.get(`device-${code}`, { type: "json" });
  } catch (err) {
    return json(500, {
      ok: false,
      error: "storage_unavailable",
      message: "Servidor de ativação indisponível.",
    });
  }

  if (!record) {
    return json(404, { ok: false, error: "not_found" });
  }

  return json(200, { ok: true, activation: record });
};
