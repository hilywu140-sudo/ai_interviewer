"""
将旧用户的数据迁移到当前 Clerk 用户

使用方法:
python migrate_user_data.py <旧用户ID> <新用户ID>

例如:
python migrate_user_data.py 0d3af06c-0179-4700-8e1c-edb6e7bc0801 c6c2afde-19fa-49ae-9122-c74e787b7aa7
"""
import sys
sys.path.insert(0, '.')

from database import SessionLocal
from models.user import User
from models.project import Project
from models.session import Session

def migrate_user_data(old_user_id: str, new_user_id: str):
    db = SessionLocal()

    try:
        # 验证用户存在
        old_user = db.query(User).filter(User.id == old_user_id).first()
        new_user = db.query(User).filter(User.id == new_user_id).first()

        if not old_user:
            print(f"错误: 找不到旧用户 {old_user_id}")
            return
        if not new_user:
            print(f"错误: 找不到新用户 {new_user_id}")
            return

        print(f"旧用户: {old_user.id} (email: {old_user.email})")
        print(f"新用户: {new_user.id} (clerk_id: {new_user.clerk_user_id})")

        # 迁移项目
        projects = db.query(Project).filter(Project.user_id == old_user_id).all()
        print(f"\n找到 {len(projects)} 个项目需要迁移:")
        for p in projects:
            print(f"  - {p.id}: {p.title}")

        if not projects:
            print("没有项目需要迁移")
            return

        # 确认迁移
        confirm = input("\n确认迁移这些项目? (yes/no): ")
        if confirm.lower() != 'yes':
            print("取消迁移")
            return

        # 执行迁移
        for p in projects:
            p.user_id = new_user_id
            print(f"迁移项目: {p.title}")

        db.commit()
        print(f"\n成功迁移 {len(projects)} 个项目!")

        # 可选: 将旧用户的 email 更新到新用户
        if old_user.email and not new_user.email:
            update_email = input(f"\n是否将旧用户的 email ({old_user.email}) 更新到新用户? (yes/no): ")
            if update_email.lower() == 'yes':
                new_user.email = old_user.email
                db.commit()
                print(f"已更新新用户的 email 为: {old_user.email}")

    except Exception as e:
        db.rollback()
        print(f"迁移失败: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    old_user_id = sys.argv[1]
    new_user_id = sys.argv[2]
    migrate_user_data(old_user_id, new_user_id)
