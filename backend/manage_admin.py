import sys
import os

# Add the parent directory to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User, RoleEnum
from app.core.security import get_password_hash

def print_help():
    print("Baro Platform Admin Management Tool")
    print("==============================")
    print("Usage:")
    print("  python manage_admin.py create <email> <password> [<full_name>]")
    print("  python manage_admin.py reset-password <email> <new_password>")
    print("  python manage_admin.py promote <email>")
    print("  python manage_admin.py demote <email>")
    print("  python manage_admin.py list")

def main():
    if len(sys.argv) < 2:
        print_help()
        return

    action = sys.argv[1].lower()
    db = SessionLocal()

    try:
        if action == "create":
            if len(sys.argv) < 4:
                print("Error: Missing email or password.")
                print("Usage: python manage_admin.py create <email> <password> [<full_name>]")
                return
            email = sys.argv[2].strip().lower()
            password = sys.argv[3]
            full_name = sys.argv[4] if len(sys.argv) > 4 else "System Administrator"

            if len(password) < 8:
                print("Error: Password must be at least 8 characters long.")
                return

            # Check if user already exists
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                print(f"User with email {email} already exists. Role: {existing_user.role}. Use 'promote' or 'reset-password' instead.")
                return

            new_admin = User(
                email=email,
                hashed_password=get_password_hash(password),
                full_name=full_name,
                role=RoleEnum.admin,
                is_active=True,
                is_email_verified=True,
                has_password=True
            )
            db.add(new_admin)
            db.commit()
            print(f"Success! Admin account created for {email}")

        elif action == "reset-password":
            if len(sys.argv) < 4:
                print("Error: Missing email or new password.")
                print("Usage: python manage_admin.py reset-password <email> <new_password>")
                return
            email = sys.argv[2].strip().lower()
            password = sys.argv[3]

            if len(password) < 8:
                print("Error: Password must be at least 8 characters long.")
                return

            user = db.query(User).filter(User.email == email).first()
            if not user:
                print(f"Error: No user found with email {email}")
                return

            user.hashed_password = get_password_hash(password)
            user.has_password = True
            user.login_attempts = 0
            user.lockout_until = None
            db.commit()
            print(f"Success! Password has been reset for {email} (Role: {user.role.value if hasattr(user.role, 'value') else str(user.role)})")

        elif action == "promote":
            if len(sys.argv) < 3:
                print("Error: Missing email.")
                print("Usage: python manage_admin.py promote <email>")
                return
            email = sys.argv[2].strip().lower()

            user = db.query(User).filter(User.email == email).first()
            if not user:
                print(f"Error: No user found with email {email}")
                return

            user.role = RoleEnum.admin
            db.commit()
            print(f"Success! User {email} has been promoted to Admin.")

        elif action == "demote":
            if len(sys.argv) < 3:
                print("Error: Missing email.")
                print("Usage: python manage_admin.py demote <email>")
                return
            email = sys.argv[2].strip().lower()

            user = db.query(User).filter(User.email == email).first()
            if not user:
                print(f"Error: No user found with email {email}")
                return

            user.role = RoleEnum.user
            db.commit()
            print(f"Success! User {email} has been demoted to standard user.")

        elif action == "list":
            admins = db.query(User).filter(User.role == RoleEnum.admin).all()
            print("Baro Platform Administrators:")
            print("-" * 50)
            if not admins:
                print("No administrators found.")
            for admin in admins:
                status = "Active" if admin.is_active else "Inactive"
                print(f"- {admin.full_name} ({admin.email}) | Status: {status}")

        else:
            print(f"Unknown action: {action}")
            print_help()

    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
