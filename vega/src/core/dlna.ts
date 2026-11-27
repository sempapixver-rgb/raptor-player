import type {SourceConfig, Entry} from '../types';
import {playUrl} from './xtream';
import {readJSON, writeJSON} from './storage';

export type DlnaDevice = {
  name: string;
  controlUrl: string;
  host: string;
};

const SERVICE = 'urn:schemas-upnp-org:service:AVTransport:1';
const CANDIDATES = [
  '/upnp/control/AVTransport1',
  '/upnp/control/AVTransport',
  '/AVTransport/ctrl',
  '/upnp/control/rendertransport1',
];

const M3U8 = /\.m3u8(\?.*)?$/i;

const xmlEscape = (value: string) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function mimeFor(url: string): string {
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.ts')) {
    return 'video/mpeg';
  }
  if (path.endsWith('.mkv')) {
    return 'video/x-matroska';
  }
  if (path.endsWith('.avi')) {
    return 'video/avi';
  }
  if (path.endsWith('.mov')) {
    return 'video/quicktime';
  }
  if (path.endsWith('.m3u8')) {
    return 'application/vnd.apple.mpegurl';
  }
  return 'video/mp4';
}

/** Canais ao vivo chegam em HLS; TVs LG preferem o mesmo stream em .ts. */
export function castableUrl(url: string): string {
  return url.replace(M3U8, '.ts');
}

async function soap(
  controlUrl: string,
  action: string,
  body: string,
): Promise<string> {
  const envelope =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"' +
    ' xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<s:Body><u:' +
    action +
    ' xmlns:u="' +
    SERVICE +
    '">' +
    body +
    '</u:' +
    action +
    '></s:Body></s:Envelope>';

  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const response = await Promise.race([
      fetch(controlUrl, {
        method: 'POST',
        headers: {
          SOAPAction: '"' + SERVICE + '#' + action + '"',
          'Content-Type': 'text/xml; charset="utf-8"',
        },
        body: envelope,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Tempo esgotado')), 5000);
      }),
    ]);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    return await response.text();
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function didl(title: string, url: string, mime: string): string {
  return (
    '<DIDL-Lite' +
    ' xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"' +
    ' xmlns:dc="http://purl.org/dc/elements/1.1/"' +
    ' xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">' +
    '<item id="0" parentID="-1" restricted="1">' +
    '<dc:title>' +
    xmlEscape(title) +
    '</dc:title>' +
    '<upnp:class>object.item.videoItem</upnp:class>' +
    '<res protocolInfo="http-get:*:' +
    mime +
    ':*">' +
    xmlEscape(url) +
    '</res>' +
    '</item></DIDL-Lite>'
  );
}

export async function loadDevices(): Promise<DlnaDevice[]> {
  const list = await readJSON<DlnaDevice[]>('dlna.devices', []);
  return Array.isArray(list) ? list : [];
}

export async function saveDevices(list: DlnaDevice[]): Promise<void> {
  await writeJSON('dlna.devices', list.slice(0, 8));
}

function baseOf(raw: string): string {
  let host = String(raw || '').trim();
  if (!host) {
    return '';
  }
  if (!/^https?:\/\//i.test(host)) {
    host = 'http://' + host;
  }
  return host.replace(/\/+$/, '');
}

/** Testa os caminhos AVTransport usuais e Guarda o que responder. */
export async function addDevice(raw: string): Promise<DlnaDevice> {
  const base = baseOf(raw);
  if (!base) {
    throw new Error('Informe o endereco da TV.');
  }
  let lastError = '';
  for (const path of CANDIDATES) {
    const controlUrl = base + path;
    try {
      await soap(controlUrl, 'GetTransportInfo', '<InstanceID>0</InstanceID>');
      return {name: base.replace(/^https?:\/\//, ''), controlUrl, host: base};
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error('TV nao respondeu. ' + lastError);
}

export async function cast(
  device: DlnaDevice,
  source: SourceConfig,
  entry: Entry,
): Promise<void> {
  const original = playUrl(source, entry);
  if (!original) {
    throw new Error('Este item nao tem URL reproduzivel.');
  }
  const target = castableUrl(original);
  const mime = mimeFor(target);
  const metadata = didl(entry.name, target, mime);
  const params =
    '<InstanceID>0</InstanceID>' +
    '<CurrentURI>' +
    xmlEscape(target) +
    '</CurrentURI>' +
    '<CurrentURIMetaData>' +
    xmlEscape(metadata) +
    '</CurrentURIMetaData>';

  let sent = false;
  try {
    await soap(device.controlUrl, 'SetAVTransportURI', params);
    sent = true;
  } catch {
    try {
      await soap(
        device.controlUrl,
        'SetAVTransportURI',
        params.replace('http-get:*:' + mime + ':*', 'http-get:*:*:*'),
      );
      sent = true;
    } catch {
      sent = false;
    }
  }
  if (!sent) {
    throw new Error('A TV nao aceitou este video.');
  }
  await soap(
    device.controlUrl,
    'Play',
    '<InstanceID>0</InstanceID><Speed>1</Speed>',
  );
}

export async function stop(device: DlnaDevice): Promise<void> {
  await soap(device.controlUrl, 'Stop', '<InstanceID>0</InstanceID>');
}
