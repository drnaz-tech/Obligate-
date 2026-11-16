const STORAGE_KEY = 'obligate.sfx';
const SOUND_EVENT = 'obligate:sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambientBus: GainNode | null = null;
let ambientSources: AudioScheduledSourceNode[] = [];
let clockTimer: number | null = null;
let ambientOn = false;
let ducked = false;
let lastClickAt = 0;
let initialised = false;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function ensureMaster(ac: AudioContext): GainNode {
  if (!master) {
    master = ac.createGain();
    master.gain.value = 0.9;
    master.connect(ac.destination);
  }
  return master;
}

export function sfxEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) !== 'off';
}

export function subscribeSound(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(SOUND_EVENT, cb);
  return () => window.removeEventListener(SOUND_EVENT, cb);
}

function announce(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SOUND_EVENT));
}

export function setSfxEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  if (enabled) startAmbient();
  else stopAmbient();
  announce();
}

/* ---------------------------------------------------------------- noise ---- */

function noiseBuffer(ac: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const length = Math.floor(ac.sampleRate * seconds);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

/* -------------------------------------------------------------- ambient ---- */

function tickClock(): void {
  const ac = ctx;
  if (!ac || !ambientBus || !ambientOn) return;
  const at = ac.currentTime + 0.01;
  const length = Math.floor(ac.sampleRate * 0.05);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 6);
  }
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2600;
  filter.Q.value = 3;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0.05, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  source.connect(filter).connect(amp).connect(ambientBus);
  source.start(at);
  source.stop(at + 0.07);
}

export function startAmbient(): void {
  if (!sfxEnabled()) return;
  const ac = audio();
  if (!ac || ambientOn) return;

  try {
    const out = ensureMaster(ac);
    ambientBus = ac.createGain();
    ambientBus.gain.value = 0;
    ambientBus.connect(out);

    const room = ac.createBufferSource();
    room.buffer = noiseBuffer(ac, 8, true);
    room.loop = true;
    const roomFilter = ac.createBiquadFilter();
    roomFilter.type = 'lowpass';
    roomFilter.frequency.value = 340;
    const roomGain = ac.createGain();
    roomGain.gain.value = 0.5;
    room.connect(roomFilter).connect(roomGain).connect(ambientBus);
    room.start();

    const rain = ac.createBufferSource();
    rain.buffer = noiseBuffer(ac, 6, false);
    rain.loop = true;
    const rainFilter = ac.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 2400;
    rainFilter.Q.value = 0.5;
    const rainGain = ac.createGain();
    rainGain.gain.value = 0.045;
    rain.connect(rainFilter).connect(rainGain).connect(ambientBus);
    rain.start();

    ambientSources = [room, rain];
    ambientOn = true;
    ambientBus.gain.setTargetAtTime(ducked ? 0.1 : 0.42, ac.currentTime, 1.4);
    clockTimer = window.setInterval(tickClock, 2400);
  } catch {
    ambientOn = false;
  }
}

export function stopAmbient(): void {
  const ac = ctx;
  if (clockTimer !== null) {
    window.clearInterval(clockTimer);
    clockTimer = null;
  }
  if (!ac || !ambientBus) {
    ambientOn = false;
    return;
  }
  const bus = ambientBus;
  const sources = ambientSources;
  ambientBus = null;
  ambientSources = [];
  ambientOn = false;
  try {
    bus.gain.setTargetAtTime(0, ac.currentTime, 0.4);
    window.setTimeout(() => {
      sources.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      });
      try {
        bus.disconnect();
      } catch {
        /* already disconnected */
      }
    }, 1600);
  } catch {
    /* context closed */
  }
}

/** Lower the room tone while a case is open so it never fights the chat. */
export function setAmbientDucked(value: boolean): void {
  ducked = value;
  const ac = ctx;
  if (!ac || !ambientBus) return;
  try {
    ambientBus.gain.setTargetAtTime(value ? 0.1 : 0.42, ac.currentTime, 0.8);
  } catch {
    /* context closed */
  }
}

/* ---------------------------------------------------------------- clicks --- */

export function playClick(): void {
  if (!sfxEnabled()) return;
  const ac = audio();
  if (!ac) return;
  const now = performance.now();
  if (now - lastClickAt < 45) return;
  lastClickAt = now;

  try {
    const at = ac.currentTime + 0.005;
    const out = ensureMaster(ac);

    const blip = ac.createOscillator();
    blip.type = 'sine';
    blip.frequency.setValueAtTime(880 + Math.random() * 120, at);
    blip.frequency.exponentialRampToValueAtTime(420, at + 0.05);
    const blipGain = ac.createGain();
    blipGain.gain.setValueAtTime(0.055, at);
    blipGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    blip.connect(blipGain).connect(out);
    blip.start(at);
    blip.stop(at + 0.08);

    const length = Math.floor(ac.sampleRate * 0.02);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
    }
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200;
    filter.Q.value = 1.2;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0.05, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
    source.connect(filter).connect(amp).connect(out);
    source.start(at);
    source.stop(at + 0.04);
  } catch {
    /* never let audio break the page */
  }
}

/* ------------------------------------------------------------- existing ---- */

function click(ac: AudioContext, at: number, gain: number): void {
  const length = Math.floor(ac.sampleRate * 0.035);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  const source = ac.createBufferSource();
  source.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1900 + Math.random() * 900;
  filter.Q.value = 1.1;

  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);

  source.connect(filter).connect(amp).connect(ac.destination);
  source.start(at);
  source.stop(at + 0.06);

  const thock = ac.createOscillator();
  thock.type = 'square';
  thock.frequency.setValueAtTime(150 + Math.random() * 40, at);
  const thockGain = ac.createGain();
  thockGain.gain.setValueAtTime(gain * 0.35, at);
  thockGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
  thock.connect(thockGain).connect(ac.destination);
  thock.start(at);
  thock.stop(at + 0.05);
}

export function playTypewriter(): void {
  if (!sfxEnabled()) return;
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + 0.02;
  let cursor = 0;
  for (let i = 0; i < 9; i += 1) {
    click(ac, start + cursor, 0.16 + Math.random() * 0.06);
    cursor += 0.055 + Math.random() * 0.045;
  }
}

export function playStamp(): void {
  if (!sfxEnabled()) return;
  const ac = audio();
  if (!ac) return;
  const at = ac.currentTime + 0.02;

  const body = ac.createOscillator();
  body.type = 'sine';
  body.frequency.setValueAtTime(180, at);
  body.frequency.exponentialRampToValueAtTime(58, at + 0.16);
  const bodyGain = ac.createGain();
  bodyGain.gain.setValueAtTime(0.5, at);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
  body.connect(bodyGain).connect(ac.destination);
  body.start(at);
  body.stop(at + 0.26);

  const length = Math.floor(ac.sampleRate * 0.09);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 5);
  }
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0.32, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
  source.connect(filter).connect(amp).connect(ac.destination);
  source.start(at);
  source.stop(at + 0.1);
}

export function playAccusation(): void {
  playTypewriter();
  window.setTimeout(playStamp, 640);
}

/* ------------------------------------------------------------------ init --- */

/**
 * Wires the global audio behaviour once: first-gesture start, delegated click
 * feedback, and pausing the room tone while the tab is hidden.
 */
export function initAudio(): void {
  if (typeof window === 'undefined' || initialised) return;
  initialised = true;

  const unlock = () => {
    if (sfxEnabled()) startAmbient();
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const control = target.closest(
        'button, a, [role="button"], summary, input[type="checkbox"], input[type="radio"], select',
      );
      if (!control) return;
      if (control.closest('[data-silent]')) return;
      playClick();
    },
    true,
  );

  document.addEventListener('visibilitychange', () => {
    const ac = ctx;
    if (!ac) return;
    if (document.hidden) {
      void ac.suspend().catch(() => undefined);
    } else if (sfxEnabled()) {
      void ac.resume().catch(() => undefined);
    }
  });
}
