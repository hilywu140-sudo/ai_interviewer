"""
Migration script to update the assets table schema.
This script drops and recreates the assets table with the new columns.

WARNING: This will delete all existing asset data!
For production, use Alembic migrations instead.
"""

from sqlalchemy import create_engine, text
from config import settings
from models.asset import Asset
from database import Base

def migrate_assets_table():
    """Drop and recreate the assets table with new schema."""
    engine = create_engine(settings.database_url)

    print("Connecting to database...")
    with engine.connect() as conn:
        # Drop the existing assets table
        print("Dropping existing assets table...")
        conn.execute(text("DROP TABLE IF EXISTS assets CASCADE"))
        conn.commit()
        print("[OK] Assets table dropped")

    # Recreate the table with new schema
    print("Creating assets table with new schema...")
    Base.metadata.create_all(bind=engine, tables=[Asset.__table__])
    print("[OK] Assets table created with new columns: transcript, version, parent_asset_id")

    print("\nMigration completed successfully!")
    print("The assets table now has the following structure:")
    print("  - id (UUID)")
    print("  - project_id (UUID)")
    print("  - question (Text)")
    print("  - optimized_answer (Text)")
    print("  - transcript (Text) [NEW]")
    print("  - original_message_id (UUID)")
    print("  - audio_file_id (UUID, nullable)")
    print("  - tags (ARRAY)")
    print("  - star_structure (JSONB)")
    print("  - version (Integer, default=1) [NEW]")
    print("  - parent_asset_id (UUID, nullable) [NEW]")
    print("  - created_at (DateTime)")
    print("  - updated_at (DateTime)")

if __name__ == "__main__":
    import sys

    print("=" * 60)
    print("Asset Table Migration Script")
    print("=" * 60)
    print("\nWARNING: This will delete all existing asset data!")

    # Check for --force flag
    if "--force" not in sys.argv:
        print("\nTo run this migration, use: python migrate_assets.py --force")
        sys.exit(1)

    migrate_assets_table()
