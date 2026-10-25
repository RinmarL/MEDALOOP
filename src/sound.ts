class SoundManager {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private lastClinkTime: number = 0;

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  public playDrop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(310, now + 0.06);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playMedalClink(intensity: number = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastClinkTime < 0.03) return;
    this.lastClinkTime = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 1350 + Math.random() * 400;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.18, now + 0.035);
    const vol = Math.min(0.08, 0.025 * intensity);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playPinHit(isBumper: boolean = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isBumper ? 'square' : 'sine';
    const freq = isBumper ? 880 + Math.random() * 200 : 660 + Math.random() * 160;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 0.08);
    gain.gain.setValueAtTime(isBumper ? 0.1 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playPocket(isBonusMedal: boolean = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = isBonusMedal ? [587.33, 880, 1174.66] : [523.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);
      gain.gain.setValueAtTime(0.11, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.13);
    });
  }

  public playPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720 + Math.random() * 120, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.055);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playReload(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.06);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playLaserSplit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // 切れ味鋭いSFレーザースプリット音（高周波パルス＋瞬時ピッチドロップ）
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(3600, now + 0.03);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.09);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playCatapultLaunch(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // 近未来サイバーワープSE（吸い込み転送＆高周波フェイザースイープ）
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(320, now);
    osc1.frequency.exponentialRampToValueAtTime(1480, now + 0.12);
    osc1.frequency.exponentialRampToValueAtTime(2200, now + 0.2);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(640, now);
    osc2.frequency.exponentialRampToValueAtTime(2960, now + 0.14);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.23);
    osc2.stop(now + 0.23);
  }

  public playUpgrade(isMilestone: boolean = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = isMilestone ? [440, 554.37, 659.25, 880] : [440, 659.25];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.055);
      gain.gain.setValueAtTime(0.14, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.19);
    });
  }

  public playJackpotLamp(lit: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (lit) {
      // 点灯：明るいピピッ！
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(880, now + 0.04);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else {
      // 消灯：少し低めのポコッ
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(370, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  }

  public playJackpotFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playJackpotShoot(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.07);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playFreezePutsun(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. レイヤー1: 重低音サブベース衝撃波（ドスッ…！と心臓に響く超低域）
    const oscSub = ctx.createOscillator();
    const gainSub = ctx.createGain();
    oscSub.type = 'triangle';
    oscSub.frequency.setValueAtTime(120, now);
    oscSub.frequency.exponentialRampToValueAtTime(26, now + 0.38);
    gainSub.gain.setValueAtTime(0.38, now);
    gainSub.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    oscSub.connect(gainSub);
    gainSub.connect(ctx.destination);
    oscSub.start(now);
    oscSub.stop(now + 0.45);

    // 2. レイヤー2: 電源断アタック放電クリック（バチンッ！という破裂過渡音）
    const oscClick = ctx.createOscillator();
    const gainClick = ctx.createGain();
    oscClick.type = 'sawtooth';
    oscClick.frequency.setValueAtTime(2800, now);
    oscClick.frequency.exponentialRampToValueAtTime(60, now + 0.05);
    gainClick.gain.setValueAtTime(0.32, now);
    gainClick.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    oscClick.connect(gainClick);
    gainClick.connect(ctx.destination);
    oscClick.start(now);
    oscClick.stop(now + 0.07);

    // 3. レイヤー3: CRTテレビ光収束ピチュンスイープ（中央へ光が吸い込まれる電子音）
    const oscSweep = ctx.createOscillator();
    const gainSweep = ctx.createGain();
    oscSweep.type = 'sine';
    oscSweep.frequency.setValueAtTime(3200, now);
    oscSweep.frequency.exponentialRampToValueAtTime(350, now + 0.22);
    gainSweep.gain.setValueAtTime(0.24, now);
    gainSweep.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    oscSweep.connect(gainSweep);
    gainSweep.connect(ctx.destination);
    oscSweep.start(now);
    oscSweep.stop(now + 0.25);
  }

  public playFreezePremium(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // 荘厳で上品なメジャー9thアルペジオ＆残響
    const chord = [523.25, 659.25, 783.99, 987.77, 1174.66, 1318.51, 1567.98, 2093.0];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.9);
    });
  }
}

export const sound = new SoundManager();
