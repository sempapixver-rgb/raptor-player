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
 * O player nativo nao segue redirecionamento entre protocolos (302 de
 * http para https, por exemplo). Uma consulta HEAD resolve o destino final
 * antes de entregar a URL ao player. Sem resposta no tempo limite, a URL
 * original e mantida para nao atrasar o inicio.
 */
/**
 * Consulta de catalogo com tempo limite e tentativa em http quando o servidor
 * aceita certificado apenas em uma das duas formas (mesmo fallback do Android).
 */
export async function fetchWithFallback(
  url: string,
  timeoutMs = 15000,
): Promise<Response | null> {
  const once = async (target: string): Promise<Response | null> => {
    try {
      return await Promise.race([
        fetch(target),
        new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
      ]);
    } catch {
      return null;
    }
  };

  const primary = await once(url);
  if (primary && primary.ok) {
    return primary;
  }
  if (/^https:\/\//i.test(url)) {
    const fallback = await once(url.replace(/^https:\/\//i, 'http://'));
    if (fallback && fallback.ok) {
      return fallback;
    }
  }
  return primary;
}

export async function resolveRedirect(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) {
    return url;
  }
  try {
    const resolved = await Promise.race([
      fetch(url, {method: 'HEAD', redirect: 'follow'} as RequestInit)
        .then(response => response.url || url)
        .catch(() => url),
      new Promise<string>(resolve => setTimeout(() => resolve(url), 2500)),
    ]);
    return resolved || url;
  } catch {
    return url;
  }
}
