"""
Convert EgoAllo NPZ + YAML output into dashboard-ready JSON.

Usage:
    python convert_npz.py <npz_file> [--yaml <yaml_file>] [-o output.json]

The NPZ is expected to contain:
    Ts_world_cpf    (N, 7)          camera transforms (quat wxyz + translation xyz)
    Ts_world_root   (1, N, 7)       root body transforms
    body_quats      (1, N, 21, 4)   body joint quaternions
    left_hand_quats (1, N, 15, 4)   left hand joint quaternions
    right_hand_quats(1, N, 15, 4)   right hand joint quaternions
    contacts        (1, N, 21)      contact values per joint
    betas           (1, N, 16)      SMPL-H shape params
    frame_nums      (N,)            frame indices
    timestamps_ns   (N,)            nanosecond timestamps

Output JSON matches the format expected by the Safety Monitor Dashboard.
"""

import argparse
import json
import numpy as np
import yaml
from pathlib import Path

# SMPL-H 22 body joints (root + 21)
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

# Skeleton connectivity (parent, child) indices
BONES = [
    [0, 1], [0, 2], [0, 3],        # pelvis -> hips, spine
    [1, 4], [2, 5],                 # hips -> knees
    [3, 6],                         # spine1 -> spine2
    [4, 7], [5, 8],                 # knees -> ankles
    [6, 9],                         # spine2 -> spine3
    [7, 10], [8, 11],               # ankles -> feet
    [9, 12], [9, 13], [9, 14],      # spine3 -> neck, collars
    [12, 15],                       # neck -> head
    [13, 16], [14, 17],             # collars -> shoulders
    [16, 18], [17, 19],             # shoulders -> elbows
    [18, 20], [19, 21],             # elbows -> wrists
]


def quat_to_rotmat(q):
    """Convert quaternion (w,x,y,z) to 3x3 rotation matrix."""
    w, x, y, z = q
    return np.array([
        [1 - 2*(y*y + z*z), 2*(x*y - z*w),     2*(x*z + y*w)],
        [2*(x*y + z*w),     1 - 2*(x*x + z*z), 2*(y*z - x*w)],
        [2*(x*z - y*w),     2*(y*z + x*w),     1 - 2*(x*x + y*y)],
    ])


def forward_kinematics_simple(root_transform, body_quats):
    """
    Simplified FK: compute approximate 3D joint positions.
    root_transform: (7,) -> quat(wxyz) + translation(xyz)
    body_quats: (21, 4) -> local rotations

    Returns (22, 3) joint positions.
    """
    # SMPL-H rest-pose offsets (approximate, in meters)
    REST_OFFSETS = np.array([
        [0, 0, 0],           # 0  pelvis
        [0.08, -0.08, 0],    # 1  left_hip
        [-0.08, -0.08, 0],   # 2  right_hip
        [0, 0.1, 0],         # 3  spine1
        [0.08, -0.48, 0],    # 4  left_knee
        [-0.08, -0.48, 0],   # 5  right_knee
        [0, 0.2, 0],         # 6  spine2
        [0.08, -0.88, 0],    # 7  left_ankle
        [-0.08, -0.88, 0],   # 8  right_ankle
        [0, 0.35, 0],        # 9  spine3
        [0.08, -0.92, 0],    # 10 left_foot
        [-0.08, -0.92, 0],   # 11 right_foot
        [0, 0.52, 0],        # 12 neck
        [0.05, 0.48, 0],     # 13 left_collar
        [-0.05, 0.48, 0],    # 14 right_collar
        [0, 0.6, 0],         # 15 head
        [0.18, 0.48, 0],     # 16 left_shoulder
        [-0.18, 0.48, 0],    # 17 right_shoulder
        [0.42, 0.44, 0],     # 18 left_elbow
        [-0.42, 0.44, 0],    # 19 right_elbow
        [0.62, 0.40, 0],     # 20 left_wrist
        [-0.62, 0.40, 0],    # 21 right_wrist
    ])

    root_quat = root_transform[:4]
    root_pos = root_transform[4:]
    root_rot = quat_to_rotmat(root_quat)

    positions = np.zeros((22, 3))
    for i in range(22):
        offset = REST_OFFSETS[i]
        if i > 0:
            local_rot = quat_to_rotmat(body_quats[i - 1])
            offset = local_rot @ offset
        positions[i] = root_rot @ offset + root_pos

    return positions


def project_to_2d(positions_3d, image_width=800, image_height=600):
    """Simple orthographic projection of 3D joints to 2D canvas coords."""
    # Center on pelvis, scale to canvas
    centered = positions_3d - positions_3d[0]  # center on pelvis
    scale = min(image_width, image_height) * 0.35

    points_2d = []
    for p in centered:
        x = image_width / 2 + p[0] * scale
        y = image_height / 2 - p[1] * scale  # flip Y
        points_2d.append([round(float(x), 1), round(float(y), 1)])
    return points_2d


def convert(npz_path, yaml_path=None, output_path=None):
    data = np.load(npz_path, allow_pickle=True)

    meta = {
        "source": "egoallo",
        "guidance_mode": "unknown",
        "joint_names": JOINT_NAMES,
        "bones": BONES,
    }

    if yaml_path and Path(yaml_path).exists():
        with open(yaml_path) as f:
            args = yaml.safe_load(f)
        meta["guidance_mode"] = args.get("guidance_mode", "unknown")
        traj_root = args.get("traj_root", "")
        if hasattr(traj_root, "as_posix"):
            traj_root = str(traj_root)
        meta["traj_root"] = str(traj_root)

    timestamps_ns = data["timestamps_ns"]
    frame_nums = data["frame_nums"]
    root_transforms = data["Ts_world_root"][0]   # (N, 7)
    body_quats = data["body_quats"][0]            # (N, 21, 4)
    contacts = data["contacts"][0]                # (N, 21)
    n_frames = len(frame_nums)

    frames = []
    for i in range(n_frames):
        pos_3d = forward_kinematics_simple(root_transforms[i], body_quats[i])
        joints_2d = project_to_2d(pos_3d)
        frames.append({
            "frame_num": int(frame_nums[i]),
            "timestamp_ns": int(timestamps_ns[i]),
            "joints_2d": joints_2d,
            "contacts": [round(float(c), 4) for c in contacts[i]],
        })

    result = {
        "meta": meta,
        "frames": frames,
        "warnings": [],  # warnings come from LLM analysis, not from NPZ
    }

    if output_path is None:
        output_path = Path(npz_path).with_suffix(".json")

    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"Converted {n_frames} frames -> {output_path}")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert EgoAllo NPZ to dashboard JSON")
    parser.add_argument("npz_file", help="Path to the .npz file")
    parser.add_argument("--yaml", help="Path to the _args.yaml file", default=None)
    parser.add_argument("-o", "--output", help="Output JSON path", default=None)
    args = parser.parse_args()

    if args.yaml is None:
        # Try to find yaml next to npz
        candidate = Path(args.npz_file).with_name(
            Path(args.npz_file).stem + "_args.yaml"
        )
        if not candidate.exists():
            candidate = Path(args.npz_file).with_name(
                Path(args.npz_file).name.replace(".npz", "_args.yaml")
            )
        if candidate.exists():
            args.yaml = str(candidate)

    convert(args.npz_file, args.yaml, args.output)
