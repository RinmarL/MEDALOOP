import { ComputedStats, MedalType, SkillNodeDef } from './types';

function polar(radius: number, deg: number): { gx: number; gy: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    gx: Math.round(Math.cos(rad) * radius * 100) / 100,
    gy: Math.round(Math.sin(rad) * radius * 100) / 100,
  };
}

// 第1円〜第4円の完全等間隔軌道（64px刻み：全ノードがこの4つの円軌道上に配置される）
export const ORBIT_R1 = 64; // 第1円
export const ORBIT_R2 = 128; // 第2円
export const ORBIT_R3 = 192; // 第3円
export const ORBIT_R4 = 256; // 第4円
export const TREE_ORBIT_RADII = [ORBIT_R1, ORBIT_R2, ORBIT_R3, ORBIT_R4] as const;

export const SKILL_NODES: SkillNodeDef[] = [
  // === 起点ノード（中心コア：初期Lv0、ここから上下2本だけ伸びる） ===
  {
    id: 'c0',
    name: '中央スロット強化',
    description: '中央の点数スロット倍率x1→x4',
    gx: 0,
    gy: 0,
    maxLevel: 1,
    baseCost: 5,
    costScale: 1,
    neighbors: ['r1_0', 'r1_3'],
    category: 'core',
    icon: '✡',
  },

  // === 第1円 (R1 = 64)：序盤の基礎強化（正六角形配置・最大3分岐） ===
  {
    id: 'r1_0',
    name: '投下間隔短縮 I',
    description: '投下クールタイム -15%',
    ...polar(ORBIT_R1, -90),
    maxLevel: 3,
    baseCost: 8,
    costScale: 1.7,
    neighbors: ['c0', 'r1_1', 'r1_5', 'jp_prob_1'],
    category: 'stat',
    icon: '⚡',
  },
  {
    id: 'r1_3',
    name: '制限時間延長 I',
    description: '制限時間 +1秒',
    ...polar(ORBIT_R1, 90),
    maxLevel: 3,
    baseCost: 6,
    costScale: 1.6,
    neighbors: ['c0', 'r1_2', 'r1_4', 'medal_1'],
    category: 'stat',
    icon: '⏱',
  },
  {
    id: 'r1_1',
    name: '制限時間延長 II',
    description: '制限時間 +1秒',
    ...polar(ORBIT_R1, -30),
    maxLevel: 3,
    baseCost: 12,
    costScale: 1.7,
    neighbors: ['r1_0', 'r2_0', 'm2_1'],
    category: 'stat',
    icon: '⏱',
  },
  {
    id: 'r1_2',
    name: 'メダル基礎点 I',
    description: 'メダル1枚の基礎点数 +1',
    ...polar(ORBIT_R1, 30),
    maxLevel: 3,
    baseCost: 14,
    costScale: 1.8,
    neighbors: ['r1_3', 'r2_1', 'r2_2'],
    category: 'stat',
    icon: '💎',
  },
  {
    id: 'r1_4',
    name: '同時装填数強化 I',
    description: '1回の装填枚数 1枚→2枚',
    ...polar(ORBIT_R1, 150),
    maxLevel: 1,
    baseCost: 24,
    costScale: 1,
    neighbors: ['r1_3', 'r2_3', 'm2_3'],
    category: 'stat',
    icon: '🔋',
  },
  {
    id: 'r1_5',
    name: '回収範囲拡大',
    description: '下皿の回収判定範囲 +25%（最大60px）',
    ...polar(ORBIT_R1, -150),
    maxLevel: 4,
    baseCost: 10,
    costScale: 1.6,
    neighbors: ['r1_0', 'm2_0', 'm2_5'],
    category: 'stat',
    icon: '🧲',
  },

  // === 下方向：メダル変化 アンカー型配置（第2円→第3円→第4円へ等間隔直進＋第4円3並び） ===
  {
    id: 'medal_1',
    name: 'ゴールドメダル変化',
    description: '初期メダル1枚目をゴールドメダル（得点x3）に変化',
    ...polar(ORBIT_R2, 90),
    maxLevel: 1,
    baseCost: 70,
    costScale: 1,
    neighbors: ['r1_3', 'medal_2'],
    category: 'medal',
    icon: '🪙',
  },
  {
    id: 'medal_2',
    name: 'プラズマメダル変化',
    description: '初期メダル2枚目をプラズマメダル（得点x2・接触帯電2.5倍）に変化',
    ...polar(ORBIT_R3, 90),
    maxLevel: 1,
    baseCost: 180,
    costScale: 1,
    neighbors: ['medal_1', 'star_3'],
    category: 'medal',
    icon: '🔮',
  },
  {
    id: 'medal_3',
    name: 'バウンスメダル変化',
    description: '初期メダル3枚目をバウンスメダル（バンパー得点x4・高反発）に変化',
    ...polar(ORBIT_R4, 108),
    maxLevel: 1,
    baseCost: 360,
    costScale: 1,
    neighbors: ['star_3'],
    category: 'medal',
    icon: '💥',
  },
  {
    id: 'star_3',
    name: 'クローンメダル変化',
    description: '初期メダル4枚目をクローンメダル（スロット入賞時メダル+1枚）に変化',
    ...polar(ORBIT_R4, 90),
    maxLevel: 1,
    baseCost: 580,
    costScale: 1,
    neighbors: ['medal_2', 'medal_3', 'medal_5'],
    category: 'medal',
    icon: '🧬',
  },
  {
    id: 'medal_5',
    name: 'クロノメダル変化',
    description: '初期メダル5枚目をクロノメダル（得点x3・入賞時+1.2秒）に変化',
    ...polar(ORBIT_R4, 72),
    maxLevel: 1,
    baseCost: 920,
    costScale: 1,
    neighbors: ['star_3'],
    category: 'medal',
    icon: '👑',
  },

  // === 上方向：JP関連ロード（案A：第2円中央→第3円中央→第3円左→第4円左→第4円中央） ===
  {
    id: 'jp_prob_1',
    name: 'JP特殊確率 I',
    description: 'JACKPOT時の特殊メダル出現率UP（通常70%→Lv1:60%/Lv2:50%）',
    ...polar(ORBIT_R2, -90),
    maxLevel: 2,
    baseCost: 120,
    costScale: 1.8,
    neighbors: ['r1_0', 'jp_count_1'],
    category: 'milestone',
    icon: '🎰',
  },
  {
    id: 'jp_count_1',
    name: 'JP枚数増加 I',
    description: 'JACKPOT時の射出枚数 10枚→15枚',
    ...polar(ORBIT_R3, -90),
    maxLevel: 1,
    baseCost: 220,
    costScale: 1,
    neighbors: ['jp_prob_1', 'jp_prob_2'],
    category: 'milestone',
    icon: '🪙',
  },
  {
    id: 'jp_prob_2',
    name: 'JP特殊確率 II',
    description: 'JACKPOT時の特殊メダル出現率UP（通常50%→Lv1:40%/Lv2:30%）',
    ...polar(ORBIT_R3, -108),
    maxLevel: 2,
    baseCost: 350,
    costScale: 1.8,
    neighbors: ['jp_count_1', 'jp_count_2'],
    category: 'milestone',
    icon: '🎰',
  },
  {
    id: 'jp_count_2',
    name: 'JP枚数増加 II',
    description: 'JACKPOT時の射出枚数 15枚→20枚',
    ...polar(ORBIT_R3, -126),
    maxLevel: 1,
    baseCost: 550,
    costScale: 1,
    neighbors: ['jp_prob_2', 'jp_freeze'],
    category: 'milestone',
    icon: '🪙',
  },
  {
    id: 'jp_freeze',
    name: 'JPロングフリーズ',
    description: 'JACKPOT突入時1%で暗転フリーズ！50枚一気放出プレミアム演出',
    ...polar(ORBIT_R4, -126),
    maxLevel: 1,
    baseCost: 800,
    costScale: 1,
    neighbors: ['jp_count_2', 'jp_count_3'],
    category: 'milestone',
    icon: '❄',
  },
  {
    id: 'jp_count_3',
    name: 'JP枚数増加 III',
    description: 'JACKPOT時の射出枚数 20枚→25枚',
    ...polar(ORBIT_R4, -108),
    maxLevel: 1,
    baseCost: 1100,
    costScale: 1,
    neighbors: ['jp_freeze', 'jp_fever'],
    category: 'milestone',
    icon: '🪙',
  },
  {
    id: 'jp_fever',
    name: 'JPフィーバー！',
    description: 'JACKPOT発動から5秒間、全メダル獲得得点が2倍（JPメダル含む）',
    ...polar(ORBIT_R4, -90),
    maxLevel: 1,
    baseCost: 1500,
    costScale: 1,
    neighbors: ['jp_count_3'],
    category: 'milestone',
    icon: '🔥',
  },

  // === 右上セクター（第2円: -54°, -18°） ===
  {
    id: 'r2_0',
    name: 'スプリット・レーザー I',
    description: '盤面に分裂レーザー出現（通過でメダル分裂、5秒維持→3秒消滅）',
    ...polar(ORBIT_R2, -54),
    maxLevel: 1,
    baseCost: 65,
    costScale: 1,
    neighbors: ['r1_1', 'star_1'],
    category: 'milestone',
    icon: '⚡',
  },
  {
    id: 'star_1',
    name: 'サイバー・カタパルト',
    description: '下部左右にカタパルト出現、入ったメダルを最上部へ打ち上げループ',
    ...polar(ORBIT_R3, -54),
    maxLevel: 1,
    baseCost: 400,
    costScale: 1,
    neighbors: ['r2_0', 'outer_0'],
    category: 'milestone',
    icon: '🚀',
  },
  {
    id: 'outer_0',
    name: 'スプリット・レーザー II',
    description: '分裂レーザーの出現本数 1本→2本',
    ...polar(ORBIT_R4, -54),
    maxLevel: 1,
    baseCost: 700,
    costScale: 1,
    neighbors: ['star_1'],
    category: 'milestone',
    icon: '⚡',
  },
  {
    id: 'm2_1',
    name: 'クローンオーブ',
    description: '盤面に分裂オーブ出現（通過でメダル分裂 Lv1:+1枚 / Lv2:分裂得点x1.5 / Lv3:+2枚）',
    ...polar(ORBIT_R2, -18),
    maxLevel: 3,
    baseCost: 60,
    costScale: 1.7,
    neighbors: ['r1_1'],
    category: 'milestone',
    icon: '🌀',
  },

  // === 右下セクター（第2円: 18°, 54°） ===
  {
    id: 'r2_1',
    name: 'ブーストオーブ',
    description: '盤面に倍率オーブ出現（通過で得点倍率 Lv1:x2 / Lv2:x3 / Lv3:x4）',
    ...polar(ORBIT_R2, 18),
    maxLevel: 3,
    baseCost: 50,
    costScale: 1.7,
    neighbors: ['r1_2', 'outer_1'],
    category: 'milestone',
    icon: '💫',
  },
  {
    id: 'outer_1',
    name: '制限時間延長 V',
    description: '制限時間 +1秒',
    ...polar(ORBIT_R3, 14),
    maxLevel: 3,
    baseCost: 300,
    costScale: 1.8,
    neighbors: ['r2_1'],
    category: 'stat',
    icon: '⏱',
  },
  {
    id: 'r2_2',
    name: 'メダル増殖スロット',
    description: '中央スロット入賞時、ラウンド中メダル +1枚',
    ...polar(ORBIT_R2, 54),
    maxLevel: 1,
    baseCost: 80,
    costScale: 1,
    neighbors: ['r1_2', 'm2_2', 'outer_2'],
    category: 'milestone',
    icon: '✨',
  },
  {
    id: 'm2_2',
    name: 'バンパー基礎点 II',
    description: '高反発バンパー増設 ＆ バンパーの基礎点数 +2',
    ...polar(ORBIT_R3, 44),
    maxLevel: 2,
    baseCost: 280,
    costScale: 1.9,
    neighbors: ['r2_2', 'star_2'],
    category: 'stat',
    icon: '🎯',
  },
  {
    id: 'outer_2',
    name: '獲得ポイント強化 II',
    description: '全獲得スコア x1.5 ＆ 初期メダル +1枚',
    ...polar(ORBIT_R3, 64),
    maxLevel: 1,
    baseCost: 800,
    costScale: 1,
    neighbors: ['r2_2'],
    category: 'stat',
    icon: '🌾',
  },
  {
    id: 'star_2',
    name: 'スロット倍率x2 I',
    description: '全ポケット・スロットの得点倍率が2倍（x2）',
    ...polar(ORBIT_R4, 44),
    maxLevel: 1,
    baseCost: 200,
    costScale: 1,
    neighbors: ['m2_2', 'star_0'],
    category: 'stat',
    icon: '🎰',
  },
  {
    id: 'star_0',
    name: 'スロット倍率x2 II',
    description: '全ポケット・スロットの得点倍率がさらに2倍（計x4）',
    ...polar(ORBIT_R4, 24),
    maxLevel: 1,
    baseCost: 500,
    costScale: 1,
    neighbors: ['star_2'],
    category: 'stat',
    icon: '🎰',
  },

  // === 左下セクター（第2円: 126°, 162°） ===
  {
    id: 'r2_3',
    name: 'メダル接触強化',
    description: 'メダル同士の接触で得点倍率上昇（最大x2.5）',
    ...polar(ORBIT_R2, 126),
    maxLevel: 1,
    baseCost: 95,
    costScale: 1,
    neighbors: ['r1_4', 'outer_3'],
    category: 'milestone',
    icon: '⚡',
  },
  {
    id: 'outer_3',
    name: 'メダル基礎点 II',
    description: 'メダル1枚の基礎点数 +4 ＆ 接触最大倍率 x6.0→x10.0',
    ...polar(ORBIT_R3, 126),
    maxLevel: 1,
    baseCost: 900,
    costScale: 1,
    neighbors: ['r2_3', 'star_4'],
    category: 'stat',
    icon: '💎',
  },
  {
    id: 'star_4',
    name: '接触倍率上限強化',
    description: 'メダル接触強化の最大倍率 x2.5→x6.0',
    ...polar(ORBIT_R4, 126),
    maxLevel: 1,
    baseCost: 450,
    costScale: 1,
    neighbors: ['outer_3'],
    category: 'milestone',
    icon: '🌩',
  },
  {
    id: 'm2_3',
    name: '長押し装填',
    description: '投入口の長押し連続装填を解放',
    ...polar(ORBIT_R2, 162),
    maxLevel: 1,
    baseCost: 190,
    costScale: 1,
    neighbors: ['r1_4', 'r2_4'],
    category: 'milestone',
    icon: '⏫',
  },
  {
    id: 'r2_4',
    name: '制限時間延長 III',
    description: '制限時間 +1秒',
    ...polar(ORBIT_R3, 162),
    maxLevel: 3,
    baseCost: 40,
    costScale: 1.7,
    neighbors: ['m2_3', 'm2_4'],
    category: 'stat',
    icon: '⏱',
  },
  {
    id: 'm2_4',
    name: '制限時間延長 IV',
    description: '制限時間 +1秒',
    ...polar(ORBIT_R4, 162),
    maxLevel: 3,
    baseCost: 110,
    costScale: 1.8,
    neighbors: ['r2_4'],
    category: 'stat',
    icon: '⏱',
  },

  // === 左上セクター（第2円: -162°, -126°） ===
  {
    id: 'm2_0',
    name: '連続回収',
    description: '下皿の長押し・なぞり連続回収を解放',
    ...polar(ORBIT_R2, -126),
    maxLevel: 1,
    baseCost: 190,
    costScale: 1,
    neighbors: ['r1_5'],
    category: 'milestone',
    icon: '👋',
  },
  {
    id: 'm2_5',
    name: '長押し投下',
    description: '盤面の長押し連続投下を解放',
    ...polar(ORBIT_R2, -162),
    maxLevel: 1,
    baseCost: 210,
    costScale: 1,
    neighbors: ['r1_5', 'r2_5', 'star_5'],
    category: 'milestone',
    icon: '👇',
  },
  {
    id: 'r2_5',
    name: 'バンパー基礎点 I',
    description: 'バンパーの基礎点数 +1',
    ...polar(ORBIT_R3, -146),
    maxLevel: 3,
    baseCost: 140,
    costScale: 1.8,
    neighbors: ['m2_5', 'outer_5'],
    category: 'stat',
    icon: '🎯',
  },
  {
    id: 'outer_5',
    name: 'バンパー基礎点倍化',
    description: 'バンパーの基礎点数 x2',
    ...polar(ORBIT_R4, -146),
    maxLevel: 1,
    baseCost: 1800,
    costScale: 1,
    neighbors: ['r2_5'],
    category: 'stat',
    icon: '👑',
  },
  {
    id: 'star_5',
    name: '連射速度＆同時装填強化',
    description: '投下・回収・装填の間隔 -35% ＆ 1回の装填枚数 2枚→3枚',
    ...polar(ORBIT_R3, -168),
    maxLevel: 1,
    baseCost: 440,
    costScale: 1,
    neighbors: ['m2_5', 'outer_4'],
    category: 'milestone',
    icon: '🚀',
  },
  {
    id: 'outer_4',
    name: '獲得ポイント強化 III',
    description: '全獲得スコア x1.5 ＆ 初期メダル +1枚',
    ...polar(ORBIT_R4, -168),
    maxLevel: 1,
    baseCost: 1000,
    costScale: 1,
    neighbors: ['star_5'],
    category: 'stat',
    icon: '🌌',
  },
];

export const HEXAGRAM_LINES: Array<[string, string]> = [];

export class SkillTreeState {
  public levels: Record<string, number> = {};
  public debugShowAll: boolean = false;

  constructor() {
    for (const node of SKILL_NODES) {
      this.levels[node.id] = 0;
    }
  }

  public getLevel(id: string): number {
    return this.levels[id] || 0;
  }

  public isUnlocked(node: SkillNodeDef): boolean {
    if (node.id === 'c0') return true;
    return node.neighbors.some((nid) => this.getLevel(nid) > 0);
  }

  public isVisible(node: SkillNodeDef): boolean {
    if (this.debugShowAll) return true;
    return this.getLevel(node.id) > 0 || this.isUnlocked(node);
  }

  public debugUnlockAll(): boolean {
    const { percent } = this.getCompletionRatio();
    const willMax = percent < 100;
    for (const node of SKILL_NODES) {
      this.levels[node.id] = willMax ? node.maxLevel : 0;
    }
    return willMax;
  }

  public getCost(node: SkillNodeDef): number {
    const lv = this.getLevel(node.id);
    let cost = Math.round(node.baseCost * Math.pow(node.costScale, lv));
    if (cost >= 100) {
      cost = Math.round(cost / 10) * 10;
    }
    return cost;
  }

  public canBuy(node: SkillNodeDef, currentScore: number): boolean {
    const lv = this.getLevel(node.id);
    if (lv >= node.maxLevel) return false;
    if (!this.isUnlocked(node)) return false;
    return currentScore >= this.getCost(node);
  }

  public getCompletionRatio(): { unlockedLevels: number; totalLevels: number; percent: number } {
    let unlockedLevels = 0;
    let totalLevels = 0;
    for (const node of SKILL_NODES) {
      unlockedLevels += this.getLevel(node.id);
      totalLevels += node.maxLevel;
    }
    return {
      unlockedLevels,
      totalLevels,
      percent: Math.round((unlockedLevels / totalLevels) * 100),
    };
  }

  public computeStats(): ComputedStats {
    const lv = (id: string) => this.getLevel(id);

    const centerSlot4xUnlocked = lv('c0') > 0;

    // 初期5枚のメダル構成
    const specialMedals: MedalType[] = ['normal', 'normal', 'normal', 'normal', 'normal'];
    if (lv('medal_1') > 0) specialMedals[0] = 'gold';
    if (lv('medal_2') > 0) specialMedals[1] = 'plasma';
    if (lv('medal_3') > 0) specialMedals[2] = 'bounce';
    if (lv('star_3') > 0) specialMedals[3] = 'clone';
    if (lv('medal_5') > 0) specialMedals[4] = 'chrono';

    // 投下クールタイム（初期 1.0秒）
    let dropCooldown = 1.0;
    dropCooldown *= Math.pow(0.85, lv('r1_0'));
    if (lv('star_5') > 0) dropCooldown *= 0.65;
    dropCooldown = Math.max(0.08, dropCooldown);

    // ベースの制限時間：15.0秒 ＋ 「+1秒（最大3回）」× 5マス（r1_3, r1_1, r2_4, m2_4, outer_1）
    const timeBonusLevels =
      lv('r1_3') + lv('r1_1') + lv('r2_4') + lv('m2_4') + lv('outer_1');
    const roundDuration = 15.0 + timeBonusLevels * 1.0;

    // 下皿回収速度・範囲（初期30pxに対して25%ずつ加算、最大Lv4で60px）
    let pickupInterval = 0.13;
    if (lv('star_5') > 0) pickupInterval *= 0.65;
    pickupInterval = Math.max(0.04, pickupInterval);

    const pickupRadius = Math.round(30 * (1 + 0.25 * lv('r1_5')));

    // 装填速度・同時装填枚数
    let reloadInterval = 0.16;
    if (lv('star_5') > 0) reloadInterval *= 0.65;
    reloadInterval = Math.max(0.05, reloadInterval);

    let reloadBatchSize = 1;
    if (lv('r1_4') >= 1) reloadBatchSize = 2;
    if (lv('star_5') >= 1) reloadBatchSize = 3;

    // バンパー（ピン）は初期0点、r2_5 / m2_2 / outer_5 で増加
    let basePinScore = lv('r2_5') * 1 + lv('m2_2') * 2;
    if (lv('outer_5') > 0) basePinScore *= 2;

    // メダル1枚の基礎点数は初期 1点
    const basePocketScore = 1 + lv('r1_2') * 1 + (lv('outer_3') > 0 ? 4 : 0);

    // 全体スコア倍率
    let globalScoreMultiplier = 1.0;
    if (lv('outer_2') > 0) globalScoreMultiplier *= 1.5;
    if (lv('outer_4') > 0) globalScoreMultiplier *= 1.5;

    const { unlockedLevels, totalLevels } = this.getCompletionRatio();
    const hexagramCompleted = unlockedLevels >= totalLevels;
    if (hexagramCompleted) {
      globalScoreMultiplier *= 3.0;
    }

    // ピン配置ティア (0〜4)
    let pinLayoutTier = 0;
    if (lv('r2_5') >= 1) pinLayoutTier = 1;
    if (lv('r2_5') >= 3) pinLayoutTier = 2;
    if (lv('m2_2') >= 1) pinLayoutTier = 3;
    if (lv('outer_5') >= 1) pinLayoutTier = 4;

    // スプリット・レーザー (r2_0: 1本, outer_0: 2本)
    let splitLaserCount = 0;
    if (lv('r2_0') > 0) splitLaserCount = 1;
    if (lv('outer_0') > 0) splitLaserCount = 2;

    // サイバー・カタパルト（最上部ループ打ち上げ）
    const catapultUnlocked = lv('star_1') > 0;

    // 周期ストッパー（廃止・後方互換）
    const stopperCount = 0;
    const stopperCooldown = 3.8;
    const stopperWidthRatio = 1.15;

    // 接触帯電強化
    let contactChargeRate = 0;
    let contactMaxMultiplier = 1.0;
    if (lv('r2_3') > 0) {
      contactChargeRate = 0.45;
      contactMaxMultiplier = 2.5;
    }
    if (lv('star_4') > 0) {
      contactChargeRate = 0.95;
      contactMaxMultiplier = 6.0;
    }
    if (lv('outer_3') > 0) {
      contactChargeRate = 1.35;
      contactMaxMultiplier = 10.0;
    }

    // スロット倍率（star_2でx2, star_0でさらにx2 => 最大x4）
    let slotMultiplier = 1;
    if (lv('star_2') > 0) slotMultiplier *= 2;
    if (lv('star_0') > 0) slotMultiplier *= 2;

    // ブーストオーブLv (r2_1: 0〜3) & クローンオーブLv (m2_1: 0〜3)
    const boostRingLevel = lv('r2_1');
    const cloneRingLevel = lv('m2_1');

    // 初期追加メダル
    const extraStartMedals = lv('outer_2') + lv('outer_4');

    // === JP関連ステータス ===
    // JP射出枚数（初期10枚、jp_count_1:15枚、jp_count_2:20枚、jp_count_3:25枚）
    let jpShotsCount = 10;
    if (lv('jp_count_1') > 0) jpShotsCount = 15;
    if (lv('jp_count_2') > 0) jpShotsCount = 20;
    if (lv('jp_count_3') > 0) jpShotsCount = 25;

    // JP特殊メダル通常率（デフォルト0.70、jp_prob_1 Lv1:0.60, Lv2:0.50、jp_prob_2 Lv1:0.40, Lv2:0.30）
    let jpNormalMedalRate = 0.7;
    const prob1 = lv('jp_prob_1');
    const prob2 = lv('jp_prob_2');
    if (prob1 === 1) jpNormalMedalRate = 0.6;
    else if (prob1 >= 2) jpNormalMedalRate = 0.5;
    if (prob2 === 1) jpNormalMedalRate = 0.4;
    else if (prob2 >= 2) jpNormalMedalRate = 0.3;

    return {
      centerSlot4xUnlocked,
      roundDuration,
      dropCooldown,
      holdDropUnlocked: lv('m2_5') > 0,
      swipePickupUnlocked: lv('m2_0') > 0,
      pickupInterval,
      pickupRadius,
      holdReloadUnlocked: lv('m2_3') > 0,
      reloadInterval,
      reloadBatchSize,
      basePinScore,
      basePocketScore,
      globalScoreMultiplier,
      pinLayoutTier,
      splitLaserCount,
      catapultUnlocked,
      stopperCount,
      stopperCooldown,
      stopperWidthRatio,
      contactChargeRate,
      contactMaxMultiplier,
      bonusPocketUnlocked: lv('r2_2') > 0,
      bonusMedalExtraChance: 0,
      extraStartMedals,
      specialMedals,
      hexagramCompleted,
      boostRingLevel,
      cloneRingLevel,
      slotMultiplier,
      jpShotsCount,
      jpNormalMedalRate,
      jpFeverUnlocked: lv('jp_fever') > 0,
      jpFreezeUnlocked: lv('jp_freeze') > 0,
    };
  }
}
