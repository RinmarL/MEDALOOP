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
  warpCooldown?: number; // ワープ直後の連続再突入防止クールダウン
  warpTrailTimer?: number; // ワープ射出直後のネオントレイル強調タイマー
  prismCooldown?: number; // プリズム連続ヒット防止クールダウン
  boardElapsedSec: number; // 盤面投入後の経過秒数（ケンタウルス高速入賞判定用）
  pinBounceCount: number; // ピン・バンパー新規衝突回数（ペガサス加算用）
  stuckSec: number; // 盤面同一箇所での滞留累積秒数（スタック脱出安全弁用）
  anchorX: number; // 滞留判定アンカーX座標
  anchorY: number; // 滞留判定アンカーY座標
  unstickCount: number; // 同一メダルでの滞留脱出発動回数
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
  exitX: number;
  exitY: number;
  radius: number;
  launchAnim: number; // 発射噴射アニメ (1.0 -> 0)
}

export interface PrismTarget {
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  active: boolean;
  respawnTimer: number;
  rotAngle: number;
  hitAnim: number;
  lastSpotIndex: number;
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
  tx?: number; // arc終点X（ワープ先ゲートX）
  ty?: number; // arc終点Y（ワープ先ゲートY）
  progress: number; // 0 -> 1
  maxR: number;
  color: string;
  kind: 'implosion' | 'explosion' | 'arc'; // implosion: 吸い込み消滅, explosion: 出現拡散, arc: 入口→出口ワープビーム
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

export type RuneId =
  | 'comet'
  | 'solar'
  | 'twinkle'
  | 'sagittarius'
  | 'draco'
  | 'gemini'
  | 'pegasus'
  | 'fortuna'
  | 'centaurus'
  | 'altair';

export interface RuneDef {
  id: RuneId;
  name: string;
  icon: string;
  tier: 'initial' | 'intermediate' | 'advanced';
  description: string;
  detail: string;
}

export const RUNE_DEFINITIONS: RuneDef[] = [
  {
    id: 'comet',
    name: 'コメット',
    icon: '☄️',
    tier: 'initial',
    description: '反発係数 -15% ＆ 落下速度 +15%',
    detail: '通常メダルの反発を抑えつつ落下速度を上げ、テンポ良く素早く落とす刻印！',
  },
  {
    id: 'solar',
    name: 'ソーラー',
    icon: '☀️',
    tier: 'initial',
    description: '中央ポケット入賞時 +50 PT',
    detail: '中央のスロットに入賞した時、追加で固定+50 PTを獲得するスナイパー刻印！',
  },
  {
    id: 'twinkle',
    name: 'トゥインクル',
    icon: '✨',
    tier: 'initial',
    description: '両端ポケット入賞時 +10 PT',
    detail: '両端の2つのポケットに入賞した時、追加で固定+10 PTを獲得する刻印！',
  },
  {
    id: 'sagittarius',
    name: 'サジタリウス',
    icon: '🏹',
    tier: 'intermediate',
    description: 'ピン衝突時 5%で会心 +10 PT',
    detail: '通常メダルがピンに衝突した際、5%の確率でクリティカルヒットが発生し+10 PT獲得！',
  },
  {
    id: 'draco',
    name: 'ドラコ',
    icon: '🐉',
    tier: 'intermediate',
    description: '残り時間10秒以下で獲得点数 +25%',
    detail: '残り時間が10秒以下になると覚醒し、通常メダルの獲得スコアが+25%上昇する終盤追い込み刻印！',
  },
  {
    id: 'gemini',
    name: 'ジェミニ',
    icon: '♊',
    tier: 'intermediate',
    description: '中左・中右ポケット入賞時 35%で1枚投下',
    detail: '通常メダルが中左・中右のポケットに入賞した時、35%の確率で上空から通常メダルを1枚追加投下する刻印！',
  },
  {
    id: 'pegasus',
    name: 'ペガサス',
    icon: '🦋',
    tier: 'advanced',
    description: 'バウンドごと +4%（最大+40%）',
    detail: '通常メダルがピンやバンパーでバウンドするたび、最大10回まで入賞スコアが+4%ずつ上昇！',
  },
  {
    id: 'fortuna',
    name: 'フォルトゥナ',
    icon: '🎲',
    tier: 'advanced',
    description: '入賞 +5%(50%)/+25%(35%)/+100%(15%)',
    detail: '通常メダルの入賞時、50%で+5%・35%で+25%・15%で+100%の祝福を与える幸運刻印！',
  },
  {
    id: 'centaurus',
    name: 'ケンタウルス',
    icon: '🎯',
    tier: 'advanced',
    description: '落下速度 +20% ＆ 2秒以内に入賞で +40%',
    detail: '通常メダルの落下速度を20%速め、2.0秒以内に入賞すると獲得スコア+40%！',
  },
  {
    id: 'altair',
    name: 'アルタイル',
    icon: '🔄',
    tier: 'advanced',
    description: '別ポケット連続 +10%（最大+50%）',
    detail: '通常メダルが直前と異なるポケットに連続入賞するたび、最大5連まで獲得スコアが+10%ずつ上昇！',
  },
];

/**
 * 案D「ゾディアック・グランモワール」準拠の精密天体SVGアイコン（viewBox="0 0 64 64"）
 * ID衝突を防ぐため、ソリッド＆透過レイヤー重ねとCSS発光で表現する
 */
export function getRuneSvgIcon(id: RuneId | 'lock'): string {
  switch (id) {
    case 'comet':
      return `<svg viewBox="0 0 64 64" class="engraving-svg-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 彗星の尾（外光＆鋭い流星尾） -->
        <path d="M23 41 L55 11 L30 33 Z" fill="#fde68a" fill-opacity="0.28"/>
        <path d="M20 35 L49 11 L26 40 Z" fill="#fef3c7" fill-opacity="0.72"/>
        <path d="M27 45 L56 20 L31 40 Z" fill="#a7f3d0" fill-opacity="0.35"/>
        <path d="M25 36 L52 13" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M21 31 L43 13" stroke="#e2e8f0" stroke-width="1.2" stroke-linecap="round" stroke-opacity="0.8"/>
        <path d="M29 41 L51 23" stroke="#fde68a" stroke-width="1.2" stroke-linecap="round" stroke-opacity="0.8"/>
        <!-- 彗星核の二重光輪 -->
        <circle cx="20" cy="43" r="10.5" stroke="#fde68a" stroke-width="1.3" stroke-opacity="0.75"/>
        <circle cx="20" cy="43" r="7.5" fill="#fef3c7" stroke="#ffffff" stroke-width="1.5"/>
        <circle cx="20" cy="43" r="4" fill="#ffffff"/>
        <!-- 煌めきの星屑 -->
        <path d="M13 24 L14.2 27.5 L17.5 28.5 L14.2 29.5 L13 33 L11.8 29.5 L8.5 28.5 L11.8 27.5 Z" fill="#fef08a"/>
        <circle cx="48" cy="34" r="1.4" fill="#e2e8f0" fill-opacity="0.8"/>
      </svg>`;

    case 'solar':
      return `<svg viewBox="0 0 64 64" class="engraving-svg-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 長い8本のシャープ太陽コロナ光条 -->
        <path d="M32 4 L35 16 L29 16 Z M32 60 L35 48 L29 48 Z M4 32 L16 29 L16 35 Z M60 32 L48 29 L48 35 Z" fill="#fef3c7"/>
        <path d="M12.2 12.2 L22.5 19 L19 22.5 Z M51.8 51.8 L41.5 45 L45 41.5 Z M51.8 12.2 L45 22.5 L41.5 19 Z M12.2 51.8 L19 41.5 L22.5 45 Z" fill="#fde68a"/>
        <!-- 間の副次コロナ棘（8本） -->
        <path d="M21.5 8.5 L26 17 L23 18 Z M42.5 55.5 L38 47 L41 46 Z M55.5 21.5 L47 26 L46 23 Z M8.5 42.5 L17 38 L18 41 Z" fill="#fde68a" fill-opacity="0.68"/>
        <path d="M42.5 8.5 L41 18 L38 17 Z M21.5 55.5 L23 46 L26 47 Z M55.5 42.5 L46 41 L47 38 Z M8.5 21.5 L18 23 L17 26 Z" fill="#fde68a" fill-opacity="0.68"/>
        <!-- 太陽本体（二重金輪＆白金コア） -->
        <circle cx="32" cy="32" r="13.5" fill="#1e1b2e" stroke="#fde68a" stroke-width="1.5"/>
        <circle cx="32" cy="32" r="11" fill="#fde68a" fill-opacity="0.92" stroke="#ffffff" stroke-width="1.2"/>
        <circle cx="32" cy="32" r="7.5" fill="#fef9c3"/>
        <circle cx="29.5" cy="29.5" r="3" fill="#ffffff" fill-opacity="0.8"/>
      </svg>`;

    case 'twinkle':
      return `<svg viewBox="0 0 64 64" class="engraving-svg-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 主閃光星（左下・大） -->
        <path d="M25 14 Q26 31 43 32 Q26 33 25 50 Q24 33 7 32 Q24 31 25 14 Z" fill="#fef3c7" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
        <circle cx="25" cy="32" r="3.5" fill="#ffffff"/>
        <!-- 副閃光星（右上・中） -->
        <path d="M46 11 Q46.7 20 56 21 Q46.7 22 46 31 Q45.3 22 36 21 Q45.3 20 46 11 Z" fill="#e2e8f0" stroke="#ffffff" stroke-width="0.9" stroke-linejoin="round"/>
        <!-- 小星（右下） -->
        <path d="M48 39 Q48.4 44.5 54 45 Q48.4 45.5 48 51 Q47.6 45.5 42 45 Q47.6 44.5 48 39 Z" fill="#fde68a"/>
        <!-- 星粒 -->
        <circle cx="14" cy="17" r="1.4" fill="#ffffff" fill-opacity="0.85"/>
        <circle cx="17" cy="49" r="1.2" fill="#fde68a" fill-opacity="0.75"/>
      </svg>`;

    case 'sagittarius':
      return `<svg viewBox="0 0 64 64" class="engraving-svg-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 背後の日蝕リング -->
        <circle cx="32" cy="32" r="19" fill="#070a17" stroke="#94a3b8" stroke-width="1.2" stroke-opacity="0.6"/>
        <circle cx="32" cy="32" r="15.5" stroke="#cbd5e1" stroke-width="0.8" stroke-dasharray="2 3" stroke-opacity="0.5"/>
        <!-- 星座の弓と弦 -->
        <path d="M18 19 C33 17, 45 29, 45 45" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>
        <line x1="18" y1="19" x2="45" y2="45" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2 1.5"/>
        <!-- 鋭い星矢 -->
        <line x1="14" y1="50" x2="47" y2="17" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
        <path d="M47 17 L38 19 L45 26 Z" fill="#f8fafc"/>
        <path d="M14 50 L17 43 M14 50 L21 47" stroke="#cbd5e1" stroke-width="1.4" stroke-linecap="round"/>
        <!-- 星座星点 -->
        <circle cx="18" cy="19" r="2" fill="#fde68a"/>
        <circle cx="45" cy="45" r="2" fill="#fde68a"/>
        <circle cx="36" cy="28" r="2" fill="#ffffff"/>
      </svg>`;

    case 'draco':
      return `<svg viewBox="0 0 64 64" class="engraving-svg-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 背後の日蝕リング -->
        <circle cx="32" cy="32" r="19" fill="#070a17" stroke="#94a3b8" stroke-width="1.2" stroke-opacity="0.6"/>
        <circle cx="32" cy="32" r="15.5" stroke="#cbd5e1" stroke-width="0.8" stroke-dasharray="2 3" stroke-opacity="0.5"/>
        <!-- 竜座のS字天体骨格と翼 -->
        <path d="M18 46 C14 36, 24 30, 32 31 C40 32, 46 25, 42 18 C39 14, 33 15, 31 19" stroke="#e2e8f0" stroke-width="1.9" stroke-linecap="round"/>
        <path d="M27 29 L17 22 L23 32 Z" fill="#cbd5e1" fill-opacity="0.35" stroke="#cbd5e1" stroke-width="1" stroke-linejoin="round"/>
        <path d="M35 28 L47 26 L38 35 Z" fill="#fde68a" fill-opacity="0.28" stroke="#fde68a" stroke-width="1" stroke-linejoin="round"/>
        <!-- 竜角と竜首の鋭角 -->
        <path d="M31 19 L27 12 M34 17 L34 11" stroke="#fde68a" stroke-width="1.3" stroke-linecap="round"/>
        <!-- 星点（エルタニン・ラスタバン等の輝星） -->
        <circle cx="31" cy="19" r="2.3" fill="#ffffff"/>
        <circle cx="42" cy="18" r="1.8" fill="#fde68a"/>
        <circle cx="32" cy="31" r="1.8" fill="#e2e8f0"/>
        <circle cx="18" cy="46" r="2" fill="#fde68a"/>
      </svg>`;

    case 'gemini':
      return `<svg viewBox="0 0 64 64" class="engraving-svg-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 背後の日蝕リング -->
        <circle cx="32" cy="32" r="19" fill="#070a17" stroke="#94a3b8" stroke-width="1.2" stroke-opacity="0.6"/>
        <!-- 連星の交差軌道 -->
        <ellipse cx="32" cy="32" rx="17" ry="8" transform="rotate(-30 32 32)" stroke="#cbd5e1" stroke-width="1" stroke-opacity="0.55"/>
        <ellipse cx="32" cy="32" rx="17" ry="8" transform="rotate(30 32 32)" stroke="#fde68a" stroke-width="1" stroke-opacity="0.45"/>
        <!-- 双子星を結ぶ星座線と柱（II象徴） -->
        <path d="M22 18 L24 46 M42 18 L40 46" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round" stroke-opacity="0.7"/>
        <path d="M18 19 Q32 23 46 19 M19 45 Q32 41 45 45" stroke="#e2e8f0" stroke-width="1.4" stroke-linecap="round"/>
        <!-- カストル＆ポルックス（双子連星の輝星） -->
        <path d="M23 21 L24 24.5 L27.5 25.5 L24 26.5 L23 30 L22 26.5 L18.5 25.5 L22 24.5 Z" fill="#fef3c7" stroke="#ffffff" stroke-width="0.6"/>
        <path d="M41 34 L42 37.5 L45.5 38.5 L42 39.5 L41 43 L40 39.5 L36.5 38.5 L40 37.5 Z" fill="#fde68a" stroke="#ffffff" stroke-width="0.6"/>
        <circle cx="23" cy="25.5" r="2.1" fill="#ffffff"/>
        <circle cx="41" cy="38.5" r="2.1" fill="#fef3c7"/>
      </svg>`;

    case 'pegasus':
      return `<svg viewBox="0 0 64 64" class="engraving-svg-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 背後の日蝕・星図リング -->
        <circle cx="32" cy="32" r="20" fill="#070a17" stroke="#fde68a" stroke-width="1.2" stroke-opacity="0.65"/>
        <circle cx="32" cy="32" r="16" stroke="#cbd5e1" stroke-width="0.8" stroke-dasharray="2 3" stroke-opacity="0.45"/>
        <!-- 天馬ペガサスの天翔ける主翼（3層フェザーライン） -->
        <path d="M16 42 C18 32, 26 23, 47 16 C39 24, 34 30, 31 35 C37 32, 44 29, 49 27 C40 34, 34 38, 28 42 Z" fill="#fef3c7" fill-opacity="0.22" stroke="#fef3c7" stroke-width="1.35" stroke-linejoin="round"/>
        <path d="M23 39 L44 22 M25 41 L45 31" stroke="#fde68a" stroke-width="1" stroke-linecap="round" stroke-opacity="0.85"/>
        <!-- 跳躍する星馬シルエット（首〜駆ける星線） -->
        <path d="M17 44 Q24 38, 27 32 L22 25 L26 22 L30 27" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- ペガサスの大四辺形と輝星シェアト／マルカブ -->
        <circle cx="26" cy="22" r="2.2" fill="#ffffff"/>
        <circle cx="47" cy="16" r="2.3" fill="#fde68a"/>
        <circle cx="49" cy="27" r="1.7" fill="#e2e8f0"/>
        <circle cx="17" cy="44" r="2.1" fill="#fef3c7"/>
        <path d="M14 17 L15 20 L18 21 L15 22 L14 25 L13 22 L10 21 L13 20 Z" fill="#fde68a"/>
      </svg>`;

    case 'fortuna':
      return `<svg viewBox="0 0 64 64" class="engraving-svg-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 運命の車輪（ゴールドアストロ・ルーレット） -->
        <circle cx="32" cy="32" r="20.5" fill="#070a17" stroke="#fde68a" stroke-width="1.4" stroke-opacity="0.85"/>
        <circle cx="32" cy="32" r="17" stroke="#cbd5e1" stroke-width="0.9" stroke-dasharray="2.5 2.5" stroke-opacity="0.6"/>
        <!-- 8方位の運命スポーク -->
        <path d="M32 11.5 V52.5 M11.5 32 H52.5 M17.5 17.5 L46.5 46.5 M46.5 17.5 L17.5 46.5" stroke="#fde68a" stroke-width="0.9" stroke-opacity="0.45"/>
        <!-- 傾けた黄金ダイヤモンド・ダイス紋（幸運の目） -->
        <rect x="21" y="21" width="22" height="22" rx="4" transform="rotate(45 32 32)" fill="#131936" stroke="#fef3c7" stroke-width="1.5"/>
        <circle cx="32" cy="23.5" r="1.9" fill="#fde68a"/>
        <circle cx="32" cy="40.5" r="1.9" fill="#fde68a"/>
        <circle cx="23.5" cy="32" r="1.9" fill="#fde68a"/>
        <circle cx="40.5" cy="32" r="1.9" fill="#fde68a"/>
        <!-- 中央の祝福スパークル星 -->
        <path d="M32 25 L33.6 30.4 L39 32 L33.6 33.6 L32 39 L30.4 33.6 L25 32 L30.4 30.4 Z" fill="#ffffff" stroke="#fde68a" stroke-width="0.6"/>
      </svg>`;

    case 'centaurus':
      return `<svg viewBox="0 0 64 64" class="engraving-svg-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 背後の日蝕リング -->
        <circle cx="32" cy="32" r="19.5" fill="#070a17" stroke="#94a3b8" stroke-width="1.2" stroke-opacity="0.65"/>
        <!-- 疾走する急降下流星スピードライン（速攻ドロップ象徴） -->
        <path d="M16 14 L34 32 M13 22 L28 37 M23 12 L38 27" stroke="#a7f3d0" stroke-width="1.15" stroke-linecap="round" stroke-opacity="0.65"/>
        <!-- ケンタウルス座の鋭い流星槍（右下方向へ貫く疾風ランス） -->
        <line x1="15" y1="15" x2="48" y2="48" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round"/>
        <path d="M51 51 L41 48 L48 41 Z" fill="#fef3c7" stroke="#ffffff" stroke-width="0.8" stroke-linejoin="round"/>
        <!-- 星槍のクロスガード＆軌道リング -->
        <path d="M21 29 L29 21" stroke="#fde68a" stroke-width="1.6" stroke-linecap="round"/>
        <!-- α・βケンタウルス（双輝星） -->
        <path d="M47 16 L48 19 L51 20 L48 21 L47 24 L46 21 L43 20 L46 19 Z" fill="#fef3c7"/>
        <circle cx="19" cy="45" r="2" fill="#fde68a"/>
        <circle cx="15" cy="15" r="2.1" fill="#ffffff"/>
      </svg>`;

    case 'altair':
      return `<svg viewBox="0 0 64 64" class="engraving-svg-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 背後の銀河周回軌道リング（別穴チェイン象徴） -->
        <circle cx="32" cy="32" r="19.5" fill="#070a17" stroke="#fde68a" stroke-width="1.2" stroke-opacity="0.7"/>
        <path d="M17 20 A19 19 0 0 1 47 20" stroke="#6ee7b7" stroke-width="1.3" stroke-linecap="round" stroke-opacity="0.8"/>
        <path d="M47 44 A19 19 0 0 1 17 44" stroke="#6ee7b7" stroke-width="1.3" stroke-linecap="round" stroke-opacity="0.8"/>
        <!-- 鷲座（アクイラ）の広がった飛翔翼シルエット -->
        <path d="M11 27 Q23 23 32 31 Q41 23 53 27 Q42 33 32 39 Q22 33 11 27 Z" fill="#fef3c7" fill-opacity="0.22" stroke="#e2e8f0" stroke-width="1.4" stroke-linejoin="round"/>
        <!-- 鷲座中心軸と一直線上の三つ星（アルシャイン・アルタイル・タラゼド） -->
        <line x1="20" y1="22" x2="44" y2="42" stroke="#fde68a" stroke-width="1" stroke-dasharray="2 2" stroke-opacity="0.8"/>
        <!-- 主星アルタイル（大十字輝星） -->
        <path d="M32 19 L34 29.5 L44.5 31.5 L34 33.5 L32 44 L30 33.5 L19.5 31.5 L30 29.5 Z" fill="#ffffff" stroke="#fde68a" stroke-width="0.7"/>
        <circle cx="22" cy="24" r="1.9" fill="#fde68a"/>
        <circle cx="42" cy="40" r="1.9" fill="#fde68a"/>
      </svg>`;

    case 'lock':
      return `<svg viewBox="0 0 64 64" class="engraving-svg-icon engraving-lock-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- シャックル（アーチ） -->
        <path d="M22 29 V21 C22 14.5 26.5 10 32 10 C37.5 10 42 14.5 42 21 V29" stroke="#cbd5e1" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M24 29 V21 C24 16 27.5 12.5 32 12.5 C36.5 12.5 40 16 40 21 V29" stroke="#64748b" stroke-width="1.2" stroke-linecap="round"/>
        <!-- 錠前本体 -->
        <rect x="17" y="28" width="30" height="24" rx="5" fill="#1e293b" stroke="#94a3b8" stroke-width="1.8"/>
        <rect x="20" y="31" width="24" height="18" rx="3" stroke="#475569" stroke-width="1"/>
        <!-- 星辰鍵穴 -->
        <circle cx="32" cy="38" r="3.2" fill="#cbd5e1"/>
        <path d="M30.5 39 L33.5 39 L34.2 46 L29.8 46 Z" fill="#cbd5e1"/>
      </svg>`;
  }
}

export interface ComputedStats {
  centerSlot4xUnlocked: boolean; // 起点ノード効果：中央スロットを4倍にする
  roundDuration: number; // 初期 15秒（最大 25秒）
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
  slotMultiplier: number; // スロット倍率強化 (1:通常, 2:基礎x2, 3:基礎x3)
  jpShotsCount: number; // JP射出枚数（初期10枚、jp_count_1:15枚、jp_count_2:20枚、jp_count_3:25枚）
  jpNormalMedalRate: number; // JP時の通常メダル確率（初期0.80、強化で0.70→0.60→0.50）
  jpFeverUnlocked: boolean; // JPフィーバー（3秒間全メダル得点2倍）
  jpFreezeUnlocked: boolean; // JPロングフリーズ（2%で4.4秒演出＆100枚一斉投下）
  prismTargetUnlocked: boolean; // プリズム・ターゲット（破壊型結晶ギミック）有効化
  engravingUnlocked: boolean; // 刻印開放（ホーム「刻印」解放＆初期3刻印有効化）
  engravingMidUnlocked: boolean; // 中級刻印開放（中級刻印3種解禁）
  engravingSlot2Unlocked: boolean; // スロット2枠目開放（最大2種同時装備）
  engravingAdvUnlocked: boolean; // 上級刻印開放（上級刻印4種解禁）
  runeCometActive?: boolean; // コメット刻印有効化（通常メダル反発-15% ＆ 落下速度+15%）
  runeCentaurusActive?: boolean; // ケンタウルス刻印有効化（通常メダル落下速度+20% ＆ 2秒以内入賞+40%）
}
