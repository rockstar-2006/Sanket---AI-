import { useState, useEffect } from 'react';

export function useMeetingTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = () => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const pad = (num: number) => String(num).padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  return {
    seconds,
    formattedTime: formatTime(),
    pauseTimer: () => setIsActive(false),
    resetTimer: () => setSeconds(0),
  };
}
