"""
修复用户数据：将当前 Clerk 用户关联到有项目数据的旧用户

这个脚本会：
1. 找到当前登录的 Clerk 用户
2. 找到有项目数据的旧用户
3. 将 clerk_user_id 从新用户转移到旧用户
4. 删除没有数据的新用户
"""
import sys
sys.path.insert(0, '.')

from database import SessionLocal
from models.user import User
from models.project import Project

db = SessionLocal()

# 当前登录的 clerk_user_id
CURRENT_CLERK_USER_ID = "user_39rO0Yeqy1Chh568vXYACPxGdBY"

# 有项目数据的旧用户 ID
OLD_USER_ID = "0d3af06c-0179-4700-8e1c-edb6e7bc0801"

try:
    # 找到当前 Clerk 用户
    current_user = db.query(User).filter(User.clerk_user_id == CURRENT_CLERK_USER_ID).first()
    if not current_user:
        print(f"找不到 clerk_user_id={CURRENT_CLERK_USER_ID} 的用户")
        sys.exit(1)

    print(f"当前 Clerk 用户: {current_user.id}")
    print(f"  clerk_user_id: {current_user.clerk_user_id}")
    print(f"  email: {current_user.email}")

    # 找到旧用户
    old_user = db.query(User).filter(User.id == OLD_USER_ID).first()
    if not old_user:
        print(f"找不到旧用户 {OLD_USER_ID}")
        sys.exit(1)

    print(f"\n旧用户: {old_user.id}")
    print(f"  clerk_user_id: {old_user.clerk_user_id}")
    print(f"  email: {old_user.email}")

    # 统计项目数量
    current_projects = db.query(Project).filter(Project.user_id == current_user.id).count()
    old_projects = db.query(Project).filter(Project.user_id == old_user.id).count()
    print(f"\n当前用户项目数: {current_projects}")
    print(f"旧用户项目数: {old_projects}")

    if current_user.id == old_user.id:
        print("\n当前用户和旧用户是同一个，无需修复")
        sys.exit(0)

    # 确认操作
    print("\n将执行以下操作:")
    print(f"1. 将当前用户的 {current_projects} 个项目迁移到旧用户")
    print(f"2. 将 clerk_user_id 从当前用户转移到旧用户")
    print(f"3. 删除当前用户记录")

    confirm = input("\n确认执行? (yes/no): ")
    if confirm.lower() != 'yes':
        print("取消操作")
        sys.exit(0)

    # 1. 迁移项目
    db.query(Project).filter(Project.user_id == current_user.id).update(
        {Project.user_id: old_user.id}
    )
    print(f"已迁移 {current_projects} 个项目")

    # 2. 转移 clerk_user_id
    old_user.clerk_user_id = CURRENT_CLERK_USER_ID
    print(f"已将 clerk_user_id 转移到旧用户")

    # 3. 删除当前用户
    db.delete(current_user)
    print(f"已删除当前用户记录")

    db.commit()
    print("\n修复完成！")

    # 验证
    final_user = db.query(User).filter(User.clerk_user_id == CURRENT_CLERK_USER_ID).first()
    final_projects = db.query(Project).filter(Project.user_id == final_user.id).count()
    print(f"\n验证: 用户 {final_user.id} 现在有 {final_projects} 个项目")

except Exception as e:
    db.rollback()
    print(f"错误: {e}")
finally:
    db.close()
