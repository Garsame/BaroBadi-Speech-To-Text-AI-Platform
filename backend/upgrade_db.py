import sqlite3

def upgrade():
    conn = sqlite3.connect('sql_app.db')
    c = conn.cursor()
    try:
        c.execute("ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(500);")
        conn.commit()
        print("Schema successfully updated with profile_picture_url")
    except sqlite3.OperationalError as e:
        print("OperationalError:", e)
    finally:
        conn.close()

if __name__ == "__main__":
    upgrade()
