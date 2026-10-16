import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402


@pytest.fixture(scope="module")
def source():
    words, vectors, _ = common.load_source()
    return words, vectors


def test_quantized_ranking_tracks_exact_cosine(source):
    words, vectors = source
    q, inv_norm = common.quantize(vectors)
    index = {w: i for i, w in enumerate(words)}
    for word in ("cheese", "ocean", "king"):
        quantized = common.rank_quantized(q, inv_norm, index[word])
        exact = common.rank_exact(vectors, index[word])
        assert quantized[0] == exact[0] == index[word]
        assert len(set(quantized[1:21]) & set(exact[1:21])) >= 18


def test_exact_cosine_matches_definition(source):
    words, vectors = source
    a, b = vectors[words.index("cheese")], vectors[words.index("butter")]
    expected = float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b)))
    unit = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
    assert unit[words.index("cheese")] @ unit[words.index("butter")] == pytest.approx(expected, abs=1e-5)


def test_quantize_handles_zero_rows():
    q, inv_norm = common.quantize(np.zeros((2, 4), dtype=np.float32))
    assert q.dtype == np.int8 and np.all(q == 0)
    assert np.all(np.isfinite(inv_norm))


def test_select_targets_rules():
    words = ["the", "cheese", "cheeses", "albania", "ass", "zebra", "abc", "extraordinarily"]
    headwords = {"the", "cheese", "cheeses", "ass", "zebra", "abc", "extraordinarily"}
    targets = common.select_targets(words, headwords, {"ass"}, min_rank=1, max_rank=100)
    # "the" is too frequent, "cheeses" is an inflection, "albania" is not a headword,
    # "ass" is blocklisted, "abc"/"extraordinarily" fail the length rule.
    assert targets == ["cheese", "zebra"]


@pytest.mark.parametrize(
    ("word", "root"),
    [("cheeses", "cheese"), ("pies", "pie"), ("cities", "city"), ("bragging", "brag"), ("hoped", "hope")],
)
def test_inflection_roots(word, root):
    assert root in common.inflection_roots(word)


def test_annoy_reader_roundtrip(tmp_path):
    dim, count = 3, 2
    node = np.dtype([("n_descendants", "<i4"), ("children", "<i4", 2), ("v", "<f4", dim)])
    nodes = np.zeros(count + 1, dtype=node)
    nodes["n_descendants"][:count] = 1
    nodes["n_descendants"][count] = 2  # a split node after the items
    nodes["v"][:count] = [[1, 2, 3], [4, 5, 6]]
    path = tmp_path / "index.ann"
    nodes.tofile(path)
    assert common.read_annoy_vectors(path, count, dim).tolist() == [[1, 2, 3], [4, 5, 6]]
    with pytest.raises(ValueError):
        common.read_annoy_vectors(path, count + 1, dim)


def test_built_assets_are_consistent():
    manifest = json.loads((common.OUTPUT_DIR / "manifest.json").read_text(encoding="utf-8"))
    vocab = json.loads((common.OUTPUT_DIR / "vocab.json").read_text(encoding="utf-8"))
    size = (common.OUTPUT_DIR / "embeddings.bin").stat().st_size
    assert manifest["count"] == len(vocab)
    assert size == manifest["count"] * manifest["dim"] + 4 * manifest["count"]
    assert set(manifest["targets"]) <= set(vocab)
    assert len(manifest["targets"]) == len(set(manifest["targets"])) > 1000
