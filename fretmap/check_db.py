import sqlite3, os

DB_PATH = os.path.abspath('fretmap.db')
try:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    print("\n=== USER SETTINGS & PROGRESS ===")
    try:
        user = c.execute("SELECT zone_index, strictness, attack FROM user_progress WHERE id=1").fetchone()
        if user:
            print(f"Zone: {user[0]} | Strictness: {user[1]} | Attack: {user[2]}")
        else:
            print("No user data yet.")
    except sqlite3.OperationalError:
        print("⚠️ user_progress table missing! (Refresh your live web page to generate it).")

    print("\n=== TRANSITIONS (Top 15 Slowest) ===")
    rows = c.execute(
        "SELECT id, avg_time, best_time, total_attempts, mastery_status FROM transitions ORDER BY avg_time DESC LIMIT 15").fetchall()
    for r in rows: print(
        f"{r[0]:<12} | Avg: {r[1]:<6.1f} | Best: {r[2]:<6.1f} | Count: {r[3]:<3} | Mastered: {'✅' if r[4] == 1 else '❌'}")
    if not rows: print("No transitions logged yet.")
    conn.close()
except Exception as e:
    print("Error:", e)