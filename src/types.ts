export type MedalType =
  | 'normal'
  | 'gold'
  | 'plasma'
  | 'bounce'
  | 'rush'
  | 'chrono'
  | 'bonus';

export interface TrailPoint {
  x: number;
  y: number;
}

export interface MedalEntity {
  id: number;
  type: MedalType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number; // 21 px
  zone: 'board' | 'tray';
  chargeMultiplier: number;
  contactFlash: number;
  passedPocket: boolean;
  lastPinHitId: number;
  pinHitCooldown: number;
  contactCooldown?: number; // メダル同士接触倍率加算クールダウン
  splitCooldown?: number; // スプリットライン連続分裂防止クールダウン
  trail: TrailPoint[];
}

export interface PinEntity {
  id: number;
  x: number;
  y: number;
  radius: number;
  baseScore: number;
  kind: 'normal' | 'bumper';
  hitAnim: number;
  electrifiedTimer: number; // 帯電残り秒数（0なら通常、>0で帯電中）
}

export interface StopperBar {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  active: boolean;
  timer: number;
  activeDuration: number; // 3.0s
  cooldownDuration: number;
}

export interface SplitLaser {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
  timer: number;
  activeDuration: number; // 5.0s
  cooldownDuration: number; // 3.0s
  pulsePhase: number;
  splitCount: number; // 1回の出現期間中の通過分裂回数（最大3回で消滅）
}

export type SplitLine = SplitLaser;

export interface CyberCatapult {
  id: number;
  side: 'left' | 'right';
  x: number;
  y: number;
  radius: number;
  launchAnim: number; // 発射噴射アニメ (1.0 -> 0)
}

export interface PocketSlot {
  index: number;
  x1: number;
  x2: number;
  label: string;
  scoreMultiplier: number;
  spawnsBonusMedal: boolean;
  flashAnim: number;
  lit: boolean; // JACKPOT用ランプ点灯状態（トグル）
}

export interface LuckyRing {
  x: number;
  y: number;
  radius: number;
  kind: 'mult' | 'split';
  active: boolean;
  respawnTimer: number;
  respawnDuration: number;
  activeTimer: number;
  pulsePhase: number;
  lastSpotIndex: number;
}

export interface GuideRailSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GuideRail {
  id: number;
  side: 'left' | 'right';
  points: { x: number; y: number }[];
  segments: GuideRailSegment[];
  hitAnim: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  alpha: number;
  scale: number;
}

export interface PickupParticle {
  x: number;
  y: number;
  tx: number;
  ty: number;
  progress: number;
  type: MedalType;
}

export interface SlotInsertAnim {
  progress: number; // 0 -> 1 (上から下へスリットに吸い込まれるアニメーション)
  type: MedalType;
}

export interface LightningBolt {
  id: number;
  points: { x: number; y: number }[];
  life: number; // 1.0 -> 0 (寿命減衰)
  maxLife: number; // 0.12s
  color: string;
}

export interface WarpEffect {
  x: number;
  y: number;
  progress: number; // 0 -> 1
  maxR: number;
  color: string;
  kind: 'implosion' | 'explosion'; // implosion: 吸い込み消滅, explosion: 出現拡散
}

export interface SkillNodeDef {
  id: string;
  name: string;
  description: string;
  gx: number;
  gy: number;
  maxLevel: number;
  baseCost: number;
  costScale: number;
  neighbors: string[];
  category: 'core' | 'milestone' | 'stat' | 'medal';
  icon: string;
}

export interface ComputedStats {
  centerSlot4xUnlocked: boolean; // 起点ノード効果：中央スロットを4倍にする
  roundDuration: number; // 初期 20秒
  dropCooldown: number; // 初期 1.0秒
  holdDropUnlocked: boolean; // 長押し投下
  swipePickupUnlocked: boolean; // 下皿スワイプ/長押し回収
  pickupInterval: number; // 長押し回収の間隔
  pickupRadius: number; // 回収タップ判定半径
  pickupBatchSize: number; // 1回の回収枚数
  holdReloadUnlocked: boolean; // 長押し装填
  reloadInterval: number; // 長押し装填の間隔
  reloadBatchSize: number; // 1回の装填枚数
  basePinScore: number; // ピン基本得点（初期 0点！）
  basePocketScore: number; // ポケット基本得点
  globalScoreMultiplier: number; // 全体スコア倍率
  pinLayoutTier: number; // ピン増設段階 (0〜4)
  splitLaserCount: number; // スプリットライン出現本数 (0: なし, 1: 1本, 2: 2本)
  catapultUnlocked: boolean; // サイバー・カタパルト（最上部ループ打ち上げ）有効化
  stopperCount: number; // 周期ストッパー数 (後方互換・0固定)
  stopperCooldown: number; // ストッパー再出現時間
  stopperWidthRatio: number; // ストッパー幅比率
  contactChargeRate: number; // メダル同士の接触による倍率上昇率/秒 (後方互換)
  contactMaxMultiplier: number; // 接触倍率上限（初期x2.0、強化でx3.0→x6.0→x10.0）
  pinChargeGain: number; // ピン/バンパー接触時の倍率上昇量（初期0.1、強化で0.2→0.3→0.4）
  medalChargeGain: number; // メダル同士接触時の倍率上昇量（初期0.4、強化で0.4→0.6→0.8）
  bonusPocketUnlocked: boolean; // +MEDALポケット有効化
  bonusMedalExtraChance: number; // +MEDALポケットで2枚出る確率
  extraStartMedals: number; // 初期5枚に加わる追加メダル数
  specialMedals: MedalType[]; // 初期5枚の内訳
  hexagramCompleted: boolean; // 全ノード解放ボーナス
  boostRingLevel: number; // ブーストオーブLv (0:未出現, 1:x2, 2:x3, 3:x4)
  cloneRingLevel: number; // クローンオーブLv (0:未出現, 1:+1枚, 2:分裂メダル1.5倍, 3:+2枚)
  slotMultiplier: number; // スロット倍率強化 (1:通常, 2:x2, 4:x4)
  jpShotsCount: number; // JP射出枚数（初期10枚、jp_count_1:15枚、jp_count_2:20枚、jp_count_3:25枚）
  jpNormalMedalRate: number; // JP時の通常メダル確率（初期0.80、強化で0.70→0.60→0.50）
  jpFeverUnlocked: boolean; // JPフィーバー（5秒間全メダル得点2倍）
  jpFreezeUnlocked: boolean; // JPロングフリーズ（1%で4.4秒演出＆100枚一斉投下）
}
