#!/usr/bin/env python3
"""
Upload patterns from vendor ZIP files to Supabase.

This script:
1. Extracts QLI files from vendor ZIP archives
2. Renders PDF files to PNG thumbnails
3. Uploads thumbnails and pattern files to Supabase Storage
4. Creates pattern records in the database
5. Optionally generates embeddings for semantic search

Usage:
    cd scripts
    pip install supabase python-dotenv pymupdf pillow
    python upload_patterns.py /path/to/vendor-patterns.zip

Requirements:
    - PyMuPDF (fitz) for PDF rendering
    - Pillow for image resizing
    - supabase-py for database/storage access
"""

import os
import sys
import re
import zipfile
import tempfile
from pathlib import Path
from io import BytesIO
from collections import defaultdict

# Third-party imports
try:
    import fitz  # PyMuPDF
    from PIL import Image
    from dotenv import load_dotenv
    from supabase import create_client, Client
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install supabase python-dotenv pymupdf pillow")
    sys.exit(1)

# Force unbuffered output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)

# Paths
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent

# Load environment variables
load_dotenv(PROJECT_ROOT / '.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Supported file extensions
PATTERN_EXTENSIONS = {'.qli'}  # Only QLI files for the longarm machine
PDF_EXTENSION = '.pdf'
THUMBNAIL_SIZE = (256, 256)


def connect_supabase() -> Client:
    """Connect to Supabase."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_next_pattern_id(supabase: Client) -> int:
    """Get the next available pattern ID."""
    result = supabase.table('patterns').select('id').order('id', desc=True).limit(1).execute()
    if result.data:
        return result.data[0]['id'] + 1
    return 1


def get_existing_pattern_names(supabase: Client) -> set:
    """
    Get all existing pattern filenames (normalized) from the database.
    Used to check for duplicates before uploading.
    """
    existing = set()
    offset = 0
    batch_size = 1000

    while True:
        result = supabase.table('patterns').select('file_name').range(offset, offset + batch_size - 1).execute()
        if not result.data:
            break

        for row in result.data:
            if row['file_name']:
                # Normalize: lowercase, remove extension
                name = Path(row['file_name']).stem.lower()
                existing.add(name)

        if len(result.data) < batch_size:
            break
        offset += batch_size

    return existing


def normalize_pattern_name(filename: str) -> str:
    """
    Normalize a filename to a pattern name.

    Examples:
        'baby-blue-eyes-block-1.QLI' -> 'baby-blue-eyes-block-1'
        'Baby Blue Eyes - QLI/baby-blue-eyes-block-1.QLI' -> 'baby-blue-eyes-block-1'
    """
    # Get just the filename without path
    name = Path(filename).stem
    # Lowercase for consistency
    return name.lower()


def extract_author_from_qli(qli_content: bytes) -> dict:
    """
    Extract author information from QLI file content.

    QLI files contain "NO INFO" lines with author details.
    """
    try:
        text = qli_content.decode('utf-8', errors='replace')
    except:
        return {}

    author_info = {
        'author': None,
        'author_url': None,
        'author_notes': None,
    }

    # Look for common patterns in NO INFO lines
    info_lines = []
    for line in text.split('\n'):
        line = line.strip()
        if line.startswith('NO INFO'):
            info_text = line[7:].strip()
            info_lines.append(info_text)

            # Check for URL
            if 'www.' in info_text.lower() or 'http' in info_text.lower():
                url = info_text.strip()
                if not url.startswith('http'):
                    url = 'https://' + url.lower().replace('www.', '').split()[0]
                    if 'www.' in info_text.lower():
                        url = 'https://www.' + info_text.lower().split('www.')[-1].split()[0]
                author_info['author_url'] = url

            # Check for author name patterns
            if 'designed' in info_text.lower() and 'by' in info_text.lower():
                match = re.search(r'by\s+(.+)', info_text, re.IGNORECASE)
                if match:
                    author_info['author'] = match.group(1).strip()
            elif 'copyrighted' in info_text.lower() and 'by' in info_text.lower():
                match = re.search(r'by\s+(.+)', info_text, re.IGNORECASE)
                if match and not author_info['author']:
                    author_info['author'] = match.group(1).strip()

    # Combine all info lines as notes
    if info_lines:
        author_info['author_notes'] = '\n'.join(info_lines)

    return author_info


def render_pdf_to_thumbnail(pdf_data: bytes) -> bytes:
    """
    Render the first page of a PDF to a PNG thumbnail.

    Returns PNG image data as bytes.
    """
    # Open PDF from bytes
    doc = fitz.open(stream=pdf_data, filetype="pdf")
    page = doc[0]

    # Render at higher resolution for quality
    zoom = 2.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)

    # Convert to PIL Image for resizing
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

    # Resize to thumbnail size, maintaining aspect ratio
    img.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

    # Create white background and paste image centered
    thumb = Image.new('RGB', THUMBNAIL_SIZE, (255, 255, 255))
    offset = ((THUMBNAIL_SIZE[0] - img.width) // 2, (THUMBNAIL_SIZE[1] - img.height) // 2)
    thumb.paste(img, offset)

    # Convert to PNG bytes
    buffer = BytesIO()
    thumb.save(buffer, format='PNG', optimize=True)
    doc.close()

    return buffer.getvalue()


def process_zip(zip_path: Path, supabase: Client) -> dict:
    """
    Process a vendor ZIP file and upload patterns to Supabase.

    Returns a summary dict with results.
    """
    print(f"\n📦 Processing: {zip_path.name}")
    print("=" * 60)

    # Track files by normalized pattern name
    patterns = defaultdict(lambda: {'qli': None, 'pdf': None, 'qli_path': None, 'pdf_path': None})

    with zipfile.ZipFile(zip_path, 'r') as zf:
        # First pass: catalog all files
        for name in zf.namelist():
            if name.endswith('/'):  # Skip directories
                continue

            path = Path(name)
            ext = path.suffix.lower()

            if ext in PATTERN_EXTENSIONS:
                pattern_name = normalize_pattern_name(name)
                patterns[pattern_name]['qli'] = name
                patterns[pattern_name]['qli_path'] = name
            elif ext == PDF_EXTENSION:
                pattern_name = normalize_pattern_name(name)
                patterns[pattern_name]['pdf'] = name
                patterns[pattern_name]['pdf_path'] = name

        print(f"  Found {len(patterns)} unique patterns in ZIP")

        # Filter to only patterns that have QLI files
        valid_patterns = {k: v for k, v in patterns.items() if v['qli']}
        print(f"  {len(valid_patterns)} patterns have QLI files")

        # Check for duplicates against existing database
        print("  Checking for duplicates...")
        existing_names = get_existing_pattern_names(supabase)
        print(f"  {len(existing_names)} patterns already in database")

        # Filter out duplicates
        new_patterns = {}
        duplicates = []
        for name, files in valid_patterns.items():
            if name in existing_names:
                duplicates.append(name)
            else:
                new_patterns[name] = files

        if duplicates:
            print(f"  ⚠️  Skipping {len(duplicates)} duplicate patterns:")
            for dup in duplicates[:5]:
                print(f"      - {dup}")
            if len(duplicates) > 5:
                print(f"      ... and {len(duplicates) - 5} more")

        if not new_patterns:
            print("  ℹ️  No new patterns to upload (all duplicates)")
            return {
                'uploaded': [],
                'skipped': [{'name': d, 'reason': 'Duplicate'} for d in duplicates],
                'errors': [],
            }

        print(f"  {len(new_patterns)} new patterns to upload")

        # Get next pattern ID
        next_id = get_next_pattern_id(supabase)
        print(f"  Starting pattern ID: {next_id}")

        # Process each pattern
        results = {
            'uploaded': [],
            'skipped': [{'name': d, 'reason': 'Duplicate'} for d in duplicates],
            'errors': [],
        }

        for i, (pattern_name, files) in enumerate(new_patterns.items()):
            pattern_id = next_id + i

            try:
                # Read QLI file
                qli_data = zf.read(files['qli'])
                qli_size = len(qli_data)

                # Extract author info from QLI
                author_info = extract_author_from_qli(qli_data)

                # Generate thumbnail from PDF if available
                thumbnail_url = None
                if files['pdf']:
                    try:
                        pdf_data = zf.read(files['pdf'])
                        thumbnail_data = render_pdf_to_thumbnail(pdf_data)

                        # Upload thumbnail
                        thumb_path = f"{pattern_id}.png"
                        supabase.storage.from_('thumbnails').upload(
                            thumb_path,
                            thumbnail_data,
                            file_options={"content-type": "image/png", "upsert": "true"}
                        )
                        thumbnail_url = supabase.storage.from_('thumbnails').get_public_url(thumb_path)

                    except Exception as e:
                        print(f"  ⚠️  Warning: Could not generate thumbnail for {pattern_name}: {e}")

                # Upload pattern file
                pattern_path = f"{pattern_id}.qli"
                supabase.storage.from_('patterns').upload(
                    pattern_path,
                    qli_data,
                    file_options={"content-type": "application/octet-stream", "upsert": "true"}
                )

                # Create display name from filename
                display_name = pattern_name.replace('-', ' ').replace('_', ' ').title()

                # Insert pattern record
                pattern_record = {
                    'id': pattern_id,
                    'file_name': f"{pattern_name}.qli",
                    'file_extension': 'qli',
                    'file_size': qli_size,
                    'author': author_info.get('author'),
                    'author_url': author_info.get('author_url'),
                    'author_notes': author_info.get('author_notes'),
                    'notes': display_name,
                    'thumbnail_url': thumbnail_url,
                    'pattern_file_url': pattern_path,
                }

                supabase.table('patterns').insert(pattern_record).execute()

                results['uploaded'].append({
                    'id': pattern_id,
                    'name': pattern_name,
                    'has_thumbnail': thumbnail_url is not None,
                })

                # Progress indicator
                if (i + 1) % 5 == 0 or (i + 1) == len(new_patterns):
                    print(f"  Processed {i + 1}/{len(new_patterns)} patterns...")

            except Exception as e:
                results['errors'].append({
                    'name': pattern_name,
                    'error': str(e),
                })
                print(f"  ❌ Error processing {pattern_name}: {e}")

    return results


def print_summary(results: dict):
    """Print upload summary."""
    print("\n" + "=" * 60)
    print("📊 Upload Summary")
    print("=" * 60)

    uploaded = results['uploaded']
    skipped = results['skipped']
    errors = results['errors']

    print(f"\n✅ Successfully uploaded: {len(uploaded)} patterns")

    if uploaded:
        with_thumbs = sum(1 for p in uploaded if p['has_thumbnail'])
        without_thumbs = len(uploaded) - with_thumbs
        print(f"   - With thumbnails: {with_thumbs}")
        print(f"   - Without thumbnails: {without_thumbs}")

        print(f"\n📋 Uploaded patterns:")
        for p in uploaded[:10]:  # Show first 10
            thumb_icon = "🖼️" if p['has_thumbnail'] else "⬜"
            print(f"   {thumb_icon} [{p['id']}] {p['name']}")
        if len(uploaded) > 10:
            print(f"   ... and {len(uploaded) - 10} more")

    if skipped:
        print(f"\n⏭️  Skipped: {len(skipped)} patterns (duplicates)")

    if errors:
        print(f"\n❌ Errors: {len(errors)}")
        for e in errors[:5]:
            print(f"   - {e['name']}: {e['error']}")
        if len(errors) > 5:
            print(f"   ... and {len(errors) - 5} more errors")

    print()


def main():
    if len(sys.argv) < 2:
        print("Usage: python upload_patterns.py <zip_file> [zip_file2] ...")
        print("\nExample:")
        print("  python upload_patterns.py ../upload_example/baby-blue-eyes-set.zip")
        sys.exit(1)

    print("=" * 60)
    print("🧵 Quilting Pattern Upload Tool")
    print("=" * 60)

    # Connect to Supabase
    print("\n🔌 Connecting to Supabase...")
    supabase = connect_supabase()
    print(f"  ✅ Connected to {SUPABASE_URL}")

    # Process each ZIP file
    all_results = {
        'uploaded': [],
        'skipped': [],
        'errors': [],
    }

    for zip_arg in sys.argv[1:]:
        zip_path = Path(zip_arg)

        if not zip_path.exists():
            print(f"\n❌ File not found: {zip_path}")
            continue

        if not zip_path.suffix.lower() == '.zip':
            print(f"\n❌ Not a ZIP file: {zip_path}")
            continue

        results = process_zip(zip_path, supabase)

        all_results['uploaded'].extend(results['uploaded'])
        all_results['skipped'].extend(results['skipped'])
        all_results['errors'].extend(results['errors'])

    print_summary(all_results)

    # Suggest running embeddings
    if all_results['uploaded']:
        print("💡 Next step: Generate embeddings for semantic search")
        print("   python generate_embeddings.py")

    print("✅ Done!")


if __name__ == '__main__':
    main()
