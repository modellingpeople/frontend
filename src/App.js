import React, { useEffect, useMemo, useRef, useState } from 'react';
import safetyData from './data/placeholder.json';
import {
  API_BASE_URL,
  apiUrl,
  fetchArtifacts,
  fetchJob,
  fetchScene,
  launchVisualizer,
  uploadInferenceJob,
} from './api/inferenceApi';
import TabBar from './components/TabBar';

import SidebarMonitor from './components/SidebarMonitor';
import CameraView3D from './components/CameraView3D';
import Timeline from './components/Timeline';

const TAB_DATA = {
  safety: safetyData,
  elder_care: null,
  rehab_fitness: null,
};

// Lazy-load tab data
try { TAB_DATA.elder_care = require('./data/elder_care.json'); } catch (e) {}
try { TAB_DATA.rehab_fitness = require('./data/rehab_fitness.json'); } catch (e) {}

function getTabDerived(data) {
  if (!data) return { warnings: [], minTime: 0, maxTime: 0 };
  const { warnings } = data;
  if (!warnings || warnings.length === 0) return { warnings: [], minTime: 0, maxTime: 0 };
  const timestamps = warnings.map(w => new Date(w.timestamp).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  return { warnings, minTime, maxTime };
}

const GUIDANCE_OPTIONS = [
  { value: 'no_hands', label: 'No Hands' },
  { value: 'hamer_wrist', label: 'HaMeR Wrist' },
  { value: 'hamer_reproj2', label: 'HaMeR Reproj2' },
];

const POLL_INTERVAL_MS = 1500;
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

function formatTimestamp(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function PlaybackPanel({ frameIndex, totalFrames, onFrameChange }) {
  if (!totalFrames) {
    return (
      <div className="timeline playback-panel">
        <div className="playback-header">
          <strong>Inference Playback</strong>
          <span>Waiting for frame data.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline playback-panel">
      <div className="playback-header">
        <strong>Inference Playback</strong>
        <span>Frame {frameIndex + 1} / {totalFrames}</span>
      </div>
      <input
        type="range"
        min="0"
        max={Math.max(totalFrames - 1, 0)}
        value={Math.min(frameIndex, totalFrames - 1)}
        onChange={(event) => onFrameChange(Number(event.target.value))}
      />
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('safety');

  const [currentTime, setCurrentTime] = useState(0);
  const [selectedWarning, setSelectedWarning] = useState(null);
  const [frameIndex, setFrameIndex] = useState(0);

  const [demoSceneData, setDemoSceneData] = useState(null);
  const [demoSceneLoading, setDemoSceneLoading] = useState(true);
  const [demoSceneError, setDemoSceneError] = useState('');

  const [inferenceSceneData, setInferenceSceneData] = useState(null);
  const [inferenceSceneLoading, setInferenceSceneLoading] = useState(false);
  const [sceneMode, setSceneMode] = useState('demo');

  const [selectedFile, setSelectedFile] = useState(null);
  const [trajLength, setTrajLength] = useState('256');
  const [guidanceMode, setGuidanceMode] = useState('no_hands');
  const [isUploadPanelCollapsed, setIsUploadPanelCollapsed] = useState(false);
  const [job, setJob] = useState(null);
  const [jobArtifacts, setJobArtifacts] = useState([]);
  const [jobError, setJobError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLaunchingVisualizer, setIsLaunchingVisualizer] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);

  const pollTimerRef = useRef(null);
  const consecutivePollErrorsRef = useRef(0);
  const fileInputRef = useRef(null);

  const sceneData = sceneMode === 'inference' && inferenceSceneData
    ? inferenceSceneData
    : demoSceneData;

  const { warnings, minTime, maxTime } = useMemo(
    () => {
      if (sceneMode === 'inference' && inferenceSceneData) {
        return getTabDerived({ warnings: inferenceSceneData.warnings || [] });
      }
      return getTabDerived(TAB_DATA[activeTab]);
    },
    [activeTab, inferenceSceneData, sceneMode]
  );
  const sceneLoading = sceneMode === 'inference' ? inferenceSceneLoading : demoSceneLoading;
  const sceneError = sceneMode === 'inference' ? jobError : demoSceneError;
  const showPlayback = sceneMode === 'inference' && warnings.length === 0;
  const totalFrames = sceneData?.mesh?.frames?.length || 0;
  const jobInFlight = Boolean(job && ['queued', 'running'].includes(job.status));

  useEffect(() => {
    setSelectedWarning(null);
    setFrameIndex(0);
    setCurrentTime(warnings.length > 0 ? minTime : 0);
  }, [activeTab, minTime, sceneMode, warnings.length]);

  useEffect(() => {
    fetch('/data/scene3d.json')
      .then(res => {
        if (!res.ok) throw new Error('No 3D data available');
        return res.json();
      })
      .then(data => {
        setDemoSceneData(data);
        setDemoSceneError('');
      })
      .catch(() => {
        setDemoSceneError('No demo 3D scene is available.');
      })
      .finally(() => {
        setDemoSceneLoading(false);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeJobId) {
      return undefined;
    }

    let cancelled = false;

    const stopPolling = () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const finalizeJob = async (payload) => {
      try {
        const artifactsPayload = await fetchArtifacts(payload.job_id);
        if (!cancelled) {
          setJobArtifacts(artifactsPayload.artifacts || []);
        }
      } catch (error) {
        if (!cancelled) {
          setJobError(error.message);
        }
      }

      if (payload.status !== 'succeeded') {
        return;
      }

      if (!cancelled) {
        setInferenceSceneLoading(true);
      }

      try {
        const scenePayload = await fetchScene(payload.job_id);
        if (!cancelled) {
          setInferenceSceneData(scenePayload);
          setSceneMode('inference');
        }
      } catch (error) {
        if (!cancelled) {
          setJobError(error.message);
        }
      } finally {
        if (!cancelled) {
          setInferenceSceneLoading(false);
        }
      }
    };

    const pollJob = async () => {
      try {
        const payload = await fetchJob(activeJobId);
        if (cancelled) {
          return;
        }

        consecutivePollErrorsRef.current = 0;
        setJob(payload);

        if (payload.status === 'succeeded' || payload.status === 'failed') {
          stopPolling();
          setActiveJobId(null);
          await finalizeJob(payload);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        consecutivePollErrorsRef.current += 1;
        if (consecutivePollErrorsRef.current >= MAX_CONSECUTIVE_POLL_ERRORS) {
          stopPolling();
          setActiveJobId(null);
          setJobError(
            `Polling stopped after ${MAX_CONSECUTIVE_POLL_ERRORS} errors: ${error.message}`
          );
        }
      }
    };

    pollJob();
    pollTimerRef.current = window.setInterval(pollJob, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [activeJobId]);

  const handleMarkerClick = (warning) => {
    setSelectedWarning(warning);
    setCurrentTime(new Date(warning.timestamp).getTime());
    setFrameIndex(0);
  };

  const handleInferenceSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setJobError('Select a .r3d file before starting inference.');
      return;
    }
    if (!selectedFile.name.toLowerCase().endsWith('.r3d')) {
      setJobError('The selected file must end in .r3d.');
      return;
    }

    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    consecutivePollErrorsRef.current = 0;
    setJobError('');
    setJobArtifacts([]);
    setIsSubmitting(true);

    try {
      const payload = await uploadInferenceJob({
        file: selectedFile,
        trajLength: Number(trajLength || 256),
        guidanceMode,
      });
      setJob({
        job_id: payload.job_id,
        status: payload.status,
        guidance_mode: guidanceMode,
        traj_length: Number(trajLength || 256),
        visualizer_status: 'idle',
      });
      setActiveJobId(payload.job_id);
    } catch (error) {
      setJobError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseDemoScene = () => {
    if (demoSceneData) {
      setSceneMode('demo');
    }
  };

  const handleLaunchVisualizer = async () => {
    if (!job || job.status !== 'succeeded') {
      return;
    }

    setIsLaunchingVisualizer(true);
    setJobError('');

    try {
      const payload = await launchVisualizer(job.job_id);
      setJob(payload);
    } catch (error) {
      setJobError(error.message);
    } finally {
      setIsLaunchingVisualizer(false);
    }
  };

  const overlayMessage = showPlayback
    ? 'Use the playback slider below to inspect the inference result.'
    : (!selectedWarning ? 'Select a warning to view 3D pose' : null);

  return (
    <div className="app">
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <section className="inference-console">
        <form className="inference-form" onSubmit={handleInferenceSubmit}>
          <div className="inference-form-header">
            <div>
              <p className="inference-form-kicker">Inference Upload</p>
              <h2>Upload a Record3D capture</h2>
            </div>
            <button
              type="button"
              className="inference-collapse-button"
              onClick={() => setIsUploadPanelCollapsed((current) => !current)}
              aria-expanded={!isUploadPanelCollapsed}
              aria-controls="upload-panel-body"
            >
              {isUploadPanelCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>

          {isUploadPanelCollapsed ? (
            <div className="inference-collapsed-summary" id="upload-panel-body">
              <span>{selectedFile ? selectedFile.name : 'No .r3d selected'}</span>
              <span>Length {trajLength}</span>
              <span>{guidanceMode}</span>
            </div>
          ) : (
            <div className="inference-form-body" id="upload-panel-body">
              <div className="upload-card">
                <div className="upload-card-copy">
                  <span className="upload-card-label">Record3D file</span>
                  <strong>{selectedFile ? selectedFile.name : 'No file selected yet'}</strong>
                  <p>Choose a `.r3d` capture from your machine and send it directly to the inference API.</p>
                </div>
                <input
                  ref={fileInputRef}
                  className="hidden-file-input"
                  type="file"
                  accept=".r3d"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  className="file-picker-button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? 'Choose another .r3d' : 'Choose .r3d file'}
                </button>
              </div>

              <div className="inference-field-grid">
                <label className="inference-field inference-field-small">
                  <span>Trajectory length</span>
                  <input
                    type="number"
                    min="1"
                    value={trajLength}
                    onChange={(event) => setTrajLength(event.target.value)}
                  />
                </label>
                <label className="inference-field inference-field-small">
                  <span>Guidance mode</span>
                  <select
                    value={guidanceMode}
                    onChange={(event) => setGuidanceMode(event.target.value)}
                  >
                    {GUIDANCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="inference-actions">
                <button type="submit" className="primary-action" disabled={isSubmitting || jobInFlight}>
                  {isSubmitting ? 'Submitting...' : (jobInFlight ? 'Job running...' : 'Run inference')}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleUseDemoScene}
                  disabled={!demoSceneData || sceneMode === 'demo'}
                >
                  Use demo scene
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleLaunchVisualizer}
                  disabled={!job || job.status !== 'succeeded' || isLaunchingVisualizer}
                >
                  {isLaunchingVisualizer ? 'Launching...' : 'Launch visualizer'}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="inference-status">
          <div className="inference-status-row">
            <span className="inference-status-label">API</span>
            <code>{API_BASE_URL}</code>
          </div>
          <div className="inference-status-row">
            <span className="inference-status-label">Status</span>
            <span className={`job-status-pill ${job ? job.status : 'idle'}`}>
              {job ? job.status : 'idle'}
            </span>
          </div>
          <div className="inference-status-row">
            <span className="inference-status-label">Job</span>
            <span>{job?.job_id || '-'}</span>
          </div>
          <div className="inference-status-row">
            <span className="inference-status-label">Guidance</span>
            <span>{job?.guidance_mode || guidanceMode}</span>
          </div>
          <div className="inference-status-row">
            <span className="inference-status-label">Finished</span>
            <span>{formatTimestamp(job?.finished_at)}</span>
          </div>
          {job?.visualizer_url && (
            <a
              className="visualizer-link"
              href={job.visualizer_url}
              target="_blank"
              rel="noreferrer"
            >
              Open visualizer
            </a>
          )}
          {jobArtifacts.length > 0 && (
            <div className="artifact-links">
              {jobArtifacts.map((artifact) => (
                <a
                  key={artifact.path}
                  href={apiUrl(artifact.url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {artifact.path}
                </a>
              ))}
            </div>
          )}
          {jobError && <p className="job-error">{jobError}</p>}
        </div>
      </section>

      <div className="dashboard-body">
        <aside className="sidebar">
          <SidebarMonitor
            warnings={warnings}
            allWarnings={warnings}
            selectedWarning={selectedWarning}
            activeTab={showPlayback ? 'inference' : activeTab}
            titleOverride={showPlayback ? 'Inference Monitor' : undefined}
            emptyMessage={
              showPlayback
                ? 'Use the playback slider to inspect frames from the inferred scene.'
                : 'Select a warning on the timeline'
            }
          />
        </aside>

        <main className="main-content">
          {sceneLoading ? (
            <div className="camera-view camera-empty">
              {sceneMode === 'inference' ? 'Preparing inferred 3D scene...' : 'Loading 3D scene...'}
            </div>
          ) : sceneData ? (
            <CameraView3D
              warning={showPlayback ? null : selectedWarning}
              frameIndex={frameIndex}
              onFrameChange={setFrameIndex}
              meshData={sceneData ? sceneData.mesh : null}
              pointCloud={sceneData ? sceneData.point_cloud : null}
              cameraData={sceneData ? sceneData.camera : null}
              overlayMessage={overlayMessage}
            />
          ) : (
            <div className="camera-view camera-empty">
              {sceneError || 'No 3D scene is available.'}
            </div>
          )}

          {showPlayback ? (
            <PlaybackPanel
              frameIndex={frameIndex}
              totalFrames={totalFrames}
              onFrameChange={setFrameIndex}
            />
          ) : (
            <Timeline
              warnings={warnings}
              minTime={minTime}
              maxTime={maxTime}
              currentTime={currentTime}
              onTimeChange={setCurrentTime}
              onMarkerClick={handleMarkerClick}
              selectedWarning={selectedWarning}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
