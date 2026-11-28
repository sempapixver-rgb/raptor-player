import {SITE_BASE} from '../config/app';
import type {Activation, SourceConfig} from '../types';
import {normalizeCode} from './device';
import {fetchTimed} from './media';

export type ActivationResult =
  | {status: 'ok'; source: SourceConfig; activation: Activation}
  | {status: 'pending'}
  | {status: 'blocked' | 'expired'; message: string}
  | {status: 'offline' | 'error'; message: string};

function toSource(activation: Activation): SourceConfig | null {
  const label = activation.label || 'Ativado pelo site';
  if (String(activation.mode || '').toUpperCase() === 'M3U') {
    const link = String(activation.m3u || '').trim();
    if (!link) {
      return null;
    }
    return {mode: 'M3U', m3uUrl: link, label};
  }
  const baseUrl = String(activation.host || '').trim();
  const username = String(activation.user || '').trim();
  const password = String(activation.pass || '').trim();
  if (!baseUrl || !username || !password) {
    return null;
  }
  return {mode: 'XTREAM', baseUrl, username, password, label};
}

export async function fetchActivation(code: string): Promise<ActivationResult> {
  const url =
    SITE_BASE +
    '/api/device?code=' +
    encodeURIComponent(normalizeCode(code)) +
    '&t=' +
    Date.now();

  // Sem tempo limite o polling travava para sempre e o botão parava de responder.
  const response = await fetchTimed(url, {method: 'GET'}, 10000);
  if (!response) {
    return {
      status: 'offline',
      message: 'Sem conexao com o servidor de ativacao.',
    };
  }

  if (response.status === 404) {
    return {status: 'pending'};
  }

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 403) {
    const reason = String(body?.error || '');
    return {
      status: reason === 'expired' ? 'expired' : 'blocked',
      message:
        body?.message ||
        (reason === 'expired'
          ? 'A validade deste aparelho expirou.'
          : 'Este aparelho esta bloqueado.'),
    };
  }

  if (!response.ok || !body?.ok || !body?.activation) {
    return {status: 'error', message: 'Nao foi possivel consultar a ativacao.'};
  }

  const source = toSource(body.activation as Activation);
  if (!source) {
    return {
      status: 'error',
      message: 'A ativacao esta incompleta. Confira no site.',
    };
  }
  return {status: 'ok', source, activation: body.activation as Activation};
}
