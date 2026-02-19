import sqlite3
import os

# Set the path
DB_PATH = os.path.abspath('fretmap.db')

def analyze():
    if not os.path.exists(DB_PATH):
        print(f"Error: {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 1. Fetch all real transitions
    rows = c.execute("SELECT id, avg_time, total_attempts, mastery_status FROM transitions WHERE id != 'REPAIR-TEST'").fetchall()

    if not rows:
        print("\n[!] Database is empty. Play some notes first!")
        return

    # 2. Perform Calculations
    times = [r[1] for r in rows]
    min_time = min(times)
    max_time = max(times)
    avg_total = sum(times) / len(times)
    total_mastered = sum(1 for r in rows if r[3] == 1)

    # 3. Display Overview
    print("\n" + "="*55)
    print("      🎸 FRETBOARD ENGINE: GLOBAL PERFORMANCE 🎸")
    print("="*55)
    print(f"Total Unique Jumps: {len(rows):<10} | Mastered: {total_mastered}")
    print(f"Fastest Speed:      {min_time:>7.0f}ms   | Slowest:  {max_time:>7.0f}ms")
    print(f"Overall Average:    {avg_total:>7.0f}ms")
    print("-" * 55)

    # 4. Detailed List
    print(f"{'TRANSITION':<20} | {'AVG TIME':<10} | {'ATTEMPTS'}")
    print("-" * 55)

    for r in rows:
        # Decode the ID (e.g., 5-9_4-11 -> S1F9 to S2F11)
        try:
            p = r[0].replace('_', '-').split('-')
            # Assuming standard 6-string mapping (0=High E, 5=Low E)
            label = f"S{6-int(p[0])}F{p[1]:<2} -> S{6-int(p[2])}F{p[3]:<2}"
        except:
            label = r[0]

        status = "✅" if r[3] == 1 else "  "
        print(f"{label:<20} | {r[1]:>7.0f}ms {status} | {r[2]:>5}")

    print("="*55 + "\n")
    conn.close()

if __name__ == "__main__":
    analyze()