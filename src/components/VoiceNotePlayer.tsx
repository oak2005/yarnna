import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface Props {
  url?: string | null;
  durationSeconds?: number | null;
}

export const VoiceNotePlayer: React.FC<Props> = ({ url, durationSeconds = 14 }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);

  const totalDuration = durationSeconds || 14;

  useEffect(() => {
    if (url) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setCurrentTime(Math.round(audioRef.current.currentTime));
        }
      };
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [url]);

  const togglePlay = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPlaying(false);
    } else {
      if (audioRef.current && url) {
        audioRef.current.play().catch(() => {
          // Fallback simulation timer if audio CORS or local blob
          simulatePlayback();
        });
      } else {
        simulatePlayback();
      }
      setIsPlaying(true);
    }
  };

  const simulatePlayback = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= totalDuration) {
          clearInterval(timerRef.current);
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  // Generate 24 static waveform heights for audio representation
  const barHeights = [
    8, 14, 22, 10, 18, 26, 12, 20, 28, 16, 24, 18,
    10, 22, 14, 26, 8, 20, 16, 24, 12, 18, 10, 6,
  ];

  const progressRatio = totalDuration > 0 ? currentTime / totalDuration : 0;
  const activeBarCount = Math.floor(progressRatio * barHeights.length);

  return (
    <div className="voice-note-player">
      <button
        onClick={togglePlay}
        className="play-pause-btn"
        aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div className="waveform-bar-box">
          {barHeights.map((h, idx) => {
            const isPlayed = idx <= activeBarCount;
            return (
              <div
                key={idx}
                className="waveform-bar"
                style={{
                  height: `${h}px`,
                  backgroundColor: isPlayed ? 'var(--primary)' : 'rgba(5, 96, 58, 0.25)',
                  transition: 'background-color 0.1s ease',
                }}
              />
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="waveform-duration">
            {formatSeconds(currentTime)} / {formatSeconds(totalDuration)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--text-light)', fontSize: '0.72rem' }}>
            <Volume2 size={12} />
            <span>Voice Note</span>
          </div>
        </div>
      </div>
    </div>
  );
};
