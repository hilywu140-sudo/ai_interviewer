"""
数据库迁移脚本 - 添加用户认证相关表

使用方法:
    python migrate_add_auth.py

功能:
    1. 创建 users 表
    2. 创建 sms_verification_codes 表
    3. 为 projects 表添加 user_id 外键
"""

import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("错误: 请设置 DATABASE_URL 环境变量")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

def run_migration():
    with engine.connect() as conn:
        # 开启事务
        trans = conn.begin()
        
        try:
            # 1. 创建 users 表
            print("创建 users 表...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    phone VARCHAR(20) UNIQUE NOT NULL,
                    nickname VARCHAR(100),
                    avatar_url VARCHAR(500),
                    is_active BOOLEAN DEFAULT TRUE,
                    is_verified BOOLEAN DEFAULT FALSE,
                    last_login_at TIMESTAMP WITH TIME ZONE,
                    login_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            
            # 创建索引
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_phone ON users(phone)
            """))
            print("✓ users 表创建成功")
            
            # 2. 创建 sms_verification_codes 表
            print("创建 sms_verification_codes 表...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS sms_verification_codes (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    phone VARCHAR(20) NOT NULL,
                    code VARCHAR(6) NOT NULL,
                    purpose VARCHAR(20) DEFAULT 'login',
                    is_used BOOLEAN DEFAULT FALSE,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    ip_address VARCHAR(50)
                )
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_sms_verification_codes_phone 
                ON sms_verification_codes(phone)
            """))
            print("✓ sms_verification_codes 表创建成功")
            
            # 3. 检查 projects 表是否需要添加 user_id 列
            print("检查 projects 表...")
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'projects' AND column_name = 'user_id'
            """))
            
            if result.fetchone() is None:
                print("为 projects 表添加 user_id 列...")
                
                # 添加列（允许 NULL，后续可以手动关联）
                conn.execute(text("""
                    ALTER TABLE projects ADD COLUMN user_id UUID
                """))
                
                # 创建索引
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_projects_user_id ON projects(user_id)
                """))
                
                # 添加外键约束
                conn.execute(text("""
                    ALTER TABLE projects 
                    ADD CONSTRAINT fk_projects_user 
                    FOREIGN KEY (user_id) REFERENCES users(id)
                """))
                
                print("✓ projects 表更新成功")
            else:
                print("✓ projects 表已有 user_id 列，跳过")
            
            # 提交事务
            trans.commit()
            print("\n迁移完成!")
            
        except Exception as e:
            trans.rollback()
            print(f"\n错误: {e}")
            print("已回滚所有更改")
            sys.exit(1)

if __name__ == "__main__":
    print("=" * 50)
    print("用户认证数据库迁移")
    print("=" * 50)
    print(f"数据库: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
    print()
    
    confirm = input("确认执行迁移? (y/n): ")
    if confirm.lower() == 'y':
        run_migration()
    else:
        print("已取消")
