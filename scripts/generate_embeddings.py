#!/usr/bin/env python3
"""
Generate multimodal embeddings for pattern thumbnails using Voyage AI.

This embeds the actual thumbnail images so users can search with natural
language like "butterflies with flowers" and find visually similar patterns.

Usage:
    pip install voyageai
    SUPABASE_SERVICE_KEY="..." VOYAGE_API_KEY="..." python generate_embeddings.py

Cost estimate: ~$1.80 for 15,350 images (images ~1k tokens each, $0.12/1M tokens)
"""

import os
import sys
import time
import io
from typing import List, Dict, Any
import requests

try:
    import voyageai
    from PIL import Image
except ImportError:
    print("Installing voyageai and pillow...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "voyageai", "pillow"])
    import voyageai
    from PIL import Image

# Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://base.tachyonfuture.com")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY")

# Voyage AI settings - using multimodal for image embeddings
VOYAGE_MODEL = "voyage-multimodal-3"
VOYAGE_BATCH_SIZE = 10  # Smaller batches for images
EMBEDDING_DIMENSION = 1024

# Rate limiting - with payment method, we have higher limits
# Standard is ~300 RPM for multimodal, so we can go much faster
RATE_LIMIT_DELAY = 0.5  # seconds between API calls (safe margin)


def get_patterns_without_embeddings(limit: int = 100) -> List[Dict[str, Any]]:
    """Fetch patterns that don't have embeddings yet."""
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }

    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/patterns",
        headers=headers,
        params={
            "select": "id,file_name,thumbnail_url",
            "embedding": "is.null",
            "thumbnail_url": "not.is.null",  # Only patterns with thumbnails
            "limit": limit,
            "order": "id.asc"
        }
    )
    response.raise_for_status()
    return response.json()


def download_thumbnail(url: str) -> bytes:
    """Download thumbnail image from Supabase storage."""
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.content


def update_pattern_embedding(pattern_id: int, embedding: List[float]):
    """Update a pattern's embedding in the database."""
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    response = requests.patch(
        f"{SUPABASE_URL}/rest/v1/patterns",
        headers=headers,
        params={"id": f"eq.{pattern_id}"},
        json={"embedding": embedding}
    )
    response.raise_for_status()


def main():
    if not SUPABASE_SERVICE_KEY:
        print("Error: SUPABASE_SERVICE_KEY environment variable required")
        sys.exit(1)

    if not VOYAGE_API_KEY:
        print("Error: VOYAGE_API_KEY environment variable required")
        sys.exit(1)

    # Initialize Voyage client
    vo = voyageai.Client(api_key=VOYAGE_API_KEY)

    print(f"Using Voyage model: {VOYAGE_MODEL} (multimodal)")
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Batch size: {VOYAGE_BATCH_SIZE}")
    print()

    total_processed = 0
    total_errors = 0

    while True:
        # Fetch batch of patterns
        patterns = get_patterns_without_embeddings(limit=VOYAGE_BATCH_SIZE)

        if not patterns:
            print("\nAll patterns have embeddings!")
            break

        print(f"Processing {len(patterns)} patterns (starting at ID {patterns[0]['id']})...")

        # Process one image at a time to avoid issues
        for pattern in patterns:
            try:
                # Download thumbnail
                img_bytes = download_thumbnail(pattern['thumbnail_url'])

                # Open as PIL Image
                img = Image.open(io.BytesIO(img_bytes))

                # Generate embedding using SDK with PIL Image
                result = vo.multimodal_embed(
                    inputs=[[img]],
                    model=VOYAGE_MODEL,
                    input_type="document"  # These are documents being indexed
                )
                embedding = result.embeddings[0]

                # Update database
                update_pattern_embedding(pattern["id"], embedding)
                total_processed += 1
                print(f"  ✓ Pattern {pattern['id']} ({total_processed} done, {total_errors} errors)")

                # Rate limiting - wait between each API call
                time.sleep(RATE_LIMIT_DELAY)

            except Exception as e:
                error_msg = str(e)
                if "rate limit" in error_msg.lower() or "RPM" in error_msg:
                    print(f"  Rate limited, waiting 60 seconds...")
                    time.sleep(60)
                    # Don't count rate limits as errors, retry will happen
                else:
                    print(f"  ✗ Error pattern {pattern['id']}: {e}")
                    total_errors += 1
                continue

    print(f"\n=== Complete ===")
    print(f"Total processed: {total_processed}")
    print(f"Total errors: {total_errors}")
    print(f"Estimated cost: ~${total_processed * 0.00012:.2f}")


if __name__ == "__main__":
    main()
