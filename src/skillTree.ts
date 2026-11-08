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
    description: '投下クールタイム短縮（Lv3で約0.73秒）',
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
    neighbors: ['r1_0', 'r2_0', 'm2_5'],
    category: 'stat',
    icon: '⏱',
  },
  {
    id: 'r1_2',
    name: 'メダル基礎点 I',
    description: 'メダル1枚の基礎点数 +1',
    ...polar(ORBIT_R1, 150),
    maxLevel: 3,
    baseCost: 14,
    costScale: 1.8,
    neighbors: ['r1_3', 'r2_3', 'm2_3'],
    category: 'stat',
    icon: '💎',
  },
  {
    id: 'r1_4',
    name: 'バンパー基礎点 I',
    description: 'バンパーの基礎点数 +1',
    ...polar(ORBIT_R1, 30),
    maxLevel: 3,
    baseCost: 20,
    costScale: 1.8,
    neighbors: ['r1_3', 'r2_1', 'star_2'],
    category: 'stat',
    icon: '🎯',
  },
  {
    id: 'r1_5',
    name: '回収範囲拡大',
    description: '下皿の回収判定範囲 +25%（最大60px）',
    ...polar(ORBIT_R1, -150),
    maxLevel: 4,
    baseCost: 10,
    costScale: 1.6,
    neighbors: ['r1_0', 'm2_0', 'r2_4'],
    category: 'stat',
    icon: '🧲',
  },

  // === 下方向：メダル変化 アンカー型配置（第2円→第3円→第4円へ等間隔直進＋第4円3並び円弧ルート） ===
  {
    id: 'medal_1',
    name: 'ラッシュメダル追加',
    description: '初期メダルにラッシュメダル（得点x2・投下後即座に連射OK）を+1枚追加',
    ...polar(ORBIT_R2, 90),
    maxLevel: 1,
    baseCost: 70,
    costScale: 1,
    neighbors: ['r1_3', 'medal_2'],
    category: 'medal',
    icon: '💨',
  },
  {
    id: 'medal_2',
    name: 'バウンスメダル追加',
    description: '初期メダルにバウンスメダル（バンパー得点x4・高反発）を+1枚追加',
    ...polar(ORBIT_R3, 90),
    maxLevel: 1,
    baseCost: 180,
    costScale: 1,
    neighbors: ['medal_1', 'medal_3'],
    category: 'medal',
    icon: '💥',
  },
  {
    id: 'medal_3',
    name: 'ゴールドメダル追加',
    description: '初期メダルにゴールドメダル（得点x3）を+1枚追加',
    ...polar(ORBIT_R4, 90),
    maxLevel: 1,
    baseCost: 360,
    costScale: 1,
    neighbors: ['medal_2', 'star_3', 'medal_5'],
    category: 'medal',
    icon: '🪙',
  },
  {
    id: 'star_3',
    name: 'プラズマメダル追加',
    description: '初期メダルにプラズマメダル（得点x2・接触ピンを3秒帯電させて通過メダル倍率+0.2加算）を+1枚追加',
    ...polar(ORBIT_R4, 110),
    maxLevel: 1,
    baseCost: 580,
    costScale: 1,
    neighbors: ['medal_3'],
    category: 'medal',
    icon: '🔮',
  },
  {
    id: 'medal_5',
    name: 'クロノメダル追加',
    description: '初期メダルにクロノメダル（得点x3・入賞時+0.4秒）を+1枚追加',
    ...polar(ORBIT_R4, 70),
    maxLevel: 1,
    baseCost: 920,
    costScale: 1,
    neighbors: ['medal_3'],
    category: 'medal',
    icon: '👑',
  },

  // === 上方向：JP関連ロード（12時方向に確率2と枚数3が直列に並ぶ美しい左右対称アーチ） ===
  {
    id: 'jp_prob_1',
    name: 'JP特殊確率 I',
    description: 'JACKPOT時の特殊メダル出現率UP（通常80%→Lv1:70%/Lv2:60%）',
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
    ...polar(ORBIT_R3, -64.3),
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
    description: 'JACKPOT時の特殊メダル出現率UP（通常60%→Lv1:50% MAX）',
    ...polar(ORBIT_R3, -90),
    maxLevel: 1,
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
    ...polar(ORBIT_R3, -112.5),
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
    description: 'JACKPOT突入時1%で暗転フリーズ！100枚一気放出プレミアム演出',
    ...polar(ORBIT_R4, -110),
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
    ...polar(ORBIT_R4, -90),
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
    ...polar(ORBIT_R4, -70),
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
    name: 'スプリットライン I',
    description: '盤面に分裂ライン出現（メダル通過で分裂、最大3回で消滅）',
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
    name: 'ワープホール',
    description: '下部左右にワープホール出現、入ったメダルを最上部へワープさせてループ',
    ...polar(ORBIT_R3, -38.6),
    maxLevel: 1,
    baseCost: 400,
    costScale: 1,
    neighbors: ['r2_0', 'outer_0'],
    category: 'milestone',
    icon: '🌀',
  },
  {
    id: 'outer_0',
    name: 'スプリットライン II',
    description: 'スプリットラインの出現本数 1本→2本',
    ...polar(ORBIT_R4, -50),
    maxLevel: 1,
    baseCost: 700,
    costScale: 1,
    neighbors: ['star_1'],
    category: 'milestone',
    icon: '⚡',
  },
  // === 右上セクター（第2円: -18°：投下特化ライン） ===
  {
    id: 'm2_5',
    name: '長押し投下',
    description: '盤面の長押し連続投下を解放',
    ...polar(ORBIT_R2, -18),
    maxLevel: 1,
    baseCost: 190,
    costScale: 1,
    neighbors: ['r1_1', 'drop_spd_2'],
    category: 'milestone',
    icon: '👇',
  },
  {
    id: 'drop_spd_2',
    name: '投下間隔短縮 II',
    description: '投下クールタイム短縮（Lv3で約0.47秒）',
    ...polar(ORBIT_R3, -12.9),
    maxLevel: 3,
    baseCost: 180,
    costScale: 1.8,
    neighbors: ['m2_5', 'drop_spd_3'],
    category: 'stat',
    icon: '⚡',
  },
  {
    id: 'drop_spd_3',
    name: '投下間隔短縮 III',
    description: '投下クールタイム短縮（最大Lv3で秒間5枚・0.20秒の連射）',
    ...polar(ORBIT_R4, -10),
    maxLevel: 3,
    baseCost: 450,
    costScale: 1.8,
    neighbors: ['drop_spd_2'],
    category: 'stat',
    icon: '⚡',
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
    neighbors: ['r1_4', 'm2_2'],
    category: 'milestone',
    icon: '💫',
  },
  {
    id: 'm2_2',
    name: 'バンパー基礎点 II',
    description: '高反発バンパー増設 ＆ バンパーの基礎点数 +2',
    ...polar(ORBIT_R3, 12.9),
    maxLevel: 2,
    baseCost: 280,
    costScale: 1.9,
    neighbors: ['r2_1', 'outer_5'],
    category: 'stat',
    icon: '🎯',
  },
  {
    id: 'outer_5',
    name: 'ダブルバウンド',
    description: 'バンパーの基礎点数 x2',
    ...polar(ORBIT_R4, 10),
    maxLevel: 1,
    baseCost: 1800,
    costScale: 1,
    neighbors: ['m2_2'],
    category: 'stat',
    icon: '👑',
  },
  {
    id: 'star_2',
    name: 'ポケット倍率 I',
    description: '全ポケットの得点倍率が2倍（x2）',
    ...polar(ORBIT_R2, 54),
    maxLevel: 1,
    baseCost: 80,
    costScale: 1,
    neighbors: ['r1_4', 'm2_1', 'm2_4'],
    category: 'stat',
    icon: '🎰',
  },
  {
    id: 'm2_1',
    name: 'クローンオーブ',
    description: '盤面に分裂オーブ出現（通過でメダル分裂 Lv1:+1枚 / Lv2:分裂得点x1.5 / Lv3:+2枚）',
    ...polar(ORBIT_R3, 38.6),
    maxLevel: 3,
    baseCost: 60,
    costScale: 1.7,
    neighbors: ['star_2', 'star_0'],
    category: 'milestone',
    icon: '🌀',
  },
  {
    id: 'star_0',
    name: 'ポケット倍率 II',
    description: '全ポケットの得点倍率がさらに2倍（計x4）',
    ...polar(ORBIT_R4, 30),
    maxLevel: 1,
    baseCost: 500,
    costScale: 1,
    neighbors: ['m2_1'],
    category: 'stat',
    icon: '🎰',
  },
  {
    id: 'm2_4',
    name: '制限時間延長 IV',
    description: '制限時間 +1秒',
    ...polar(ORBIT_R3, 64.3),
    maxLevel: 3,
    baseCost: 110,
    costScale: 1.8,
    neighbors: ['star_2'],
    category: 'stat',
    icon: '⏱',
  },

  // === 左下セクター（第2円: 126°, 162°） ===
  {
    id: 'r2_3',
    name: '接触強化Ⅰ',
    description: '接触倍率上限 x2.0→x3.0 ＆ ピン接触上昇 +0.1→+0.2',
    ...polar(ORBIT_R2, 126),
    maxLevel: 1,
    baseCost: 95,
    costScale: 1,
    neighbors: ['r1_2', 'star_4'],
    category: 'milestone',
    icon: '⚡',
  },
  {
    id: 'star_4',
    name: '接触強化Ⅱ',
    description: '接触倍率上限 x3.0→x4.5 ＆ ピン+0.3 / メダル+0.6',
    ...polar(ORBIT_R3, 112.5),
    maxLevel: 1,
    baseCost: 450,
    costScale: 1,
    neighbors: ['r2_3', 'outer_3'],
    category: 'milestone',
    icon: '🌩',
  },
  {
    id: 'outer_3',
    name: 'ストラグル',
    description: 'メダル基礎点 +2 ＆ 接触最大 x6.0 ＆ ピン+0.4 / メダル+0.8',
    ...polar(ORBIT_R4, 130),
    maxLevel: 1,
    baseCost: 900,
    costScale: 1,
    neighbors: ['star_4'],
    category: 'stat',
    icon: '💎',
  },
  // === 左下セクター（第2円: 162°：装填特化ライン） ===
  {
    id: 'm2_3',
    name: '長押し装填',
    description: '投入口の長押し連続装填を解放',
    ...polar(ORBIT_R2, 162),
    maxLevel: 1,
    baseCost: 190,
    costScale: 1,
    neighbors: ['r1_2', 'reload_count', 'reload_spd_1'],
    category: 'milestone',
    icon: '⏫',
  },
  {
    id: 'reload_count',
    name: '装填枚数増加',
    description: '1回の同時装填枚数 +1枚（最大Lv3で計4枚一括装填）',
    ...polar(ORBIT_R3, 135),
    maxLevel: 3,
    baseCost: 120,
    costScale: 1.8,
    neighbors: ['m2_3', 'outer_1'],
    category: 'stat',
    icon: '🔋',
  },
  {
    id: 'reload_spd_1',
    name: '装填速度増加 I',
    description: 'メダル装填速度 +25%（最大Lv2で+50%）',
    ...polar(ORBIT_R3, 157.5),
    maxLevel: 2,
    baseCost: 100,
    costScale: 1.8,
    neighbors: ['m2_3', 'reload_spd_2'],
    category: 'stat',
    icon: '⚡',
  },
  {
    id: 'reload_spd_2',
    name: '装填速度増加 II',
    description: 'メダル装填速度 +25%（最大Lv2で+50%、計+100% 2倍速）',
    ...polar(ORBIT_R4, 170),
    maxLevel: 2,
    baseCost: 300,
    costScale: 1.8,
    neighbors: ['reload_spd_1'],
    category: 'stat',
    icon: '⚡',
  },
  {
    id: 'outer_1',
    name: '制限時間延長 V',
    description: '制限時間 +1秒',
    ...polar(ORBIT_R4, 150),
    maxLevel: 3,
    baseCost: 300,
    costScale: 1.8,
    neighbors: ['reload_count'],
    category: 'stat',
    icon: '⏱',
  },

  // === 左上セクター（第2円: -162°, -126°：回収特化ライン ＆ 獲得ポイント強化ライン） ===
  {
    id: 'r2_4',
    name: '制限時間延長 III',
    description: '制限時間 +1秒',
    ...polar(ORBIT_R2, -126),
    maxLevel: 3,
    baseCost: 40,
    costScale: 1.7,
    neighbors: ['r1_5', 'outer_2'],
    category: 'stat',
    icon: '⏱',
  },
  {
    id: 'outer_2',
    name: '獲得ポイント強化 II',
    description: '全獲得スコア +50%（1.5倍）＆ 初期メダル +1枚',
    ...polar(ORBIT_R3, -135),
    maxLevel: 1,
    baseCost: 800,
    costScale: 1,
    neighbors: ['r2_4', 'outer_4'],
    category: 'stat',
    icon: '🌾',
  },
  {
    id: 'outer_4',
    name: '獲得ポイント強化 III',
    description: '全獲得スコア +50%（計2.0倍）＆ 初期メダル +1枚',
    ...polar(ORBIT_R4, -130),
    maxLevel: 1,
    baseCost: 1000,
    costScale: 1,
    neighbors: ['outer_2'],
    category: 'stat',
    icon: '🌾',
  },
  {
    id: 'm2_0',
    name: '連続回収',
    description: '下皿の長押し・なぞり連続回収を解放',
    ...polar(ORBIT_R2, -162),
    maxLevel: 1,
    baseCost: 190,
    costScale: 1,
    neighbors: ['r1_5', 'pickup_count', 'pickup_spd_1'],
    category: 'milestone',
    icon: '👋',
  },
  {
    id: 'pickup_count',
    name: '回収枚数増加',
    description: '1回の下皿回収枚数 +1枚（最大Lv3で計4枚まとめ回収）',
    ...polar(ORBIT_R3, -157.5),
    maxLevel: 3,
    baseCost: 120,
    costScale: 1.8,
    neighbors: ['m2_0'],
    category: 'stat',
    icon: '🤲',
  },
  {
    id: 'pickup_spd_1',
    name: '回収速度増加 I',
    description: '下皿回収速度 +25%（最大Lv2で+50%）',
    ...polar(ORBIT_R3, 180),
    maxLevel: 2,
    baseCost: 100,
    costScale: 1.8,
    neighbors: ['m2_0', 'pickup_spd_2'],
    category: 'stat',
    icon: '⚡',
  },
  {
    id: 'pickup_spd_2',
    name: '回収速度増加 II',
    description: '下皿回収速度 +25%（最大Lv2で+50%、計+100% 2倍速）',
    ...polar(ORBIT_R4, -170),
    maxLevel: 2,
    baseCost: 300,
    costScale: 1.8,
    neighbors: ['pickup_spd_1'],
    category: 'stat',
    icon: '⚡',
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

    // 通常メダル5枚は常に維持し、特殊メダルノード解放で1枚ずつ純増（全解放で計10枚運用）
    const specialMedals: MedalType[] = ['normal', 'normal', 'normal', 'normal', 'normal'];
    if (lv('medal_1') > 0) specialMedals.push('rush');
    if (lv('medal_2') > 0) specialMedals.push('bounce');
    if (lv('medal_3') > 0) specialMedals.push('gold');
    if (lv('star_3') > 0) specialMedals.push('plasma');
    if (lv('medal_5') > 0) specialMedals.push('chrono');

    // 投下クールタイム（初期 1.0秒、最大短縮で 0.20秒＝秒間5枚）
    // 投下間隔短縮 I〜III（計9段階）で最大 -80%（0.20秒）まで段階的短縮
    const totalDropSpdLevels = lv('r1_0') + lv('drop_spd_2') + lv('drop_spd_3');
    const dropReduction = (totalDropSpdLevels / 9) * 0.80;
    let dropCooldown = 1.0 * (1 - dropReduction);
    dropCooldown = Math.max(0.20, dropCooldown);

    // ベースの制限時間：15.0秒 ＋ 「+1秒（最大3回）」× 5マス（r1_3, r1_1, r2_4, m2_4, outer_1）
    const timeBonusLevels =
      lv('r1_3') + lv('r1_1') + lv('r2_4') + lv('m2_4') + lv('outer_1');
    const roundDuration = 15.0 + timeBonusLevels * 1.0;

    // 下皿回収速度・枚数・範囲
    // 回収速度増加 I (+25%/Lv), II (+25%/Lv) => 計最大+100% (2倍速)
    const pickupSpdBonus = 0.25 * (lv('pickup_spd_1') + lv('pickup_spd_2'));
    let pickupInterval = 0.13 / (1 + pickupSpdBonus);
    pickupInterval = Math.max(0.04, pickupInterval);

    const pickupBatchSize = 1 + lv('pickup_count'); // 初期1枚、Lv3で最大4枚
    const pickupRadius = Math.round(30 * (1 + 0.25 * lv('r1_5')));

    // 装填速度・同時装填枚数
    // 装填速度増加 I (+25%/Lv), II (+25%/Lv) => 計最大+100% (2倍速)
    const reloadSpdBonus = 0.25 * (lv('reload_spd_1') + lv('reload_spd_2'));
    let reloadInterval = 0.16 / (1 + reloadSpdBonus);
    reloadInterval = Math.max(0.04, reloadInterval);

    const reloadBatchSize = 1 + lv('reload_count'); // 初期1枚、Lv3で最大4枚

    // バンパー（ピン）は初期0点、r1_4 (バンパー基礎点I) / m2_2 (バンパー基礎点II) / outer_5 (倍化)
    let basePinScore = lv('r1_4') * 1 + lv('m2_2') * 2;
    if (lv('outer_5') > 0) basePinScore *= 2;

    // メダル1枚の基礎点数は初期 1点
    const basePocketScore = 1 + lv('r1_2') * 1 + (lv('outer_3') > 0 ? 2 : 0);

    // 全体スコア倍率（ノード outer_2, outer_4 で各+50%、最大2.0倍）
    let globalScoreMultiplier = 1.0;
    if (lv('outer_2') > 0) globalScoreMultiplier += 0.5;
    if (lv('outer_4') > 0) globalScoreMultiplier += 0.5;

    const { unlockedLevels, totalLevels } = this.getCompletionRatio();
    const hexagramCompleted = unlockedLevels >= totalLevels;

    // ピン配置ティア (0〜4)
    let pinLayoutTier = 0;
    if (lv('r1_4') >= 1) pinLayoutTier = 1;
    if (lv('r1_4') >= 3) pinLayoutTier = 2;
    if (lv('m2_2') >= 1) pinLayoutTier = 3;
    if (lv('outer_5') >= 1) pinLayoutTier = 4;

    // スプリットライン (r2_0: 1本, outer_0: 2本)
    let splitLaserCount = 0;
    if (lv('r2_0') > 0) splitLaserCount = 1;
    if (lv('outer_0') > 0) splitLaserCount = 2;

    // サイバー・カタパルト（最上部ループ打ち上げ）
    const catapultUnlocked = lv('star_1') > 0;

    // 周期ストッパー（廃止・後方互換）
    const stopperCount = 0;
    const stopperCooldown = 3.8;
    const stopperWidthRatio = 1.15;

    // 接触帯電強化（初期値: 上限x2.0, ピン+0.1, メダル+0.4）
    let contactChargeRate = 0;
    let contactMaxMultiplier = 2.0;
    let pinChargeGain = 0.1;
    let medalChargeGain = 0.4;

    if (lv('r2_3') > 0) {
      contactChargeRate = 0.45;
      contactMaxMultiplier = 3.0;
      pinChargeGain = 0.2;
      medalChargeGain = 0.4;
    }
    if (lv('star_4') > 0) {
      contactChargeRate = 0.95;
      contactMaxMultiplier = 4.5;
      pinChargeGain = 0.3;
      medalChargeGain = 0.6;
    }
    if (lv('outer_3') > 0) {
      contactChargeRate = 1.35;
      contactMaxMultiplier = 6.0;
      pinChargeGain = 0.4;
      medalChargeGain = 0.8;
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

    // JP特殊メダル通常率（デフォルト0.80、jp_prob_1 Lv1:0.70, Lv2:0.60、jp_prob_2 Lv1:0.50）
    let jpNormalMedalRate = 0.8;
    const prob1 = lv('jp_prob_1');
    const prob2 = lv('jp_prob_2');
    if (prob1 === 1) jpNormalMedalRate = 0.7;
    else if (prob1 >= 2) jpNormalMedalRate = 0.6;
    if (prob2 >= 1) jpNormalMedalRate = 0.5;

    return {
      centerSlot4xUnlocked,
      roundDuration,
      dropCooldown,
      holdDropUnlocked: lv('m2_5') > 0,
      swipePickupUnlocked: lv('m2_0') > 0,
      pickupInterval,
      pickupRadius,
      pickupBatchSize,
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
      pinChargeGain,
      medalChargeGain,
      bonusPocketUnlocked: false,
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
      runeCometActive: false,
    };
  }
}
