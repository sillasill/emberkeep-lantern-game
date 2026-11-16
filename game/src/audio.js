// Sound only, no game rules: every effect is a short WebAudio synth voice,
// and the ambience is a quiet two-oscillator drone. Nothing here throws when
// there is no audio device (headless screenshots): the context is created
// lazily on the first user gesture, and every call is guarded.
export function createAudio() {
  let context = null;
  let master = null;
  let drone = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch { /* sound is decoration, never fatal */ }
  }

  function noise(dur, vol, low) {
    if (!context || muted) return;
    try {
      const len = Math.floor(context.sampleRate * dur);
      const buffer = context.createBuffer(1, len, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = context.createBufferSource();
      src.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = low || 1200;
      const gain = context.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch { /* ignore */ }
  }

  return {
    /** Call from a user gesture; resumes the context browsers suspended. */
    unlock() {
      if (!ensure()) return;
      if (context.state === 'suspended') context.resume().catch(() => {});
      if (!drone) {
        try {
          drone = context.createGain();
          drone.gain.value = 0.05;
          drone.connect(master);
          for (const freq of [55, 82.4]) {
            const osc = context.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.connect(drone);
            osc.start();
          }
        } catch { /* ignore */ }
      }
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() { return muted; },
    shoot() { tone(720, 0.09, 'square', 0.12, 320); },
    hit() { noise(0.07, 0.18, 900); },
    kill() { tone(220, 0.18, 'triangle', 0.2, 60); noise(0.12, 0.12, 700); },
    pickup() { tone(880, 0.07, 'sine', 0.16); setTimeout(() => tone(1320, 0.09, 'sine', 0.14), 60); },
    hurt() { tone(140, 0.25, 'sawtooth', 0.25, 60); },
    dash() { noise(0.14, 0.14, 2400); },
    waveClear() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.18), i * 90)); },
    boss() { tone(65, 0.7, 'sawtooth', 0.3, 40); noise(0.5, 0.2, 300); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.2), i * 120)); },
    over() { [392, 311, 233].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.18), i * 160)); },
    click() { tone(600, 0.05, 'sine', 0.12); },
  };
}
