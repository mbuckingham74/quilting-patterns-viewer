#!/usr/bin/env python3
"""
Bulk rotate portrait-oriented thumbnails to landscape.

This script:
1. Fetches all patterns with thumbnails
2. Downloads each thumbnail and checks its dimensions
3. If height > width (portrait), rotates 90° clockwise
4. Re-uploads the rotated image
5. Clears the embedding (needs regeneration)

Usage:
    python bulk_rotate_portraits.py [--dry-run] [--limit N]

Options:
    --dry-run   Only detect portraits, don't rotate
    --limit N   Process only first N patterns (for testing)
"""

import os
import sys
import argparse
import requests
from io import BytesIO
from PIL import Image
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    sys.exit(1)

# Supabase REST API headers
HEADERS = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}


def fetch_patterns_with_thumbnails(limit=None):
    """Fetch all patterns that have thumbnails."""
    patterns = []
    page_size = 1000
    offset = 0

    while True:
        url = f"{SUPABASE_URL}/rest/v1/patterns?select=id,thumbnail_url&thumbnail_url=not.is.null&order=id&offset={offset}&limit={page_size}"
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()

        batch = response.json()
        if not batch:
            break

        patterns.extend(batch)
        offset += len(batch)

        if limit and len(patterns) >= limit:
            patterns = patterns[:limit]
            break

        if len(batch) < page_size:
            break

    return patterns


def get_image_dimensions(url):
    """Download image and return (width, height)."""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content))
        return img.size  # (width, height)
    except Exception as e:
        print(f"  Error fetching image: {e}")
        return None


def rotate_and_upload(pattern_id, thumbnail_url):
    """Download, rotate 90° CW, and re-upload the thumbnail."""
    try:
        # Download
        response = requests.get(thumbnail_url, timeout=30)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content))

        # Rotate 90° clockwise (which is -90° or 270° in PIL)
        rotated = img.rotate(-90, expand=True)

        # Save to buffer as PNG
        buffer = BytesIO()
        rotated.save(buffer, format='PNG')
        buffer.seek(0)

        # Upload to Supabase Storage
        storage_path = f"{pattern_id}.png"
        upload_url = f"{SUPABASE_URL}/storage/v1/object/thumbnails/{storage_path}"

        upload_headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Content-Type': 'image/png',
            'x-upsert': 'true'
        }

        upload_response = requests.put(upload_url, headers=upload_headers, data=buffer.getvalue())
        upload_response.raise_for_status()

        # Clear the embedding since the image changed
        update_url = f"{SUPABASE_URL}/rest/v1/patterns?id=eq.{pattern_id}"
        update_response = requests.patch(
            update_url,
            headers=HEADERS,
            json={'embedding': None}
        )
        update_response.raise_for_status()

        return True
    except Exception as e:
        print(f"  Error rotating: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Bulk rotate portrait thumbnails')
    parser.add_argument('--dry-run', action='store_true', help='Only detect, do not rotate')
    parser.add_argument('--limit', type=int, help='Process only first N patterns')
    args = parser.parse_args()

    print("Fetching patterns with thumbnails...")
    patterns = fetch_patterns_with_thumbnails(args.limit)
    print(f"Found {len(patterns)} patterns to check")

    portraits = []
    errors = []

    for i, pattern in enumerate(patterns):
        pattern_id = pattern['id']
        thumbnail_url = pattern['thumbnail_url']

        if i % 100 == 0:
            print(f"Checking pattern {i+1}/{len(patterns)}...")

        dimensions = get_image_dimensions(thumbnail_url)
        if dimensions is None:
            errors.append(pattern_id)
            continue

        width, height = dimensions

        if height > width:
            portraits.append({
                'id': pattern_id,
                'url': thumbnail_url,
                'width': width,
                'height': height
            })
            print(f"  Pattern {pattern_id}: {width}x{height} (PORTRAIT)")

    print(f"\n{'='*50}")
    print(f"Results:")
    print(f"  Total checked: {len(patterns)}")
    print(f"  Portrait (need rotation): {len(portraits)}")
    print(f"  Errors: {len(errors)}")

    if args.dry_run:
        print(f"\n--dry-run specified, not rotating.")
        if portraits:
            print(f"\nPortrait pattern IDs:")
            for p in portraits[:50]:  # Show first 50
                print(f"  {p['id']}: {p['width']}x{p['height']}")
            if len(portraits) > 50:
                print(f"  ... and {len(portraits) - 50} more")
        return

    if not portraits:
        print("\nNo portraits found, nothing to rotate.")
        return

    print(f"\nRotating {len(portraits)} portraits...")
    rotated = 0
    failed = 0

    for i, p in enumerate(portraits):
        if i % 10 == 0:
            print(f"Rotating {i+1}/{len(portraits)}...")

        if rotate_and_upload(p['id'], p['url']):
            rotated += 1
        else:
            failed += 1

    print(f"\n{'='*50}")
    print(f"Rotation complete:")
    print(f"  Successfully rotated: {rotated}")
    print(f"  Failed: {failed}")
    print(f"\nNote: Embeddings have been cleared for rotated patterns.")
    print(f"Run generate_embeddings.py to regenerate them.")


if __name__ == '__main__':
    main()
