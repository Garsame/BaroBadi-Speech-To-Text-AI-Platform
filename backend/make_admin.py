import sqlite3
import sys

def promote(email):
    conn = sqlite3.connect('sql_app.db')
    c = conn.cursor()
    c.execute("UPDATE users SET role = 'admin' WHERE email = ?", (email,))
    
    if c.rowcount == 0:
        print(f"Error: No user found with email {email}")
    else:
        print(f"Success! {email} is now a superadmin.")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python make_admin.py <email>")
        print("Example: python make_admin.py myemail@domain.com")
    else:
        promote(sys.argv[1])
