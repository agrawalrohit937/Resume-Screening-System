"""
BM25 Lexical Search Implementation and MongoDB Atlas Search Builder.
Provides exact keyword/token scoring for hybrid recall stage.
"""

from collections import Counter
import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple
import numpy as np
import structlog

logger = structlog.get_logger(__name__)

# Common English stopwords for fast lexical filtering
STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "as", "at", "be", "because", "been", "before", "being", "below",
    "between", "both", "but", "by", "could", "did", "do", "does", "doing", "down",
    "during", "each", "few", "for", "from", "further", "had", "has", "have", "having",
    "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i",
    "if", "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most",
    "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or",
    "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
    "she", "should", "so", "some", "such", "than", "that", "the", "their", "theirs",
    "them", "themselves", "then", "there", "these", "they", "this", "those", "through",
    "to", "too", "under", "until", "up", "very", "was", "we", "were", "what",
    "when", "where", "which", "while", "who", "whom", "why", "with", "would",
    "you", "your", "yours", "yourself", "yourselves",
}


def tokenize_text(text: str) -> List[str]:
    """
    Tokenizes raw text into lowercased alphanumeric tokens, stripping stopwords.

    Complexity:
        Time: O(L_text)
        Space: O(L_text)
    """
    if not text:
        return []
    clean = re.sub(r"[^\w\s\.\+#]", " ", str(text).lower())
    tokens = [t.strip(".-") for t in clean.split() if len(t) > 1]
    return [t for t in tokens if t and t not in STOPWORDS]


class BM25Okapi:
    """
    In-memory BM25 Okapi lexical ranking algorithm.

    Formulation:
        IDF(q_i) = ln((N - n(q_i) + 0.5) / (n(q_i) + 0.5) + 1.0)
        Score(D, Q) = Σ_{q_i ∈ Q} IDF(q_i) * (f(q_i, D) * (k1 + 1)) / (f(q_i, D) + k1 * (1 - b + b * (|D| / avgdl)))

    Complexity:
        Build Time: O(N_docs * L_doc)
        Query Time: O(L_query * avg_posting_length + N_docs log K)
        Space: O(N_docs * L_doc + Vocabulary)
    """

    def __init__(
        self,
        corpus: List[Dict[str, Any]],
        text_field: str = "text",
        id_field: str = "id",
        k1: float = 1.5,
        b: float = 0.75,
    ):
        self.k1 = k1
        self.b = b
        self.corpus_size = len(corpus)
        self.doc_ids: List[str] = []
        self.doc_tokens: List[List[str]] = []
        self.doc_lens: List[int] = []
        self.doc_freqs: Dict[str, int] = Counter()
        self.idfs: Dict[str, float] = {}
        self.inverted_index: Dict[str, List[Tuple[int, int]]] = {}  # term -> [(doc_idx, freq)]

        total_length = 0
        for idx, doc in enumerate(corpus):
            d_id = str(doc.get(id_field, "") or doc.get("_id", idx))
            self.doc_ids.append(d_id)
            raw = str(doc.get(text_field, "") or "")
            tokens = tokenize_text(raw)
            self.doc_tokens.append(tokens)
            doc_len = len(tokens)
            self.doc_lens.append(doc_len)
            total_length += doc_len

            term_counts = Counter(tokens)
            for term, count in term_counts.items():
                self.doc_freqs[term] += 1
                self.inverted_index.setdefault(term, []).append((idx, count))

        self.avgdl = (total_length / self.corpus_size) if self.corpus_size > 0 else 1.0
        self._precompute_idfs()

    def _precompute_idfs(self):
        n = self.corpus_size
        for term, df in self.doc_freqs.items():
            # Standard Lucene/BM25 Okapi non-negative IDF
            self.idfs[term] = math.log(((n - df + 0.5) / (df + 0.5)) + 1.0)

    def search(self, query: str, top_k: int = 100) -> List[Tuple[str, float]]:
        """
        Executes lexical BM25 search over the indexed corpus.

        Returns:
            List of (doc_id, score) pairs sorted by BM25 score descending.
        """
        if self.corpus_size == 0 or not query:
            return []

        q_tokens = tokenize_text(query)
        if not q_tokens:
            return []

        scores = np.zeros(self.corpus_size, dtype=np.float32)

        for token in q_tokens:
            if token not in self.inverted_index:
                continue
            idf = self.idfs.get(token, 0.0)
            postings = self.inverted_index[token]
            for doc_idx, freq in postings:
                d_len = self.doc_lens[doc_idx]
                numerator = freq * (self.k1 + 1.0)
                denominator = freq + self.k1 * (1.0 - self.b + self.b * (d_len / self.avgdl))
                scores[doc_idx] += idf * (numerator / denominator)

        top_indices = np.argsort(-scores)[:top_k]
        results = [
            (self.doc_ids[idx], float(scores[idx]))
            for idx in top_indices
            if scores[idx] > 0.0
        ]
        return results


def build_atlas_search_bm25_pipeline(
    query_text: str,
    path_fields: List[str],
    filter_clauses: Optional[List[Dict[str, Any]]] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """
    Builds a MongoDB Atlas Search `$search` aggregation pipeline stage using BM25 scoring.

    Complexity:
        Time: O(1) query assembly.
        Space: O(1).
    """
    must_clauses: List[Dict[str, Any]] = [
        {
            "text": {
                "query": query_text,
                "path": path_fields if len(path_fields) > 1 else path_fields[0],
                "score": {"boost": {"value": 1.0}},
            }
        }
    ]

    compound: Dict[str, Any] = {"must": must_clauses}
    if filter_clauses:
        compound["filter"] = filter_clauses

    pipeline = [
        {"$search": {"index": "default", "compound": compound}},
        {"$limit": limit},
        {
            "$project": {
                "score": {"$meta": "searchScore"},
                "_id": 1,
                "title": 1,
                "status": 1,
                "company_name": 1,
                "location": 1,
                "work_mode": 1,
            }
        },
    ]
    return pipeline
