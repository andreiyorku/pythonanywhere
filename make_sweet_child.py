import xml.etree.ElementTree as ET
from xml.dom import minidom


def generate_cyclic_gym():
    # ==========================================
    # 1. HELPER: THE CYCLIC LOGIC
    # ==========================================
    def make_cyclic(riff_pattern):
        """Takes a riff and generates 6 variations, shifting down strings each time."""
        cyclic_sequence = []
        # Shift 0 to 5 (covering all string starting points)
        for shift in range(6):
            for (string, fret, finger) in riff_pattern:
                # Add shift, wrap around 6 strings (0-5)
                new_string = (string + shift) % 6
                cyclic_sequence.append((new_string, fret, finger))
        return cyclic_sequence

    # ==========================================
    # 2. DEFINE THE RIFFS
    # ==========================================

    # --- A. SPIDER (Sweet Child) ---
    # Box Shape: Index(12), Ring(14), Pinky(15)
    riff_spider = [
        (3, 12, 1), (1, 15, 4), (2, 14, 3), (2, 12, 1),
        (0, 15, 4), (2, 14, 3), (0, 14, 3), (2, 14, 3)
    ]

    # --- B. STRETCH (Message in a Bottle Style) ---
    # Shape: Root(Index) -> 5th(Middle/Ring) -> 9th(Pinky)
    # We use a generic "Add9" shape relative to the string
    # Base Shape: A-4, D-6, G-8
    riff_stretch = [
        (4, 4, 1), (3, 6, 2), (2, 8, 4), (3, 6, 2),  # Up/Down
        (4, 4, 1), (3, 6, 2), (2, 8, 4), (3, 6, 2)  # Repeat
    ]

    # --- C. ENDURANCE (Snow Style) ---
    # Fast triad picking.
    # Base Shape: D-14, G-14, B-13
    riff_endurance = [
        (3, 14, 3), (2, 14, 3), (1, 13, 1), (2, 14, 3)
    ]

    # --- D. NAVIGATION (Non-Repeating Scale Run) ---
    # This does NOT get the cyclic treatment. It stays linear.
    riff_navigation = [
        # Position 1
        (5, 2, 1), (5, 3, 2), (5, 5, 4),
        # Shift Pos 2
        (4, 4, 1), (4, 5, 2), (4, 7, 4),
        # Shift Pos 3
        (3, 7, 1), (3, 9, 3), (3, 10, 4),
        # Shift High
        (2, 9, 1), (2, 11, 3), (1, 12, 4)
    ]
    # Go up and come back down
    riff_navigation_full = riff_navigation + riff_navigation[::-1]

    # ==========================================
    # 3. BUILD THE MASTER SEQUENCE
    # ==========================================
    full_sequence = []

    # SECTION 1: CYCLIC SPIDER (Warmup)
    # We run the full 6-string cycle 2 times
    full_sequence.extend(make_cyclic(riff_spider) * 2)

    # SECTION 2: LINEAR NAVIGATION (Bridge 1)
    # Insert the scale run to break up the monotony
    full_sequence.extend(riff_navigation_full * 2)

    # SECTION 3: CYCLIC STRETCH (The Workout)
    # Run the full 6-string cycle 2 times
    full_sequence.extend(make_cyclic(riff_stretch) * 2)

    # SECTION 4: LINEAR NAVIGATION (Bridge 2)
    full_sequence.extend(riff_navigation_full * 2)

    # SECTION 5: CYCLIC ENDURANCE (Burnout)
    # Run the full 6-string cycle 4 times (It's fast!)
    full_sequence.extend(make_cyclic(riff_endurance) * 4)

    # ==========================================
    # 4. GENERATE XML
    # ==========================================
    song = ET.Element("song", version="14")
    ET.SubElement(song, "title").text = "Ultimate Cyclic Gym"
    ET.SubElement(song, "artistName").text = "Python Coach"
    ET.SubElement(song, "tuning", string0="0", string1="0", string2="0", string3="0", string4="0", string5="0")

    total_notes = len(full_sequence)

    ebeats = ET.SubElement(song, "ebeats", count=str(total_notes))
    curr_time = 0.0
    beat_dur = 0.5

    for i in range(total_notes):
        # Mark measure every 8 notes
        measure = 1 if i % 8 == 0 else -1
        ET.SubElement(ebeats, "ebeat", time=f"{curr_time:.3f}", measure=f"{measure}")
        curr_time += beat_dur

    levels = ET.SubElement(song, "levels", count="1")
    level = ET.SubElement(levels, "level", difficulty="0")
    notes = ET.SubElement(level, "notes", count=str(total_notes))

    note_time = 2.0
    note_step = 0.25

    for (string, fret, finger) in full_sequence:
        ET.SubElement(notes, "note",
                      time=f"{note_time:.3f}",
                      string=str(string),
                      fret=str(fret),
                      finger=str(finger),
                      sustain="0.100")
        note_time += note_step

    # Output
    xml_str = minidom.parseString(ET.tostring(song)).toprettyxml(indent="  ")
    filename = "ultimate_cyclic_gym.xml"
    with open(filename, "w") as f:
        f.write(xml_str)

    print(f"Gym Session Created: '{filename}'")
    print(f"Total Notes: {total_notes}")
    print("Sequence: Cyclic Spider -> Scale Run -> Cyclic Stretch -> Scale Run -> Cyclic Endurance")


if __name__ == "__main__":
    generate_cyclic_gym()