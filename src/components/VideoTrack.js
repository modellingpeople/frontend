import React from 'react';

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function VideoTrack({ videos, selectedVideoId, onSelectVideo }) {
  if (!videos || videos.length === 0) {
    return null;
  }

  return (
    <div className="timeline-video-section">
      <div className="timeline-video-header">
        <strong>Uploaded Videos</strong>
        <span>{videos.length} clip{videos.length === 1 ? '' : 's'}</span>
      </div>
      <div className="timeline-video-strip">
        {videos.map((video) => {
          const flexValue = Math.max(video.durationSeconds || 0, 1);
          return (
            <button
              key={video.id}
              type="button"
              className={`timeline-video-chip${selectedVideoId === video.id ? ' selected' : ''}`}
              style={{ flex: flexValue }}
              onClick={() => onSelectVideo(video.id)}
              title={`${video.name} (${formatDuration(video.durationSeconds)})`}
            >
              <span className="timeline-video-chip-name">{video.name}</span>
              <span className="timeline-video-chip-duration">{formatDuration(video.durationSeconds)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
