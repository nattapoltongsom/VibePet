/**
 * Pure Web Audio API sound synthesizer — zero external MP3 dependencies.
 */
(() => {
  interface ToneConfig {
    freq: number;
    endFreq?: number | null;
    startTime: number;
    duration: number;
    volume?: number;
    type?: OscillatorType;
  }

  let audioCtx: AudioContext | null = null;

  function getContext(): AudioContext | null {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(
    ctx: AudioContext,
    { freq, endFreq = null, startTime, duration, volume = 0.08, type = 'sine' }: ToneConfig
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  function playStateSound(state: RendererPetState, muted: boolean): void {
    if (muted) return;
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.01;

    if (state === 'coding' || state === 'thinking') {
      const startFreq = state === 'thinking' ? 540 : 620;
      const endFreq = state === 'thinking' ? 600 : 700;
      playTone(ctx, { freq: startFreq, endFreq, startTime: now, duration: 0.095, volume: 0.06, type: 'sine' });
    } else if (state === 'waiting') {
      playTone(ctx, { freq: 880.0, startTime: now, duration: 0.24, volume: 0.11, type: 'sine' });
      playTone(ctx, { freq: 1760.0, startTime: now, duration: 0.16, volume: 0.025, type: 'sine' });
      playTone(ctx, { freq: 659.25, startTime: now + 0.18, duration: 0.36, volume: 0.11, type: 'sine' });
      playTone(ctx, { freq: 1318.5, startTime: now + 0.18, duration: 0.22, volume: 0.025, type: 'sine' });
    } else if (state === 'success') {
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const t = now + idx * 0.11;
        const dur = idx === 2 ? 0.34 : 0.18;
        playTone(ctx, { freq, startTime: t, duration: dur, volume: 0.095, type: 'triangle' });
        playTone(ctx, { freq: freq * 2, startTime: t, duration: dur * 0.7, volume: 0.02, type: 'sine' });
      });
    }
  }

  window.PetAudio = { playStateSound };
})();
