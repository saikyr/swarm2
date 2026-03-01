import type { AudioEngine } from './audio-engine';

type Dest = AudioNode;

function vary(freq: number): number {
  return freq * (0.95 + Math.random() * 0.1);
}

// ── Hit / Impact ──

export function hitProjectile(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.03;
  const noise = e.createNoise();
  const bp = e.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = vary(1500);
  bp.Q.value = 2;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(bp).connect(g).connect(dest);
  noise.start(t);
  noise.stop(t + dur);
  return dur;
}

export function hitSweep(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.06;
  // Noise layer
  const noise = e.createNoise();
  const lp = e.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 800;
  const gn = e.ctx.createGain();
  gn.gain.setValueAtTime(0.2, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(lp).connect(gn).connect(dest);
  noise.start(t);
  noise.stop(t + dur);
  // Sine thump
  const osc = e.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(vary(100), t);
  const go = e.ctx.createGain();
  go.gain.setValueAtTime(0.3, t);
  go.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  osc.connect(go).connect(dest);
  osc.start(t);
  osc.stop(t + dur);
  return dur;
}

export function hitNova(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.08;
  const noise = e.createNoise();
  const lp = e.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1000;
  const gn = e.ctx.createGain();
  gn.gain.setValueAtTime(0.2, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(lp).connect(gn).connect(dest);
  noise.start(t);
  noise.stop(t + dur);
  // Deep sine
  const osc = e.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(vary(60), t);
  const go = e.ctx.createGain();
  go.gain.setValueAtTime(0.35, t);
  go.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(go).connect(dest);
  osc.start(t);
  osc.stop(t + dur);
  return dur;
}

export function hitZone(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.02;
  const noise = e.createNoise();
  const bp = e.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = vary(1000);
  bp.Q.value = 3;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(bp).connect(g).connect(dest);
  noise.start(t);
  noise.stop(t + dur);
  return dur;
}

// ── Weapon Fire ──

export function fireProjectile(e: AudioEngine, dest: Dest, isCaster: boolean): number {
  const t = e.now;
  const dur = isCaster ? 0.1 : 0.08;
  if (isCaster) {
    // Shimmery sine
    const osc1 = e.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(vary(600), t);
    osc1.frequency.exponentialRampToValueAtTime(400, t + dur);
    const osc2 = e.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(vary(603), t);
    osc2.frequency.exponentialRampToValueAtTime(403, t + dur);
    const g = e.ctx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc1.connect(g).connect(dest);
    osc2.connect(g);
    osc1.start(t); osc1.stop(t + dur);
    osc2.start(t); osc2.stop(t + dur);
  } else {
    // Sawtooth blip
    const osc = e.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(vary(180), t);
    osc.frequency.exponentialRampToValueAtTime(120, t + dur);
    const lp = e.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    const g = e.ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(lp).connect(g).connect(dest);
    osc.start(t); osc.stop(t + dur);
  }
  return dur;
}

export function fireSpread(e: AudioEngine, dest: Dest, isCaster: boolean): number {
  const t = e.now;
  const dur = 0.12;
  // Base projectile layer
  fireProjectile(e, dest, isCaster);
  // Sub-bass thump
  const osc = e.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(vary(40), t);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(g).connect(dest);
  osc.start(t); osc.stop(t + dur);
  return dur;
}

export function fireSweep(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.08;
  // Noise whoosh
  const noise = e.createNoise();
  const bp = e.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(600, t);
  bp.frequency.exponentialRampToValueAtTime(200, t + dur);
  bp.Q.value = 1;
  const gn = e.ctx.createGain();
  gn.gain.setValueAtTime(0.2, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(bp).connect(gn).connect(dest);
  noise.start(t); noise.stop(t + dur);
  // Weight sine
  const osc = e.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(vary(150), t);
  osc.frequency.exponentialRampToValueAtTime(80, t + dur);
  const go = e.ctx.createGain();
  go.gain.setValueAtTime(0.2, t);
  go.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(go).connect(dest);
  osc.start(t); osc.stop(t + dur);
  return dur;
}

export function fireNova(e: AudioEngine, dest: Dest, isCaster: boolean): number {
  const t = e.now;
  const dur = 0.2;
  // Sub-boom
  const osc = e.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(vary(80), t);
  osc.frequency.exponentialRampToValueAtTime(40, t + dur);
  const go = e.ctx.createGain();
  go.gain.setValueAtTime(0.3, t);
  go.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(go).connect(dest);
  osc.start(t); osc.stop(t + dur);
  // Air rush noise
  const noise = e.createNoise();
  const hp = e.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2000;
  const gn = e.ctx.createGain();
  gn.gain.setValueAtTime(0.12, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  noise.connect(hp).connect(gn).connect(dest);
  noise.start(t); noise.stop(t + dur);
  // Caster: ascending shimmer
  if (isCaster) {
    const osc2 = e.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(vary(300), t);
    osc2.frequency.exponentialRampToValueAtTime(800, t + dur);
    const g2 = e.ctx.createGain();
    g2.gain.setValueAtTime(0.08, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc2.connect(g2).connect(dest);
    osc2.start(t); osc2.stop(t + dur);
  }
  return dur;
}

export function fireChain(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.05;
  // Electric zap
  const osc = e.ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(vary(2000), t);
  osc.frequency.exponentialRampToValueAtTime(4000, t + dur);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t); osc.stop(t + dur);
  // Noise crackle
  const noise = e.createNoise();
  const bp = e.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3000;
  bp.Q.value = 2;
  const gn = e.ctx.createGain();
  gn.gain.setValueAtTime(0.1, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  noise.connect(bp).connect(gn).connect(dest);
  noise.start(t); noise.stop(t + dur);
  return dur;
}

export function fireBoomerang(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.1;
  const osc = e.ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(vary(300), t);
  osc.frequency.linearRampToValueAtTime(330, t + dur);
  const lp = e.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;
  // Tremolo for spin
  const lfo = e.ctx.createOscillator();
  lfo.frequency.value = 20;
  const lfoGain = e.ctx.createGain();
  lfoGain.gain.value = 0.1;
  lfo.connect(lfoGain);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  lfoGain.connect(g.gain);
  osc.connect(lp).connect(g).connect(dest);
  osc.start(t); osc.stop(t + dur);
  lfo.start(t); lfo.stop(t + dur);
  return dur;
}

export function fireGroundZone(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.15;
  const noise = e.createNoise();
  const lp = e.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(lp).connect(g).connect(dest);
  noise.start(t); noise.stop(t + dur);
  return dur;
}

export function fireRunic(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.1;
  const osc = e.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(vary(800), t);
  osc.frequency.exponentialRampToValueAtTime(1200, t + dur);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t); osc.stop(t + dur);
  // Soft noise
  const noise = e.createNoise();
  const bp = e.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2000;
  bp.Q.value = 3;
  const gn = e.ctx.createGain();
  gn.gain.setValueAtTime(0.06, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(bp).connect(gn).connect(dest);
  noise.start(t); noise.stop(t + dur);
  return dur;
}

export function fireBeam(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.12;
  const osc = e.ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(vary(200), t);
  const lp = e.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1000;
  // LFO tremolo
  const lfo = e.ctx.createOscillator();
  lfo.frequency.value = 8;
  const lfoG = e.ctx.createGain();
  lfoG.gain.value = 0.08;
  lfo.connect(lfoG);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  lfoG.connect(g.gain);
  osc.connect(lp).connect(g).connect(dest);
  osc.start(t); osc.stop(t + dur);
  lfo.start(t); lfo.stop(t + dur);
  return dur;
}

export function fireSpiral(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.15;
  const osc = e.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(vary(400), t);
  // Pitch LFO for spinning feel
  const lfo = e.ctx.createOscillator();
  lfo.frequency.value = 3;
  const lfoG = e.ctx.createGain();
  lfoG.gain.value = 50;
  lfo.connect(lfoG).connect(osc.frequency);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t); osc.stop(t + dur);
  lfo.start(t); lfo.stop(t + dur);
  return dur;
}

// ── Enemy ──

export function enemyDeath(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.12;
  // Noise burst
  const noise = e.createNoise();
  const bp = e.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = vary(400);
  bp.Q.value = 1;
  const gn = e.ctx.createGain();
  gn.gain.setValueAtTime(0.15, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(bp).connect(gn).connect(dest);
  noise.start(t); noise.stop(t + dur);
  // Pitch drop sine
  const osc = e.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(vary(150), t);
  osc.frequency.exponentialRampToValueAtTime(60, t + dur);
  const go = e.ctx.createGain();
  go.gain.setValueAtTime(0.2, t);
  go.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(go).connect(dest);
  osc.start(t); osc.stop(t + dur);
  return dur;
}

export function eliteDeath(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.25;
  // Deep sine drop
  const osc = e.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(vary(80), t);
  osc.frequency.exponentialRampToValueAtTime(30, t + dur);
  const go = e.ctx.createGain();
  go.gain.setValueAtTime(0.4, t);
  go.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(go).connect(dest);
  osc.start(t); osc.stop(t + dur);
  // HP sparkle
  const noise = e.createNoise();
  const hp = e.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3000;
  const gn = e.ctx.createGain();
  gn.gain.setValueAtTime(0.12, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  noise.connect(hp).connect(gn).connect(dest);
  noise.start(t); noise.stop(t + dur);
  // Mid sustain
  const osc2 = e.ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(vary(200), t);
  const g2 = e.ctx.createGain();
  g2.gain.setValueAtTime(0.15, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc2.connect(g2).connect(dest);
  osc2.start(t); osc2.stop(t + dur);
  return dur;
}

// ── Player ──

export function dashSound(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.12;
  // Noise whoosh
  const noise = e.createNoise();
  const hp = e.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1000;
  const gn = e.ctx.createGain();
  gn.gain.setValueAtTime(0.18, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(hp).connect(gn).connect(dest);
  noise.start(t); noise.stop(t + dur);
  // Thrust sine
  const osc = e.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(vary(200), t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.08);
  const go = e.ctx.createGain();
  go.gain.setValueAtTime(0.2, t);
  go.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(go).connect(dest);
  osc.start(t); osc.stop(t + dur);
  return dur;
}

export function playerHit(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.1;
  // Low thump
  const osc = e.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(vary(100), t);
  const go = e.ctx.createGain();
  go.gain.setValueAtTime(0.35, t);
  go.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(go).connect(dest);
  osc.start(t); osc.stop(t + dur);
  // Distorted noise
  const noise = e.createNoise();
  const bp = e.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 500;
  bp.Q.value = 2;
  const gn = e.ctx.createGain();
  gn.gain.setValueAtTime(0.2, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  noise.connect(bp).connect(gn).connect(dest);
  noise.start(t); noise.stop(t + dur);
  return dur;
}

export function levelUp(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.24;
  const notes = [400, 600, 800];
  const noteLen = 0.08;
  for (let i = 0; i < notes.length; i++) {
    const start = t + i * 0.07;
    const osc = e.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = notes[i];
    const g = e.ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.2, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + noteLen);
    osc.connect(g).connect(dest);
    osc.start(start); osc.stop(start + noteLen);
  }
  return dur;
}

export function xpPickup(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.04;
  const osc = e.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(vary(1200), t);
  osc.frequency.exponentialRampToValueAtTime(1600, t + dur);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t); osc.stop(t + dur);
  return dur;
}

export function healthPickup(e: AudioEngine, dest: Dest): number {
  const t = e.now;
  const dur = 0.12;
  const notes = [400, 600];
  for (let i = 0; i < notes.length; i++) {
    const start = t + i * 0.06;
    const osc = e.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = notes[i];
    const g = e.ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.25, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.06);
    osc.connect(g).connect(dest);
    osc.start(start); osc.stop(start + 0.06);
  }
  return dur;
}

// ── Ambient Drone ──

export interface DroneState {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  osc3: OscillatorNode;
  filter: BiquadFilterNode;
  gain3: GainNode;
}

export function startDrone(e: AudioEngine): DroneState {
  const osc1 = e.ctx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.value = 55;
  const osc2 = e.ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = 55.5;
  const osc3 = e.ctx.createOscillator();
  osc3.type = 'triangle';
  osc3.frequency.value = 82.5;

  const filter = e.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;

  const mainGain = e.ctx.createGain();
  mainGain.gain.value = 0.08;
  const gain3 = e.ctx.createGain();
  gain3.gain.value = 0;

  osc1.connect(filter);
  osc2.connect(filter);
  osc3.connect(gain3).connect(filter);
  filter.connect(mainGain).connect(e.ambientGain);

  osc1.start();
  osc2.start();
  osc3.start();

  return { osc1, osc2, osc3, filter, gain3 };
}

export function updateDrone(drone: DroneState, wave: number): void {
  drone.filter.frequency.value = 200 + wave * 50;
  drone.gain3.gain.value = wave >= 3 ? Math.min((wave - 2) * 0.3, 1.0) : 0;
}

export function stopDrone(drone: DroneState): void {
  drone.osc1.stop();
  drone.osc2.stop();
  drone.osc3.stop();
}
