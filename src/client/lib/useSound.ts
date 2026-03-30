import { useRef, useCallback, useState } from 'react';

const MUTE_KEY = 'nerveshredder_muted';

export function useSound() {
  const soundsRef = useRef<Record<string, HTMLAudioElement>>({});
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === 'true');

  const getSound = useCallback((name: string) => {
    if (!soundsRef.current[name]) {
      soundsRef.current[name] = new Audio(`/${name}.mp3`);
    }
    return soundsRef.current[name];
  }, []);

  const playSound = useCallback(
    (name: string, volume = 1) => {
      if (localStorage.getItem(MUTE_KEY) === 'true') return;
      const audio = getSound(name);
      audio.currentTime = 0;
      audio.volume = volume;
      audio.play().catch((e) => console.warn('Audio play failed:', name, e));
    },
    [getSound],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStorage.setItem(MUTE_KEY, String(next));
      return next;
    });
  }, []);

  return { playSound, muted, toggleMute };
}
