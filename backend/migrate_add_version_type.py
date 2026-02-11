"""
数据库迁移脚本：添加 version_type 列到 assets 表
运行方式: python migrate_add_version_type.py
"""
from sqlalchemy import create_engine, text
from config import settings

def migrate():
    engine = create_engine(settings.database_url)

    with engine.connect() as conn:
        # 检查列是否已存在
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'assets' AND column_name = 'version_type'
        """))

        if result.fetchone():
            print("列 version_type 已存在，无需迁移")
            return

        # 添加列
        print("正在添加 version_type 列...")
        conn.execute(text("""
            ALTER TABLE assets ADD COLUMN version_type VARCHAR(20) DEFAULT 'recording'
        """))

        # 更新现有数据
        print("正在更新现有数据...")
        conn.execute(text("""
            UPDATE assets SET version_type = 'recording' WHERE version_type IS NULL
        """))

        conn.commit()
        print("迁移完成！")

if __name__ == "__main__":
    migrate()
