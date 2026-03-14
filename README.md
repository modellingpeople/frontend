# POPE Frontend

Real-time safety monitoring dashboard that visualizes 3D human pose data from [EgoAllo](https://egoallo.github.io/) inference outputs. Built with React and Three.js.

Part of the [Modelling People](https://github.com/modellingpeople) organization.

## Prerequisites

- **Node.js** >= 16
- **Python** >= 3.8 (for data generation scripts only)
- **NumPy** (for `export_3d.py` and `convert_npz.py`)

## Quick Start

```bash
git clone https://github.com/modellingpeople/frontend.git
cd frontend
npm install
npm start
```

The app runs at `http://localhost:3000`. Without 3D scene data, you'll see the dashboard UI with timeline and warnings but an empty 3D viewport.

## Project Structure

```
frontend/
├── public/
│   └── data/
│       └── scene3d.json          # 3D scene data (mesh, point cloud, camera) — not checked in
├── src/
│   ├── App.js                    # Root component — tab state, data loading, layout
│   ├── App.css                   # Global styles (dark theme)
│   ├── components/
│   │   ├── TabBar.js             # Top-level tab navigation (Safety / Elder Care / Rehab)
│   │   ├── CameraView3D.js       # 3D viewport — React Three Fiber canvas
│   │   ├── BodyMesh.js           # Animated body mesh (tube geometry around skeleton)
│   │   ├── PointCloudView.js     # Environment point cloud renderer
│   │   ├── CameraController.js   # 1st-person (ego replay) / 3rd-person (orbit) camera
│   │   ├── Timeline.js           # Scrubable timeline with severity-colored markers
│   │   ├── WarningDetail.js      # Selected warning info panel
│   │   ├── PersonSelector.js     # Filter warnings by person
│   │   └── ViewToggle.js         # 1st / 3rd person toggle
│   └── data/
│       ├── placeholder.json      # Safety tab warnings
│       ├── elder_care.json       # Elder Care tab warnings
│       └── rehab_fitness.json    # Rehab & Fitness tab warnings
└── scripts/
    ├── export_3d.py              # EgoAllo NPZ + PLY → scene3d.json
    ├── convert_npz.py            # EgoAllo NPZ → 2D projected JSON (legacy)
    ├── generate_placeholder.py   # Generate safety warning data
    └── generate_tab_data.py      # Generate elder care + rehab warning data
```

## Loading 3D Scene Data

The 3D viewer requires `public/data/scene3d.json`, generated from EgoAllo inference outputs.

### Input

You need an EgoAllo output directory with this structure:

```
egoallo_output/
├── egoallo_outputs/
│   └── *.npz          # Inference result (body poses, joint rotations, contacts)
├── point_cloud.ply    # LiDAR point cloud (optional, provides environment context)
└── Ts_world_cpf.npy   # Camera poses (optional, enables 1st-person replay)
```

The NPZ file contains:

| Array | Shape | Description |
|-------|-------|-------------|
| `Ts_world_root` | `(1, N, 7)` | Root body transform per frame (quaternion wxyz + translation xyz) |
| `body_quats` | `(1, N, 21, 4)` | Local joint rotations for 21 SMPL-H body joints |
| `contacts` | `(1, N, 21)` | Ground contact probability per joint |
| `frame_nums` | `(N,)` | Frame indices |
| `timestamps_ns` | `(N,)` | Nanosecond timestamps |

### Export

```bash
python scripts/export_3d.py path/to/egoallo_output
```

Options:
```
--warnings path/to/placeholder.json    # Link warnings to mesh frames
-o path/to/output.json                 # Custom output path (default: public/data/scene3d.json)
```

This runs forward kinematics on the joint quaternions, generates tube mesh geometry around the skeleton (6-segment cylinders per bone + joint spheres), converts coordinates from Z-up to Y-up (Three.js convention), and packages everything into a single JSON file.

### Output: `scene3d.json`

```jsonc
{
  "mesh": {
    "faces": [[v0, v1, v2], ...],        // Triangle indices (static)
    "frames": [{ "verts": [[x,y,z], ...] }, ...]  // Per-frame vertex positions
  },
  "point_cloud": {
    "positions": [[x,y,z], ...],         // 3D points (downsampled to 50K)
    "colors": [[r,g,b], ...]             // RGB 0-255
  },
  "camera": {
    "frames": [{ "x","y","z", "qw","qx","qy","qz" }, ...]  // Per-frame camera pose
  }
}
```

## Tabs

The dashboard has three monitoring contexts. Each tab loads its own warning dataset; the 3D viewer is shared.

| Tab | Data File | Persons | Warning Types |
|-----|-----------|---------|---------------|
| **Safety** | `placeholder.json` | Person A–D | Construction hazards (PPE violations, machine guarding, fall risks) |
| **Elder Care** | `elder_care.json` | Margaret, Harold, Betty, Frank, Dorothy | Fall risk, inactivity, missed meals, social isolation, wandering |
| **Rehab & Fitness** | `rehab_fitness.json` | Patient Rivera, Chen, Okafor, Novak | Incorrect form, overexertion, skipped sessions, ROM regression |

### Regenerating Warning Data

```bash
python scripts/generate_placeholder.py     # → src/data/placeholder.json
python scripts/generate_tab_data.py         # → src/data/elder_care.json + rehab_fitness.json
```

## Development

```bash
npm start       # Dev server with hot reload
npm run build   # Production build → build/
```

### Key Libraries

- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) — React renderer for Three.js
- [Drei](https://github.com/pmndrs/drei) — OrbitControls and other Three.js helpers
- [Three.js](https://threejs.org/) — 3D rendering

### Architecture Notes

- **3D rendering**: `CameraView3D` creates a React Three Fiber `<Canvas>` with `BodyMesh` (animated triangle mesh), `PointCloudView` (static environment), and `CameraController` (orbit or ego-view replay). Mesh vertices update per-frame via `Float32Array` buffer attribute updates.
- **Animation**: When a warning is selected, frames auto-advance at 15 fps. Each warning can reference a `mesh_frame_start` offset into the mesh frame sequence.
- **Tab switching**: Resets selection state (selected warning, person filter, frame index). Warning data is bundled per-tab; 3D scene data is shared across tabs.
- **Camera modes**: 1st-person drives position/quaternion from `camera.frames` data each render frame. 3rd-person uses `OrbitControls` targeting the mesh centroid.
