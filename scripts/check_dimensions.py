#!/usr/bin/env python3
"""Quick check of thumbnail dimensions distribution."""

import os
import requests
from io import BytesIO
from PIL import Image
from collections import Counter

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

HEADERS = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
}

# Fetch 50 random patterns
url = f"{SUPABASE_URL}/rest/v1/patterns?select=id,thumbnail_url&thumbnail_url=not.is.null&limit=50"
response = requests.get(url, headers=HEADERS)
patterns = response.json()

dimensions = []
for p in patterns:
    try:
        resp = requests.get(p['thumbnail_url'], timeout=10)
        img = Image.open(BytesIO(resp.content))
        w, h = img.size
        dimensions.append((w, h))
        orientation = "PORTRAIT" if h > w else ("SQUARE" if h == w else "LANDSCAPE")
        print(f"Pattern {p['id']}: {w}x{h} ({orientation})")
    except Exception as e:
        print(f"Pattern {p['id']}: Error - {e}")

print("\nDimension distribution:")
for dim, count in Counter(dimensions).most_common():
    print(f"  {dim[0]}x{dim[1]}: {count}")
