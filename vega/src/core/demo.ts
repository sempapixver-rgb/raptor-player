import type {Entry} from '../types';

/**
 * Conteudo de demonstracao: filmes curtos de dominio publico / amostras
 * publicas de video. Serve para o cliente (e a loja) testar o player sem
 * nenhuma lista ou credencial.
 */
const BASE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';

function movie(id: string, name: string, file: string, plot: string): Entry {
  return {
    id,
    name,
    kind: 'VOD',
    categoryId: 'demo-filmes',
    category: 'Filmes de demonstracao',
    plot,
    url: BASE + file,
    ext: 'mp4',
  };
}

export const demoItems: Entry[] = [
  movie(
    'demo-bunny',
    'Big Buck Bunny',
    'BigBuckBunny.mp4',
    'Curta de animacao de dominio publico usado para testar reproducao.',
  ),
  movie(
    'demo-sintel',
    'Sintel',
    'Sintel.mp4',
    'Curta de animacao de dominio publico usado para testar reproducao.',
  ),
  movie(
    'demo-steel',
    'Tears of Steel',
    'TearsOfSteel.mp4',
    'Curta de ficcao cientifica de dominio publico.',
  ),
  movie(
    'demo-dream',
    'Elephants Dream',
    'ElephantsDream.mp4',
    'Curta de animacao de dominio publico.',
  ),
  movie(
    'demo-blazes',
    'For Bigger Blazes',
    'ForBiggerBlazes.mp4',
    'Amostra publica de video em alta definicao.',
  ),
  movie(
    'demo-escapes',
    'For Bigger Escapes',
    'ForBiggerEscapes.mp4',
    'Amostra publica de video em alta definicao.',
  ),
];

export const demoLive: Entry[] = [
  {
    id: 'demo-hls',
    name: 'Transmissao de teste (HLS)',
    kind: 'LIVE',
    categoryId: 'demo-ao-vivo',
    category: 'Ao vivo de demonstracao',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    id: 'demo-apple',
    name: 'Amostra ao vivo (Apple HLS)',
    kind: 'LIVE',
    categoryId: 'demo-ao-vivo',
    category: 'Ao vivo de demonstracao',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
  },
];
