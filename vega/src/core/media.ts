/**
 * Ajustes de URL que o player Android usa e que o runtime da Vega nao traz
 * nativamente: conexao nova nas repeticoes e redirecionamento http<->https.
 */

/** URL nova para forcar uma conexao limpa (mesmo `freshUrl` do Android). */
export function freshUrl(url: string): string {
  if (!url) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return url + separator + 'r=' + Date.now();
}

/**
 * Busca com tempo limite real: aborta a requisicao e limpa o timer.
 * `Promise.race` so com setTimeout deixava fetch e timers pendurados.
 */
export async function fetchTimed(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...(init || {}),
      signal: controller.signal,
    } as RequestInit);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Consulta de catalogo com tempo limite e tentativa em http quando o servidor
 * aceita certificado apenas em uma das duas formas (mesmo fallback do Android).
 */
export async function fetchWithFallback(
  url: string,
  timeoutMs = 15000,
): Promise<Response | null> {
  const primary = await fetchTimed(url, undefined, timeoutMs);
  if (primary && primary.ok) {
    return primary;
  }
  if (/^https:\/\//i.test(url)) {
    const fallback = await fetchTimed(
      url.replace(/^https:\/\//i, 'http://'),
      undefined,
      timeoutMs,
    );
    if (fallback && fallback.ok) {
      return fallback;
    }
  }
  return primary;
}

/**
 * O player nativo nao segue redirecionamento entre protocolos (302 de
 * http para https, por exemplo). Uma consulta HEAD resolve o destino final
 * antes de entregar a URL ao player. Sem resposta no tempo limite, a URL
 * original e mantida para nao atrasar o inicio.
 */
export async function resolveRedirect(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) {
    return url;
  }
  const resolved = await fetchTimed(
    url,
    {method: 'HEAD', redirect: 'follow'} as RequestInit,
    2500,
  );
  return resolved?.url || url;
}
