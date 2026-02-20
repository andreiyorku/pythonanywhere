import sqlite3
import os

DB_PATH = os.path.abspath('myapp_db.sqlite3')


def scan_database():
    if not os.path.exists(DB_PATH):
        print(f"❌ Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    print("\n" + "=" * 60)
    print(" 🎸 FRETMAP GLOBAL PERFORMANCE SCANNER 🎸")
    print("=" * 60)

    # 1. Fetch User Settings
    try:
        u = c.execute("SELECT zone_index, strictness, attack FROM user_progress WHERE id=1").fetchone()
        if u:
            print(f"[CURRENT SETTINGS] Zone: {u[0]} | Strictness: {u[1]} | Attack: {u[2]}")
        else:
            print("[CURRENT SETTINGS] No user settings found.")
    except Exception as e:
        print(f"Error reading user_progress: {e}")

    # 2. Fetch Active Play Data
    try:
        # We ONLY want rows the user has actually played
        c.execute('''SELECT id, avg_time, min_time, max_time, total_attempts, mastery_status 
                     FROM transitions 
                     WHERE total_attempts > 0 
                     ORDER BY avg_time DESC''')
        rows = c.fetchall()

        if not rows:
            print("\n[!] No notes played yet. Play a session in the app first!")
        else:
            total_played = len(rows)
            mastered = sum(1 for r in rows if r[5] == 1)
            all_mins = [r[2] for r in rows]
            all_avgs = [r[1] for r in rows]

            print(f"\n[OVERALL PROGRESS]")
            print(f"Total Unique Jumps Explored: {total_played}")
            print(f"Total Mastered:              {mastered} ({(mastered / total_played) * 100:.1f}%)")
            print(f"Absolute Fastest Speed:      {min(all_mins):.0f}ms")
            print(f"Average Execution Speed:     {sum(all_avgs) / total_played:.0f}ms")

            print("\n[YOUR 15 SLOWEST TRANSITIONS]")
            print(f"{'TRANSITION':<20} | {'AVG TIME':<8} | {'BEST':<8} | {'HITS':<4} | {'STATUS'}")
            print("-" * 60)

            for r in rows[:15]:
                # Format string indices (6 - index) to match physical guitar strings
                try:
                    p = r[0].replace('_', '-').split('-')
                    label = f"S{6 - int(p[0])}F{p[1]} -> S{6 - int(p[2])}F{p[3]}"
                except:
                    label = r[0]

                status = "✅ Mastered" if r[5] == 1 else "❌ Learning"
                print(f"{label:<20} | {r[1]:>6.0f}ms | {r[2]:>6.0f}ms | {r[4]:>4} | {status}")

    except Exception as e:
        print(f"Error reading transitions: {e}")

    print("=" * 60 + "\n")
    conn.close()


if __name__ == "__main__":
    scan_database()