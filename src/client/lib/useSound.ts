import { useRef, useCallback, useState, useEffect } from 'react';

const MUTE_KEY = 'nerveshredder_muted';
const SOUND_NAMES = ['start', 'tick', 'bust', 'bank', 'click'] as const;
type SoundName = (typeof SOUND_NAMES)[number];

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Partial<Record<SoundName, AudioBuffer>>>({});
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === 'true');

  useEffect(() => {
    const ac = new AudioContext();
    ctxRef.current = ac;

    for (const name of SOUND_NAMES) {
      fetch(`/${name}.mp3`)
        .then((res) => res.arrayBuffer())
        .then((buf) => ac.decodeAudioData(buf))
        .then((decoded) => {
          buffersRef.current[name] = decoded;
        })
        .catch((e) => console.warn('Audio preload failed:', name, e));
    }

    return () => {
      void ac.close();
      ctxRef.current = null;
    };
  }, []);

  const playSound = useCallback((name: string, volume = 1) => {
    if (localStorage.getItem(MUTE_KEY) === 'true') return;
    const ac = ctxRef.current;
    if (!ac) return;
    const buffer = buffersRef.current[name as SoundName];
    if (!buffer) return; // still decoding — fail silently

    const resume = ac.state === 'suspended' ? ac.resume() : Promise.resolve();
    resume
      .then(() => {
        const source = ac.createBufferSource();
        source.buffer = buffer;
        if (volume !== 1) {
          const gain = ac.createGain();
          gain.gain.value = volume;
          source.connect(gain);
          gain.connect(ac.destination);
        } else {
          source.connect(ac.destination);
        }
        source.start(0);
      })
      .catch((e) => console.warn('Audio play failed:', name, e));
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStorage.setItem(MUTE_KEY, String(next));
      return next;
    });
  }, []);

  return { playSound, muted, toggleMute };
}
