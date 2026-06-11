"""
Generate word frequency data from corpora for use in compute_topk.py.

Supports multiple sources:
- nltk: Use NLTK Wordnet frequency corpus
- uniform: Assign uniform frequency to all words
- file: Load from external frequency file
"""

import os
import json
import argparse
from collections import defaultdict

ARTIFACTS_DIR = os.path.join("artifacts")
OUTPUT_PATH = os.path.join(ARTIFACTS_DIR, "freq.json")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)


def generate_from_nltk(words=None):
    """
    Try to load word frequencies from NLTK corpora.
    Falls back to uniform if unavailable.
    """
    try:
        from nltk.corpus import wordnet as wn
        import nltk
        nltk.download('wordnet', quiet=True)
        nltk.download('wordnet_ic', quiet=True)

        freq = {}
        # Use synset counts as a proxy for frequency
        for word in (words or []):
            synsets = wn.synsets(word)
            # more synsets = more common word
            freq[word] = len(synsets)
        
        if freq:
            print(f"Generated frequencies for {len(freq)} words using NLTK WordNet.")
            return freq
    except Exception as e:
        print(f"NLTK frequency generation failed: {e}. Falling back to uniform.")
    
    return None


def generate_uniform(words):
    """Assign uniform frequency to all words."""
    return {w: 1.0 for w in words}


def load_from_file(filepath):
    """Load frequency data from an external JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def generate_frequencies(words, source='nltk', external_file=None):
    """
    Generate frequency data for the given word list.
    
    Args:
        words: list of words
        source: 'nltk' (WordNet), 'uniform', or 'file'
        external_file: path to external frequency file (required if source='file')
    
    Returns:
        dict mapping word -> frequency score
    """
    if source == 'nltk':
        freq = generate_from_nltk(words)
        if freq is None:
            freq = generate_uniform(words)
    elif source == 'uniform':
        freq = generate_uniform(words)
    elif source == 'file':
        if not external_file:
            raise ValueError("--external-file required when source='file'")
        freq = load_from_file(external_file)
    else:
        raise ValueError(f"Unknown source: {source}")
    
    return freq


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate word frequency data for pool selection.")
    parser.add_argument("--source", choices=['nltk', 'uniform', 'file'], default='nltk',
                        help="Frequency source")
    parser.add_argument("--external-file", type=str, default=None,
                        help="External frequency file (required if source='file')")
    parser.add_argument("--words-file", type=str, default=os.path.join(ARTIFACTS_DIR, "annoy_index_words.json"),
                        help="Path to words list JSON (from build_index.py)")
    parser.add_argument("--output", type=str, default=OUTPUT_PATH,
                        help="Output path for freq.json")
    args = parser.parse_args()

    # Load words from Annoy index
    if not os.path.exists(args.words_file):
        print(f"Words file not found: {args.words_file}")
        print("Run build_index.py first to generate the Annoy index.")
        exit(1)

    with open(args.words_file, 'r', encoding='utf-8') as f:
        words = json.load(f)

    print(f"Loaded {len(words)} words from {args.words_file}")
    print(f"Generating frequencies using source: {args.source}...")

    freq = generate_frequencies(words, source=args.source, external_file=args.external_file)

    # Write output
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(freq, f, ensure_ascii=False)

    print(f"✅ Wrote {len(freq)} frequency scores to {args.output}")
