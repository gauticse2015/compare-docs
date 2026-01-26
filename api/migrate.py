import json
import os
import datetime
from .database import SessionLocal, User, History, hash_password, create_tables

# File paths
USERS_FILE = "users.json"
HISTORIES_FILE = "histories.json"
CONTENTS_DIR = "contents"

def migrate():
    # Create tables if not exist
    create_tables()

    db = SessionLocal()
    try:
        # Load users
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'r') as f:
                users_data = json.load(f)
            for user_data in users_data:
                # Check if user exists
                existing = db.query(User).filter(User.email == user_data['email']).first()
                if not existing:
                    print(f"Password length: {len(user_data['password'])}")
                    hashed = hash_password(user_data['password'])
                    new_user = User(name=user_data['name'], email=user_data['email'], password_hash=hashed, created_at=datetime.datetime.utcnow())
                    db.add(new_user)
                    db.commit()
                    db.refresh(new_user)
                    print(f"Migrated user: {user_data['email']}")
                else:
                    print(f"User already exists: {user_data['email']}")

        # Load histories
        if os.path.exists(HISTORIES_FILE):
            with open(HISTORIES_FILE, 'r') as f:
                histories_data = json.load(f)
            for email, hist_list in histories_data.items():
                db_user = db.query(User).filter(User.email == email).first()
                if not db_user:
                    print(f"User not found for histories: {email}")
                    continue
                user_dir = os.path.join(CONTENTS_DIR, str(db_user.id))
                os.makedirs(user_dir, exist_ok=True)
                for hist in hist_list:
                    # Create history
                    new_hist = History(user_id=db_user.id, result=hist['result'])
                    db.add(new_hist)
                    db.commit()
                    db.refresh(new_hist)

                    # Save contents
                    left_path = os.path.join(user_dir, f"{new_hist.id}_left.txt")
                    right_path = os.path.join(user_dir, f"{new_hist.id}_right.txt")
                    with open(left_path, 'w', encoding='utf-8') as f:
                        f.write(hist['leftContent'])
                    with open(right_path, 'w', encoding='utf-8') as f:
                        f.write(hist['rightContent'])

                    # Update paths
                    new_hist.left_content_path = left_path
                    new_hist.right_content_path = right_path
                    db.commit()
                    print(f"Migrated history for {email}: {new_hist.id}")

        print("Migration completed.")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()