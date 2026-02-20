"""检查数据库中的用户和项目记录"""
import sys
sys.path.insert(0, '.')

from database import SessionLocal
from models.user import User
from models.project import Project

db = SessionLocal()

print("=" * 60)
print("所有用户记录:")
print("=" * 60)
users = db.query(User).all()
for u in users:
    print(f"ID: {u.id}")
    print(f"  clerk_user_id: {u.clerk_user_id}")
    print(f"  email: {u.email}")
    print(f"  nickname: {u.nickname}")
    print(f"  created_at: {u.created_at}")
    print("-" * 40)

print("\n" + "=" * 60)
print("所有项目记录:")
print("=" * 60)
projects = db.query(Project).all()
for p in projects:
    print(f"ID: {p.id}")
    print(f"  title: {p.title}")
    print(f"  user_id: {p.user_id}")
    print(f"  created_at: {p.created_at}")
    print("-" * 40)

print("\n" + "=" * 60)
print("用户-项目关联统计:")
print("=" * 60)
for u in users:
    project_count = db.query(Project).filter(Project.user_id == u.id).count()
    print(f"用户 {u.id} ({u.email or u.clerk_user_id}): {project_count} 个项目")

db.close()
