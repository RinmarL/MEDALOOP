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

  public playUpgrade(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // 全ノード統一：透明感のあるクリスタル・アルペジオ（C5 -> E5 -> G5 -> C6）
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.045);
      gain.gain.setValueAtTime(0.12, now + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.17);
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

  // 1.0s時点の不穏な砂嵐・走査線クラックルノイズ（ザザッ…）
  public playFreezeGlitchNoise(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = 0.38;

    // ホワイトノイズ生成
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // 間欠的なザザッ…というクラックル感を出す
      const env = (i / bufferSize) > 0.4 ? 1.0 : (i % 800 < 400 ? 0.8 : 0.1);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.linearRampToValueAtTime(1200, now + dur);
    filter.Q.setValueAtTime(3.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.1);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + dur + 0.05);
  }

  // 強烈なリアル「プチュン」音（バシィィン！放電アタック ＋ 超重低音地鳴り ＋ ピチュゥゥン収束）
  public playFreezePutsun(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. レイヤー1: 超重低音サブベース衝撃波（ドスッ…！と心臓を震わせる超低域）
    const oscSub = ctx.createOscillator();
    const gainSub = ctx.createGain();
    oscSub.type = 'triangle';
    oscSub.frequency.setValueAtTime(100, now);
    oscSub.frequency.exponentialRampToValueAtTime(20, now + 0.45);
    gainSub.gain.setValueAtTime(0.65, now);
    gainSub.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
    oscSub.connect(gainSub);
    gainSub.connect(ctx.destination);
    oscSub.start(now);
    oscSub.stop(now + 0.55);

    // 2. レイヤー2: 電源断アタック放電クリック（バシィッ！！という破裂過渡音）
    const oscClick = ctx.createOscillator();
    const gainClick = ctx.createGain();
    oscClick.type = 'sawtooth';
    oscClick.frequency.setValueAtTime(3600, now);
    oscClick.frequency.exponentialRampToValueAtTime(45, now + 0.07);
    gainClick.gain.setValueAtTime(0.58, now);
    gainClick.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
    oscClick.connect(gainClick);
    gainClick.connect(ctx.destination);
    oscClick.start(now);
    oscClick.stop(now + 0.09);

    // 3. レイヤー3: CRTテレビ光収束ピチュンスイープ（中央へ光が吸い込まれる電子音）
    const oscSweep = ctx.createOscillator();
    const gainSweep = ctx.createGain();
    oscSweep.type = 'sine';
    oscSweep.frequency.setValueAtTime(4200, now);
    oscSweep.frequency.exponentialRampToValueAtTime(280, now + 0.32);
    gainSweep.gain.setValueAtTime(0.42, now);
    gainSweep.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    oscSweep.connect(gainSweep);
    gainSweep.connect(ctx.destination);
    oscSweep.start(now);
    oscSweep.stop(now + 0.36);

    // 4. レイヤー4: 高電圧放電ノイズスプレー（チリチリ…という真空管放電感）
    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
    const nData = noiseBuf.getChannelData(0);
    for (let i = 0; i < nData.length; i++) {
      nData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    noiseSource.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(now);
  }

  // プレミアムJP文字出現時の重厚インパクト衝撃音 ＆ 壮大ロングファンファーレ（約2.5秒）
  public playFreezeCrash(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. 低域衝撃音（ドォォン！）
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.45);
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.52);

    // 2. 金属クラッシュ過渡音
    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.18), ctx.sampleRate);
    const nData = noiseBuf.getChannelData(0);
    for (let i = 0; i < nData.length; i++) {
      nData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const nSource = ctx.createBufferSource();
    nSource.buffer = noiseBuf;
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'highpass';
    nFilter.frequency.setValueAtTime(2800, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.35, now);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    nSource.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(ctx.destination);
    nSource.start(now);

    // 3. 荘厳で特別感のあるロングファンファーレ（約2.5秒）
    this.playFreezePremium();
  }

  public playFreezePremium(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // ヘルパー：ブラス音（金管楽器のような力強い和音）
    const playBrassNote = (freq: number, startT: number, dur: number, vol: number) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, startT);
      osc2.frequency.setValueAtTime(freq * 1.003, startT); // わずかなデチューンで厚み

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 3.5, startT);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.5, startT + dur);

      gain.gain.setValueAtTime(0.001, startT);
      gain.gain.linearRampToValueAtTime(vol, startT + 0.04);
      gain.gain.setValueAtTime(vol * 0.85, startT + dur * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, startT + dur);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(startT);
      osc2.start(startT);
      osc1.stop(startT + dur + 0.05);
      osc2.stop(startT + dur + 0.05);
    };

    // ヘルパー：クリスタルベル・チャイム（キラキラした高音）
    const playBell = (freq: number, startT: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startT);
      gain.gain.setValueAtTime(vol, startT);
      gain.gain.exponentialRampToValueAtTime(0.0001, startT + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startT);
      osc.stop(startT + 0.65);
    };

    // --- 進行構成（全2.5秒） ---
    // 1音目: Cmaj (0.0s〜0.45s) - PREMIUM激突！
    const c1 = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5
    c1.forEach((f) => playBrassNote(f, now, 0.42, 0.1));

    // 2音目: Fmaj (0.45s〜0.9s) - エネルギー集結！
    const c2 = [349.23, 440.0, 523.25, 698.46]; // F4, A4, C5, F5
    c2.forEach((f) => playBrassNote(f, now + 0.45, 0.42, 0.11));

    // 3音目: Gmaj (0.9s〜1.35s) - JACKPOT激突！！（2回目の低音インパクト付き）
    const c3 = [392.0, 493.88, 587.33, 783.99]; // G4, B4, D5, G5
    c3.forEach((f) => playBrassNote(f, now + 0.9, 0.42, 0.12));

    // 3音目 JACKPOT激突の低音サブベース（ズドォォン！）
    const oscJp = ctx.createOscillator();
    const gainJp = ctx.createGain();
    oscJp.type = 'triangle';
    oscJp.frequency.setValueAtTime(140, now + 0.9);
    oscJp.frequency.exponentialRampToValueAtTime(24, now + 1.3);
    gainJp.gain.setValueAtTime(0.58, now + 0.9);
    gainJp.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
    oscJp.connect(gainJp);
    gainJp.connect(ctx.destination);
    oscJp.start(now + 0.9);
    oscJp.stop(now + 1.38);

    // 4音目: 祝祭大団円 完全協和ピュアCmaj（1.35s〜2.6s: 不協和音完全ゼロ・極上の澄み切ったロングサステイン）
    // 不快な半音衝突（B音とC音）を排除し、C, E, G の倍音・オクターブのみで美しく調和
    const c4 = [261.63, 392.0, 523.25, 659.25, 783.99, 1046.5, 1318.51]; // C4, G4, C5, E5, G5, C6, E6
    c4.forEach((f) => playBrassNote(f, now + 1.35, 1.3, 0.11));

    // 低音ベース進行（C2 -> F2 -> G2 -> C3）
    const bass = [
      { f: 65.41, t: 0.0, d: 0.44 },
      { f: 87.31, t: 0.45, d: 0.44 },
      { f: 98.0, t: 0.9, d: 0.44 },
      { f: 130.81, t: 1.35, d: 1.25 },
    ];
    bass.forEach((b) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(b.f, now + b.t);
      gain.gain.setValueAtTime(0.22, now + b.t);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + b.t + b.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + b.t);
      osc.stop(now + b.t + b.d + 0.05);
    });

    // 高音クリスタルベル・グリッサンド（キラキラと祝福する星屑チャイム）
    const bells = [
      { f: 1046.5, dt: 0.2 },
      { f: 1174.66, dt: 0.35 },
      { f: 1318.51, dt: 0.5 },
      { f: 1567.98, dt: 0.68 },
      { f: 1760.0, dt: 0.85 },
      { f: 1975.53, dt: 1.05 },
      { f: 2093.0, dt: 1.35 },
      { f: 2637.02, dt: 1.45 },
      { f: 3135.96, dt: 1.55 },
    ];
    bells.forEach((b) => playBell(b.f, now + b.dt, 0.08));
  }

  public playElectricSpark(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // バチバチッという電撃アーク（鋸歯状波の高速周波数ホップ＋短音ノイズ）
    const sparkCount = 4;
    for (let i = 0; i < sparkCount; i++) {
      const t = now + i * 0.032 + Math.random() * 0.01;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const freq = 1200 + Math.random() * 2200;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(160, t + 0.038);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.038);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.04);
    }
  }

  public playTimeTick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 時計の針のカチッというウッドブロック風ギア音＋クリスタルレゾナンス
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1760, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);

    // 神秘的な高音ハーモニクス
    const oscHarm = ctx.createOscillator();
    const gainHarm = ctx.createGain();
    oscHarm.type = 'sine';
    oscHarm.frequency.setValueAtTime(3520, now + 0.02);
    gainHarm.gain.setValueAtTime(0.12, now + 0.02);
    gainHarm.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    oscHarm.connect(gainHarm);
    gainHarm.connect(ctx.destination);
    oscHarm.start(now + 0.02);
    oscHarm.stop(now + 0.38);
  }
}

export const sound = new SoundManager();
