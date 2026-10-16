/**
 * worker-rank.ts — Loads the vocabulary and embeddings once (IndexedDB first, then network)
 * and ranks the whole vocabulary against a target off the main thread.
 */

import { getAssets, putAssets } from "./asset-cache";
import { parseEmbeddings, rankByIndex, type Embeddings, type Manifest } from "./ranking";

export interface RankRequest {
  id: number;
  manifest: Manifest;
  baseUrl: string;
  target: string;
}

export type RankResponse = { id: number; words: string[] } | { id: number; error: string };

interface Loaded {
  version: string;
  vocab: string[];
  index: Map<string, number>;
  embeddings: Embeddings;
}

let loaded: Promise<Loaded> | null = null;

async function fetchOk(url: string): Promise<Response> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url} (HTTP ${resp.status})`);
  return resp;
}

async function load(manifest: Manifest, baseUrl: string): Promise<Loaded> {
  let assets = await getAssets(manifest.version);
  if (!assets) {
    const [vocab, embeddings] = await Promise.all([
      fetchOk(baseUrl + manifest.files.vocab).then((r) => r.json() as Promise<string[]>),
      fetchOk(baseUrl + manifest.files.embeddings).then((r) => r.arrayBuffer()),
    ]);
    assets = { vocab, embeddings };
    void putAssets(manifest.version, assets);
  }
  if (assets.vocab.length !== manifest.count) {
    throw new Error(`vocab.json has ${assets.vocab.length} words; manifest says ${manifest.count}`);
  }
  return {
    version: manifest.version,
    vocab: assets.vocab,
    index: new Map(assets.vocab.map((w, i) => [w, i])),
    embeddings: parseEmbeddings(assets.embeddings, manifest.count, manifest.dim),
  };
}

self.addEventListener("message", async (e: MessageEvent<RankRequest>) => {
  const { id, manifest, baseUrl, target } = e.data;
  try {
    if (!loaded) {
      loaded = load(manifest, baseUrl);
    } else if ((await loaded).version !== manifest.version) {
      loaded = load(manifest, baseUrl);
    }
    const data = await loaded;
    const targetIndex = data.index.get(target);
    if (targetIndex === undefined) throw new Error(`"${target}" is not in the vocabulary`);
    const order = rankByIndex(data.embeddings, targetIndex);
    const words = Array.from(order, (i) => data.vocab[i]);
    self.postMessage({ id, words } satisfies RankResponse);
  } catch (err) {
    loaded = null; // allow a retry after transient network failures
    self.postMessage({ id, error: String(err) } satisfies RankResponse);
  }
});
