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
    baseCost: 18,
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
    baseCost: 15,
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
    baseCost: 25,
    costScale: 1.7,
    neighbors: ['r1_0', 'hot_slot', 'm2_5'],
    category: 'stat',
    icon: '⏱',
  },
  {
    id: 'r1_2',
    name: 'メダル基礎点 I',
    description: 'メダル1枚の基礎点数 +1',
    ...polar(ORBIT_R1, 150),
    maxLevel: 3,
    baseCost: 40,
    costScale: 1.9,
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
    baseCost: 45,
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
    baseCost: 15,
    costScale: 1.6,
    neighbors: ['r1_0', 'm2_0', 'engraving_unlock'],
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
    baseCost: 450,
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
    baseCost: 4200,
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
    baseCost: 6400,
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
    baseCost: 12800,
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
    baseCost: 28000,
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
    baseCost: 800,
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
    baseCost: 6000,
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
    baseCost: 9500,
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
    baseCost: 8500,
    costScale: 1,
    neighbors: ['jp_prob_2', 'jp_freeze'],
    category: 'milestone',
    icon: '🪙',
  },
  {
    id: 'jp_freeze',
    name: 'JPロングフリーズ',
    description: 'JACKPOT突入時2%で暗転フリーズ！100枚一気放出プレミアム演出',
    ...polar(ORBIT_R4, -110),
    maxLevel: 1,
    baseCost: 45000,
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
    baseCost: 72000,
    costScale: 1,
    neighbors: ['jp_freeze', 'jp_fever'],
    category: 'milestone',
    icon: '🪙',
  },
  {
    id: 'jp_fever',
    name: 'JPフィーバー！',
    description: 'JACKPOT発動から3秒間、全メダル獲得得点が2倍（JPメダル含む）',
    ...polar(ORBIT_R4, -70),
    maxLevel: 1,
    baseCost: 110000,
    costScale: 1,
    neighbors: ['jp_count_3'],
    category: 'milestone',
    icon: '🔥',
  },

  // === 右上セクター（第2円: -54°, -18°） ===
  {
    id: 'hot_slot',
    name: 'ホットスロット',
    description: '光るHOTポケットにメダルが入賞するとスロットが始動（最大4保留）',
    ...polar(ORBIT_R2, -54),
    maxLevel: 1,
    baseCost: 750,
    costScale: 1,
    neighbors: ['r1_1', 'r3_0'],
    category: 'milestone',
    icon: '🎰',
  },
  {
    id: 'r3_0',
    name: 'スプリットライン',
    description: '盤面に通過メダルが2枚に分裂するラインが出現（Lv1: 1本、Lv2: 2本）',
    ...polar(ORBIT_R3, -38.6),
    maxLevel: 2,
    baseCost: 3200,
    costScale: 2.5,
    neighbors: ['hot_slot', 'outer_0'],
    category: 'milestone',
    icon: '⚡',
  },
  {
    id: 'outer_0',
    name: 'ワープホール',
    description: '下部ワープホールから上空ゲートへ高速クロス射出（通過で倍率+0.5＆25%複製）',
    ...polar(ORBIT_R4, -50),
    maxLevel: 1,
    baseCost: 18000,
    costScale: 1,
    neighbors: ['r3_0'],
    category: 'milestone',
    icon: '🌀',
  },
  // === 右上セクター（第2円: -18°：投下特化ライン） ===
  {
    id: 'm2_5',
    name: '長押し投下',
    description: '盤面の長押し連続投下を解放',
    ...polar(ORBIT_R2, -18),
    maxLevel: 1,
    baseCost: 650,
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
    baseCost: 2400,
    costScale: 1.7,
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
    baseCost: 6000,
    costScale: 1.55,
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
    baseCost: 300,
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
    baseCost: 5000,
    costScale: 1.5,
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
    baseCost: 120000,
    costScale: 1,
    neighbors: ['m2_2'],
    category: 'stat',
    icon: '👑',
  },
  {
    id: 'star_2',
    name: 'ポケット倍率 I',
    description: '全ポケットの得点倍率を基礎値の2倍へ強化（x1/x2/x4 → x2/x4/x8）',
    ...polar(ORBIT_R2, 54),
    maxLevel: 1,
    baseCost: 1200,
    costScale: 1,
    neighbors: ['r1_4', 'm2_1', 'r2_4'],
    category: 'stat',
    icon: '🎰',
  },
  {
    id: 'm2_1',
    name: 'クローンオーブ',
    description: '盤面に分裂オーブ出現（通過でメダル分裂 Lv1:+1枚 / Lv2:分裂得点x1.5 / Lv3:+2枚）',
    ...polar(ORBIT_R3, 38.6),
    maxLevel: 3,
    baseCost: 3800,
    costScale: 1.45,
    neighbors: ['star_2', 'star_0'],
    category: 'milestone',
    icon: '🌀',
  },
  {
    id: 'star_0',
    name: 'ポケット倍率 II',
    description: '全ポケットの得点倍率を基礎値の3倍へ強化（x2/x4/x8 → x3/x6/x12）',
    ...polar(ORBIT_R4, 30),
    maxLevel: 1,
    baseCost: 68000,
    costScale: 1,
    neighbors: ['m2_1'],
    category: 'stat',
    icon: '🎰',
  },
  {
    id: 'r2_4',
    name: '制限時間延長 III',
    description: '制限時間 +1秒（最大Lv4）',
    ...polar(ORBIT_R3, 64.3),
    maxLevel: 4,
    baseCost: 3200,
    costScale: 1.55,
    neighbors: ['star_2', 'prism_target'],
    category: 'stat',
    icon: '⏱',
  },
  {
    id: 'prism_target',
    name: 'プリズム',
    description: '盤面に破壊可能な結晶が出現（Lv1:1個 / Lv2:同時2個。5回当てると破壊＆2枚放出）',
    ...polar(ORBIT_R4, 50),
    maxLevel: 2,
    baseCost: 4200,
    costScale: 2,
    neighbors: ['r2_4'],
    category: 'milestone',
    icon: '💠',
  },

  // === 左下セクター（第2円: 126°, 162°） ===
  {
    id: 'r2_3',
    name: '接触強化Ⅰ',
    description: '接触倍率上限 x2.0→x3.0 ＆ ピン接触上昇 +0.1→+0.2',
    ...polar(ORBIT_R2, 126),
    maxLevel: 1,
    baseCost: 850,
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
    baseCost: 6600,
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
    baseCost: 93000,
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
    baseCost: 650,
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
    baseCost: 1600,
    costScale: 1.7,
    neighbors: ['m2_3'],
    category: 'stat',
    icon: '🔋',
  },
  {
    id: 'reload_spd_1',
    name: '装填速度増加 I',
    description: 'メダル装填速度 +25%（最大Lv2で+50%）',
    ...polar(ORBIT_R3, 157.5),
    maxLevel: 2,
    baseCost: 1200,
    costScale: 1.7,
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
    baseCost: 5500,
    costScale: 1.55,
    neighbors: ['reload_spd_1'],
    category: 'stat',
    icon: '⚡',
  },

  // === 左上セクター（第2円: -162°回収ライン ＆ 刻印ツリー 2分岐ライン） ===
  {
    id: 'engraving_unlock',
    name: '刻印開放',
    description: 'ホーム画面「刻印」を解放し、初期刻印3種（コメット・ソーラー・トゥインクル）が使用可能になる',
    ...polar(ORBIT_R2, -126),
    maxLevel: 1,
    baseCost: 500,
    costScale: 1,
    neighbors: ['r1_5', 'engraving_mid'],
    category: 'milestone',
    icon: '✧',
  },
  {
    id: 'engraving_mid',
    name: '中級刻印開放',
    description: '中級刻印3種（サジタリウス・ドラコ・ジェミニ）を解放する',
    ...polar(ORBIT_R3, -135),
    maxLevel: 1,
    baseCost: 8000,
    costScale: 1,
    neighbors: ['engraving_unlock', 'engraving_slot2', 'engraving_adv'],
    category: 'milestone',
    icon: '✶',
  },
  {
    id: 'engraving_slot2',
    name: 'スロット2枠目開放',
    description: '刻印スロットの2枠目を解放し、最大2種類の刻印を同時に装着できる',
    ...polar(ORBIT_R4, -150),
    maxLevel: 1,
    baseCost: 28000,
    costScale: 1,
    neighbors: ['engraving_mid'],
    category: 'milestone',
    icon: '❖',
  },
  {
    id: 'engraving_adv',
    name: '上級刻印開放',
    description: '上級刻印4種（ペガサス・フォルトゥナ・ケンタウルス・アルタイル）を解放する',
    ...polar(ORBIT_R4, -130),
    maxLevel: 1,
    baseCost: 36000,
    costScale: 1,
    neighbors: ['engraving_mid'],
    category: 'milestone',
    icon: '✪',
  },
  {
    id: 'm2_0',
    name: '連続回収',
    description: '下皿の長押し・なぞり連続回収を解放',
    ...polar(ORBIT_R2, -162),
    maxLevel: 1,
    baseCost: 650,
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
    baseCost: 1600,
    costScale: 1.7,
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
    baseCost: 1200,
    costScale: 1.7,
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
    baseCost: 5500,
    costScale: 1.55,
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
    if (cost >= 100000) {
      cost = Math.round(cost / 1000) * 1000;
    } else if (cost >= 10000) {
      cost = Math.round(cost / 100) * 100;
    } else if (cost >= 100) {
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

    // ベースの制限時間：15.0秒 ＋ 延長 I(+3) / II(+3) / III(+4) で最大 25.0秒
    const timeBonusLevels = lv('r1_3') + lv('r1_1') + lv('r2_4');
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

    // 全体スコア倍率（獲得ポイント強化ノード整理に伴い1.0倍固定）
    const globalScoreMultiplier = 1.0;

    const { unlockedLevels, totalLevels } = this.getCompletionRatio();
    const hexagramCompleted = unlockedLevels >= totalLevels;

    // ピン配置ティア (0〜4)
    let pinLayoutTier = 0;
    if (lv('r1_4') >= 1) pinLayoutTier = 1;
    if (lv('r1_4') >= 3) pinLayoutTier = 2;
    if (lv('m2_2') >= 1) pinLayoutTier = 3;
    if (lv('outer_5') >= 1) pinLayoutTier = 4;

    // スプリットライン (r3_0: Lv1で1本, Lv2で2本)
    let splitLaserCount = 0;
    if (lv('r3_0') >= 1) splitLaserCount = lv('r3_0');

    // サイバー・カタパルト（最上部ループ打ち上げ：第4円 outer_0）
    const catapultUnlocked = lv('outer_0') > 0;

    // ホットスロット（第2円 hot_slot）
    const hotSlotUnlocked = lv('hot_slot') > 0;

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

    // スロット倍率（star_2で基礎x2, star_0で基礎x3 => 中央 4→8→12、他ポケットも整数倍）
    const slotMultiplier = 1 + (lv('star_2') > 0 ? 1 : 0) + (lv('star_0') > 0 ? 1 : 0);

    // ブーストオーブLv (r2_1: 0〜3) & クローンオーブLv (m2_1: 0〜3)
    const boostRingLevel = lv('r2_1');
    const cloneRingLevel = lv('m2_1');

    // 初期追加メダル（獲得ポイント強化廃止に伴い0固定）
    const extraStartMedals = 0;

    // 刻印ツリー解放状態
    const engravingUnlocked = lv('engraving_unlock') > 0;
    const engravingMidUnlocked = engravingUnlocked && lv('engraving_mid') > 0;
    const engravingSlot2Unlocked = engravingUnlocked && lv('engraving_slot2') > 0;
    const engravingAdvUnlocked = engravingUnlocked && lv('engraving_adv') > 0;

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
      prismTargetUnlocked: lv('prism_target') > 0,
      prismTargetCount: lv('prism_target'),
      hotSlotUnlocked,
      engravingUnlocked,
      engravingMidUnlocked,
      engravingSlot2Unlocked,
      engravingAdvUnlocked,
      runeCometActive: false,
      runeCentaurusActive: false,
    };
  }
}

// ============================================================
// 強化画面の効果プレビュー（現在値 → 次Lv の数値差）
// 実際の computeStats() を「Lv+1」状態と比較して生成するため、
// ノード定義の変更や他ノードの取得状況に自動追従する。
// ============================================================
export interface EffectPreviewRow {
  label: string;
  from: string;
  to: string;
}

function fmtNum(n: number, digits: number = 2): string {
  return String(parseFloat(n.toFixed(digits)));
}

export function getNodeEffectPreview(state: SkillTreeState, node: SkillNodeDef): EffectPreviewRow[] {
  const lv = state.getLevel(node.id);
  const isMax = lv >= node.maxLevel;

  const alt = new SkillTreeState();
  Object.assign(alt.levels, state.levels);
  alt.levels[node.id] = isMax ? Math.max(0, lv - 1) : lv + 1;

  const a = isMax ? alt.computeStats() : state.computeStats();
  const b = isMax ? state.computeStats() : alt.computeStats();
  const rows: EffectPreviewRow[] = [];
  const push = (label: string, from: string, to: string) => rows.push({ label, from, to });

  if (a.roundDuration !== b.roundDuration) {
    push('制限時間', `${fmtNum(a.roundDuration, 1)}秒`, `${fmtNum(b.roundDuration, 1)}秒`);
  }
  if (a.dropCooldown !== b.dropCooldown) {
    push('投下クールタイム', `${fmtNum(a.dropCooldown)}秒`, `${fmtNum(b.dropCooldown)}秒`);
  }
  if (a.basePinScore !== b.basePinScore) {
    push('バンパー基礎点', `${a.basePinScore}点`, `${b.basePinScore}点`);
  } else if (node.id === 'outer_5') {
    push('バンパー基礎点', 'x1', 'x2');
  }
  if (a.basePocketScore !== b.basePocketScore) {
    push('メダル基礎点', `${a.basePocketScore}点`, `${b.basePocketScore}点`);
  }
  if (a.centerSlot4xUnlocked !== b.centerSlot4xUnlocked) {
    push('中央ポケット倍率', `x${1 * a.slotMultiplier}`, `x${4 * b.slotMultiplier}`);
  }
  if (a.slotMultiplier !== b.slotMultiplier) {
    const fmtAllPockets = (s: ComputedStats) => {
      const c = (s.centerSlot4xUnlocked ? 4 : 1) * s.slotMultiplier;
      return `x${1 * s.slotMultiplier} / x${2 * s.slotMultiplier} / x${c}`;
    };
    push('全ポケット倍率 (端/中/中央)', fmtAllPockets(a), fmtAllPockets(b));
  }
  if (a.pickupInterval !== b.pickupInterval) {
    push('回収速度', `x${fmtNum(0.13 / a.pickupInterval)}`, `x${fmtNum(0.13 / b.pickupInterval)}`);
  }
  if (a.reloadInterval !== b.reloadInterval) {
    push('装填速度', `x${fmtNum(0.16 / a.reloadInterval)}`, `x${fmtNum(0.16 / b.reloadInterval)}`);
  }
  if (a.pickupBatchSize !== b.pickupBatchSize) {
    push('1回の回収枚数', `${a.pickupBatchSize}枚`, `${b.pickupBatchSize}枚`);
  }
  if (a.reloadBatchSize !== b.reloadBatchSize) {
    push('同時装填枚数', `${a.reloadBatchSize}枚`, `${b.reloadBatchSize}枚`);
  }
  if (a.pickupRadius !== b.pickupRadius) {
    push('回収範囲', `${a.pickupRadius}px`, `${b.pickupRadius}px`);
  }
  if (a.contactMaxMultiplier !== b.contactMaxMultiplier) {
    push('接触倍率の上限', `x${fmtNum(a.contactMaxMultiplier, 1)}`, `x${fmtNum(b.contactMaxMultiplier, 1)}`);
  }
  if (a.pinChargeGain !== b.pinChargeGain) {
    push('ピン接触の上昇量', `+${fmtNum(a.pinChargeGain, 1)}`, `+${fmtNum(b.pinChargeGain, 1)}`);
  }
  if (a.medalChargeGain !== b.medalChargeGain) {
    push('メダル接触の上昇量', `+${fmtNum(a.medalChargeGain, 1)}`, `+${fmtNum(b.medalChargeGain, 1)}`);
  }
  if (a.jpShotsCount !== b.jpShotsCount) {
    push('JP射出枚数', `${a.jpShotsCount}枚`, `${b.jpShotsCount}枚`);
  }
  if (a.jpNormalMedalRate !== b.jpNormalMedalRate) {
    push(
      'JP特殊メダル出現率',
      `${Math.round((1 - a.jpNormalMedalRate) * 100)}%`,
      `${Math.round((1 - b.jpNormalMedalRate) * 100)}%`
    );
  }
  if (a.specialMedals.length !== b.specialMedals.length) {
    push('初期メダル枚数', `${a.specialMedals.length}枚`, `${b.specialMedals.length}枚`);
  }
  if (a.boostRingLevel !== b.boostRingLevel) {
    push(
      'ブーストオーブ倍率',
      a.boostRingLevel > 0 ? `x${a.boostRingLevel + 1}` : 'なし',
      `x${b.boostRingLevel + 1}`
    );
  }
  if (a.cloneRingLevel !== b.cloneRingLevel) {
    const cloneCount = (lvl: number) => (lvl >= 3 ? 2 : lvl >= 1 ? 1 : 0);
    const cloneBonus = (lvl: number) => (lvl >= 2 ? 1.5 : 1);
    if (cloneCount(a.cloneRingLevel) !== cloneCount(b.cloneRingLevel)) {
      push(
        '分裂で増える枚数',
        cloneCount(a.cloneRingLevel) > 0 ? `+${cloneCount(a.cloneRingLevel)}枚` : 'なし',
        `+${cloneCount(b.cloneRingLevel)}枚`
      );
    }
    if (cloneBonus(a.cloneRingLevel) !== cloneBonus(b.cloneRingLevel)) {
      push('分裂メダルの得点', `x${cloneBonus(a.cloneRingLevel)}`, `x${cloneBonus(b.cloneRingLevel)}`);
    }
  }
  if (a.splitLaserCount !== b.splitLaserCount) {
    push('スプリットライン', `${a.splitLaserCount}本`, `${b.splitLaserCount}本`);
  }
  if (a.prismTargetCount !== b.prismTargetCount) {
    push('プリズム出現数', `${a.prismTargetCount}個`, `${b.prismTargetCount}個`);
  }

  const unlockFlags: Array<[keyof ComputedStats, string, string]> = [
    ['hotSlotUnlocked', 'hot_slot', 'ホットスロット'],
    ['holdDropUnlocked', 'm2_5', '長押し連続投下'],
    ['swipePickupUnlocked', 'm2_0', '連続回収（なぞり）'],
    ['holdReloadUnlocked', 'm2_3', '長押し連続装填'],
    ['catapultUnlocked', 'outer_0', 'ワープホール'],
    ['jpFeverUnlocked', 'jp_fever', 'JPフィーバー'],
    ['jpFreezeUnlocked', 'jp_freeze', 'JPロングフリーズ'],
    ['engravingUnlocked', 'engraving_unlock', '刻印'],
    ['engravingMidUnlocked', 'engraving_mid', '中級刻印'],
    ['engravingSlot2Unlocked', 'engraving_slot2', '刻印スロット2枠目'],
    ['engravingAdvUnlocked', 'engraving_adv', '上級刻印'],
  ];
  for (const [key, nid, label] of unlockFlags) {
    if ((!a[key] && b[key]) || node.id === nid) {
      push(label, '未解放', '解放');
    }
  }

  return rows;
}