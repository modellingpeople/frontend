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
import VideoTrack from './components/VideoTrack';

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

function createVideoEntry(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement('video');

    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      resolve({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        url,
        durationSeconds: Number.isFinite(probe.duration) ? probe.duration : 0,
      });
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to read video metadata for ${file.name}.`));
    };
    probe.src = url;
  });
}

function PlaybackPanel({ frameIndex, totalFrames, onFrameChange }) {
  if (!totalFrames) {
    return (
      <>
        <div className="playback-header">
          <strong>Inference Playback</strong>
          <span>Waiting for frame data.</span>
        </div>
      </>
    );
  }

  return (
    <>
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
    </>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('safety');

  const [currentTime, setCurrentTime] = useState(0);
  const [selectedWarning, setSelectedWarning] = useState(null);
  const [frameIndex, setFrameIndex] = useState(0);


  const [warningSceneData, setWarningSceneData] = useState(null);
  const [warningSceneLoading, setWarningSceneLoading] = useState(false);
  const [warningSceneError, setWarningSceneError] = useState('');
  const warningSceneCacheRef = useRef({});

  const [aiAnalysis, setAiAnalysis] = useState("");
  
  const [inferenceSceneData, setInferenceSceneData] = useState(null);
  const [inferenceSceneLoading, setInferenceSceneLoading] = useState(false);
  const [sceneMode, setSceneMode] = useState('demo');

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [trajLength, setTrajLength] = useState('256');
  const [guidanceMode, setGuidanceMode] = useState('no_hands');
  const [isUploadPanelCollapsed, setIsUploadPanelCollapsed] = useState(false);
  const [job, setJob] = useState(null);
  const [jobArtifacts, setJobArtifacts] = useState([]);
  const [jobError, setJobError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLaunchingVisualizer, setIsLaunchingVisualizer] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);
  const [showEmbeddedVisualizer, setShowEmbeddedVisualizer] = useState(false);

  const pollTimerRef = useRef(null);
  const consecutivePollErrorsRef = useRef(0);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const uploadedVideosRef = useRef([]);

  const sceneData = sceneMode === 'inference' && inferenceSceneData
    ? inferenceSceneData
    : warningSceneData;
  const selectedVideo = useMemo(
    () => uploadedVideos.find((video) => video.id === selectedVideoId) || null,
    [uploadedVideos, selectedVideoId]
  );

  const { warnings, minTime, maxTime } = useMemo(
    () => {
      if (sceneMode === 'inference' && inferenceSceneData) {
        return getTabDerived({ warnings: inferenceSceneData.warnings || [] });
      }
      return getTabDerived(TAB_DATA[activeTab]);
    },
    [activeTab, inferenceSceneData, sceneMode]
  );
  const sceneLoading = sceneMode === 'inference' ? inferenceSceneLoading : warningSceneLoading;
  const sceneError = sceneMode === 'inference' ? jobError : warningSceneError;
  const showPlayback = sceneMode === 'inference' && warnings.length === 0;
  const totalFrames = sceneData?.mesh?.frames?.length || 0;
  const jobInFlight = Boolean(job && ['queued', 'running'].includes(job.status));

  useEffect(() => {
    setSelectedWarning(null);
    setFrameIndex(0);
    setCurrentTime(warnings.length > 0 ? minTime : 0);
  }, [activeTab, minTime, sceneMode, warnings.length]);

  const loadWarningScene = async (warning) => {
    const sceneFile = warning.sceneFile;
    if (!sceneFile) {
      setWarningSceneData(null);
      setWarningSceneError('No scene file for this warning.');
      return;
    }

    // Check cache
    if (warningSceneCacheRef.current[sceneFile]) {
      setWarningSceneData(warningSceneCacheRef.current[sceneFile]);
      setWarningSceneError('');
      return;
    }

    setWarningSceneLoading(true);
    setWarningSceneError('');
    try {
      const res = await fetch(`/data/${sceneFile}`);
      if (!res.ok) throw new Error('Scene not found');
      const data = await res.json();
      warningSceneCacheRef.current[sceneFile] = data;
      setWarningSceneData(data);
    } catch {
      setWarningSceneError('Failed to load 3D scene.');
      setWarningSceneData(null);
    } finally {
      setWarningSceneLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
      }
      uploadedVideosRef.current.forEach((video) => {
        URL.revokeObjectURL(video.url);
      });
    };
  }, []);

  useEffect(() => {
    uploadedVideosRef.current = uploadedVideos;
  }, [uploadedVideos]);

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
      let resolvedJob = payload;
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

      try {
        const visualizerPayload = await launchVisualizer(payload.job_id);
        if (!cancelled) {
          resolvedJob = visualizerPayload;
          setJob(visualizerPayload);
          if (visualizerPayload.visualizer_url) {
            setShowEmbeddedVisualizer(true);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setJobError((current) => current || error.message);
        }
      }

      if (!cancelled && resolvedJob.visualizer_url) {
        setShowEmbeddedVisualizer(true);
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
    setSelectedVideoId(null);
    setCurrentTime(new Date(warning.timestamp).getTime());
    setFrameIndex(0);

    setAiAnalysis(""); // Clear previous AI analysis when selecting a new warning
    loadWarningScene(warning);

  };

  const handleSelectVideo = (videoId) => {
    setSelectedVideoId(videoId);
    setSelectedWarning(null);
  };

  const handleVideoUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setJobError('');
    try {
      const nextVideos = await Promise.all(files.map(createVideoEntry));
      setUploadedVideos((current) => [...current, ...nextVideos]);
      setSelectedVideoId((current) => current || nextVideos[0]?.id || null);
    } catch (error) {
      setJobError(error.message);
    } finally {
      event.target.value = '';
    }
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
    setSceneMode('demo');
    setShowEmbeddedVisualizer(false);
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
      if (payload.visualizer_url) {
        setShowEmbeddedVisualizer(true);
      }
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

      <section className={`inference-console${isUploadPanelCollapsed ? ' collapsed' : ''}`}>
        <form className={`inference-form${isUploadPanelCollapsed ? ' collapsed' : ''}`} onSubmit={handleInferenceSubmit}>
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

          {isUploadPanelCollapsed ? null : (
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

              <div className="upload-card upload-card-secondary">
                <div className="upload-card-copy">
                  <span className="upload-card-label">Reference videos</span>
                  <strong>
                    {uploadedVideos.length > 0
                      ? `${uploadedVideos.length} video${uploadedVideos.length === 1 ? '' : 's'} selected`
                      : 'No videos uploaded yet'}
                  </strong>
                  <p>Upload multiple videos. They will appear as clickable clips inside the timeline panel.</p>
                  {uploadedVideos.length > 0 && (
                    <div className="video-upload-list">
                      {uploadedVideos.map((video) => (
                        <span
                          key={video.id}
                          className={`video-upload-pill${selectedVideoId === video.id ? ' selected' : ''}`}
                          onClick={() => handleSelectVideo(video.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleSelectVideo(video.id);
                            }
                          }}
                        >
                          {video.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  ref={videoInputRef}
                  className="hidden-file-input"
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={handleVideoUpload}
                />
                <button
                  type="button"
                  className="file-picker-button secondary-picker"
                  onClick={() => videoInputRef.current?.click()}
                >
                  Add videos
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
                  disabled={sceneMode === 'demo'}
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
            selectedVideo={selectedVideo}
            activeTab={showPlayback ? 'inference' : activeTab}
            aiAnalysis={aiAnalysis}
            titleOverride={showPlayback ? 'Inference Monitor' : undefined}
            emptyMessage={
              showPlayback
                ? 'Use the playback slider to inspect frames from the inferred scene.'
                : 'Select a warning on the timeline'
            }
          />
        </aside>

        <main className="main-content">
          {showEmbeddedVisualizer && job?.visualizer_url ? (
            <div className="camera-view camera-visualizer">
              <iframe
                title="Trajectory visualizer"
                src={job.visualizer_url}
                className="camera-visualizer-iframe"
                allow="autoplay; fullscreen"
              />
            </div>
          ) : sceneLoading ? (
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

              onAnalysisComplete={(text) => {
                console.log("AI TEXT", text);
                setAiAnalysis(text);
              }}
            />
          ) : (
            <div className="camera-view camera-empty">
              {sceneError || 'No 3D scene is available.'}
            </div>
          )}

          {showPlayback ? (
            <div className="timeline playback-panel">
              <PlaybackPanel
                frameIndex={frameIndex}
                totalFrames={totalFrames}
                onFrameChange={setFrameIndex}
              />
              {job?.visualizer_url && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowEmbeddedVisualizer((current) => !current)}
                >
                  {showEmbeddedVisualizer ? 'Show inferred scene' : 'Show embedded visualizer'}
                </button>
              )}
              <VideoTrack
                videos={uploadedVideos}
                selectedVideoId={selectedVideoId}
                onSelectVideo={handleSelectVideo}
              />
            </div>
          ) : (
            <Timeline
              warnings={warnings}
              minTime={minTime}
              maxTime={maxTime}
              currentTime={currentTime}
              onTimeChange={setCurrentTime}
              onMarkerClick={handleMarkerClick}
              selectedWarning={selectedWarning}
              videos={uploadedVideos}
              selectedVideoId={selectedVideoId}
              onSelectVideo={handleSelectVideo}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
