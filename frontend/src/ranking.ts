/**
 * ranking.ts — Pure similarity ranking over int8 embeddings.
 * Must match data-pipeline/common.py `rank_quantized` exactly (checked by tests/ranking.test.ts).
 */

export interface Manifest {
  version: string;
  count: number;
  dim: number;
  files: { vocab: string; embeddings: string; aliases?: string };
  targets: string[];
}

export interface Embeddings {
  dim: number;
  vectors: Int8Array; // count * dim, row-major
  invNorm: Float32Array; // count
}

/** Splits embeddings.bin: int8[count*dim] followed by float32[count] inverse norms. */
export function parseEmbeddings(buffer: ArrayBuffer, count: number, dim: number): Embeddings {
  const vectorBytes = count * dim;
  if (buffer.byteLength !== vectorBytes + 4 * count || vectorBytes % 4 !== 0) {
    throw new Error(`embeddings.bin is ${buffer.byteLength} bytes; expected ${vectorBytes + 4 * count}`);
  }
  return {
    dim,
    vectors: new Int8Array(buffer, 0, vectorBytes),
    invNorm: new Float32Array(buffer, vectorBytes, count),
  };
}

/** Word indices ordered by cosine similarity to `target` (target first), ties broken by index. */
export function rankByIndex({ dim, vectors, invNorm }: Embeddings, target: number): Uint32Array {
  const count = invNorm.length;
  const scores = new Float32Array(count);
  const t = target * dim;
  for (let i = 0; i < count; i++) {
    const row = i * dim;
    let dot = 0;
    for (let d = 0; d < dim; d++) dot += vectors[row + d] * vectors[t + d];
    scores[i] = dot * invNorm[i];
  }
  scores[target] = Infinity;

  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  return order.sort((a, b) => scores[b] - scores[a] || a - b);
}
