#!/usr/bin/env python3
"""
Migration script: SQLite → Supabase
Migrates patterns, keywords, and uploads files to Supabase Storage.

Usage:
    cd scripts
    pip install supabase python-dotenv
    python migrate.py
"""

import os
import sys
import sqlite3
import zlib
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, 'reconfigure') else None

# Determine script directory (works whether run as script or imported)
if '__file__' in dir():
    SCRIPT_DIR = Path(__file__).parent.resolve()
else:
    SCRIPT_DIR = Path.cwd()

# Load environment variables from project root
PROJECT_ROOT = SCRIPT_DIR.parent
load_dotenv(PROJECT_ROOT / '.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Paths
FILES_DIR = PROJECT_ROOT / 'files'
SQLITE_DB = FILES_DIR / 'patterns.db.20251212'
THUMBNAILS_DIR = FILES_DIR / 'PVM_Thumbnails'

# Batch sizes
BATCH_SIZE = 100  # Records per batch insert
UPLOAD_BATCH_SIZE = 50  # Files per upload batch


def connect_sqlite() -> sqlite3.Connection:
    """Connect to SQLite database."""
    conn = sqlite3.connect(SQLITE_DB)
    conn.row_factory = sqlite3.Row
    return conn


def connect_supabase() -> Client:
    """Connect to Supabase."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def migrate_keywords(sqlite_conn: sqlite3.Connection, supabase: Client):
    """Migrate keywords table."""
    print("\n📚 Migrating keywords...")
    cursor = sqlite_conn.execute("SELECT ID, Value FROM Keyword ORDER BY ID")
    keywords = [{'id': row['ID'], 'value': row['Value']} for row in cursor]

    # Insert in batches
    for i in range(0, len(keywords), BATCH_SIZE):
        batch = keywords[i:i + BATCH_SIZE]
        supabase.table('keywords').upsert(batch).execute()
        print(f"  Inserted keywords {i+1}-{min(i+BATCH_SIZE, len(keywords))} of {len(keywords)}")

    print(f"  ✅ Migrated {len(keywords)} keywords")


def migrate_keyword_groups(sqlite_conn: sqlite3.Connection, supabase: Client):
    """Migrate keyword groups and their mappings."""
    print("\n📁 Migrating keyword groups...")

    # Keyword groups
    cursor = sqlite_conn.execute("SELECT ID, Name FROM KeywordGroup ORDER BY ID")
    groups = [{'id': row['ID'], 'name': row['Name']} for row in cursor]

    if groups:
        supabase.table('keyword_groups').upsert(groups).execute()
        print(f"  ✅ Migrated {len(groups)} keyword groups")

    # Keyword group mappings
    cursor = sqlite_conn.execute("SELECT KeywordGroupID, KeywordID FROM KeywordGroupKeyword")
    mappings = [{'keyword_group_id': row['KeywordGroupID'], 'keyword_id': row['KeywordID']} for row in cursor]

    if mappings:
        for i in range(0, len(mappings), BATCH_SIZE):
            batch = mappings[i:i + BATCH_SIZE]
            supabase.table('keyword_group_keywords').upsert(batch).execute()
        print(f"  ✅ Migrated {len(mappings)} keyword group mappings")


def upload_thumbnails(supabase: Client):
    """Upload thumbnail images to Supabase Storage."""
    print("\n🖼️  Uploading thumbnails...")

    if not THUMBNAILS_DIR.exists():
        print(f"  ⚠️  Thumbnails directory not found: {THUMBNAILS_DIR}")
        return {}

    thumbnail_files = list(THUMBNAILS_DIR.glob('*.png'))
    total = len(thumbnail_files)
    uploaded = 0
    errors = 0
    thumbnail_urls = {}

    for i, thumb_path in enumerate(thumbnail_files):
        pattern_id = thumb_path.stem  # filename without extension
        storage_path = f"{pattern_id}.png"

        try:
            with open(thumb_path, 'rb') as f:
                file_data = f.read()

            # Upload to storage
            supabase.storage.from_('thumbnails').upload(
                storage_path,
                file_data,
                file_options={"content-type": "image/png", "upsert": "true"}
            )

            # Get public URL
            thumbnail_urls[int(pattern_id)] = supabase.storage.from_('thumbnails').get_public_url(storage_path)
            uploaded += 1

        except Exception as e:
            if 'Duplicate' in str(e) or 'already exists' in str(e).lower():
                # Already uploaded, get the URL
                thumbnail_urls[int(pattern_id)] = supabase.storage.from_('thumbnails').get_public_url(storage_path)
                uploaded += 1
            else:
                errors += 1
                if errors <= 5:
                    print(f"  ⚠️  Error uploading {thumb_path.name}: {e}")

        if (i + 1) % 500 == 0 or (i + 1) == total:
            print(f"  Uploaded {uploaded}/{total} thumbnails ({errors} errors)")

    print(f"  ✅ Uploaded {uploaded} thumbnails")
    return thumbnail_urls


def decompress_pattern_file(data: bytes, compression_method: int) -> bytes:
    """Decompress pattern file data."""
    if compression_method == 0 or data is None:
        return data

    try:
        # Raw deflate (no header) - use -15 for windowBits
        return zlib.decompress(data, -15)
    except zlib.error:
        try:
            # Try with zlib header
            return zlib.decompress(data)
        except zlib.error:
            # Return as-is if decompression fails
            return data


def upload_pattern_files(sqlite_conn: sqlite3.Connection, supabase: Client):
    """Extract and upload pattern files to Supabase Storage."""
    print("\n📦 Uploading pattern files...")

    cursor = sqlite_conn.execute("""
        SELECT ID, FileName, FileExtension, CompressionMethod, FileData
        FROM Pattern
        WHERE FileData IS NOT NULL
        ORDER BY ID
    """)

    uploaded = 0
    errors = 0
    pattern_urls = {}

    rows = cursor.fetchall()
    total = len(rows)

    for i, row in enumerate(rows):
        pattern_id = row['ID']
        extension = (row['FileExtension'] or 'bin').lower().lstrip('.')
        compression = row['CompressionMethod'] or 0
        file_data = row['FileData']

        if not file_data:
            continue

        storage_path = f"{pattern_id}.{extension}"

        try:
            # Decompress if needed
            decompressed_data = decompress_pattern_file(file_data, compression)

            # Determine content type
            content_types = {
                'qli': 'application/octet-stream',
                'csq': 'application/octet-stream',
                'dxf': 'application/dxf',
                'pat': 'application/octet-stream',
            }
            content_type = content_types.get(extension, 'application/octet-stream')

            # Upload to storage
            supabase.storage.from_('patterns').upload(
                storage_path,
                decompressed_data,
                file_options={"content-type": content_type, "upsert": "true"}
            )

            pattern_urls[pattern_id] = storage_path
            uploaded += 1

        except Exception as e:
            if 'Duplicate' in str(e) or 'already exists' in str(e).lower():
                pattern_urls[pattern_id] = storage_path
                uploaded += 1
            else:
                errors += 1
                if errors <= 5:
                    print(f"  ⚠️  Error uploading pattern {pattern_id}: {e}")

        if (i + 1) % 500 == 0 or (i + 1) == total:
            print(f"  Uploaded {uploaded}/{total} pattern files ({errors} errors)")

    print(f"  ✅ Uploaded {uploaded} pattern files")
    return pattern_urls


def migrate_patterns(sqlite_conn: sqlite3.Connection, supabase: Client,
                     thumbnail_urls: dict, pattern_urls: dict):
    """Migrate patterns table."""
    print("\n🧵 Migrating patterns...")

    cursor = sqlite_conn.execute("""
        SELECT ID, FileName, FileExtension, FileLength, Author, AuthorUrl, AuthorNotes, Notes
        FROM Pattern
        ORDER BY ID
    """)

    patterns = []
    for row in cursor:
        pattern_id = row['ID']
        extension = (row['FileExtension'] or '').lower().lstrip('.')

        patterns.append({
            'id': pattern_id,
            'file_name': row['FileName'],
            'file_extension': extension,
            'file_size': row['FileLength'],
            'author': row['Author'],
            'author_url': row['AuthorUrl'],
            'author_notes': row['AuthorNotes'],
            'notes': row['Notes'],
            'thumbnail_url': thumbnail_urls.get(pattern_id),
            'pattern_file_url': pattern_urls.get(pattern_id),
        })

    # Insert in batches
    for i in range(0, len(patterns), BATCH_SIZE):
        batch = patterns[i:i + BATCH_SIZE]
        supabase.table('patterns').upsert(batch).execute()
        print(f"  Inserted patterns {i+1}-{min(i+BATCH_SIZE, len(patterns))} of {len(patterns)}")

    print(f"  ✅ Migrated {len(patterns)} patterns")


def migrate_pattern_keywords(sqlite_conn: sqlite3.Connection, supabase: Client):
    """Migrate pattern-keyword relationships."""
    print("\n🏷️  Migrating pattern keywords...")

    cursor = sqlite_conn.execute("SELECT PatternID, KeywordID FROM KeywordPattern ORDER BY PatternID, KeywordID")
    mappings = [{'pattern_id': row['PatternID'], 'keyword_id': row['KeywordID']} for row in cursor]

    for i in range(0, len(mappings), BATCH_SIZE):
        batch = mappings[i:i + BATCH_SIZE]
        supabase.table('pattern_keywords').upsert(batch).execute()
        if (i + BATCH_SIZE) % 5000 == 0 or i + BATCH_SIZE >= len(mappings):
            print(f"  Inserted {min(i+BATCH_SIZE, len(mappings))}/{len(mappings)} pattern keywords")

    print(f"  ✅ Migrated {len(mappings)} pattern-keyword relationships")


def main():
    print("=" * 60)
    print("🧵 Quilting Pattern Migration: SQLite → Supabase")
    print("=" * 60)

    # Connect to databases
    print("\n🔌 Connecting to databases...")
    sqlite_conn = connect_sqlite()
    supabase = connect_supabase()
    print("  ✅ Connected!")

    # Run migrations
    migrate_keywords(sqlite_conn, supabase)
    migrate_keyword_groups(sqlite_conn, supabase)

    # Upload files first to get URLs
    thumbnail_urls = upload_thumbnails(supabase)
    pattern_urls = upload_pattern_files(sqlite_conn, supabase)

    # Migrate pattern data with URLs
    migrate_patterns(sqlite_conn, supabase, thumbnail_urls, pattern_urls)
    migrate_pattern_keywords(sqlite_conn, supabase)

    # Cleanup
    sqlite_conn.close()

    print("\n" + "=" * 60)
    print("✅ Migration complete!")
    print("=" * 60)


if __name__ == '__main__':
    main()
