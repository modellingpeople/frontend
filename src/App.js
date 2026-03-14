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

function App() {
  const [activeTab, setActiveTab] = useState('safety');
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedWarning, setSelectedWarning] = useState(null);
  const [frameIndex, setFrameIndex] = useState(0);

  // --- AI ANALYSIS STATE ---
  const [aiAnalysis, setAiAnalysis] = useState("");

  const [demoSceneData, setDemoSceneData] = useState(null);
  const [demoSceneLoading, setDemoSceneLoading] = useState(true);
  const [demoSceneError, setDemoSceneError] = useState('');

  const [inferenceSceneData, setInferenceSceneData] = useState(null);
  const [inferenceSceneLoading, setInferenceSceneLoading] = useState(false);
  const [sceneMode, setSceneMode] = useState('demo');

  const [selectedFile, setSelectedFile] = useState(null);
  const [job, setJob] = useState(null);
  const [jobError, setJobError] = useState('');
  const [activeJobId, setActiveJobId] = useState(null);

  const sceneData = sceneMode === 'inference' && inferenceSceneData
    ? inferenceSceneData
    : demoSceneData;

  const { warnings, minTime, maxTime } = useMemo(() => {
    if (sceneMode === 'inference' && inferenceSceneData) {
      return getTabDerived({ warnings: inferenceSceneData.warnings || [] });
    }
    return getTabDerived(TAB_DATA[activeTab]);
  }, [activeTab, inferenceSceneData, sceneMode]);

  const sceneLoading = sceneMode === 'inference' ? inferenceSceneLoading : demoSceneLoading;
  const sceneError = sceneMode === 'inference' ? jobError : demoSceneError;
  const showPlayback = sceneMode === 'inference' && warnings.length === 0;
  const totalFrames = sceneData?.mesh?.frames?.length || 0;

  // --- FIX: UPDATED RESET EFFECT ---
  // We only reset selection and frame index when switching tabs/modes.
  // We do NOT reset aiAnalysis here because background data updates 
  // might trigger this effect and wipe your Gemini result.
  useEffect(() => {
    setSelectedWarning(null);
    setFrameIndex(0);
    setCurrentTime(warnings.length > 0 ? minTime : 0);
  }, [activeTab, sceneMode]); 

  // Load Demo Data
  useEffect(() => {
    fetch('/data/scene3d.json')
      .then(res => res.json())
      .then(data => {
        setDemoSceneData(data);
        setDemoSceneLoading(false);
      })
      .catch(() => {
        setDemoSceneError('No demo 3D scene available.');
        setDemoSceneLoading(false);
      });
  }, []);

  // Handlers
  const handleMarkerClick = (warning) => {
    setSelectedWarning(warning);
    setCurrentTime(new Date(warning.timestamp).getTime());
    setFrameIndex(0);
    // AI text is cleared ONLY when a new marker is selected
    setAiAnalysis(""); 
  };

  const overlayMessage = showPlayback
    ? 'Use the playback slider below to inspect results.'
    : (!selectedWarning ? 'Select a warning to view 3D pose' : null);

  return (
    <div className="app">
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="dashboard-body">
        <aside className="sidebar">
          <SidebarMonitor
            warnings={warnings}
            allWarnings={warnings}
            selectedWarning={selectedWarning}
            activeTab={showPlayback ? 'inference' : activeTab}
            aiAnalysis={aiAnalysis} // DATA GOING DOWN
            emptyMessage={
              showPlayback
                ? 'Use the playback slider to inspect frames.'
                : 'Select a warning on the timeline'
            }
          />
        </aside>

        <main className="main-content">
          {sceneLoading ? (
            <div className="camera-view camera-empty">Loading 3D scene...</div>
          ) : sceneData ? (
            <CameraView3D
              warning={showPlayback ? null : selectedWarning}
              frameIndex={frameIndex}
              onFrameChange={setFrameIndex}
              meshData={sceneData.mesh}
              pointCloud={sceneData.point_cloud}
              cameraData={sceneData.camera}
              overlayMessage={overlayMessage}
              // DATA COMING UP
              onAnalysisComplete={(text) => {
                console.log("App received AI text:", text);
                setAiAnalysis(text);
              }}
            />
          ) : (
            <div className="camera-view camera-empty">
              {sceneError || 'No 3D scene is available.'}
            </div>
          )}

          {!showPlayback && (
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