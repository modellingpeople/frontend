"""
Generate warning data for the Safety Monitor Dashboard.
Produces src/data/placeholder.json with warning metadata only (no 2D rigs).
3D visualization comes from scene3d.json via export_3d.py.

Usage:
    python scripts/generate_placeholder.py
"""

import json
import random
from pathlib import Path
from datetime import datetime, timedelta

random.seed(42)

WARNINGS_TEMPLATES = [
    {"severity": "high",     "text": "Person reaching dangerously close to rotating blade guard. Left hand within 15cm of hazard zone."},
    {"severity": "low",      "text": "Hard hat slightly tilted, not fully secured. Minor PPE adjustment needed."},
    {"severity": "medium",   "text": "Person not wearing required safety goggles while operating grinding station."},
    {"severity": "critical", "text": "Person leaning into conveyor belt zone. Immediate entanglement risk detected."},
    {"severity": "medium",   "text": "Two workers in close proximity near press brake. Insufficient clearance for safe operation."},
    {"severity": "high",     "text": "Person climbing on racking system without fall protection harness."},
    {"severity": "low",      "text": "Person standing slightly outside designated walkway. Minor positional deviation."},
    {"severity": "high",     "text": "Welding operation detected without proper face shield. Arc flash exposure risk."},
    {"severity": "critical", "text": "Person entered lockout/tagout zone while machine is energized. Immediate danger."},
    {"severity": "medium",   "text": "Forklift approaching pedestrian zone at excessive speed. Near-miss incident."},
    {"severity": "low",      "text": "Safety signage partially obscured by stacked materials. Visibility reduced."},
    {"severity": "high",     "text": "Person lifting heavy object with improper posture. High risk of back injury."},
    {"severity": "medium",   "text": "Chemical spill detected near workstation. Person not wearing chemical-resistant gloves."},
    {"severity": "critical", "text": "Person caught between moving platform and fixed structure. Crush hazard imminent."},
    {"severity": "low",      "text": "Ambient noise level exceeding 80dB. Hearing protection advisory."},
    {"severity": "high",     "text": "Overhead crane load swinging near personnel. Exclusion zone not maintained."},
    {"severity": "medium",   "text": "Person operating forklift without seatbelt fastened. Moderate safety violation."},
    {"severity": "low",      "text": "Emergency exit path partially blocked by pallets. Clearance below minimum width."},
    {"severity": "high",     "text": "Electrical panel accessed without insulated gloves. Electrocution risk."},
    {"severity": "critical", "text": "Gas leak detected in welding bay. Person still present without respiratory protection."},
    {"severity": "medium",   "text": "Scaffolding guardrail missing on second tier. Fall hazard for workers above."},
    {"severity": "high",     "text": "Person using damaged power tool with exposed wiring. Shock and fire risk."},
    {"severity": "low",      "text": "Safety shower not tested this week. Compliance check overdue."},
    {"severity": "critical", "text": "Confined space entry without atmospheric monitoring. Oxygen deficiency risk."},
    {"severity": "medium",   "text": "Hot work permit expired 2 hours ago. Welding operation still in progress."},
    {"severity": "high",     "text": "Person bypassed machine guard to clear jam. Hands inside pinch point zone."},
    {"severity": "medium",   "text": "Ladder placed on uneven surface at incorrect angle. Tip-over risk during use."},
    {"severity": "high",     "text": "Compressed air being used to clean clothing. Injection injury hazard."},
    {"severity": "critical", "text": "Structural crack detected on lifting beam during operation. Catastrophic failure risk."},
    {"severity": "low",      "text": "First aid kit supplies below minimum count. Restocking required."},
    {"severity": "medium",   "text": "Dust extraction system running below rated capacity. Airborne particulate levels elevated."},
    {"severity": "high",     "text": "Person standing in forklift travel lane while distracted. Unaware of approaching vehicle."},
    {"severity": "critical", "text": "Fire detected near flammable storage cabinet. Suppression system not yet activated."},
    {"severity": "low",      "text": "Toolbox left open on floor creating trip hazard. Housekeeping reminder issued."},
]

PERSONS = ["Person A", "Person B", "Person C", "Person D"]


def generate():
    start_date = datetime(2026, 1, 5, 8, 0, 0)
    end_date = datetime(2026, 3, 31, 17, 0, 0)
    total_span = (end_date - start_date).total_seconds()

    warnings = []
    n = len(WARNINGS_TEMPLATES)

    for i, tpl in enumerate(WARNINGS_TEMPLATES):
        base_offset = (i / n) * total_span
        jittered_offset = base_offset + random.uniform(-total_span * 0.01, total_span * 0.01)
        jittered_offset = max(0, min(total_span, jittered_offset))
        ts = start_date + timedelta(seconds=jittered_offset)
        ts = ts.replace(hour=random.randint(7, 17), minute=random.randint(0, 59))

        warnings.append({
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "severity": tpl["severity"],
            "text": tpl["text"],
            "person": random.choice(PERSONS),
        })

    warnings.sort(key=lambda w: w["timestamp"])

    result = {
        "meta": {
            "source": "egoallo",
        },
        "warnings": warnings,
    }

    out_path = Path(__file__).parent.parent / "src" / "data" / "placeholder.json"
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"Generated {len(warnings)} warnings -> {out_path}")
    stats = {}
    for w in warnings:
        stats[w["severity"]] = stats.get(w["severity"], 0) + 1
    print(f"  Severities: {stats}")
    print(f"  Persons: {sorted(set(w['person'] for w in warnings))}")
    print(f"  Date range: {warnings[0]['timestamp']} -> {warnings[-1]['timestamp']}")


if __name__ == "__main__":
    generate()
