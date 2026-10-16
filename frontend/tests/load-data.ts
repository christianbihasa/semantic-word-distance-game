import { readFileSync } from "node:fs";
import { parseEmbeddings, type Embeddings, type Manifest } from "../src/ranking";

const dataDir = new URL("../public/data/", import.meta.url);

export function loadGameData(): { manifest: Manifest; vocab: string[]; embeddings: Embeddings } {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", dataDir), "utf8")) as Manifest;
  const vocab = JSON.parse(readFileSync(new URL(manifest.files.vocab, dataDir), "utf8")) as string[];
  const bytes = readFileSync(new URL(manifest.files.embeddings, dataDir));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return { manifest, vocab, embeddings: parseEmbeddings(buffer, manifest.count, manifest.dim) };
}
