# --- CONFIGURATION ---
start_time = 12.1  # Start exactly at 12.1
end_time = 240.0  # End at 4 minutes
loop_length = 2.0  # EXACTLY 2.0 seconds (12.1 -> 14.1 -> 16.1)

# The Riff Notes
riff_notes = [
    {"rel": 0.000, "fret": 12, "string": 4},
    {"rel": 0.189, "fret": 13, "string": 4},
    {"rel": 0.377, "fret": 15, "string": 4},
    {"rel": 0.566, "fret": 12, "string": 5},
    {"rel": 0.754, "fret": 15, "string": 4},
    {"rel": 0.942, "fret": 13, "string": 4},
    {"rel": 1.131, "fret": 12, "string": 4},
    {"rel": 1.508, "fret": 12, "string": 4},
    {"rel": 1.697, "fret": 12, "string": 3},
    {"rel": 1.886, "fret": 14, "string": 2},
]

# --- HEADER ---
header = r"""<?xml version="1.0" encoding="UTF-8"?>
<song version="7">
    <title>Hey Ya!</title>
    <arrangement>Lead</arrangement>
    <part>1</part>
    <offset>-10.000</offset>
    <centOffset>0</centOffset>
    <songLength>240.000</songLength>
    <songNameSort>Hey ya</songNameSort>
    <startBeat>10</startBeat>
    <averageTempo>120</averageTempo>
    <tuning string0="0" string1="0" string2="0" string3="0" string4="0" string5="0"/>
    <capo>0</capo>
    <artistName>OutKast</artistName>
    <artistNameSort>Outkast</artistNameSort>
    <albumName>The Love Below</albumName>
    <albumNameSort>Love below</albumNameSort>
    <albumYear>2003</albumYear>
    <albumArt>urn:image:dds:album_outkheyy</albumArt>
    <crowdSpeed>1</crowdSpeed>
    <arrangementProperties represent="1" standardTuning="1" nonStandardChords="0" barreChords="0" powerChords="0" dropDPower="0" openChords="0" fingerPicking="0" pickDirection="0" doubleStops="0" palmMutes="0" harmonics="0" pinchHarmonics="0" hopo="1" tremolo="0" slides="1" unpitchedSlides="1" bends="1" tapping="0" vibrato="1" fretHandMutes="0" slapPop="0" twoFingerPicking="0" fifthsAndOctaves="0" syncopation="0" bassPick="0" sustain="1" bonusArr="0" Metronome="0" pathLead="1" pathRhythm="0" pathBass="0" routeMask="1"/>
    <lastConversionDateTime>09-9-16 11:06</lastConversionDateTime>

    <tonebase>outkheyy_drive</tonebase>
    <tonea>outkheyy_drive</tonea>
    <toneb>outkheyy_leadsynth</toneb>
    <tonec>outkheyy_synth</tonec>
    <tones count="5">
        <tone time="12.100" id="1" name="outkheyy_leadsynth"/>
        <tone time="60.000" id="0" name="outkheyy_drive"/>
        <tone time="120.000" id="1" name="outkheyy_leadsynth"/>
        <tone time="180.000" id="2" name="outkheyy_synth"/>
        <tone time="212.152" id="1" name="outkheyy_leadsynth"/>
    </tones>
"""

# --- GENERATE CONTENT ---
xml_ebeats = []
xml_notes = []
xml_sections = []

# 1. Generate Beats (Grid)
grid_time = 10.0
beat_interval = 1.0  # 1 beat per second
beat_counter = 0

while grid_time <= end_time:
    is_measure = 1 if (beat_counter % 4 == 0) else 0
    xml_ebeats.append(f'        <ebeat time="{grid_time:.3f}" measure="{is_measure}"/>')

    if beat_counter > 0 and beat_counter % 16 == 0:
        sec_num = int(beat_counter / 16)
        xml_sections.append(f'        <section name="riff" number="{sec_num}" startTime="{grid_time:.3f}"/>')

    grid_time += beat_interval
    beat_counter += 1

# 2. Generate Notes
note_cursor = start_time
total_notes = 0

while note_cursor < end_time:
    for n in riff_notes:
        abs_time = note_cursor + n['rel']
        if abs_time > end_time:
            break
        xml_notes.append(
            f'                <note time="{abs_time:.3f}" fret="{n["fret"]}" string="{n["string"]}" sustain="0.1"/>')
        total_notes += 1
    note_cursor += loop_length

notes_block = chr(10).join(xml_notes)

# --- ASSEMBLE XML ---
# We inject the notes in TWO places:
# 1. <transcriptionTrack> (The master record)
# 2. <level difficulty="4"> (The "Amazing" difficulty tab)

full_xml = f"""{header}
    <ebeats count="{len(xml_ebeats)}">
{chr(10).join(xml_ebeats)}
    </ebeats>
    <sections count="{len(xml_sections)}">
{chr(10).join(xml_sections)}
    </sections>
    <events count="0"/>

    <transcriptionTrack difficulty="-1">
        <notes count="{total_notes}">
{notes_block}
        </notes>
        <chords count="0"/>
        <anchors count="0"/>
        <handShapes count="0"/>
    </transcriptionTrack>

    <levels count="1">
        <level difficulty="4">
            <notes count="{total_notes}">
{notes_block}
            </notes>
            <chords count="0"/>
            <anchors count="0"/>
            <handShapes count="0"/>
        </level>
    </levels>
</song>
"""

filename = "HeyYa_Master_Loop.xml"
with open(filename, "w") as f:
    f.write(full_xml)

print(f"SUCCESS: Generated {filename}")
print(f"- Difficulty: Set to 4 (Amazing) and Master Track")