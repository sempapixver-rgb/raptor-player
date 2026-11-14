/** Tempo em segundos para mm:ss (ou h:mm:ss quando passa de 1 hora). */
export function formatTime(seconds: number): string {
  const value = Number(seconds);
  if (!isFinite(value) || value <= 0) {
    return '00:00';
  }
  const total = Math.floor(value);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? String(h) + ':' + mm + ':' + ss : mm + ':' + ss;
}

/** Texto sem acento e em minusculas, para busca e comparacao. */
export function normalizeText(text: string): string {
  const value = String(text || '').toLowerCase();
  try {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  } catch {
    return value.trim();
  }
}
