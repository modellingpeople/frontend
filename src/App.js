import React, { useState, useMemo, useEffect } from 'react';
import safetyData from './data/placeholder.json';
import TabBar from './components/TabBar';
import PersonSelector from './components/PersonSelector';
import ViewToggle from './components/ViewToggle';
import CameraView3D from './components/CameraView3D';
import Timeline from './components/Timeline';
import WarningDetail from './components/WarningDetail';

const TAB_DATA = {
  safety: safetyData,
  elder_care: null,
  rehab_fitness: null,
};

// Lazy-load tab data
try { TAB_DATA.elder_care = require('./data/elder_care.json'); } catch (e) {}
try { TAB_DATA.rehab_fitness = require('./data/rehab_fitness.json'); } catch (e) {}

function getTabDerived(data) {
  if (!data) return { meta: { joint_names: [], bones: [] }, warnings: [], persons: [], minTime: 0, maxTime: 0 };
  const { meta, warnings } = data;
  const persons = [...new Set(warnings.map(w => w.person))].sort();
  const timestamps = warnings.map(w => new Date(w.timestamp).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  return { meta, warnings, persons, minTime, maxTime };
}

function App() {
  const [activeTab, setActiveTab] = useState('safety');
  const [selectedPerson, setSelectedPerson] = useState('All');
  const [viewMode, setViewMode] = useState('1st');
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedWarning, setSelectedWarning] = useState(null);
  const [frameIndex, setFrameIndex] = useState(0);

  // 3D scene data (only for safety tab)
  const [sceneData, setSceneData] = useState(null);
  const [sceneLoading, setSceneLoading] = useState(true);

  const { meta, warnings, persons, minTime, maxTime } = useMemo(
    () => getTabDerived(TAB_DATA[activeTab]),
    [activeTab]
  );

  // Reset per-tab state on tab switch
  useEffect(() => {
    setSelectedPerson('All');
    setSelectedWarning(null);
    setFrameIndex(0);
    setCurrentTime(minTime);
  }, [activeTab, minTime]);

  // Load 3D data from public/data/scene3d.json
  useEffect(() => {
    fetch('/data/scene3d.json')
      .then(res => {
        if (!res.ok) throw new Error('No 3D data available');
        return res.json();
      })
      .then(data => {
        setSceneData(data);
        setSceneLoading(false);
      })
      .catch(() => {
        setSceneLoading(false);
      });
  }, []);

  const filtered = useMemo(
    () => selectedPerson === 'All'
      ? warnings
      : warnings.filter(w => w.person === selectedPerson),
    [selectedPerson, warnings]
  );

  const handleMarkerClick = (warning) => {
    setSelectedWarning(warning);
    setCurrentTime(new Date(warning.timestamp).getTime());
    setFrameIndex(0);
  };

  const has3D = activeTab === 'safety' && sceneData && sceneData.mesh && sceneData.mesh.frames.length > 0;

  return (
    <div className="app">
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <header className="toolbar">
        <PersonSelector
          persons={persons}
          selected={selectedPerson}
          onChange={setSelectedPerson}
        />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </header>

      {activeTab === 'safety' && sceneLoading ? (
        <div className="camera-view" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#555', fontStyle: 'italic',
        }}>
          Loading 3D scene...
        </div>
      ) : has3D ? (
        <CameraView3D
          viewMode={viewMode}
          warning={selectedWarning}
          frameIndex={frameIndex}
          onFrameChange={setFrameIndex}
          meshData={sceneData.mesh}
          pointCloud={sceneData.point_cloud}
          cameraData={sceneData.camera}
        />
      ) : (
        <CameraView
          viewMode={viewMode}
          currentTime={currentTime}
          warning={selectedWarning}
          frameIndex={frameIndex}
          onFrameChange={setFrameIndex}
          meta={meta}
        />
      )}

      <Timeline
        warnings={filtered}
        minTime={minTime}
        maxTime={maxTime}
        currentTime={currentTime}
        onTimeChange={setCurrentTime}
        onMarkerClick={handleMarkerClick}
        selectedWarning={selectedWarning}
      />

      <WarningDetail warning={selectedWarning} />
    </div>
  );
}

export default App;
