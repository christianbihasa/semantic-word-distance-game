import gzip
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import evaluate  # noqa: E402


def model(name, rows):
    words = [w for w, _ in rows]
    return evaluate.Model(name, words, evaluate.normalise(np.array([v for _, v in rows], dtype=np.float32)))


def test_blend_ranks_by_average_cosine():
    a = model("a", [("x", [1, 0]), ("y", [1, 1]), ("z", [0, 1])])
    b = model("b", [("x", [1, 0]), ("y", [0, 1]), ("z", [1, 0])])
    blended = evaluate.blend("ab", a, b)
    for w in ("y", "z"):
        expected = (a.unit[a.index["x"]] @ a.unit[a.index[w]] + b.unit[b.index["x"]] @ b.unit[b.index[w]]) / 2
        assert blended.unit[blended.index["x"]] @ blended.unit[blended.index[w]] == pytest.approx(expected)


def test_ranks_put_target_first_and_order_by_similarity():
    m = model("m", [("cat", [1, 0]), ("dog", [0.9, 0.1]), ("car", [0, 1])])
    assert evaluate.ranks_for(m, "cat") == {"cat": 1, "dog": 2, "car": 3}


def test_spearman():
    assert evaluate.spearman([1, 2, 3, 4], [10, 20, 30, 40]) == pytest.approx(1.0)
    assert evaluate.spearman([1, 2, 3, 4], [40, 30, 20, 10]) == pytest.approx(-1.0)


def test_score_target_counts_missing_words_as_worst():
    m = model("m", [("cat", [1, 0]), ("dog", [0.9, 0.1]), ("car", [0, 1])])
    score = evaluate.score_target(m, "cat", ["dog", "unicorn"], reference=None)
    assert score.hit100 == 0.5  # dog is #2; unicorn has no vector, so it ranks last
    assert score.worst[0] == ("unicorn", 4)


def test_read_text_vectors_handles_headers_numberbatch_and_gzip(tmp_path):
    path = tmp_path / "nb.txt.gz"
    with gzip.open(path, "wt", encoding="utf-8") as f:
        f.write("3 2\n/c/en/cat 1 0\n/c/fr/chat 9 9\n/c/en/ice_cream 1 1\ndog 0 1\n")
    found = evaluate.read_text_vectors(path, {"cat", "dog", "chat"})
    assert set(found) == {"cat", "dog"}
    assert found["cat"].tolist() == [1, 0]


def test_resolve_follows_the_games_guess_rules():
    assert evaluate.resolve("held", {"hold"}, {"held": "hold"}) == "hold"
    assert evaluate.resolve("hold", {"hold"}, {}) == "hold"
    assert evaluate.resolve("december", {"hold"}, {}) is None
