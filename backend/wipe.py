import sqlite3
import os

db_path = 'sql_app.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('PRAGMA foreign_keys=OFF;')
    tables = c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    for t in tables:
        try:
            c.execute(f"DELETE FROM {t[0]}")
        except Exception as e:
            print(f"Error wiping {t[0]}: {e}")
    conn.commit()
    conn.close()
    print('All user and lecture data wiped perfectly.')
    
    # Also wipe celery databases if they exist
    for cdb in ['celery_backend.sqlite', 'celery_broker.sqlite']:
        if os.path.exists(cdb):
            try:
                os.remove(cdb)
                print(f"Removed old celery database: {cdb}")
            except:
                pass
else:
    print('Database not found.')
