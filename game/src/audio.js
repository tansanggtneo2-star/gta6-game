// Sound, synthesized live with WebAudio: no audio files, no network. Every
// effect is a short oscillator or noise burst; the siren and the engine hum run
// as quiet loops while the player is chased or driving. All calls are safe
// before the player has pressed anything (the context starts on first input).

export function createAudio() {
  let context = null;
  let master = null;
  let sirenNodes = null;
  let engineNodes = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, dur, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), context.currentTime + dur);
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + dur + 0.02);
    } catch { /* sound is decoration; a failure never stops the game */ }
  }

  function noise(dur, volume, lowpass) {
    if (!ensure() || muted) return;
    try {
      const length = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch { /* ignore */ }
  }

  function startSiren() {
    if (!ensure() || muted || sirenNodes) return;
    try {
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 700;
      const lfo = context.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 1.4;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const gain = context.createGain();
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo, gain };
    } catch { /* ignore */ }
  }

  function stopSiren() {
    if (!sirenNodes) return;
    try {
      sirenNodes.osc.stop();
      sirenNodes.lfo.stop();
    } catch { /* ignore */ }
    sirenNodes = null;
  }

  function setEngine(speedRatio) {
    if (!ensure()) return;
    if (speedRatio <= 0.02) {
      if (engineNodes) {
        try { engineNodes.osc.stop(); } catch { /* ignore */ }
        engineNodes = null;
      }
      return;
    }
    try {
      if (!engineNodes) {
        const osc = context.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 60;
        const gain = context.createGain();
        gain.gain.value = 0.035;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        osc.start();
        engineNodes = { osc, gain };
      }
      engineNodes.osc.frequency.setTargetAtTime(55 + speedRatio * 130, context.currentTime, 0.08);
    } catch { /* ignore */ }
  }

  return {
    unlock,
    shoot() { noise(0.12, 0.5, 2600); tone(180, 0.08, 'square', 0.18, 60); },
    punch() { noise(0.08, 0.35, 700); },
    crash() { noise(0.25, 0.5, 500); },
    pickup() { tone(660, 0.09, 'sine', 0.22); tone(990, 0.14, 'sine', 0.2); },
    coin() { tone(880, 0.07, 'triangle', 0.2); tone(1320, 0.12, 'triangle', 0.18); },
    steal() { tone(220, 0.12, 'square', 0.16, 440); },
    busted() { tone(392, 0.25, 'sawtooth', 0.2, 196); tone(196, 0.5, 'sawtooth', 0.2, 98); },
    missionDone() {
      tone(523, 0.12, 'triangle', 0.25);
      setTimeout(() => tone(659, 0.12, 'triangle', 0.25), 120);
      setTimeout(() => tone(784, 0.22, 'triangle', 0.28), 240);
    },
    missionStart() { tone(440, 0.12, 'triangle', 0.2); tone(554, 0.18, 'triangle', 0.2); },
    click() { tone(700, 0.05, 'square', 0.12); },
    startSiren,
    stopSiren,
    setEngine,
    toggleMute() {
      muted = !muted;
      if (muted) { stopSiren(); setEngine(0); }
      return muted;
    },
  };
}
