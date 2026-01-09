#!/usr/bin/env python3
"""
Pre-compute pattern similarity scores for the duplicate detection feature.

This script fetches all pattern embeddings, computes pairwise cosine similarities,
and stores pairs above a threshold in the pattern_similarities table.

Usage:
    SUPABASE_SERVICE_KEY="..." python compute_similarities.py

The script processes in chunks to manage memory and shows progress.
Run this periodically (e.g., weekly) or after bulk uploads.
"""

import os
import sys
import time
from typing import List, Dict, Any, Tuple

try:
    import numpy as np
    import requests
except ImportError:
    print("Installing required packages...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "numpy", "requests"])
    import numpy as np
    import requests

# Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://base.tachyonfuture.com")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# Similarity threshold - only store pairs above this
# Lower = more pairs stored, higher = fewer pairs but faster queries
MIN_SIMILARITY_THRESHOLD = 0.85

# Processing settings
FETCH_BATCH_SIZE = 1000  # Fetch embeddings in batches
CHUNK_SIZE = 500  # Process similarity matrix in chunks (for memory)
INSERT_BATCH_SIZE = 100  # Insert into DB in batches


def get_all_embeddings() -> Tuple[List[int], np.ndarray]:
    """Fetch all pattern IDs and embeddings from the database."""
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }

    all_patterns = []
    offset = 0

    print("Fetching embeddings from database...", flush=True)

    while True:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/patterns",
            headers=headers,
            params={
                "select": "id,embedding",
                "embedding": "not.is.null",
                "limit": FETCH_BATCH_SIZE,
                "offset": offset,
                "order": "id.asc"
            }
        )
        response.raise_for_status()
        batch = response.json()

        if not batch:
            break

        all_patterns.extend(batch)
        offset += len(batch)
        print(f"  Fetched {offset} patterns...", flush=True)

    print(f"Total patterns with embeddings: {len(all_patterns)}", flush=True)

    if not all_patterns:
        return [], np.array([])

    # Extract IDs and embeddings
    # Handle embeddings that may come as strings from REST API
    pattern_ids = [p['id'] for p in all_patterns]

    def parse_embedding(emb):
        if isinstance(emb, str):
            # Parse string representation of array
            import json
            return json.loads(emb)
        return emb

    embeddings = np.array([parse_embedding(p['embedding']) for p in all_patterns], dtype=np.float32)

    return pattern_ids, embeddings


def normalize_embeddings(embeddings: np.ndarray) -> np.ndarray:
    """Normalize embeddings to unit vectors for cosine similarity."""
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    # Avoid division by zero
    norms = np.where(norms == 0, 1, norms)
    return embeddings / norms


def clear_similarities_table():
    """Clear the existing similarities table."""
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    # Delete all rows
    response = requests.delete(
        f"{SUPABASE_URL}/rest/v1/pattern_similarities",
        headers=headers,
        params={"pattern_id_1": "gte.0"}  # Match all
    )
    # Ignore errors if table doesn't exist yet
    if response.status_code not in [200, 204, 404]:
        print(f"Warning: Could not clear table: {response.status_code} {response.text}")


def insert_similarities(pairs: List[Dict[str, Any]]):
    """Insert similarity pairs into the database."""
    if not pairs:
        return

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal,resolution=ignore-duplicates",
    }

    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/pattern_similarities",
        headers=headers,
        json=pairs
    )

    if response.status_code not in [200, 201]:
        print(f"Warning: Insert failed: {response.status_code} {response.text[:200]}")


def compute_and_store_similarities(pattern_ids: List[int], embeddings: np.ndarray):
    """Compute pairwise similarities and store pairs above threshold."""
    n = len(pattern_ids)

    if n == 0:
        print("No patterns to process.")
        return

    print(f"\nComputing similarities for {n} patterns...")
    print(f"Minimum threshold: {MIN_SIMILARITY_THRESHOLD}")
    print(f"This involves {n * (n - 1) // 2:,} pair comparisons", flush=True)

    # Normalize embeddings for cosine similarity
    print("Normalizing embeddings...", flush=True)
    normalized = normalize_embeddings(embeddings)

    # Process in chunks to manage memory
    total_pairs_found = 0
    pairs_to_insert = []

    start_time = time.time()

    for i in range(0, n, CHUNK_SIZE):
        chunk_end = min(i + CHUNK_SIZE, n)
        chunk_embeddings = normalized[i:chunk_end]

        # Compute similarities between this chunk and all patterns after it
        # (We only compute upper triangle to avoid duplicates)
        for j in range(i, n, CHUNK_SIZE):
            j_start = max(j, i)  # Start from diagonal
            j_end = min(j + CHUNK_SIZE, n)

            compare_embeddings = normalized[j_start:j_end]

            # Compute similarity matrix for this block
            # Using dot product of normalized vectors = cosine similarity
            similarities = np.dot(chunk_embeddings, compare_embeddings.T)

            # Find pairs above threshold
            for ci, chunk_idx in enumerate(range(i, chunk_end)):
                for cj, compare_idx in enumerate(range(j_start, j_end)):
                    # Only upper triangle (avoid duplicates and self-comparisons)
                    if chunk_idx >= compare_idx:
                        continue

                    sim = float(similarities[ci, cj])
                    if sim >= MIN_SIMILARITY_THRESHOLD:
                        # Store normalized: smaller ID first
                        id1, id2 = pattern_ids[chunk_idx], pattern_ids[compare_idx]
                        if id1 > id2:
                            id1, id2 = id2, id1

                        pairs_to_insert.append({
                            "pattern_id_1": id1,
                            "pattern_id_2": id2,
                            "similarity": round(sim, 6)
                        })
                        total_pairs_found += 1

                        # Insert in batches
                        if len(pairs_to_insert) >= INSERT_BATCH_SIZE:
                            insert_similarities(pairs_to_insert)
                            pairs_to_insert = []

        # Progress update
        progress = (chunk_end / n) * 100
        elapsed = time.time() - start_time
        print(f"  Progress: {progress:.1f}% ({chunk_end}/{n} rows, {total_pairs_found:,} pairs found, {elapsed:.1f}s)", flush=True)

    # Insert remaining pairs
    if pairs_to_insert:
        insert_similarities(pairs_to_insert)

    elapsed = time.time() - start_time
    print(f"\n=== Complete ===")
    print(f"Total similar pairs found: {total_pairs_found:,}")
    print(f"Time elapsed: {elapsed:.1f}s")


def main():
    if not SUPABASE_SERVICE_KEY:
        print("Error: SUPABASE_SERVICE_KEY environment variable required")
        sys.exit(1)

    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Minimum similarity threshold: {MIN_SIMILARITY_THRESHOLD}")
    print()

    # Fetch all embeddings
    pattern_ids, embeddings = get_all_embeddings()

    if len(pattern_ids) == 0:
        print("No patterns with embeddings found.")
        return

    # Clear existing similarities
    print("\nClearing existing similarity data...", flush=True)
    clear_similarities_table()

    # Compute and store new similarities
    compute_and_store_similarities(pattern_ids, embeddings)

    print("\nDone! The Find Duplicates feature should now work quickly.")


if __name__ == "__main__":
    main()
