import os
import json
import urllib.request
import re
import argparse
import nltk
import numpy as np
from annoy import AnnoyIndex
from nltk.corpus import words

nltk.download('words', quiet=True)
VALID_ENGLISH_WORDS = set(w.lower() for w in words.words())

# Configure mirrors similar to existing pipeline
VECTOR_MIRRORS = [
    "https://huggingface.co/datasets/Jay-Mayekar/glove-vectors/resolve/main/glove.6B.50d.txt",
    "https://huggingface.co/JeremiahZ/glove/resolve/main/glove.6B.50d.txt",
    "https://raw.githubusercontent.com/teropa/nlp/master/glove.6B.50d.txt"
]

DICTIONARY_URL = "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt"
OUTPUT_DIR = os.path.join("..", "frontend", "public", "topk")
ARTIFACTS_DIR = os.path.join("artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)


def is_valid_game_word(word: str) -> bool:
    if not re.match(r"^[a-z]+$", word):
        return False
    if len(word) < 3 or len(word) > 12:
        return False
    if word not in VALID_ENGLISH_WORDS:
        return False
    return True


def load_master_vocab():
    print("Loading master vocabulary...")
    req = urllib.request.Request(DICTIONARY_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as response:
        all_raw = response.read().decode('utf-8').splitlines()
    master = set()
    for raw in all_raw:
        w = raw.strip().lower()
        if is_valid_game_word(w):
            master.add(w)
    print(f"Filtered master vocab size: {len(master)}")
    return master


def fetch_embeddings(master_vocab, max_words=0):
    print("Fetching embeddings from mirrors...")
    embeddings = {}
    for url in VECTOR_MIRRORS:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=20) as response:
                for raw_line in response:
                    line = raw_line.decode('utf-8')
                    parts = line.strip().split()
                    if not parts:
                        continue
                    word = parts[0].lower()
                    if word in master_vocab:
                        try:
                            vec = np.array([float(x) for x in parts[1:]], dtype=np.float32)
                            embeddings[word] = vec
                        except ValueError:
                            continue
                    if max_words and len(embeddings) >= max_words:
                        break
            if len(embeddings) > 100:
                print(f"Loaded {len(embeddings)} embeddings from {url}")
                break
        except Exception as e:
            print(f"Mirror failed: {e}")
            continue
    return embeddings


def build_ann_index(embeddings, dim=None, n_trees=50, out_prefix=os.path.join(ARTIFACTS_DIR, "annoy_index")):
    if not embeddings:
        raise RuntimeError("No embeddings to index")
    first_vec = next(iter(embeddings.values()))
    DIM = dim or len(first_vec)
    index = AnnoyIndex(DIM, 'angular')
    words = []
    for i, (w, vec) in enumerate(embeddings.items()):
        index.add_item(i, vec.tolist())
        words.append(w)
    print(f"Building Annoy index with DIM={DIM} and n_trees={n_trees}...")
    index.build(n_trees)
    ann_path = f"{out_prefix}.ann"
    index.save(ann_path)
    # Save words order and metadata
    with open(f"{out_prefix}_words.json", "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False)
    meta = {"dim": DIM, "n_trees": n_trees, "count": len(words)}
    with open(f"{out_prefix}_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f)
    print(f"Saved index to {ann_path} and {out_prefix}_words.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-words", type=int, default=0, help="Limit number of embeddings to ingest (0 = all)")
    parser.add_argument("--n-trees", type=int, default=50, help="Annoy trees to build")
    args = parser.parse_args()

    master = load_master_vocab()
    embeddings = fetch_embeddings(master, max_words=args.max_words)
    if not embeddings:
        print("No embeddings loaded; aborting.")
    else:
        build_ann_index(embeddings, n_trees=args.n_trees)
