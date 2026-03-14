"""
Generate realistic placeholder data for the Safety Monitor Dashboard.
Produces src/data/placeholder.json matching the EgoAllo-converted format.

Usage:
    python scripts/generate_placeholder.py
"""

import json
import math
import random
from pathlib import Path
from datetime import datetime, timedelta

random.seed(42)

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

# Base standing pose (2D, canvas coords for 800x600)
BASE_POSE = [
    [400, 340],  # 0  pelvis
    [370, 350],  # 1  left_hip
    [430, 350],  # 2  right_hip
    [400, 300],  # 3  spine1
    [370, 430],  # 4  left_knee
    [430, 430],  # 5  right_knee
    [400, 260],  # 6  spine2
    [370, 510],  # 7  left_ankle
    [430, 510],  # 8  right_ankle
    [400, 220],  # 9  spine3
    [365, 530],  # 10 left_foot
    [435, 530],  # 11 right_foot
    [400, 180],  # 12 neck
    [380, 195],  # 13 left_collar
    [420, 195],  # 14 right_collar
    [400, 150],  # 15 head
    [340, 200],  # 16 left_shoulder
    [460, 200],  # 17 right_shoulder
    [310, 270],  # 18 left_elbow
    [490, 270],  # 19 right_elbow
    [280, 340],  # 20 left_wrist
    [520, 340],  # 21 right_wrist
]

POSE_VARIATIONS = {
    "reaching_high_left": {
        18: [-60, -120], 20: [-80, -200],  # left arm reaching up
    },
    "reaching_forward": {
        18: [-40, -20], 20: [-100, -40],  # left arm forward
        19: [40, -20], 21: [100, -40],    # right arm forward
    },
    "bending_over": {
        9: [0, 30], 12: [0, 60], 15: [0, 70],  # torso bent
        13: [-10, 50], 14: [10, 50],
        16: [-30, 60], 17: [30, 60],
        18: [-20, 100], 19: [20, 100],
        20: [-10, 130], 21: [10, 130],
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
    "leaning_right": {
        9: [30, 10], 12: [40, 15], 15: [45, 10],
        13: [20, 15], 14: [40, 15],
        16: [10, 15], 17: [60, 15],
    },
    "arms_wide": {
        16: [-80, 0], 17: [80, 0],
        18: [-140, 10], 19: [140, 10],
        20: [-190, 20], 21: [190, 20],
    },
    "climbing": {
        16: [-50, -20], 18: [-70, -100], 20: [-60, -170],
        4: [-20, -10], 7: [-25, 0],
    },
}

WARNINGS_TEMPLATES = [
    {"severity": "high",     "text": "Person reaching dangerously close to rotating blade guard. Left hand within 15cm of hazard zone.", "pose": "reaching_forward"},
    {"severity": "low",      "text": "Hard hat slightly tilted, not fully secured. Minor PPE adjustment needed.", "pose": "reaching_high_left"},
    {"severity": "medium",   "text": "Person not wearing required safety goggles while operating grinding station.", "pose": "reaching_forward"},
    {"severity": "critical", "text": "Person leaning into conveyor belt zone. Immediate entanglement risk detected.", "pose": "leaning_right"},
    {"severity": "medium",   "text": "Two workers in close proximity near press brake. Insufficient clearance for safe operation.", "pose": "reaching_forward"},
    {"severity": "high",     "text": "Person climbing on racking system without fall protection harness.", "pose": "climbing"},
    {"severity": "low",      "text": "Person standing slightly outside designated walkway. Minor positional deviation.", "pose": "reaching_forward"},
    {"severity": "high",     "text": "Welding operation detected without proper face shield. Arc flash exposure risk.", "pose": "reaching_forward"},
    {"severity": "critical", "text": "Person entered lockout/tagout zone while machine is energized. Immediate danger.", "pose": "reaching_forward"},
    {"severity": "medium",   "text": "Forklift approaching pedestrian zone at excessive speed. Near-miss incident.", "pose": "reaching_forward"},
    {"severity": "low",      "text": "Safety signage partially obscured by stacked materials. Visibility reduced.", "pose": "reaching_forward"},
    {"severity": "high",     "text": "Person lifting heavy object with improper posture. High risk of back injury.", "pose": "bending_over"},
    {"severity": "medium",   "text": "Chemical spill detected near workstation. Person not wearing chemical-resistant gloves.", "pose": "reaching_forward"},
    {"severity": "critical", "text": "Person caught between moving platform and fixed structure. Crush hazard imminent.", "pose": "leaning_right"},
    {"severity": "low",      "text": "Ambient noise level exceeding 80dB. Hearing protection advisory.", "pose": "reaching_forward"},
    {"severity": "high",     "text": "Overhead crane load swinging near personnel. Exclusion zone not maintained.", "pose": "crouching"},
    {"severity": "medium",   "text": "Person operating forklift without seatbelt fastened. Moderate safety violation.", "pose": "reaching_forward"},
    {"severity": "low",      "text": "Emergency exit path partially blocked by pallets. Clearance below minimum width.", "pose": "reaching_forward"},
    {"severity": "high",     "text": "Electrical panel accessed without insulated gloves. Electrocution risk.", "pose": "one_arm_up"},
    {"severity": "critical", "text": "Gas leak detected in welding bay. Person still present without respiratory protection.", "pose": "reaching_forward"},
    {"severity": "medium",   "text": "Scaffolding guardrail missing on second tier. Fall hazard for workers above.", "pose": "climbing"},
    {"severity": "high",     "text": "Person using damaged power tool with exposed wiring. Shock and fire risk.", "pose": "reaching_forward"},
    {"severity": "low",      "text": "Safety shower not tested this week. Compliance check overdue.", "pose": "reaching_forward"},
    {"severity": "critical", "text": "Confined space entry without atmospheric monitoring. Oxygen deficiency risk.", "pose": "crouching"},
    {"severity": "medium",   "text": "Hot work permit expired 2 hours ago. Welding operation still in progress.", "pose": "reaching_forward"},
    {"severity": "high",     "text": "Person bypassed machine guard to clear jam. Hands inside pinch point zone.", "pose": "reaching_forward"},
    {"severity": "medium",   "text": "Ladder placed on uneven surface at incorrect angle. Tip-over risk during use.", "pose": "climbing"},
    {"severity": "high",     "text": "Compressed air being used to clean clothing. Injection injury hazard.", "pose": "arms_wide"},
    {"severity": "critical", "text": "Structural crack detected on lifting beam during operation. Catastrophic failure risk.", "pose": "one_arm_up"},
    {"severity": "low",      "text": "First aid kit supplies below minimum count. Restocking required.", "pose": "reaching_forward"},
    {"severity": "medium",   "text": "Dust extraction system running below rated capacity. Airborne particulate levels elevated.", "pose": "reaching_forward"},
    {"severity": "high",     "text": "Person standing in forklift travel lane while distracted. Unaware of approaching vehicle.", "pose": "reaching_forward"},
    {"severity": "critical", "text": "Fire detected near flammable storage cabinet. Suppression system not yet activated.", "pose": "arms_wide"},
    {"severity": "low",      "text": "Toolbox left open on floor creating trip hazard. Housekeeping reminder issued.", "pose": "bending_over"},
]

PERSONS = ["Person A", "Person B", "Person C", "Person D"]


def apply_variation(base, variation_name, jitter=True):
    """Apply a named pose variation to the base pose with optional jitter."""
    pose = [list(p) for p in base]
    deltas = POSE_VARIATIONS.get(variation_name, {})
    for joint_idx, (dx, dy) in deltas.items():
        pose[joint_idx][0] += dx
        pose[joint_idx][1] += dy
    if jitter:
        for p in pose:
            p[0] += random.uniform(-5, 5)
            p[1] += random.uniform(-5, 5)
    return [[round(p[0], 1), round(p[1], 1)] for p in pose]


def generate_pose_frames(variation_name, num_frames=30):
    """Generate a short clip of pose frames with subtle motion."""
    frames_2d = []
    for f in range(num_frames):
        t = f / max(num_frames - 1, 1)
        # Interpolate from base to variation and add breathing-like motion
        pose = [list(p) for p in BASE_POSE]
        deltas = POSE_VARIATIONS.get(variation_name, {})
        for joint_idx, (dx, dy) in deltas.items():
            pose[joint_idx][0] += dx * t
            pose[joint_idx][1] += dy * t
        # Add subtle breathing / sway
        breath = math.sin(f * 0.3) * 2
        for i in [9, 12, 13, 14, 15]:
            pose[i][1] += breath
        # Jitter
        for p in pose:
            p[0] += random.uniform(-2, 2)
            p[1] += random.uniform(-2, 2)
        frames_2d.append([[round(p[0], 1), round(p[1], 1)] for p in pose])
    return frames_2d


def generate():
    start_date = datetime(2026, 1, 5, 8, 0, 0)
    end_date = datetime(2026, 3, 31, 17, 0, 0)
    total_span = (end_date - start_date).total_seconds()

    warnings = []
    n = len(WARNINGS_TEMPLATES)

    for i, tpl in enumerate(WARNINGS_TEMPLATES):
        # Spread evenly with some randomness
        base_offset = (i / n) * total_span
        jittered_offset = base_offset + random.uniform(-total_span * 0.01, total_span * 0.01)
        jittered_offset = max(0, min(total_span, jittered_offset))
        ts = start_date + timedelta(seconds=jittered_offset)
        # Snap to work hours (7am-6pm)
        ts = ts.replace(hour=random.randint(7, 17), minute=random.randint(0, 59))

        base_ns = int(ts.timestamp() * 1e9)
        fps = 30
        num_frames = 30
        pose_frames = generate_pose_frames(tpl["pose"], num_frames)
        contacts = []
        for f in range(num_frames):
            c = [round(random.uniform(-0.001, 0.01), 4) for _ in range(21)]
            # Ground contact joints (feet, ankles) get higher values
            for foot_idx in [7, 8, 10, 11]:
                c[foot_idx] = round(random.uniform(0.5, 1.0), 4)
            contacts.append(c)

        frames = []
        for f in range(num_frames):
            frames.append({
                "frame_num": f,
                "timestamp_ns": base_ns + int(f * (1e9 / fps)),
                "joints_2d": pose_frames[f],
                "contacts": contacts[f],
            })

        warnings.append({
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "severity": tpl["severity"],
            "text": tpl["text"],
            "person": random.choice(PERSONS),
            "frames": frames,
        })

    warnings.sort(key=lambda w: w["timestamp"])

    result = {
        "meta": {
            "source": "egoallo",
            "guidance_mode": "aria_hamer",
            "joint_names": JOINT_NAMES,
            "bones": BONES,
        },
        "warnings": warnings,
    }

    out_path = Path(__file__).parent.parent / "src" / "data" / "placeholder.json"
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"Generated {len(warnings)} warnings with pose data -> {out_path}")
    stats = {}
    for w in warnings:
        stats[w["severity"]] = stats.get(w["severity"], 0) + 1
    print(f"  Severities: {stats}")
    print(f"  Persons: {sorted(set(w['person'] for w in warnings))}")
    print(f"  Date range: {warnings[0]['timestamp']} -> {warnings[-1]['timestamp']}")


if __name__ == "__main__":
    generate()
