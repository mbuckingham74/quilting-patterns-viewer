#!/usr/bin/env python3
"""
AI-based mirror detection for quilting pattern thumbnails.

Uses Claude Vision to analyze each thumbnail and determine if it is horizontally
mirrored (text appears backwards, etc.). Stores results for review.

Usage:
    python detect_mirrored.py [--limit N] [--batch-size N] [--dry-run]

Options:
    --limit N       Process only first N patterns (for testing)
    --batch-size N  How many images to process in parallel (default: 10)
    --dry-run       Only analyze, don't store results
"""

import os
import sys
import json
import argparse
import asyncio
import aiohttp
import base64
from datetime import datetime

# Load environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    sys.exit(1)

if not ANTHROPIC_API_KEY:
    print("Error: ANTHROPIC_API_KEY must be set")
    sys.exit(1)

HEADERS = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

CLAUDE_HEADERS = {
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
}

# The prompt for Claude to analyze mirroring
MIRROR_PROMPT = """Analyze this quilting pattern thumbnail image. These are black line art designs on white backgrounds used for quilting.

Determine if the pattern appears to be HORIZONTALLY MIRRORED (flipped left-to-right).

Signs of horizontal mirroring:
- TEXT that appears BACKWARDS or REVERSED (like "ARMY" appearing as "YMRA")
- Letters that are mirror images of themselves
- Recognizable objects or symbols that appear flipped (like a flag with stars on wrong side)
- Numbers appearing backwards

Important:
- Most quilting patterns are abstract/geometric and cannot be determined to be mirrored - mark these as "normal"
- Only mark as "mirrored" if there is CLEAR evidence like backwards text or recognizable reversed imagery
- If unsure, mark as "normal"

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "is_mirrored": true | false,
  "confidence": "high" | "medium" | "low",
  "reason": "brief explanation of what appears mirrored, or why it looks normal"
}"""


async def fetch_patterns_to_analyze(session, limit=None):
    """Fetch patterns that haven't been analyzed for mirroring yet."""
    # First check if the mirror_analysis table exists
    url = f"{SUPABASE_URL}/rest/v1/mirror_analysis?select=pattern_id&limit=1"
    async with session.get(url, headers=HEADERS) as response:
        if response.status == 404 or 'does not exist' in await response.text():
            # Table doesn't exist, fetch all patterns
            analyzed_ids = set()
        else:
            # Get already analyzed pattern IDs
            url = f"{SUPABASE_URL}/rest/v1/mirror_analysis?select=pattern_id"
            async with session.get(url, headers=HEADERS) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    analyzed_ids = {r['pattern_id'] for r in data}
                else:
                    analyzed_ids = set()

    # Fetch patterns with thumbnails
    patterns = []
    page_size = 1000
    offset = 0

    while True:
        url = f"{SUPABASE_URL}/rest/v1/patterns?select=id,thumbnail_url,file_name&thumbnail_url=not.is.null&order=id&offset={offset}&limit={page_size}"
        async with session.get(url, headers=HEADERS) as response:
            response.raise_for_status()
            batch = await response.json()

            if not batch:
                break

            # Filter out already analyzed
            for p in batch:
                if p['id'] not in analyzed_ids:
                    patterns.append(p)

            offset += len(batch)

            if limit and len(patterns) >= limit:
                patterns = patterns[:limit]
                break

            if len(batch) < page_size:
                break

    return patterns


async def download_image(session, url, max_retries=3):
    """Download image and return base64 encoded data with retry logic."""
    for attempt in range(max_retries):
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                response.raise_for_status()
                data = await response.read()
                return base64.b64encode(data).decode('utf-8')
        except asyncio.TimeoutError:
            print(f"  Timeout downloading image (attempt {attempt + 1})")
        except Exception as e:
            print(f"  Error downloading image (attempt {attempt + 1}): {e}")

        if attempt < max_retries - 1:
            await asyncio.sleep(2 ** attempt)  # Exponential backoff

    return None


async def analyze_image(session, image_base64, max_retries=3):
    """Send image to Claude for mirror analysis with retry logic."""
    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 200,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_base64
                        }
                    },
                    {
                        "type": "text",
                        "text": MIRROR_PROMPT
                    }
                ]
            }
        ]
    }

    for attempt in range(max_retries):
        try:
            async with session.post(
                "https://api.anthropic.com/v1/messages",
                headers=CLAUDE_HEADERS,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=60)
            ) as response:
                if response.status == 429:
                    # Rate limited - wait and retry
                    print(f"  Rate limited, waiting 30s (attempt {attempt + 1})")
                    await asyncio.sleep(30)
                    continue

                if response.status != 200:
                    error_text = await response.text()
                    print(f"  Claude API error: {response.status} - {error_text} (attempt {attempt + 1})")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2 ** attempt)
                    continue

                result = await response.json()
                text = result['content'][0]['text']

                # Parse JSON response
                try:
                    # Handle potential markdown code blocks
                    if text.startswith('```'):
                        text = text.split('```')[1]
                        if text.startswith('json'):
                            text = text[4:]
                    return json.loads(text.strip())
                except json.JSONDecodeError:
                    print(f"  Failed to parse Claude response: {text}")
                    return None

        except asyncio.TimeoutError:
            print(f"  Claude API timeout (attempt {attempt + 1})")
        except Exception as e:
            print(f"  Claude API error: {e} (attempt {attempt + 1})")

        if attempt < max_retries - 1:
            await asyncio.sleep(2 ** attempt)

    return None


async def store_result(session, pattern_id, result, max_retries=3):
    """Store analysis result in the database using UPSERT to handle duplicates."""
    url = f"{SUPABASE_URL}/rest/v1/mirror_analysis"
    payload = {
        "pattern_id": pattern_id,
        "is_mirrored": result['is_mirrored'],
        "confidence": result['confidence'],
        "reason": result.get('reason', ''),
        "analyzed_at": datetime.utcnow().isoformat(),
        "reviewed": False
    }

    # Use UPSERT: on conflict with pattern_id, update the existing record
    upsert_headers = {
        **HEADERS,
        'Prefer': 'resolution=merge-duplicates,return=representation'
    }

    for attempt in range(max_retries):
        try:
            async with session.post(
                url,
                headers=upsert_headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status in (200, 201):
                    return True
                error = await response.text()
                print(f"  Failed to store result (attempt {attempt + 1}): {error}")
        except asyncio.TimeoutError:
            print(f"  Timeout storing result (attempt {attempt + 1})")
        except Exception as e:
            print(f"  Error storing result (attempt {attempt + 1}): {e}")

        if attempt < max_retries - 1:
            await asyncio.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s, 4s

    return False


async def process_batch(session, patterns, dry_run=False):
    """Process a batch of patterns."""
    results = []

    for pattern in patterns:
        pattern_id = pattern['id']
        thumbnail_url = pattern['thumbnail_url']
        file_name = pattern.get('file_name', '')

        # Download image
        image_data = await download_image(session, thumbnail_url)
        if not image_data:
            results.append((pattern_id, file_name, None, "download_failed"))
            continue

        # Analyze with Claude
        analysis = await analyze_image(session, image_data)
        if not analysis:
            results.append((pattern_id, file_name, None, "analysis_failed"))
            continue

        # Store result
        if not dry_run:
            await store_result(session, pattern_id, analysis)

        results.append((pattern_id, file_name, analysis, "success"))

        # Small delay to avoid rate limiting
        await asyncio.sleep(0.1)

    return results


async def main():
    parser = argparse.ArgumentParser(description='AI mirror detection for pattern thumbnails')
    parser.add_argument('--limit', type=int, help='Process only first N patterns')
    parser.add_argument('--batch-size', type=int, default=10, help='Batch size for processing')
    parser.add_argument('--dry-run', action='store_true', help='Only analyze, do not store results')
    args = parser.parse_args()

    print("Fetching patterns to analyze for mirroring...")

    async with aiohttp.ClientSession() as session:
        patterns = await fetch_patterns_to_analyze(session, args.limit)
        print(f"Found {len(patterns)} patterns to analyze")

        if not patterns:
            print("No patterns to analyze!")
            return

        # Process in batches
        total_normal = 0
        total_mirrored = 0
        total_failed = 0
        mirrored_list = []

        for i in range(0, len(patterns), args.batch_size):
            batch = patterns[i:i + args.batch_size]
            batch_num = i // args.batch_size + 1
            print(f"\nProcessing batch {batch_num} ({i + 1}-{min(i + len(batch), len(patterns))} of {len(patterns)})...")

            try:
                results = await process_batch(session, batch, args.dry_run)

                for pattern_id, file_name, analysis, status in results:
                    if status != "success" or not analysis:
                        total_failed += 1
                        print(f"  Pattern {pattern_id}: FAILED ({status})")
                    elif not analysis['is_mirrored']:
                        total_normal += 1
                        print(f"  Pattern {pattern_id}: normal ({analysis['confidence']})")
                    else:
                        total_mirrored += 1
                        mirrored_list.append({
                            'id': pattern_id,
                            'file_name': file_name,
                            'confidence': analysis['confidence'],
                            'reason': analysis.get('reason', '')
                        })
                        print(f"  Pattern {pattern_id}: MIRRORED ({analysis['confidence']}) - {file_name} - {analysis.get('reason', '')}")

            except Exception as e:
                print(f"  BATCH {batch_num} FAILED: {e}")
                print(f"  Waiting 10s before continuing...")
                await asyncio.sleep(10)
                # Mark all patterns in failed batch as failed
                for p in batch:
                    total_failed += 1
                    print(f"  Pattern {p['id']}: FAILED (batch_error)")

        # Summary
        print(f"\n{'='*50}")
        print(f"Analysis complete!")
        print(f"  Total analyzed: {len(patterns)}")
        print(f"  Normal (not mirrored): {total_normal}")
        print(f"  Mirrored: {total_mirrored}")
        print(f"  Failed: {total_failed}")

        if mirrored_list:
            print(f"\nMirrored patterns found:")
            for p in mirrored_list:
                print(f"  {p['id']}: {p['file_name']} ({p['confidence']}) - {p['reason']}")

        if args.dry_run:
            print("\n--dry-run specified, results were not stored.")


if __name__ == '__main__':
    asyncio.run(main())
