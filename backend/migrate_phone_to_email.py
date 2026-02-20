"""
数据库迁移脚本：将手机号登录改为邮箱登录

执行方式：
    cd backend
    python migrate_phone_to_email.py

注意：
    - 执行前请备份数据库
    - 此脚本会修改 users 表结构
    - 此脚本会重命名 sms_verification_codes 表
"""

import sys
from sqlalchemy import create_engine, text
from config import settings


def migrate():
    """执行迁移"""
    engine = create_engine(settings.database_url)

    with engine.connect() as conn:
        # 开始事务
        trans = conn.begin()

        try:
            print("开始数据库迁移...")

            # 1. 检查 users 表是否存在 phone 列
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'phone'
            """))
            has_phone = result.fetchone() is not None

            if has_phone:
                print("1. 修改 users 表...")

                # 添加 email 列
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)
                """))
                print("   - 添加 email 列")

                # 将 phone 数据复制到 email（作为临时邮箱）
                conn.execute(text("""
                    UPDATE users SET email = phone || '@temp.local' WHERE email IS NULL
                """))
                print("   - 迁移 phone 数据到 email")

                # 设置 email 为非空
                conn.execute(text("""
                    ALTER TABLE users ALTER COLUMN email SET NOT NULL
                """))
                print("   - 设置 email 为非空")

                # 删除 phone 列的唯一约束和索引
                conn.execute(text("""
                    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key
                """))
                conn.execute(text("""
                    DROP INDEX IF EXISTS ix_users_phone
                """))
                print("   - 删除 phone 约束和索引")

                # 删除 phone 列
                conn.execute(text("""
                    ALTER TABLE users DROP COLUMN IF EXISTS phone
                """))
                print("   - 删除 phone 列")

                # 为 email 添加唯一约束和索引
                conn.execute(text("""
                    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email)
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)
                """))
                print("   - 添加 email 唯一约束和索引")
            else:
                print("1. users 表已经是 email 结构，跳过")

            # 2. 处理验证码表
            result = conn.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_name = 'sms_verification_codes'
            """))
            has_sms_table = result.fetchone() is not None

            if has_sms_table:
                print("2. 迁移验证码表...")

                # 创建新表
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS email_verification_codes (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        email VARCHAR(255) NOT NULL,
                        code VARCHAR(6) NOT NULL,
                        purpose VARCHAR(20) DEFAULT 'login',
                        is_used BOOLEAN DEFAULT FALSE,
                        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        ip_address VARCHAR(50)
                    )
                """))
                print("   - 创建 email_verification_codes 表")

                # 复制数据（将 phone 转为临时 email）
                conn.execute(text("""
                    INSERT INTO email_verification_codes (id, email, code, purpose, is_used, expires_at, created_at, ip_address)
                    SELECT id, phone || '@temp.local', code, purpose, is_used, expires_at, created_at, ip_address
                    FROM sms_verification_codes
                    ON CONFLICT (id) DO NOTHING
                """))
                print("   - 迁移验证码数据")

                # 创建索引
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_email_verification_codes_email
                    ON email_verification_codes (email)
                """))
                print("   - 创建索引")

                # 删除旧表
                conn.execute(text("""
                    DROP TABLE IF EXISTS sms_verification_codes
                """))
                print("   - 删除旧表 sms_verification_codes")
            else:
                # 检查新表是否存在
                result = conn.execute(text("""
                    SELECT table_name FROM information_schema.tables
                    WHERE table_name = 'email_verification_codes'
                """))
                has_email_table = result.fetchone() is not None

                if not has_email_table:
                    print("2. 创建 email_verification_codes 表...")
                    conn.execute(text("""
                        CREATE TABLE email_verification_codes (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            email VARCHAR(255) NOT NULL,
                            code VARCHAR(6) NOT NULL,
                            purpose VARCHAR(20) DEFAULT 'login',
                            is_used BOOLEAN DEFAULT FALSE,
                            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                            ip_address VARCHAR(50)
                        )
                    """))
                    conn.execute(text("""
                        CREATE INDEX ix_email_verification_codes_email
                        ON email_verification_codes (email)
                    """))
                    print("   - 表创建完成")
                else:
                    print("2. email_verification_codes 表已存在，跳过")

            # 提交事务
            trans.commit()
            print("\n迁移完成！")
            print("\n注意：现有用户的邮箱被设置为 '原手机号@temp.local'")
            print("用户需要重新使用真实邮箱登录。")

        except Exception as e:
            trans.rollback()
            print(f"\n迁移失败: {e}")
            sys.exit(1)


if __name__ == "__main__":
    migrate()
