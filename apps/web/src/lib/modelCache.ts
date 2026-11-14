import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Cache persistente dos modelos 3D (Cache Storage do navegador).
 *
 * Os `.glb` são a maior parte do download do jogo e não mudam entre partidas: depois da
 * primeira vez eles vêm do disco, sem rede, e a base abre quase instantaneamente (inclusive
 * ao "sortear outra base"). A cada leitura fazemos uma checagem barata (HEAD) para saber se o
 * arquivo mudou no servidor; se sim, baixamos de novo e atualizamos o cache.
 */
const CACHE_NAME = 'mars-outpost-models-v1';
const VALIDATE_TIMEOUT_MS = 800;

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

/** O que identifica uma versão do arquivo nos cabeçalhos HTTP. */
function fingerprint(res: Response): string {
  return [
    res.headers.get('etag') ?? '',
    res.headers.get('last-modified') ?? '',
    res.headers.get('content-length') ?? '',
  ].join('|');
}

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(CACHE_NAME);
  } catch {
    return null; // modo privativo / armazenamento bloqueado
  }
}

/** Mesma URL em andamento: uma única requisição para vários chamadores. */
const inflight = new Map<string, Promise<ArrayBuffer>>();

async function readBuffer(url: string): Promise<ArrayBuffer> {
  const cache = await openCache();
  const hit = await cache?.match(url);

  if (hit && cache) {
    // O arquivo continua o mesmo? (offline ou lento: confia no que está guardado)
    try {
      const ctl = new AbortController();
      const t = window.setTimeout(() => ctl.abort(), VALIDATE_TIMEOUT_MS);
      const head = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: ctl.signal });
      window.clearTimeout(t);
      if (head.ok && fingerprint(head) !== fingerprint(hit) && fingerprint(head) !== '||') {
        return await download(url, cache);
      }
    } catch {
      /* sem rede: usa a cópia local */
    }
    return hit.arrayBuffer();
  }
  return download(url, cache);
}

async function download(url: string, cache: Cache | null): Promise<ArrayBuffer> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Falha ao baixar ${url} (${res.status})`);
  if (cache) void cache.put(url, res.clone()).catch(() => {});
  return res.arrayBuffer();
}

function loadBuffer(url: string): Promise<ArrayBuffer> {
  let p = inflight.get(url);
  if (!p) {
    p = readBuffer(url).finally(() => inflight.delete(url));
    inflight.set(url, p);
  }
  return p;
}

/**
 * Carrega e decodifica um GLB usando o cache persistente. Cada chamada devolve uma cena nova
 * (o que o jogo altera e descarta não contamina as próximas partidas).
 */
export async function loadGLB(url: string): Promise<GLTF> {
  const buffer = await loadBuffer(url);
  // `parse` consome o buffer: cada decodificação recebe a própria cópia
  return loader.parseAsync(buffer.slice(0), url.slice(0, url.lastIndexOf('/') + 1));
}
