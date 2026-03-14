"""
Generate warning data for Elder Care and Rehab & Fitness tabs.
Produces src/data/elder_care.json and src/data/rehab_fitness.json.

Usage:
    python scripts/generate_tab_data.py
"""

import json
import random
from pathlib import Path
from datetime import datetime, timedelta

random.seed(99)


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
        })

    warnings.sort(key=lambda w: w["timestamp"])
    return {
        "meta": {
            "source": "egoallo",
        },
        "warnings": warnings,
    }


# ── Elder Care ──────────────────────────────────────────────

ELDER_PERSONS = ["Margaret", "Harold", "Betty", "Frank", "Dorothy"]

ELDER_TEMPLATES = [
    {"severity": "critical", "text": "Fall risk detected: Margaret showing unsteady gait pattern with lateral sway exceeding safe threshold."},
    {"severity": "critical", "text": "Fall detected in hallway. Harold found on ground, unable to self-recover. Emergency response initiated."},
    {"severity": "critical", "text": "Betty attempted to stand from wheelchair without assistance. High fall risk — staff alerted."},
    {"severity": "high", "text": "Prolonged inactivity: Frank has not moved from bed for over 4 hours. Wellness check recommended."},
    {"severity": "high", "text": "Social isolation alert: Dorothy has not interacted with other residents for 48 hours."},
    {"severity": "high", "text": "Wandering detected: Harold found near emergency exit at 2:30 AM. Night staff notified."},
    {"severity": "high", "text": "Unusual night activity: Margaret has been pacing the corridor for 45 minutes after midnight."},
    {"severity": "high", "text": "Missed medication window: Betty did not pick up 10 AM prescriptions. Nurse follow-up needed."},
    {"severity": "medium", "text": "Missed meal: Frank did not attend lunch service. Tray delivery scheduled."},
    {"severity": "medium", "text": "Missed meal: Dorothy skipped breakfast for the second consecutive day."},
    {"severity": "medium", "text": "Reduced mobility: Harold's walking speed has decreased 30% over the past week."},
    {"severity": "medium", "text": "Bathroom visit frequency increased: Margaret visited 8 times today, above normal baseline."},
    {"severity": "medium", "text": "Prolonged inactivity: Betty remained seated in common area for 3 hours without movement."},
    {"severity": "low", "text": "Positive interaction: Margaret and Dorothy engaged in 40-minute conversation in the garden."},
    {"severity": "low", "text": "Group activity: Harold, Betty, and Frank participated in afternoon card game for 1 hour."},
    {"severity": "low", "text": "Assisted walking: Dorothy completed two laps of the corridor with physical therapist support."},
    {"severity": "low", "text": "Social engagement: Margaret joined the morning exercise class with 5 other residents."},
    {"severity": "low", "text": "Positive interaction: Harold and Frank had a 25-minute conversation over coffee in the lounge."},
    {"severity": "medium", "text": "Sleep disruption: Betty woke 4 times during the night. Sleep quality declining over past 3 days."},
    {"severity": "high", "text": "Fall risk: Dorothy using furniture for balance support instead of walker. Equipment compliance issue."},
    {"severity": "low", "text": "Family visit: Margaret received visitors for 2 hours. Mood and engagement noticeably improved."},
    {"severity": "medium", "text": "Weight change alert: Frank's weekly weigh-in shows 2kg loss over 2 weeks. Dietary review needed."},
    {"severity": "critical", "text": "Choking risk detected: Harold eating alone and coughing repeatedly during dinner. Staff alerted."},
    {"severity": "low", "text": "Positive interaction: All five residents gathered for movie night. High engagement observed."},
    {"severity": "high", "text": "Agitation detected: Betty exhibiting restless behavior and repeated attempts to leave the facility."},
]

# ── Rehab & Fitness ─────────────────────────────────────────

REHAB_PERSONS = ["Patient Rivera", "Patient Chen", "Patient Okafor", "Patient Novak"]

REHAB_TEMPLATES = [
    {"severity": "critical", "text": "Overexertion detected: Patient Rivera's heart rate spiked to 185 BPM during treadmill session. Session halted."},
    {"severity": "critical", "text": "Overexertion alert: Patient Chen collapsed during resistance training. Vitals unstable — medical team called."},
    {"severity": "critical", "text": "Severe pain response: Patient Okafor reported sharp pain during shoulder rehab. Possible re-injury."},
    {"severity": "high", "text": "Incorrect exercise form: Patient Novak performing deadlift with rounded lumbar spine. Injury risk elevated."},
    {"severity": "high", "text": "Incorrect form: Patient Rivera hyperextending knees during leg press. Corrective cue delivered."},
    {"severity": "high", "text": "Range-of-motion regression: Patient Chen's shoulder flexion decreased 15 degrees from last session."},
    {"severity": "high", "text": "Incorrect form: Patient Okafor compensating with lower back during bicep curls. Technique correction needed."},
    {"severity": "medium", "text": "Skipped session: Patient Novak did not attend scheduled 9 AM physical therapy appointment."},
    {"severity": "medium", "text": "Skipped session: Patient Rivera missed second consecutive aquatic therapy session."},
    {"severity": "medium", "text": "Fatigue detected: Patient Chen showing declining rep quality in final set. Session intensity may need adjustment."},
    {"severity": "medium", "text": "Fatigue detected: Patient Okafor's grip strength dropped 40% midway through occupational therapy tasks."},
    {"severity": "medium", "text": "Range-of-motion plateau: Patient Novak's knee flexion unchanged for 3 consecutive sessions."},
    {"severity": "medium", "text": "Therapy compliance: Patient Rivera completed only 2 of 4 prescribed home exercise sets this week."},
    {"severity": "low", "text": "Milestone reached: Patient Chen successfully completed 10-minute unassisted walk for the first time."},
    {"severity": "low", "text": "Improved ROM: Patient Okafor's hip flexion increased by 12 degrees since therapy start."},
    {"severity": "low", "text": "Consistent attendance: Patient Novak has attended all 12 scheduled sessions this month."},
    {"severity": "low", "text": "Progress note: Patient Rivera's balance test score improved from 6/10 to 8/10."},
    {"severity": "low", "text": "Milestone reached: Patient Chen completed full squat to parallel for first time post-surgery."},
    {"severity": "low", "text": "Improved ROM: Patient Okafor achieved full overhead reach with operated shoulder. Recovery on track."},
    {"severity": "high", "text": "Swelling observed: Patient Novak's operated knee showing increased inflammation post-session."},
    {"severity": "medium", "text": "Asymmetry detected: Patient Rivera favoring right leg during gait analysis. Compensation pattern developing."},
    {"severity": "low", "text": "Progress note: Patient Chen reported pain level decreased from 7/10 to 3/10 over past two weeks."},
    {"severity": "high", "text": "Incorrect form: Patient Okafor performing plank with excessive hip sag. Core engagement insufficient."},
    {"severity": "critical", "text": "Overexertion: Patient Novak ignored rest interval guidelines and showing signs of rhabdomyolysis risk."},
    {"severity": "low", "text": "Consistent attendance: All four patients completed this week's full therapy schedule."},
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
