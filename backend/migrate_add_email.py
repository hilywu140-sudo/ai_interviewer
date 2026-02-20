"""
数据库迁移脚本: 添加 email 字段（从 phone 迁移到 email）

运行方式: python migrate_add_email.py
"""

from sqlalchemy import create_engine, text
from config import settings


def migrate():
    engine = create_engine(settings.database_url)

    with engine.connect() as conn:
        # 检查 email 列是否已存在
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'email'
        """))

        if result.fetchone():
            print("email 列已存在，跳过")
        else:
            # 检查是否有 phone 列
            result = conn.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'phone'
            """))

            if result.fetchone():
                # 重命名 phone 为 email
                conn.execute(text("ALTER TABLE users RENAME COLUMN phone TO email"))
                print("已将 phone 列重命名为 email")
            else:
                # 添加 email 列
                conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE"))
                print("已添加 email 列")

        # 检查 clerk_user_id 列是否已存在
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'clerk_user_id'
        """))

        if result.fetchone():
            print("clerk_user_id 列已存在，跳过")
        else:
            conn.execute(text("ALTER TABLE users ADD COLUMN clerk_user_id VARCHAR(255) UNIQUE"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_clerk_user_id ON users (clerk_user_id)"))
            print("已添加 clerk_user_id 列")

        conn.commit()
        print("迁移完成！")


if __name__ == "__main__":
    migrate()
