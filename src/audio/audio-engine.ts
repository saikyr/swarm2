const MAX_VOICES = 24;

export class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  sfxGain: GainNode;
  ambientGain: GainNode;
  private voiceCount = 0;
  private noiseBuffer: AudioBuffer;
  private unlocked = false;

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.masterGain);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.3;
    this.ambientGain.connect(this.masterGain);

    // Pre-generate 1s white noise buffer
    const sr = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, sr, sr);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < sr; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  suspend(): void {
    this.ctx.suspend();
  }

  resume(): void {
    if (this.unlocked) this.ctx.resume();
  }

  canPlay(): boolean {
    return this.unlocked && this.voiceCount < MAX_VOICES;
  }

  /** Register a voice that will last `duration` seconds */
  addVoice(duration: number): void {
    this.voiceCount++;
    setTimeout(() => { this.voiceCount--; }, duration * 1000);
  }

  /** Create a noise source node from the pre-generated buffer */
  createNoise(): AudioBufferSourceNode {
    const node = this.ctx.createBufferSource();
    node.buffer = this.noiseBuffer;
    node.loop = true;
    return node;
  }

  get now(): number {
    return this.ctx.currentTime;
  }
}
