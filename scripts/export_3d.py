"""
Export EgoAllo NPZ + PLY point cloud to 3D scene JSON for the frontend viewer.

Usage:
    python export_3d.py <npz_dir> [-o output.json]

Where <npz_dir> is the egoallo output directory containing:
    egoallo_outputs/*.npz     - inference results
    point_cloud.ply           - LiDAR point cloud
    Ts_world_cpf.npy          - camera poses (optional, also in NPZ)

Produces scene3d.json with:
  - Per-frame 3D skeleton joints (22 joints) + bones for mesh-like rendering
  - Point cloud positions + colors (downsampled to ~50K)
  - Per-frame camera poses
  - Warnings array from placeholder.json

Works WITHOUT the SMPL-H model file by using forward kinematics on the
skeleton joints directly from the NPZ quaternion data.
"""

import argparse
import json
import struct
from pathlib import Path

import numpy as np

# SMPL-H 22 body joints
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

# Kinematic tree: parent index for each joint (-1 = root)
PARENT = [-1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 12, 13, 14, 16, 17, 18, 19]

# SMPL-H rest-pose offsets (meters) — approximate T-pose skeleton
REST_OFFSETS = np.array([
    [0, 0, 0],           # 0  pelvis
    [0.08, -0.08, 0],    # 1  left_hip
    [-0.08, -0.08, 0],   # 2  right_hip
    [0, 0.1, 0],         # 3  spine1
    [0, -0.40, 0],       # 4  left_knee (relative to left_hip)
    [0, -0.40, 0],       # 5  right_knee (relative to right_hip)
    [0, 0.10, 0],        # 6  spine2 (relative to spine1)
    [0, -0.40, 0],       # 7  left_ankle (relative to left_knee)
    [0, -0.40, 0],       # 8  right_ankle (relative to right_knee)
    [0, 0.15, 0],        # 9  spine3 (relative to spine2)
    [0, -0.04, 0.08],    # 10 left_foot (relative to left_ankle)
    [0, -0.04, 0.08],    # 11 right_foot (relative to right_ankle)
    [0, 0.17, 0],        # 12 neck (relative to spine3)
    [0.05, -0.04, 0],    # 13 left_collar (relative to spine3)
    [-0.05, -0.04, 0],   # 14 right_collar (relative to spine3)
    [0, 0.08, 0],        # 15 head (relative to neck)
    [0.13, 0, 0],        # 16 left_shoulder (relative to left_collar)
    [-0.13, 0, 0],       # 17 right_shoulder (relative to right_collar)
    [0.26, 0, 0],        # 18 left_elbow (relative to left_shoulder)
    [-0.26, 0, 0],       # 19 right_elbow (relative to right_shoulder)
    [0.26, 0, 0],        # 20 left_wrist (relative to left_elbow)
    [-0.26, 0, 0],       # 21 right_wrist (relative to right_elbow)
])


def quat_to_rotmat(q):
    """Quaternion (w,x,y,z) to 3x3 rotation matrix."""
    w, x, y, z = q
    return np.array([
        [1 - 2*(y*y + z*z), 2*(x*y - z*w),     2*(x*z + y*w)],
        [2*(x*y + z*w),     1 - 2*(x*x + z*z), 2*(y*z - x*w)],
        [2*(x*z - y*w),     2*(y*z + x*w),     1 - 2*(x*x + y*y)],
    ])


def forward_kinematics(root_transform, body_quats):
    """
    Full hierarchical FK using kinematic tree.
    root_transform: (7,) -> quat(wxyz) + translation(xyz)
    body_quats: (21, 4) -> local joint rotations (wxyz)
    Returns (22, 3) joint positions in world space.
    """
    root_quat = root_transform[:4]
    root_pos = root_transform[4:]

    # World-space rotation and position for each joint
    world_rots = [None] * 22
    positions = np.zeros((22, 3))

    # Root joint
    world_rots[0] = quat_to_rotmat(root_quat)
    positions[0] = root_pos

    for i in range(1, 22):
        parent = PARENT[i]
        local_rot = quat_to_rotmat(body_quats[i - 1])
        world_rots[i] = world_rots[parent] @ local_rot
        positions[i] = positions[parent] + world_rots[parent] @ REST_OFFSETS[i]

    return positions


def generate_tube_mesh(joints_sequence, bones, radius=0.02, segments=6):
    """
    Generate a tube/capsule mesh around the skeleton bones for all frames.
    Returns faces (once) and per-frame vertices.

    Each bone becomes a cylinder with `segments` sides.
    Each joint gets a sphere approximation (icosphere-ish).
    """
    n_bones = len(bones)
    # Per bone: 2 rings of `segments` verts = 2*segments verts, 2*segments triangles
    verts_per_bone = 2 * segments
    faces_per_bone = 2 * segments  # quads split into 2 tris each

    # Per joint: 1 vert (center) — we'll just use spheres at joints
    # Actually, for simplicity: capsule = cylinder between joints + sphere caps
    # Simpler approach: just generate cylinder tubes + joint spheres

    # Build faces (topology is the same for all frames)
    all_faces = []
    for b_idx in range(n_bones):
        base = b_idx * verts_per_bone
        for s in range(segments):
            s_next = (s + 1) % segments
            # Bottom ring indices
            b0 = base + s
            b1 = base + s_next
            # Top ring indices
            t0 = base + segments + s
            t1 = base + segments + s_next
            # Two triangles per quad
            all_faces.append([b0, t0, b1])
            all_faces.append([b1, t0, t1])

    # Joint sphere verts and faces
    joint_base = n_bones * verts_per_bone
    n_joints = 22
    # Each joint: center + ring of segments verts = 1 + segments verts
    # Faces: segments triangles (fan)
    # Top cap + bottom cap
    for j in range(n_joints):
        center_idx = joint_base + j * (1 + segments)
        for s in range(segments):
            s_next = (s + 1) % segments
            v0 = center_idx
            v1 = center_idx + 1 + s
            v2 = center_idx + 1 + s_next
            all_faces.append([v0, v1, v2])

    faces = all_faces
    total_verts = n_bones * verts_per_bone + n_joints * (1 + segments)

    def build_frame_verts(joints):
        """Build vertices for one frame given 22 joint positions."""
        verts = np.zeros((total_verts, 3))

        # Cylinder tubes for each bone
        for b_idx, (j_start, j_end) in enumerate(bones):
            p0 = joints[j_start]
            p1 = joints[j_end]
            direction = p1 - p0
            length = np.linalg.norm(direction)
            if length < 1e-6:
                direction = np.array([0, 1, 0])
            else:
                direction = direction / length

            # Find perpendicular vectors
            if abs(direction[1]) < 0.9:
                perp1 = np.cross(direction, [0, 1, 0])
            else:
                perp1 = np.cross(direction, [1, 0, 0])
            perp1 = perp1 / (np.linalg.norm(perp1) + 1e-10)
            perp2 = np.cross(direction, perp1)

            base = b_idx * verts_per_bone
            for s in range(segments):
                angle = 2 * np.pi * s / segments
                offset = radius * (np.cos(angle) * perp1 + np.sin(angle) * perp2)
                verts[base + s] = p0 + offset          # bottom ring
                verts[base + segments + s] = p1 + offset  # top ring

        # Joint spheres
        sphere_radius = radius * 1.5
        for j in range(n_joints):
            center_idx = joint_base + j * (1 + segments)
            verts[center_idx] = joints[j]  # center
            # Ring around joint (in XZ plane relative to joint)
            for s in range(segments):
                angle = 2 * np.pi * s / segments
                offset = sphere_radius * np.array([
                    np.cos(angle), 0, np.sin(angle)
                ])
                verts[center_idx + 1 + s] = joints[j] + offset

        return verts

    return faces, total_verts, build_frame_verts


def zup_to_yup(points):
    """Convert Z-up to Y-up (Three.js). Swap Y<->Z, negate new Z."""
    out = np.empty_like(points)
    out[..., 0] = points[..., 0]
    out[..., 1] = points[..., 2]
    out[..., 2] = -points[..., 1]
    return out


def zup_to_yup_quat(quat_wxyz):
    """Convert quaternion from Z-up to Y-up."""
    out = np.empty_like(quat_wxyz)
    out[..., 0] = quat_wxyz[..., 0]
    out[..., 1] = quat_wxyz[..., 1]
    out[..., 2] = quat_wxyz[..., 3]
    out[..., 3] = -quat_wxyz[..., 2]
    return out


def load_ply(ply_path, max_points=50000):
    """Load PLY point cloud, return (positions, colors). Downsamples if needed."""
    path = Path(ply_path)
    with open(path, 'rb') as f:
        # Read header
        header_lines = []
        while True:
            line = f.readline().decode('ascii', errors='replace').strip()
            header_lines.append(line)
            if line == 'end_header':
                break

        n_verts = 0
        is_binary = False
        properties = []
        for line in header_lines:
            if line.startswith('element vertex'):
                n_verts = int(line.split()[-1])
            elif line.startswith('format binary'):
                is_binary = True
            elif line.startswith('property'):
                parts = line.split()
                properties.append((parts[1], parts[2]))

        print(f"  PLY: {n_verts} vertices, {'binary' if is_binary else 'ascii'}, {len(properties)} properties")

        # Find property indices
        prop_names = [p[1] for p in properties]
        xi = prop_names.index('x') if 'x' in prop_names else 0
        yi = prop_names.index('y') if 'y' in prop_names else 1
        zi = prop_names.index('z') if 'z' in prop_names else 2
        has_color = 'red' in prop_names and 'green' in prop_names and 'blue' in prop_names
        if has_color:
            ri = prop_names.index('red')
            gi = prop_names.index('green')
            bi = prop_names.index('blue')

        if is_binary:
            # Build struct format from properties
            fmt_map = {'float': 'f', 'double': 'd', 'uchar': 'B', 'int': 'i',
                       'uint': 'I', 'short': 'h', 'ushort': 'H', 'char': 'b',
                       'float32': 'f', 'float64': 'd', 'uint8': 'B', 'int32': 'i'}
            fmt = '<' + ''.join(fmt_map.get(p[0], 'f') for p in properties)
            stride = struct.calcsize(fmt)

            raw = f.read(n_verts * stride)
            positions = np.zeros((n_verts, 3), dtype=np.float64)
            colors = np.full((n_verts, 3), 180, dtype=np.uint8)

            for i in range(n_verts):
                vals = struct.unpack_from(fmt, raw, i * stride)
                positions[i] = [vals[xi], vals[yi], vals[zi]]
                if has_color:
                    colors[i] = [int(vals[ri]), int(vals[gi]), int(vals[bi])]
        else:
            positions = np.zeros((n_verts, 3), dtype=np.float64)
            colors = np.full((n_verts, 3), 180, dtype=np.uint8)
            for i in range(n_verts):
                parts = f.readline().decode('ascii').strip().split()
                positions[i] = [float(parts[xi]), float(parts[yi]), float(parts[zi])]
                if has_color:
                    colors[i] = [int(float(parts[ri])), int(float(parts[gi])), int(float(parts[bi]))]

    if n_verts > max_points:
        idx = np.random.default_rng(42).choice(n_verts, max_points, replace=False)
        idx.sort()
        positions = positions[idx]
        colors = colors[idx]
        print(f"  Downsampled to {max_points} points")

    return positions, colors


def export(npz_dir, warnings_path=None, output_path=None):
    npz_dir = Path(npz_dir)

    # Find NPZ file
    egoallo_dir = npz_dir / "egoallo_outputs"
    npz_files = list(egoallo_dir.glob("*.npz"))
    if not npz_files:
        raise FileNotFoundError(f"No .npz files found in {egoallo_dir}")
    npz_path = npz_files[0]
    print(f"Loading NPZ: {npz_path}")

    data = np.load(npz_path, allow_pickle=True)
    frame_nums = data["frame_nums"]                    # (N,)
    Ts_world_root = data["Ts_world_root"][0]           # (N, 7)
    body_quats = data["body_quats"][0]                 # (N, 21, 4)
    n_frames = len(frame_nums)
    print(f"  {n_frames} frames")

    # Camera poses — try NPZ first, then separate .npy
    Ts_world_cpf = data.get("Ts_world_cpf")
    if Ts_world_cpf is None:
        cpf_path = npz_dir / "Ts_world_cpf.npy"
        if cpf_path.exists():
            Ts_world_cpf = np.load(cpf_path)
            print(f"  Loaded camera poses from {cpf_path}: {Ts_world_cpf.shape}")

    # Compute 3D joint positions per frame via FK
    print("Computing forward kinematics...")
    all_joints = np.zeros((n_frames, 22, 3))
    for i in range(n_frames):
        all_joints[i] = forward_kinematics(Ts_world_root[i], body_quats[i])

    # Generate tube mesh around skeleton
    print("Generating skeleton mesh...")
    faces, total_verts, build_verts = generate_tube_mesh(
        all_joints, BONES, radius=0.02, segments=6
    )

    # Build per-frame vertices
    mesh_frames = []
    for i in range(n_frames):
        verts = build_verts(all_joints[i])
        verts = zup_to_yup(verts)
        verts = np.round(verts, 2)
        mesh_frames.append({
            "frame_num": int(frame_nums[i]),
            "verts": verts.tolist(),
        })
        if (i + 1) % 100 == 0 or i == n_frames - 1:
            print(f"  Frame {i + 1}/{n_frames}")

    print(f"  {total_verts} verts/frame, {len(faces)} faces")

    # Point cloud
    ply_path = npz_dir / "point_cloud.ply"
    pc_data = {"positions": [], "colors": []}
    if ply_path.exists():
        print(f"Loading point cloud: {ply_path}")
        positions, colors = load_ply(ply_path)
        positions = zup_to_yup(positions)
        positions = np.round(positions, 2)
        pc_data = {
            "positions": positions.tolist(),
            "colors": colors.tolist(),
        }
        print(f"  {len(positions)} points")

    # Camera poses
    camera_data = {"frames": []}
    if Ts_world_cpf is not None:
        print("Extracting camera poses...")
        # Ts_world_cpf may have more frames than NPZ; align by index
        cam_frames = min(n_frames, len(Ts_world_cpf))
        camera_frames = []
        for i in range(cam_frames):
            pose = Ts_world_cpf[i]  # (7,) = [qw, qx, qy, qz, x, y, z]
            q = zup_to_yup_quat(pose[:4].reshape(1, 4))[0]
            t = zup_to_yup(pose[4:].reshape(1, 3))[0]
            t = np.round(t, 2)
            camera_frames.append({
                "qw": round(float(q[0]), 4),
                "qx": round(float(q[1]), 4),
                "qy": round(float(q[2]), 4),
                "qz": round(float(q[3]), 4),
                "x": float(t[0]),
                "y": float(t[1]),
                "z": float(t[2]),
            })
        camera_data = {"frames": camera_frames}
        print(f"  {cam_frames} camera frames")

    # Warnings from placeholder.json
    warnings = []
    if warnings_path and Path(warnings_path).exists():
        print(f"Loading warnings from: {warnings_path}")
        with open(warnings_path) as f:
            existing = json.load(f)
        if "warnings" in existing:
            warnings = existing["warnings"]
            frame_num_to_idx = {int(fn): i for i, fn in enumerate(frame_nums)}
            for w in warnings:
                if "frames" in w and len(w["frames"]) > 0:
                    first_frame = w["frames"][0].get("frame_num", 0)
                    w["mesh_frame_start"] = frame_num_to_idx.get(first_frame, 0)

    # Build output
    result = {
        "meta": {
            "source": "egoallo",
            "joint_names": JOINT_NAMES,
            "bones": BONES,
        },
        "mesh": {
            "faces": faces,
            "frames": mesh_frames,
        },
        "point_cloud": pc_data,
        "camera": camera_data,
        "warnings": warnings,
    }

    if output_path is None:
        output_path = Path(__file__).resolve().parent.parent / "public" / "data" / "scene3d.json"

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    print(f"Writing JSON to: {output_path}")
    with open(output_path, "w") as f:
        json.dump(result, f)

    size_mb = Path(output_path).stat().st_size / (1024 * 1024)
    print(f"Done! {size_mb:.1f} MB, {n_frames} frames, {len(faces)} faces, {total_verts} verts/frame")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export EgoAllo 3D scene for frontend viewer")
    parser.add_argument("npz_dir", help="Path to egoallo output directory (containing egoallo_outputs/ and point_cloud.ply)")
    parser.add_argument("--warnings", help="Path to placeholder.json with warnings", default=None)
    parser.add_argument("-o", "--output", help="Output JSON path", default=None)
    args = parser.parse_args()

    export(args.npz_dir, args.warnings, args.output)
