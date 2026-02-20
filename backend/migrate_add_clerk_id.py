"""
数据库迁移脚本: 添加 clerk_user_id 字段

运行方式: python migrate_add_clerk_id.py
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
            WHERE table_name = 'users' AND column_name = 'clerk_user_id'
        """))

        if result.fetchone():
            print("clerk_user_id 列已存在，跳过迁移")
            return

        # 添加 clerk_user_id 列
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN clerk_user_id VARCHAR(255) UNIQUE
        """))

        # 创建索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_users_clerk_user_id
            ON users (clerk_user_id)
        """))

        conn.commit()
        print("成功添加 clerk_user_id 列")


if __name__ == "__main__":
    migrate()
