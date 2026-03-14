"""
Generate placeholder data for Elder Care and Rehab & Fitness tabs.
Produces src/data/elder_care.json and src/data/rehab_fitness.json.

Usage:
    python scripts/generate_tab_data.py
"""

import json
import math
import random
from pathlib import Path
from datetime import datetime, timedelta

random.seed(99)

JOINT_NAMES = [
    "pelvis", "left_hip", "right_hip", "spine1",
    "left_knee", "right_knee", "spine2",
    "left_ankle", "right_ankle", "spine3",
    "left_foot", "right_foot", "neck",
    "left_collar", "right_collar", "head",
    "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow",
    "left_wrist", "right_wrist"
]

BONES = [
    [0, 1], [0, 2], [0, 3],
    [1, 4], [2, 5],
    [3, 6],
    [4, 7], [5, 8],
    [6, 9],
    [7, 10], [8, 11],
    [9, 12], [9, 13], [9, 14],
    [12, 15],
    [13, 16], [14, 17],
    [16, 18], [17, 19],
    [18, 20], [19, 21],
]

BASE_POSE = [
    [400, 340], [370, 350], [430, 350], [400, 300],
    [370, 430], [430, 430], [400, 260], [370, 510],
    [430, 510], [400, 220], [365, 530], [435, 530],
    [400, 180], [380, 195], [420, 195], [400, 150],
    [340, 200], [460, 200], [310, 270], [490, 270],
    [280, 340], [520, 340],
]

POSE_VARIATIONS = {
    "standing": {},
    "reaching_forward": {
        18: [-40, -20], 20: [-100, -40],
        19: [40, -20], 21: [100, -40],
    },
    "bending_over": {
        9: [0, 30], 12: [0, 60], 15: [0, 70],
        13: [-10, 50], 14: [10, 50],
        16: [-30, 60], 17: [30, 60],
        18: [-20, 100], 19: [20, 100],
        20: [-10, 130], 21: [10, 130],
    },
    "sitting": {
        0: [0, 40], 1: [-15, 45], 2: [15, 45],
        4: [-40, 20], 5: [40, 20],
        7: [-40, 30], 8: [40, 30],
        10: [-40, 30], 11: [40, 30],
    },
    "arms_raised": {
        16: [-50, -10], 18: [-70, -80], 20: [-60, -160],
        17: [50, -10], 19: [70, -80], 21: [60, -160],
    },
    "leaning": {
        9: [30, 10], 12: [40, 15], 15: [45, 10],
        13: [20, 15], 14: [40, 15],
    },
    "crouching": {
        0: [0, 60], 1: [-15, 65], 2: [15, 65],
        3: [0, 30], 6: [0, 10],
        4: [-30, 50], 5: [30, 50],
        7: [-35, 60], 8: [35, 60],
        10: [-35, 60], 11: [35, 60],
    },
    "one_arm_up": {
        16: [-50, -10], 18: [-70, -80], 20: [-60, -160],
    },
    "walking": {
        1: [-10, 0], 4: [-15, -20], 7: [-20, -10], 10: [-20, -10],
        2: [10, 0], 5: [15, 20], 8: [20, 10], 11: [20, 10],
    },
    "stretching": {
        16: [-80, 0], 17: [80, 0],
        18: [-140, 10], 19: [140, 10],
        20: [-190, 20], 21: [190, 20],
    },
}


def generate_pose_frames(variation_name, num_frames=30):
    frames_2d = []
    for f in range(num_frames):
        t = f / max(num_frames - 1, 1)
        pose = [list(p) for p in BASE_POSE]
        deltas = POSE_VARIATIONS.get(variation_name, {})
        for joint_idx, (dx, dy) in deltas.items():
            pose[joint_idx][0] += dx * t
            pose[joint_idx][1] += dy * t
        breath = math.sin(f * 0.3) * 2
        for i in [9, 12, 13, 14, 15]:
            pose[i][1] += breath
        for p in pose:
            p[0] += random.uniform(-2, 2)
            p[1] += random.uniform(-2, 2)
        frames_2d.append([[round(p[0], 1), round(p[1], 1)] for p in pose])
    return frames_2d


def generate_frames(variation_name, timestamp, num_frames=30):
    base_ns = int(timestamp.timestamp() * 1e9)
    fps = 30
    pose_frames = generate_pose_frames(variation_name, num_frames)
    frames = []
    for f in range(num_frames):
        contacts = [round(random.uniform(-0.001, 0.01), 4) for _ in range(21)]
        for foot_idx in [7, 8, 10, 11]:
            contacts[foot_idx] = round(random.uniform(0.5, 1.0), 4)
        frames.append({
            "frame_num": f,
            "timestamp_ns": base_ns + int(f * (1e9 / fps)),
            "joints_2d": pose_frames[f],
            "contacts": contacts,
        })
    return frames


def generate_dataset(persons, templates, start_date, end_date):
    total_span = (end_date - start_date).total_seconds()
    warnings = []
    n = len(templates)

    for i, tpl in enumerate(templates):
        base_offset = (i / n) * total_span
        jittered_offset = base_offset + random.uniform(-total_span * 0.01, total_span * 0.01)
        jittered_offset = max(0, min(total_span, jittered_offset))
        ts = start_date + timedelta(seconds=jittered_offset)
        ts = ts.replace(hour=random.randint(7, 17), minute=random.randint(0, 59))

        warnings.append({
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "severity": tpl["severity"],
            "text": tpl["text"],
            "person": random.choice(persons),
            "frames": generate_frames(tpl["pose"], ts),
        })

    warnings.sort(key=lambda w: w["timestamp"])
    return {
        "meta": {
            "source": "egoallo",
            "guidance_mode": "aria_hamer",
            "joint_names": JOINT_NAMES,
            "bones": BONES,
        },
        "warnings": warnings,
    }


# ── Elder Care ──────────────────────────────────────────────

ELDER_PERSONS = ["Margaret", "Harold", "Betty", "Frank", "Dorothy"]

ELDER_TEMPLATES = [
    {"severity": "critical", "text": "Fall risk detected: Margaret showing unsteady gait pattern with lateral sway exceeding safe threshold.", "pose": "leaning"},
    {"severity": "critical", "text": "Fall detected in hallway. Harold found on ground, unable to self-recover. Emergency response initiated.", "pose": "crouching"},
    {"severity": "critical", "text": "Betty attempted to stand from wheelchair without assistance. High fall risk — staff alerted.", "pose": "sitting"},
    {"severity": "high", "text": "Prolonged inactivity: Frank has not moved from bed for over 4 hours. Wellness check recommended.", "pose": "sitting"},
    {"severity": "high", "text": "Social isolation alert: Dorothy has not interacted with other residents for 48 hours.", "pose": "sitting"},
    {"severity": "high", "text": "Wandering detected: Harold found near emergency exit at 2:30 AM. Night staff notified.", "pose": "walking"},
    {"severity": "high", "text": "Unusual night activity: Margaret has been pacing the corridor for 45 minutes after midnight.", "pose": "walking"},
    {"severity": "high", "text": "Missed medication window: Betty did not pick up 10 AM prescriptions. Nurse follow-up needed.", "pose": "sitting"},
    {"severity": "medium", "text": "Missed meal: Frank did not attend lunch service. Tray delivery scheduled.", "pose": "sitting"},
    {"severity": "medium", "text": "Missed meal: Dorothy skipped breakfast for the second consecutive day.", "pose": "sitting"},
    {"severity": "medium", "text": "Reduced mobility: Harold's walking speed has decreased 30% over the past week.", "pose": "walking"},
    {"severity": "medium", "text": "Bathroom visit frequency increased: Margaret visited 8 times today, above normal baseline.", "pose": "walking"},
    {"severity": "medium", "text": "Prolonged inactivity: Betty remained seated in common area for 3 hours without movement.", "pose": "sitting"},
    {"severity": "low", "text": "Positive interaction: Margaret and Dorothy engaged in 40-minute conversation in the garden.", "pose": "standing"},
    {"severity": "low", "text": "Group activity: Harold, Betty, and Frank participated in afternoon card game for 1 hour.", "pose": "sitting"},
    {"severity": "low", "text": "Assisted walking: Dorothy completed two laps of the corridor with physical therapist support.", "pose": "walking"},
    {"severity": "low", "text": "Social engagement: Margaret joined the morning exercise class with 5 other residents.", "pose": "arms_raised"},
    {"severity": "low", "text": "Positive interaction: Harold and Frank had a 25-minute conversation over coffee in the lounge.", "pose": "sitting"},
    {"severity": "medium", "text": "Sleep disruption: Betty woke 4 times during the night. Sleep quality declining over past 3 days.", "pose": "sitting"},
    {"severity": "high", "text": "Fall risk: Dorothy using furniture for balance support instead of walker. Equipment compliance issue.", "pose": "leaning"},
    {"severity": "low", "text": "Family visit: Margaret received visitors for 2 hours. Mood and engagement noticeably improved.", "pose": "sitting"},
    {"severity": "medium", "text": "Weight change alert: Frank's weekly weigh-in shows 2kg loss over 2 weeks. Dietary review needed.", "pose": "standing"},
    {"severity": "critical", "text": "Choking risk detected: Harold eating alone and coughing repeatedly during dinner. Staff alerted.", "pose": "sitting"},
    {"severity": "low", "text": "Positive interaction: All five residents gathered for movie night. High engagement observed.", "pose": "sitting"},
    {"severity": "high", "text": "Agitation detected: Betty exhibiting restless behavior and repeated attempts to leave the facility.", "pose": "walking"},
]

# ── Rehab & Fitness ─────────────────────────────────────────

REHAB_PERSONS = ["Patient Rivera", "Patient Chen", "Patient Okafor", "Patient Novak"]

REHAB_TEMPLATES = [
    {"severity": "critical", "text": "Overexertion detected: Patient Rivera's heart rate spiked to 185 BPM during treadmill session. Session halted.", "pose": "walking"},
    {"severity": "critical", "text": "Overexertion alert: Patient Chen collapsed during resistance training. Vitals unstable — medical team called.", "pose": "crouching"},
    {"severity": "critical", "text": "Severe pain response: Patient Okafor reported sharp pain during shoulder rehab. Possible re-injury.", "pose": "one_arm_up"},
    {"severity": "high", "text": "Incorrect exercise form: Patient Novak performing deadlift with rounded lumbar spine. Injury risk elevated.", "pose": "bending_over"},
    {"severity": "high", "text": "Incorrect form: Patient Rivera hyperextending knees during leg press. Corrective cue delivered.", "pose": "sitting"},
    {"severity": "high", "text": "Range-of-motion regression: Patient Chen's shoulder flexion decreased 15 degrees from last session.", "pose": "one_arm_up"},
    {"severity": "high", "text": "Incorrect form: Patient Okafor compensating with lower back during bicep curls. Technique correction needed.", "pose": "reaching_forward"},
    {"severity": "medium", "text": "Skipped session: Patient Novak did not attend scheduled 9 AM physical therapy appointment.", "pose": "standing"},
    {"severity": "medium", "text": "Skipped session: Patient Rivera missed second consecutive aquatic therapy session.", "pose": "standing"},
    {"severity": "medium", "text": "Fatigue detected: Patient Chen showing declining rep quality in final set. Session intensity may need adjustment.", "pose": "leaning"},
    {"severity": "medium", "text": "Fatigue detected: Patient Okafor's grip strength dropped 40% midway through occupational therapy tasks.", "pose": "reaching_forward"},
    {"severity": "medium", "text": "Range-of-motion plateau: Patient Novak's knee flexion unchanged for 3 consecutive sessions.", "pose": "sitting"},
    {"severity": "medium", "text": "Therapy compliance: Patient Rivera completed only 2 of 4 prescribed home exercise sets this week.", "pose": "standing"},
    {"severity": "low", "text": "Milestone reached: Patient Chen successfully completed 10-minute unassisted walk for the first time.", "pose": "walking"},
    {"severity": "low", "text": "Improved ROM: Patient Okafor's hip flexion increased by 12 degrees since therapy start.", "pose": "stretching"},
    {"severity": "low", "text": "Consistent attendance: Patient Novak has attended all 12 scheduled sessions this month.", "pose": "standing"},
    {"severity": "low", "text": "Progress note: Patient Rivera's balance test score improved from 6/10 to 8/10.", "pose": "standing"},
    {"severity": "low", "text": "Milestone reached: Patient Chen completed full squat to parallel for first time post-surgery.", "pose": "crouching"},
    {"severity": "low", "text": "Improved ROM: Patient Okafor achieved full overhead reach with operated shoulder. Recovery on track.", "pose": "arms_raised"},
    {"severity": "high", "text": "Swelling observed: Patient Novak's operated knee showing increased inflammation post-session.", "pose": "sitting"},
    {"severity": "medium", "text": "Asymmetry detected: Patient Rivera favoring right leg during gait analysis. Compensation pattern developing.", "pose": "walking"},
    {"severity": "low", "text": "Progress note: Patient Chen reported pain level decreased from 7/10 to 3/10 over past two weeks.", "pose": "standing"},
    {"severity": "high", "text": "Incorrect form: Patient Okafor performing plank with excessive hip sag. Core engagement insufficient.", "pose": "bending_over"},
    {"severity": "critical", "text": "Overexertion: Patient Novak ignored rest interval guidelines and showing signs of rhabdomyolysis risk.", "pose": "stretching"},
    {"severity": "low", "text": "Consistent attendance: All four patients completed this week's full therapy schedule.", "pose": "standing"},
]


def main():
    out_dir = Path(__file__).parent.parent / "src" / "data"

    # Elder Care
    elder_data = generate_dataset(
        ELDER_PERSONS, ELDER_TEMPLATES,
        datetime(2026, 1, 5, 8, 0, 0), datetime(2026, 3, 31, 17, 0, 0),
    )
    elder_path = out_dir / "elder_care.json"
    with open(elder_path, "w") as f:
        json.dump(elder_data, f, indent=2)
    print(f"Generated {len(elder_data['warnings'])} elder care warnings -> {elder_path}")

    # Rehab & Fitness
    rehab_data = generate_dataset(
        REHAB_PERSONS, REHAB_TEMPLATES,
        datetime(2026, 1, 5, 8, 0, 0), datetime(2026, 3, 31, 17, 0, 0),
    )
    rehab_path = out_dir / "rehab_fitness.json"
    with open(rehab_path, "w") as f:
        json.dump(rehab_data, f, indent=2)
    print(f"Generated {len(rehab_data['warnings'])} rehab & fitness warnings -> {rehab_path}")


if __name__ == "__main__":
    main()
