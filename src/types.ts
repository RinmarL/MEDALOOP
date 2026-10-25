export type MedalType =
  | 'normal'
  | 'gold'
  | 'plasma'
  | 'bounce'
  | 'clone'
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
  splitCooldown?: number; // スプリットレーザー連続分裂防止クールダウン
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
}

export interface StopperBar {
  id: number;
  x1: number;
  x2: number;
  y: number;
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
}

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
  holdReloadUnlocked: boolean; // 長押し装填
  reloadInterval: number; // 長押し装填の間隔
  reloadBatchSize: number; // 1回の装填枚数
  basePinScore: number; // ピン基本得点（初期 0点！）
  basePocketScore: number; // ポケット基本得点
  globalScoreMultiplier: number; // 全体スコア倍率
  pinLayoutTier: number; // ピン増設段階 (0〜4)
  splitLaserCount: number; // スプリット・レーザー出現本数 (0: なし, 1: 1本, 2: 2本)
  catapultUnlocked: boolean; // サイバー・カタパルト（最上部ループ打ち上げ）有効化
  stopperCount: number; // 周期ストッパー数 (後方互換・0固定)
  stopperCooldown: number; // ストッパー再出現時間
  stopperWidthRatio: number; // ストッパー幅比率
  contactChargeRate: number; // メダル同士の接触による倍率上昇率/秒
  contactMaxMultiplier: number; // 接触倍率上限
  bonusPocketUnlocked: boolean; // +MEDALポケット有効化
  bonusMedalExtraChance: number; // +MEDALポケットで2枚出る確率
  extraStartMedals: number; // 初期5枚に加わる追加メダル数
  specialMedals: MedalType[]; // 初期5枚の内訳
  hexagramCompleted: boolean; // 全ノード解放ボーナス
  boostRingLevel: number; // ブーストオーブLv (0:未出現, 1:x2, 2:x3, 3:x4)
  cloneRingLevel: number; // クローンオーブLv (0:未出現, 1:+1枚, 2:分裂メダル1.5倍, 3:+2枚)
  slotMultiplier: number; // スロット倍率強化 (1:通常, 2:x2, 4:x4)
  jpShotsCount: number; // JP射出枚数（初期10枚、jp_count_1:15枚、jp_count_2:20枚、jp_count_3:25枚）
  jpNormalMedalRate: number; // JP時の通常メダル確率（初期0.70、jp_prob_1 Lv1:0.60, Lv2:0.50、jp_prob_2 Lv1:0.40, Lv2:0.30）
  jpFeverUnlocked: boolean; // JPフィーバー（5秒間全メダル得点2倍）
  jpFreezeUnlocked: boolean; // JPロングフリーズ（1%で4.4秒演出＆50枚一斉投下）
}
