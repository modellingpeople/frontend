import React, { useState, useMemo } from 'react';
import data from './data/placeholder.json';
import PersonSelector from './components/PersonSelector';
import ViewToggle from './components/ViewToggle';
import CameraView from './components/CameraView';
import Timeline from './components/Timeline';
import WarningDetail from './components/WarningDetail';

const { meta, warnings } = data;
const persons = [...new Set(warnings.map(w => w.person))].sort();
const timestamps = warnings.map(w => new Date(w.timestamp).getTime());
const minTime = Math.min(...timestamps);
const maxTime = Math.max(...timestamps);

function App() {
  const [selectedPerson, setSelectedPerson] = useState('All');
  const [viewMode, setViewMode] = useState('1st');
  const [currentTime, setCurrentTime] = useState(minTime);
  const [selectedWarning, setSelectedWarning] = useState(null);
  const [frameIndex, setFrameIndex] = useState(0);

  const filtered = useMemo(
    () => selectedPerson === 'All'
      ? warnings
      : warnings.filter(w => w.person === selectedPerson),
    [selectedPerson]
  );

  const handleMarkerClick = (warning) => {
    setSelectedWarning(warning);
    setCurrentTime(new Date(warning.timestamp).getTime());
    setFrameIndex(0);
  };

  return (
    <div className="app">
      <header className="toolbar">
        <PersonSelector
          persons={persons}
          selected={selectedPerson}
          onChange={setSelectedPerson}
        />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </header>

      <CameraView
        viewMode={viewMode}
        currentTime={currentTime}
        warning={selectedWarning}
        frameIndex={frameIndex}
        onFrameChange={setFrameIndex}
        meta={meta}
      />

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
