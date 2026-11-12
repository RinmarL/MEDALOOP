import {
  ComputedStats,
  CyberCatapult,
  GuideRail,
  GuideRailSegment,
  LuckyRing,
  MedalEntity,
  MedalType,
  PinEntity,
  PocketSlot,
  SplitLaser,
  StopperBar,
} from './types';

// 厳守物理パラメータ（単位：px・秒）
export const DT = 1 / 240; // 物理更新：1/240秒
export const MEDAL_RADIUS = 15; // メダル半径：15 (直径30px)
export const GRAVITY = 3000; // 下向き重力加速度：3000（落ち着いて軌道を追える自然な速度に調整）
export const MAX_FALL_SPEED = 500; // 最高落下速度（終端速度キャップ）
export const FRICTION_DECEL = 900; // 滑り摩擦による減速度：900
export const INIT_VX_RANGE = 30; // 投入時の横速度：-30〜+30の一様乱数
export const INIT_VY = 40; // 投入時の下向き速度：40
export const RESTITUTION = 0.62; // メダル同士の反発係数：0.62
export const TANGENT_COLLISION_RETENTION = 0.96; // 衝突時の接線方向の速度保持率：0.96
export const CONTACT_NORMAL_THRESHOLD = 50; // 接触扱いにする法線相対速度：50未満
export const TANGENT_CONTACT_RETENTION = 0.985; // 接触中の接線方向の速度保持率：0.985／更新

// 盤面および下部スプリットコンソール論理座標
export const BOARD_WIDTH = 460;
export const BOARD_HEIGHT = 750;
export const WALL_LEFT = 22;
export const WALL_RIGHT = BOARD_WIDTH - 22;
export const DROP_ZONE_MAX_Y = 96;
export const POCKET_ENTRY_Y = 540;
export const POCKET_TRIGGER_Y = 570;
export const POCKET_EXIT_Y = 598;

// 下皿（左下エリア：高さをコンパクトに縮小し3Dコイン積載に対応）
export const TRAY_LEFT = 32;
export const TRAY_RIGHT = 286;
export const TRAY_TOP_Y = 616;
export const TRAY_BOTTOM_Y = 724;

// パチスロ式メダル投入口（右下エリア：高さをコンパクトに縮小）
export const INSERT_BOX_LEFT = 300;
export const INSERT_BOX_RIGHT = 428;
export const INSERT_BOX_TOP = 616;
export const INSERT_BOX_BOTTOM = 724;

// 下皿内の3Dコインスタック列X座標（8列）
export const TRAY_STACK_COLS = [52, 82, 112, 142, 172, 202, 232, 262];
export const TRAY_STACK_STEP_Y = 6.0; // 3Dコイン1枚あたりの積み重ね厚み(px)

export interface PhysicsCallbacks {
  onPinHit: (medal: MedalEntity, pin: PinEntity) => void;
  onPocketPass: (medal: MedalEntity, pocket: PocketSlot) => void;
  onMedalClink: (intensity: number) => void;
  onStopperToggle?: (active: boolean) => void;
  onLaserSplit?: (x: number, y: number) => void;
  onCatapultLaunch?: (medal: MedalEntity, catapult: CyberCatapult, originX?: number, originY?: number) => void;
  onLuckyRingPass?: (medal: MedalEntity, ring: LuckyRing) => void;
  onJackpot?: () => void;
  onPocketToggleLamp?: (pocket: PocketSlot, lit: boolean) => void;
  onRailHit?: (medal: MedalEntity, rail: GuideRail) => void;
  onPinElectrified?: (pin: PinEntity, medal: MedalEntity) => void;
  onElectrifiedPinHit?: (pin: PinEntity, medal: MedalEntity, newMultiplier: number) => void;
  onMedalElectrified?: (a: MedalEntity, b: MedalEntity) => void;
}

const LUCKY_RING_SPOTS = [
  { x: 105, y: 230 }, // 上部左
  { x: 355, y: 230 }, // 上部右
  { x: 230, y: 195 }, // バンパー真上中央
  { x: 135, y: 330 }, // バンパー左下横
  { x: 325, y: 330 }, // バンパー右下横
  { x: 230, y: 415 }, // 下中央
];

/** 点 (px, py) と線分 (x1, y1)-(x2, y2) の最短距離 */
function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** 2線分 A-B の交差判定 */
function segmentsIntersect(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number
): boolean {
  const cross = (ux: number, uy: number, vx: number, vy: number) => ux * vy - uy * vx;
  const d1 = cross(bx2 - bx1, by2 - by1, ax1 - bx1, ay1 - by1);
  const d2 = cross(bx2 - bx1, by2 - by1, ax2 - bx1, ay2 - by1);
  const d3 = cross(ax2 - ax1, ay2 - ay1, bx1 - ax1, by1 - ay1);
  const d4 = cross(ax2 - ax1, ay2 - ay1, bx2 - ax1, by2 - ay1);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** 2線分 A-B の最短距離 */
function distSegmentToSegment(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number
): number {
  if (segmentsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2)) return 0;
  return Math.min(
    distPointToSegment(ax1, ay1, bx1, by1, bx2, by2),
    distPointToSegment(ax2, ay2, bx1, by1, bx2, by2),
    distPointToSegment(bx1, by1, ax1, ay1, ax2, ay2),
    distPointToSegment(bx2, by2, ax1, ay1, ax2, ay2)
  );
}

export class PhysicsWorld {
  public medals: MedalEntity[] = [];
  public pins: PinEntity[] = [];
  public stoppers: StopperBar[] = [];
  public splitLasers: SplitLaser[] = [];
  public catapults: CyberCatapult[] = [];
  public pockets: PocketSlot[] = [];
  public guideRails: GuideRail[] = [];
  public luckyRing: LuckyRing = {
    x: 230,
    y: 195,
    radius: 17, // リングと同じ外径サイズ感（コアr=16.5, 公転リング込みで最大r=22）
    kind: 'mult',
    active: false,
    respawnTimer: 0,
    respawnDuration: 1.0,
    activeTimer: 5.0,
    pulsePhase: 0,
    lastSpotIndex: -1,
  };
  private nextMedalId: number = 1;
  private accumulator: number = 0;
  private stepCount: number = 0;
  private lastStats?: ComputedStats;

  /**
   * バンパー・ピン・カタパルト・他ギミックと重ならないランダムなスプリットライン座標を抽選する。
   */
  public getRandomLaserLine(excludeLaserId?: number): { x1: number; y1: number; x2: number; y2: number } {
    const halfLen = 26; // 線分全長 52px
    const podExtend = 5; // 両端エミッターポッドの軸方向張り出し分

    let bestHardValid: { line: { x1: number; y1: number; x2: number; y2: number }; score: number } | null = null;
    let bestFallback: { line: { x1: number; y1: number; x2: number; y2: number }; score: number } | null = null;

    for (let attempt = 0; attempt < 120; attempt++) {
      // 盤面中段エリア（x: 95〜365, y: 200〜425）から候補を生成
      const cx = 95 + Math.random() * (BOARD_WIDTH - 190);
      const cy = 200 + Math.random() * 225;
      const ang = (Math.random() - 0.5) * 0.48; // 水平±14度
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);

      const line = {
        x1: Math.round(cx - cosA * halfLen),
        y1: Math.round(cy - sinA * halfLen),
        x2: Math.round(cx + cosA * halfLen),
        y2: Math.round(cy + sinA * halfLen),
      };

      // 両端エミッター外縁まで含めた実描画ベース線分でクリアランスを判定
      const ldx = line.x2 - line.x1;
      const ldy = line.y2 - line.y1;
      const llen = Math.hypot(ldx, ldy) || 1;
      const ux = ldx / llen;
      const uy = ldy / llen;
      const ex1 = line.x1 - ux * podExtend;
      const ey1 = line.y1 - uy * podExtend;
      const ex2 = line.x2 + ux * podExtend;
      const ey2 = line.y2 + uy * podExtend;

      let minHardSlack = Infinity;
      for (const pin of this.pins) {
        // バンパーは外周ネオンリング(r+4)+ポッド幅+余白、通常ピンは本体+ポッド幅+余白を確保
        const pad = pin.kind === 'bumper' ? 18 : 14;
        const slack = distPointToSegment(pin.x, pin.y, ex1, ey1, ex2, ey2) - (pin.radius + pad);
        if (slack < minHardSlack) minHardSlack = slack;
      }
      for (const cat of this.catapults) {
        const slack = distPointToSegment(cat.x, cat.y, ex1, ey1, ex2, ey2) - (cat.radius + 16);
        if (slack < minHardSlack) minHardSlack = slack;
      }

      let minSoftSlack = Infinity;
      for (const other of this.splitLasers) {
        if (other.id === excludeLaserId || !other.active) continue;
        const slack =
          distSegmentToSegment(ex1, ey1, ex2, ey2, other.x1, other.y1, other.x2, other.y2) - 34;
        if (slack < minSoftSlack) minSoftSlack = slack;
      }
      if (this.luckyRing.active) {
        const slack =
          distPointToSegment(this.luckyRing.x, this.luckyRing.y, ex1, ey1, ex2, ey2) -
          (this.luckyRing.radius + 14);
        if (slack < minSoftSlack) minSoftSlack = slack;
      }

      // 障害物（ピン・バンパー・カタパルト）と他ギミックのすべてと干渉しなければ即採用
      if (minHardSlack >= 0 && minSoftSlack >= 0) {
        return line;
      }
      if (minHardSlack >= 0 && (!bestHardValid || minSoftSlack > bestHardValid.score)) {
        bestHardValid = { line, score: minSoftSlack };
      }
      if (!bestFallback || minHardSlack > bestFallback.score) {
        bestFallback = { line, score: minHardSlack };
      }
    }

    return (bestHardValid ?? bestFallback)!.line;
  }

  public setupBoard(stats: ComputedStats): void {
    const centerX = BOARD_WIDTH * 0.5;
    this.pins = [];
    this.stoppers = [];
    this.splitLasers = [];
    this.catapults = [];
    this.pockets = [];
    this.guideRails = [];

    let pinId = 1;

    // 1. 中央3連トライアングルバンパー（ネオン発光・大反発・ピンと同じ基礎点）
    const bumpers = [
      { x: 168, y: 246, radius: 23 }, // 上左バンパー
      { x: 292, y: 246, radius: 23 }, // 上右バンパー
      { x: 230, y: 326, radius: 25 }, // 下中央バンパー
    ];
    for (const b of bumpers) {
      this.pins.push({
        id: pinId++,
        x: b.x,
        y: b.y,
        radius: b.radius,
        baseScore: stats.basePinScore,
        kind: 'bumper',
        hitAnim: 0,
        electrifiedTimer: 0,
      });
    }

    // 2. なめらかなL字ガイドレール（上部左右のコーナーに配置し、端っこ落としを優雅に中央へ誘導＆スタック完全防止）
    const leftPoints = [
      { x: 22, y: 60 },
      { x: 23, y: 90 },
      { x: 35, y: 120 },
      { x: 58, y: 142 },
      { x: 86, y: 154 },
    ];
    const rightPoints = leftPoints.map((pt) => ({ x: BOARD_WIDTH - pt.x, y: pt.y }));

    function createSegments(points: { x: number; y: number }[]): GuideRailSegment[] {
      const segs: GuideRailSegment[] = [];
      for (let i = 0; i < points.length - 1; i++) {
        segs.push({
          x1: points[i].x,
          y1: points[i].y,
          x2: points[i + 1].x,
          y2: points[i + 1].y,
        });
      }
      return segs;
    }

    this.guideRails = [
      {
        id: 1,
        side: 'left',
        points: leftPoints,
        segments: createSegments(leftPoints),
        hitAnim: 0,
      },
      {
        id: 2,
        side: 'right',
        points: rightPoints,
        segments: createSegments(rightPoints),
        hitAnim: 0,
      },
    ];

    // 3. 釘（ピン）配置：洗練された抜け感と完璧な千鳥ダイヤモンド対称配置（案1: チャッカーガード型・計24本）
    const pinCoords = [
      // 上部1列目 (5本：±6pxの千鳥チルトで水平50px間隔による3枚ピラミッドアーチを防止)
      { x: 130, y: 169 },
      { x: 180, y: 181 },
      { x: 230, y: 169 },
      { x: 280, y: 181 },
      { x: 330, y: 169 },

      // 上部外側振り分け (2本：バンパー上部アプローチを開放し外側を中央へ誘導)
      { x: 84, y: 216 },
      { x: 376, y: 216 },

      // バンパー外側ガード (2本：バンパー外側へ逸れるメダルをバンパーへ跳ね返す)
      { x: 94, y: 286 },
      { x: 366, y: 286 },

      // バンパー下・中段受け (5本：中央キーストーンピンを軸に美しく散らす千鳥配置)
      { x: 75, y: 376 },
      { x: 140, y: 376 },
      { x: 230, y: 410 }, // ユーザー指定：画像下端付近（y: 365 -> 410）へ移動
      { x: 320, y: 376 },
      { x: 385, y: 376 },

      // スロット境界スプリット (4本：4本の仕切り棒の直上ピッタリに配置)
      { x: 105, y: 448 },
      { x: 188, y: 448 },
      { x: 272, y: 448 },
      { x: 355, y: 448 },

      // 最下段・各スロット誘導＆中央チャッカーガード (6本：門番ピン間隔48px・高低差4pxチルトでピラミッドスタック完全防止)
      { x: 64, y: 496 },
      { x: 147, y: 496 },
      { x: 206, y: 494 },
      { x: 254, y: 498 },
      { x: 313, y: 496 },
      { x: 396, y: 496 },
    ];

    pinCoords.forEach((pt, idx) => {
      let isBumper = false;
      let radius = 6.0;
      let mult = 1.0;

      // Tier向上でバンパー横ピンがミニバンパー化（高反発・触れやすさ向上のみ、得点はピンと同一）
      if (stats.pinLayoutTier >= 2 && (idx === 7 || idx === 8)) {
        isBumper = true;
        radius = 9.0;
      }
      if (stats.pinLayoutTier >= 3 && idx === 11) { // 中段中央キーストーンピン
        isBumper = true;
        radius = 8.5;
      }

      this.pins.push({
        id: pinId++,
        x: pt.x,
        y: pt.y,
        radius,
        baseScore: stats.basePinScore,
        kind: isBumper ? 'bumper' : 'normal',
        hitAnim: 0,
        electrifiedTimer: 0,
      });
    });

    // 3. サイバー・カタパルト（下部左右から最上部へ打ち上げループ）
    if (stats.catapultUnlocked) {
      this.catapults.push(
        { id: 1, side: 'left', x: 42, y: 486, radius: 18, launchAnim: 0 },
        { id: 2, side: 'right', x: 418, y: 486, radius: 18, launchAnim: 0 }
      );
    }

    // ラッキーリングを先に配置し、直後のスプリットライン生成時にも重複回避できるようにする
    this.lastStats = stats;
    this.relocateLuckyRing(stats);

    // 4. スプリットライン（長さ約52px、最大3回通過または5秒で消滅→3秒クールダウン、通過でメダル分裂）
    if (stats.splitLaserCount >= 1) {
      const line1 = this.getRandomLaserLine(1);
      this.splitLasers.push({
        id: 1,
        ...line1,
        active: true,
        timer: 0,
        activeDuration: 5.0,
        cooldownDuration: 3.0,
        pulsePhase: 0,
        splitCount: 0,
      });
    }
    if (stats.splitLaserCount >= 2) {
      const line2 = this.getRandomLaserLine(2);
      this.splitLasers.push({
        id: 2,
        ...line2,
        active: false,
        timer: 1.5, // 交互に出現するようオフセット
        activeDuration: 5.0,
        cooldownDuration: 3.0,
        pulsePhase: Math.PI,
        splitCount: 0,
      });
    }

    // 下部ポケット（5レーン）：初期倍率は 1倍 と 2倍 のみ、起点ノード解放で中央が 4倍、スロット倍率強化で全体乗算
    const totalInnerW = WALL_RIGHT - WALL_LEFT;
    const slotCount = 5;
    const slotW = totalInnerW / slotCount;
    const centerBase = stats.centerSlot4xUnlocked ? 4 : 1;
    const baseMultipliers = [1, 2, centerBase, 2, 1];
    const multipliers = baseMultipliers.map((m) => m * stats.slotMultiplier);

    for (let i = 0; i < slotCount; i++) {
      const x1 = WALL_LEFT + i * slotW;
      const x2 = x1 + slotW;
      const isCenter = i === 2;
      const spawnsBonus = isCenter && stats.bonusPocketUnlocked;
      const mult = multipliers[i];
      this.pockets.push({
        index: i,
        x1,
        x2,
        label: spawnsBonus ? `x${mult} +1M` : `x${mult}`,
        scoreMultiplier: mult,
        spawnsBonusMedal: spawnsBonus,
        flashAnim: 0,
        lit: false,
      });
    }
  }

  public resetPocketsLit(): void {
    for (const p of this.pockets) {
      p.lit = false;
    }
  }

  private relocateLuckyRing(stats?: ComputedStats): void {
    const curStats = stats || this.lastStats;
    if (!curStats || (curStats.boostRingLevel <= 0 && curStats.cloneRingLevel <= 0)) {
      this.luckyRing.active = false;
      this.luckyRing.respawnTimer = 999;
      return;
    }

    // 前回と異なるスポット候補のうち、稼働中のスプリットラインと重ならない位置を優先抽選
    const otherSpots = LUCKY_RING_SPOTS.map((_, i) => i).filter((i) => i !== this.luckyRing.lastSpotIndex);
    const nonLastSpots = otherSpots.length > 0 ? otherSpots : [0];
    const minRingPad = this.luckyRing.radius + 14;
    const clearSpots = nonLastSpots.filter((idx) => {
      const s = LUCKY_RING_SPOTS[idx];
      return this.splitLasers.every(
        (laser) => !laser.active || distPointToSegment(s.x, s.y, laser.x1, laser.y1, laser.x2, laser.y2) >= minRingPad
      );
    });
    const pool = clearSpots.length > 0 ? clearSpots : nonLastSpots;
    const spotIdx = pool[Math.floor(Math.random() * pool.length)];
    this.luckyRing.lastSpotIndex = spotIdx;
    const spot = LUCKY_RING_SPOTS[spotIdx];
    this.luckyRing.x = spot.x;
    this.luckyRing.y = spot.y;

    if (curStats.boostRingLevel > 0 && curStats.cloneRingLevel > 0) {
      this.luckyRing.kind = Math.random() < 0.5 ? 'mult' : 'split';
    } else if (curStats.boostRingLevel > 0) {
      this.luckyRing.kind = 'mult';
    } else {
      this.luckyRing.kind = 'split';
    }

    this.luckyRing.active = true;
    this.luckyRing.activeTimer = 5.0; // 5秒タイムリミット！
    this.luckyRing.respawnTimer = 0;
  }

  public spawnInitialTrayMedals(types: MedalType[]): void {
    // 初期メダルを中央寄りのスタック列に3Dタワー状に積んで配置
    const preferredCols = [2, 3, 1, 4, 2, 3];
    const colCounts = new Array(TRAY_STACK_COLS.length).fill(0);

    types.forEach((type, idx) => {
      const colIdx = preferredCols[idx % preferredCols.length];
      const stackIdx = colCounts[colIdx]++;
      const jitterX = Math.sin(idx * 2.3 + 1.1) * 2.5;
      const x = TRAY_STACK_COLS[colIdx] + jitterX;
      const y = TRAY_BOTTOM_Y - 16 - stackIdx * TRAY_STACK_STEP_Y - 12 - idx * 4;
      const m = this.spawnMedal(x, y, type, 'tray');
      m.vx = 0;
      m.vy = 40;
    });
  }

  public spawnMedal(
    x: number,
    y: number,
    type: MedalType,
    zone: 'board' | 'tray' = 'board'
  ): MedalEntity {
    const minX = (zone === 'tray' ? TRAY_LEFT : WALL_LEFT) + MEDAL_RADIUS + 2;
    const maxX = (zone === 'tray' ? TRAY_RIGHT : WALL_RIGHT) - MEDAL_RADIUS - 2;
    const clampedX = Math.max(minX, Math.min(maxX, x));

    const vx = (Math.random() * 2 - 1) * INIT_VX_RANGE;
    const vy = INIT_VY;

    let baseMult = 1.0;
    if (type === 'gold' || type === 'chrono') baseMult = 3.0;
    else if (type === 'plasma' || type === 'rush') baseMult = 2.0;
    else if (type === 'bounce' || type === 'bonus') baseMult = 1.5;

    const medal: MedalEntity = {
      id: this.nextMedalId++,
      type,
      x: clampedX,
      y,
      vx,
      vy,
      radius: MEDAL_RADIUS,
      zone,
      chargeMultiplier: baseMult,
      contactFlash: 0,
      passedPocket: zone === 'tray',
      lastPinHitId: -1,
      pinHitCooldown: 0,
      contactCooldown: 0,
      boardElapsedSec: 0,
      pinBounceCount: 0,
      stuckSec: 0,
      anchorX: clampedX,
      anchorY: y,
      unstickCount: 0,
      trail: [{ x: clampedX, y }],
    };
    this.medals.push(medal);
    return medal;
  }

  public update(
    frameDeltaSec: number,
    stats: ComputedStats,
    callbacks: PhysicsCallbacks
  ): void {
    const clampedDelta = Math.min(frameDeltaSec, 0.1);
    this.accumulator += clampedDelta;

    for (const pin of this.pins) {
      if (pin.hitAnim > 0) {
        pin.hitAnim = Math.max(0, pin.hitAnim - clampedDelta * 4);
      }
      if (pin.electrifiedTimer > 0) {
        pin.electrifiedTimer = Math.max(0, pin.electrifiedTimer - clampedDelta);
      }
    }
    for (const pocket of this.pockets) {
      if (pocket.flashAnim > 0) {
        pocket.flashAnim = Math.max(0, pocket.flashAnim - clampedDelta * 3);
      }
    }
    for (const rail of this.guideRails) {
      if (rail.hitAnim > 0) {
        rail.hitAnim = Math.max(0, rail.hitAnim - clampedDelta * 4);
      }
    }
    // カタパルトのアニメーション減衰
    for (const cat of this.catapults) {
      if (cat.launchAnim > 0) {
        cat.launchAnim = Math.max(0, cat.launchAnim - clampedDelta * 4);
      }
    }

    // スプリットラインのサイクル更新（最大3回通過または5秒で消滅→3秒クールダウン）
    for (const laser of this.splitLasers) {
      laser.pulsePhase += clampedDelta * 6.0;
      laser.timer += clampedDelta;
      if (laser.active && laser.timer >= laser.activeDuration) {
        laser.active = false;
        laser.timer = 0;
      } else if (!laser.active && laser.timer >= laser.cooldownDuration) {
        const newLine = this.getRandomLaserLine(laser.id);
        laser.x1 = newLine.x1;
        laser.y1 = newLine.y1;
        laser.x2 = newLine.x2;
        laser.y2 = newLine.y2;
        laser.active = true;
        laser.timer = 0;
        laser.splitCount = 0; // 新規出現時に通過カウントリセット
      }
    }

    this.lastStats = stats;
    this.luckyRing.pulsePhase += clampedDelta * 4.5;
    if (this.luckyRing.active) {
      this.luckyRing.activeTimer -= clampedDelta;
      if (this.luckyRing.activeTimer <= 0) {
        // 5秒とれなかったら1秒消えて別の場所で出現
        this.luckyRing.active = false;
        this.luckyRing.respawnTimer = 1.0;
        this.luckyRing.respawnDuration = 1.0;
      }
    } else {
      this.luckyRing.respawnTimer -= clampedDelta;
      if (this.luckyRing.respawnTimer <= 0) {
        this.relocateLuckyRing(stats);
      }
    }

    while (this.accumulator >= DT) {
      this.stepPhysics(stats, callbacks);
      this.accumulator -= DT;
    }
  }

  private stepPhysics(stats: ComputedStats, callbacks: PhysicsCallbacks): void {
    this.stepCount++;
    const recordTrail = this.stepCount % 5 === 0;
    const n = this.medals.length;

    for (let i = 0; i < n; i++) {
      const m = this.medals[i];

      if (m.pinHitCooldown > 0) {
        m.pinHitCooldown = Math.max(0, m.pinHitCooldown - DT);
      }
      if (m.contactCooldown && m.contactCooldown > 0) {
        m.contactCooldown = Math.max(0, m.contactCooldown - DT);
      }
      if (m.contactFlash > 0) {
        m.contactFlash = Math.max(0, m.contactFlash - DT * 3);
      }
      if (m.splitCooldown && m.splitCooldown > 0) {
        m.splitCooldown = Math.max(0, m.splitCooldown - DT);
      }

      // 1) 重力を速度に加算（盤面上の通常メダルはコメット+15% / ケンタウルス+20%で落下高速化）
      const fallSpeedMult =
        m.zone === 'board' && m.type === 'normal'
          ? 1.0 + (stats.runeCometActive ? 0.15 : 0) + (stats.runeCentaurusActive ? 0.20 : 0)
          : 1.0;
      m.vy += GRAVITY * fallSpeedMult * DT;
      if (m.zone === 'board') {
        m.vy = Math.min(MAX_FALL_SPEED * fallSpeedMult, m.vy);
        m.boardElapsedSec += DT;
      }

      // 2) 速度方向と逆向きに摩擦で減速（毎秒900の一定減速、反転しない）
      const speed = Math.hypot(m.vx, m.vy);
      if (speed > 0) {
        const newSpeed = Math.max(0, speed - FRICTION_DECEL * DT);
        const scale = newSpeed / speed;
        m.vx *= scale;
        m.vy *= scale;
      }

      // 3) 位置更新＆盤面滞在・滞留脱出安全弁
      m.x += m.vx * DT;
      m.y += m.vy * DT;

      if (m.zone === 'board') {
        const movedFromAnchor = Math.hypot(m.x - m.anchorX, m.y - m.anchorY);
        if (movedFromAnchor > 16 || m.y > m.anchorY + 12) {
          m.anchorX = m.x;
          m.anchorY = m.y;
          m.stuckSec = 0;
        } else if (m.y < POCKET_TRIGGER_Y - 35) {
          m.stuckSec += DT;
          const threshold = 0.65 + (m.id % 5) * 0.06;
          if (m.stuckSec >= threshold) {
            const dir =
              m.x < 105
                ? 1
                : m.x > BOARD_WIDTH - 105
                  ? -1
                  : (m.id + m.unstickCount) % 2 === 0
                    ? 1
                    : -1;
            m.vx = dir * (165 + (m.id % 3) * 30);
            m.vy = -195;
            m.stuckSec = 0.30;
            m.anchorX = m.x;
            m.anchorY = m.y;
            m.unstickCount++;
          }
        }
      }

      if (m.zone === 'board' && recordTrail) {
        m.trail.push({ x: m.x, y: m.y });
        if (m.trail.length > 14) {
          m.trail.shift();
        }
      }

      // ラッキーオーブ（通過ゲート）判定（物理挙動は一切変えずに効果のみ発動）
      if (m.zone === 'board' && this.luckyRing.active) {
        const rdx = m.x - this.luckyRing.x;
        const rdy = m.y - this.luckyRing.y;
        const triggerDist = this.luckyRing.radius + 6;
        if (rdx * rdx + rdy * rdy <= triggerDist * triggerDist) {
          this.luckyRing.active = false;
          this.luckyRing.respawnTimer = 3.0; // 取得できた場合は3秒後に再出現！
          this.luckyRing.respawnDuration = 3.0;
          callbacks.onLuckyRingPass?.(m, this.luckyRing);
        }
      }

      // ポケット通過判定
      if (!m.passedPocket && m.y >= POCKET_TRIGGER_Y) {
        m.passedPocket = true;
        const pocket = this.findPocketAt(m.x);
        if (pocket) {
          pocket.flashAnim = 1.0;
          pocket.lit = !pocket.lit; // トグル点灯・消灯
          callbacks.onPocketPass(m, pocket);
          callbacks.onPocketToggleLamp?.(pocket, pocket.lit);

          // 5箇所すべて点灯しているかチェック
          if (this.pockets.length === 5 && this.pockets.every((p) => p.lit)) {
            // 全点灯！JACKPOT FEVER発動
            callbacks.onJackpot?.();
            // 全て消灯（リセット）
            this.pockets.forEach((p) => (p.lit = false));
          }
        }
        m.zone = 'tray';
        m.trail = [];
        m.y = Math.max(m.y, TRAY_TOP_Y + 14);
        const targetColX = this.pickTrayStackColumnX(m.x, m.id);
        m.x = targetColX;
        m.vx = 0;
        m.vy = Math.min(260, Math.max(90, m.vy * 0.45));
      }
    }

    // 4. 盤面メダル同士の2D円衝突処理（傾斜盤面 zone === 'board' のみ厳密適用）
    for (let i = 0; i < n; i++) {
      const a = this.medals[i];
      if (a.zone !== 'board') continue;
      for (let j = i + 1; j < n; j++) {
        const b = this.medals[j];
        if (b.zone !== 'board') continue;
        this.resolveMedalPair(a, b, stats, callbacks);
      }
    }

    // 5. 壁・ピン・ストッパーとの衝突処理（盤面ゾーン）
    for (let i = 0; i < n; i++) {
      const m = this.medals[i];
      if (m.zone === 'board') {
        this.resolveBoardConstraints(m, stats, callbacks);
      }
    }

    // 6. 下皿ゾーン（zone === 'tray'）の3Dコインスタック積載処理
    this.resolveTrayStacking(callbacks);
  }

  public pickTrayStackColumnX(preferX: number, medalId: number): number {
    // 各列の現在枚数をカウントし、極端に高い列を避けつつ落下Xに近い列を選択
    const counts = new Array(TRAY_STACK_COLS.length).fill(0);
    for (const m of this.medals) {
      if (m.zone !== 'tray') continue;
      const cIdx = this.getNearestTrayColIndex(m.x);
      counts[cIdx]++;
    }

    let bestCol = 0;
    let bestScore = Infinity;
    for (let c = 0; c < TRAY_STACK_COLS.length; c++) {
      const dist = Math.abs(TRAY_STACK_COLS[c] - preferX);
      const heightPenalty = counts[c] * 28;
      const score = dist + heightPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestCol = c;
      }
    }
    const jitter = Math.sin(medalId * 1.9 + 0.7) * 2.5;
    return TRAY_STACK_COLS[bestCol] + jitter;
  }

  private getNearestTrayColIndex(x: number): number {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let c = 0; c < TRAY_STACK_COLS.length; c++) {
      const d = Math.abs(TRAY_STACK_COLS[c] - x);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = c;
      }
    }
    return bestIdx;
  }

  private resolveTrayStacking(callbacks: PhysicsCallbacks): void {
    const colBuckets: MedalEntity[][] = TRAY_STACK_COLS.map(() => []);

    for (const m of this.medals) {
      if (m.zone !== 'tray') continue;
      const cIdx = this.getNearestTrayColIndex(m.x);
      colBuckets[cIdx].push(m);
    }

    const baseFloorY = TRAY_BOTTOM_Y - 15;

    for (let c = 0; c < colBuckets.length; c++) {
      const bucket = colBuckets[c];
      if (bucket.length === 0) continue;

      // 下にあるメダル（yが大きい順、同値ならID順）から順に下から積み上げる
      bucket.sort((a, b) => b.y - a.y || a.id - b.id);

      for (let k = 0; k < bucket.length; k++) {
        const m = bucket[k];
        const jitter = Math.sin(m.id * 1.9 + k * 0.8) * 2.4;
        const targetX = TRAY_STACK_COLS[c] + jitter;
        m.x += (targetX - m.x) * 0.25;
        m.vx = 0;

        // 最大10段まで視覚的に積み上げ
        const visualStackIdx = Math.min(k, 10);
        const floorY = baseFloorY - visualStackIdx * TRAY_STACK_STEP_Y;

        if (m.y < TRAY_TOP_Y + 10) {
          m.y = TRAY_TOP_Y + 10;
          if (m.vy < 0) m.vy = 0;
        }

        if (m.y >= floorY) {
          m.y = floorY;
          if (m.vy > 140) {
            callbacks.onMedalClink(Math.min(0.7, m.vy / 450));
          }
          if (m.vy > 0) {
            m.vy = m.vy < CONTACT_NORMAL_THRESHOLD * 1.6 ? 0 : -m.vy * 0.25;
          }
        }
      }
    }
  }

  private resolveMedalPair(
    a: MedalEntity,
    b: MedalEntity,
    stats: ComputedStats,
    callbacks: PhysicsCallbacks
  ): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const minDist = a.radius + b.radius; // 42 px
    const distSq = dx * dx + dy * dy;

    if (distSq >= minDist * minDist) return;

    const dist = Math.sqrt(distSq);
    let nx = 1;
    let ny = 0;
    if (dist > 1e-6) {
      nx = dx / dist;
      ny = dy / dist;
    } else {
      // 完全に同一点に重なった場合の退避
      nx = (a.id % 2 === 0 ? 1 : -1) * 0.707;
      ny = 0.707;
    }

    // 縦直列（真上からの衝突）時のスタック・ジッター防止（左右に自然に滑り落とす）
    if (Math.abs(nx) < 0.08) {
      const dir = (a.id + b.id) % 2 === 0 ? 1 : -1;
      nx = dir * 0.08;
      ny = Math.sqrt(Math.max(0, 1 - nx * nx)) * (ny >= 0 ? 1 : -1);
    }

    const overlap = minDist - dist;
    // 剛体のめり込み補正：100%瞬時押し戻しだとピンとの間で押し合いジッター（小刻みな振動）を起こすため、
    // 緩和係数（0.78）を掛けてスプリング的に滑らかに補正
    const push = overlap * 0.5 * 0.78;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;

    // 上下に重なり・三角形組石（|nx|<0.72）となったメダル同士のアーチ崩し＆水平膠着時の高さ分離
    if (Math.abs(ny) > 0.35 && Math.abs(nx) < 0.72) {
      const upper = a.y <= b.y ? a : b;
      const lower = a.y <= b.y ? b : a;
      const dux = lower.x - upper.x;
      const dir =
        Math.abs(dux) > 0.5 ? (dux > 0 ? -1 : 1) : (upper.id + lower.id) % 2 === 0 ? 1 : -1;
      upper.vx += dir * 75 * DT * 60;
      lower.vx -= dir * 40 * DT * 60;
    } else if (
      Math.abs(ny) <= 0.35 &&
      Math.hypot(a.vx, a.vy) < 45 &&
      Math.hypot(b.vx, b.vy) < 45
    ) {
      const higher = a.y <= b.y ? a : b;
      const lower = a.y <= b.y ? b : a;
      higher.vy -= 40 * DT * 60;
      lower.vy += 20 * DT * 60;
    }

    const tx = -ny;
    const ty = nx;

    const vAn = a.vx * nx + a.vy * ny;
    const vAt = a.vx * tx + a.vy * ty;
    const vBn = b.vx * nx + b.vy * ny;
    const vBt = b.vx * tx + b.vy * ty;

    const relNormalSpeed = vAn - vBn;

    if (a.zone === 'board' && b.zone === 'board') {
      const isPlasmaContact = a.type === 'plasma' || b.type === 'plasma';
      if (isPlasmaContact) {
        // プラズマメダル固有の帯電（スキルツリー未解放でも発動）
        const getBase = (t: MedalType) => {
          if (t === 'gold' || t === 'chrono') return 3.0;
          if (t === 'plasma' || t === 'rush') return 2.0;
          if (t === 'bounce' || t === 'bonus') return 1.5;
          return 1.0;
        };
        const maxBonus = 1.5 + Math.max(0, stats.contactMaxMultiplier - 3.0);
        const limitA = getBase(a.type) + maxBonus;
        const limitB = getBase(b.type) + maxBonus;
        const mGain = stats.medalChargeGain || 0.4;
        if ((!a.contactCooldown || a.contactCooldown <= 0) && a.chargeMultiplier < limitA) {
          a.chargeMultiplier = Math.min(limitA, +(a.chargeMultiplier + mGain).toFixed(2));
          a.contactFlash = 0.8;
          a.contactCooldown = 0.12;
        }
        if ((!b.contactCooldown || b.contactCooldown <= 0) && b.chargeMultiplier < limitB) {
          b.chargeMultiplier = Math.min(limitB, +(b.chargeMultiplier + mGain).toFixed(2));
          b.contactFlash = 0.8;
          b.contactCooldown = 0.12;
        }
        callbacks.onMedalElectrified?.(a, b);
      } else if (stats.contactMaxMultiplier > 1.0) {
        // メダル同士の接触で触れるたびに倍率上昇（多重判定防止クールダウン0.12s）
        const mGain = stats.medalChargeGain || 0.4;
        if ((!a.contactCooldown || a.contactCooldown <= 0) && a.chargeMultiplier < stats.contactMaxMultiplier) {
          a.chargeMultiplier = Math.min(stats.contactMaxMultiplier, +(a.chargeMultiplier + mGain).toFixed(2));
          a.contactFlash = 0.7;
          a.contactCooldown = 0.12;
        }
        if ((!b.contactCooldown || b.contactCooldown <= 0) && b.chargeMultiplier < stats.contactMaxMultiplier) {
          b.chargeMultiplier = Math.min(stats.contactMaxMultiplier, +(b.chargeMultiplier + mGain).toFixed(2));
          b.contactFlash = 0.7;
          b.contactCooldown = 0.12;
        }
      }
    }

    if (relNormalSpeed <= 0) {
      const cmVt = 0.5 * (vAt + vBt);
      const relVt = (vAt - vBt) * TANGENT_CONTACT_RETENTION;
      const newVAt = cmVt + 0.5 * relVt;
      const newVBt = cmVt - 0.5 * relVt;
      a.vx = vAn * nx + newVAt * tx;
      a.vy = vAn * ny + newVAt * ty;
      b.vx = vBn * nx + newVBt * tx;
      b.vy = vBn * ny + newVBt * ty;
      return;
    }

    const cmVn = 0.5 * (vAn + vBn);
    const cmVt = 0.5 * (vAt + vBt);

    if (relNormalSpeed < CONTACT_NORMAL_THRESHOLD) {
      const newRelVt = (vAt - vBt) * TANGENT_CONTACT_RETENTION;
      const newVAt = cmVt + 0.5 * newRelVt;
      const newVBt = cmVt - 0.5 * newRelVt;

      a.vx = cmVn * nx + newVAt * tx;
      a.vy = cmVn * ny + newVAt * ty;
      b.vx = cmVn * nx + newVBt * tx;
      b.vy = cmVn * ny + newVBt * ty;
    } else {
      const newRelVn = -RESTITUTION * relNormalSpeed;
      const newRelVt = (vAt - vBt) * TANGENT_COLLISION_RETENTION;

      const newVAn = cmVn + 0.5 * newRelVn;
      const newVBn = cmVn - 0.5 * newRelVn;
      const newVAt = cmVt + 0.5 * newRelVt;
      const newVBt = cmVt - 0.5 * newRelVt;

      a.vx = newVAn * nx + newVAt * tx;
      a.vy = newVAn * ny + newVAt * ty;
      b.vx = newVBn * nx + newVBt * tx;
      b.vy = newVBn * ny + newVBt * ty;

      if (relNormalSpeed > 110) {
        callbacks.onMedalClink(Math.min(1, relNormalSpeed / 400));
      }
    }
  }

  private resolveBoardConstraints(m: MedalEntity, stats: ComputedStats, callbacks: PhysicsCallbacks): void {
    const r = m.radius;

    // 盤面ゾーンの左右外壁（コメット：通常メダルの反発係数 -15%）
    const wallCometMult = stats.runeCometActive && m.type === 'normal' ? 0.85 : 1.0;
    if (m.x - r < WALL_LEFT) {
      m.x = WALL_LEFT + r;
      if (m.vx < 0) {
        const approach = -m.vx;
        m.vx = approach < CONTACT_NORMAL_THRESHOLD ? 0 : approach * (RESTITUTION * wallCometMult);
        m.vy *= approach < CONTACT_NORMAL_THRESHOLD ? TANGENT_CONTACT_RETENTION : TANGENT_COLLISION_RETENTION;
      }
    } else if (m.x + r > WALL_RIGHT) {
      m.x = WALL_RIGHT - r;
      if (m.vx > 0) {
        const approach = m.vx;
        m.vx = approach < CONTACT_NORMAL_THRESHOLD ? 0 : -approach * (RESTITUTION * wallCometMult);
        m.vy *= approach < CONTACT_NORMAL_THRESHOLD ? TANGENT_CONTACT_RETENTION : TANGENT_COLLISION_RETENTION;
      }
    }

    // ピンとの衝突
    for (let i = 0; i < this.pins.length; i++) {
      const pin = this.pins[i];
      const dx = m.x - pin.x;
      const dy = m.y - pin.y;
      const minDist = r + pin.radius;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.001;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        m.x += nx * overlap;
        m.y += ny * overlap;

        // ピン頭頂付近での真上静止防止（斜め接触時の2本ピン間アーチ締め付け＆強制シフトを防止）
        if (ny < -0.78 && pin.kind === 'normal' && Math.hypot(m.vx, m.vy) < 120) {
          const rollSign = Math.abs(nx) > 0.02 ? Math.sign(nx) : (m.id % 2 === 0 ? 1 : -1);
          m.vx += rollSign * 160 * DT * 60;
        }

        const tx = -ny;
        const ty = nx;
        const vn = m.vx * nx + m.vy * ny;
        const vt = m.vx * tx + m.vy * ty;

        if (vn < 0) {
          const approach = -vn;
          const pinCometMult = stats.runeCometActive && m.type === 'normal' ? 0.85 : 1.0;
          let bounceRestitution = (pin.kind === 'bumper' ? 1.05 : RESTITUTION) * pinCometMult;
          if (m.type === 'bounce') bounceRestitution = Math.min(1.35, bounceRestitution * 1.3);

          const newVn =
            approach < CONTACT_NORMAL_THRESHOLD && pin.kind === 'normal'
              ? 0
              : Math.max(approach * bounceRestitution, pin.kind === 'bumper' ? 260 * pinCometMult : 0);
          let newVt =
            vt * (approach < CONTACT_NORMAL_THRESHOLD ? TANGENT_CONTACT_RETENTION : TANGENT_COLLISION_RETENTION);

          // ピン真上・頭頂部でのバランス停止（スタック＆微振動ミルフィーユ連射）防止
          // ny < -0.5 かつ |nx| < 0.35 （ピン上部頂上エリアに乗っかった場合、左右へツルッと滑り落とす）
          if (ny < -0.5 && Math.abs(nx) < 0.35) {
            const slideDir =
              Math.abs(nx) > 0.02
                ? (nx > 0 ? 1 : -1)
                : (m.vx !== 0 ? Math.sign(m.vx) : (m.id % 2 === 0 ? 1 : -1));
            newVt += slideDir * 65;
            m.vx += slideDir * 45;
          } else if (Math.abs(nx) < 0.08 && Math.abs(newVt) < 15) {
            newVt += (m.id % 2 === 0 ? 1 : -1) * 35;
          }

          m.vx = newVn * nx + newVt * tx;
          m.vy = newVn * ny + newVt * ty;

          const isSamePin = m.lastPinHitId === pin.id;
          if (!isSamePin || m.pinHitCooldown <= 0) {
            m.lastPinHitId = pin.id;
            // 同一ピン連続バウンド時は0.40秒クールダウンでミルフィーユ連射を防止
            // 別のピンに当たった際は即座に発火可能
            m.pinHitCooldown = 0.40;
            m.pinBounceCount++;
            pin.hitAnim = 1.0;

            // ピン / バンパー接触時に倍率上昇！
            if (stats.contactMaxMultiplier > 1.0) {
              if (m.chargeMultiplier < stats.contactMaxMultiplier) {
                const pGain = stats.pinChargeGain || 0.1;
                m.chargeMultiplier = Math.min(stats.contactMaxMultiplier, +(m.chargeMultiplier + pGain).toFixed(2));
                m.contactFlash = 0.5;
              }
            }

            // ① プラズマメダル衝突時：ピンを3秒間帯電
            if (m.type === 'plasma') {
              pin.electrifiedTimer = 3.0;
              callbacks.onPinElectrified?.(pin, m);
            }

            // ② 帯電ピン接触時：メダルの倍率を+0.2加算
            if (pin.electrifiedTimer > 0) {
              const getBase = (t: MedalType) => {
                if (t === 'gold' || t === 'chrono') return 3.0;
                if (t === 'plasma' || t === 'rush') return 2.0;
                if (t === 'bounce' || t === 'bonus') return 1.5;
                return 1.0;
              };
              const maxBonus = 1.5 + Math.max(0, stats.contactMaxMultiplier - 3.0);
              const limit = getBase(m.type) + maxBonus;
              if (m.chargeMultiplier < limit) {
                m.chargeMultiplier = Math.min(limit, +(m.chargeMultiplier + 0.2).toFixed(2));
                m.contactFlash = 0.8;
                callbacks.onElectrifiedPinHit?.(pin, m, m.chargeMultiplier);
              }
            }

            callbacks.onPinHit(m, pin);
          }
        }
      }
    }

    // スプリットラインとの交差判定（通過でメダル2枚に分裂！最大3回通過で消滅）
    if (m.zone === 'board' && (!m.splitCooldown || m.splitCooldown <= 0)) {
      for (let i = 0; i < this.splitLasers.length; i++) {
        const laser = this.splitLasers[i];
        if (!laser.active) continue;
        const dx = laser.x2 - laser.x1;
        const dy = laser.y2 - laser.y1;
        const l2 = dx * dx + dy * dy;
        let t = 0;
        if (l2 > 0) {
          t = Math.max(0, Math.min(1, ((m.x - laser.x1) * dx + (m.y - laser.y1) * dy) / l2));
        }
        const px = laser.x1 + t * dx;
        const py = laser.y1 + t * dy;
        const distSq = (m.x - px) ** 2 + (m.y - py) ** 2;
        if (distSq <= (MEDAL_RADIUS + 3) ** 2) {
          // スプリットライン通過！メダル分裂！
          m.splitCooldown = 0.55;
          m.vx -= 32;
          m.contactFlash = 0.8;

          this.medals.push({
            id: this.nextMedalId++,
            type: m.type,
            x: m.x + 8,
            y: m.y,
            vx: m.vx + 64,
            vy: m.vy,
            radius: MEDAL_RADIUS,
            zone: 'board',
            chargeMultiplier: m.chargeMultiplier,
            contactFlash: 0.8,
            passedPocket: false,
            lastPinHitId: -1,
            pinHitCooldown: 0,
            splitCooldown: 0.55,
            boardElapsedSec: 0,
            pinBounceCount: 0,
            stuckSec: 0,
            anchorX: m.x + 8,
            anchorY: m.y,
            unstickCount: 0,
            trail: [{ x: m.x + 8, y: m.y }],
          });

          callbacks.onLaserSplit?.(px, py);

          // 1回の出現中に3回通過したら即座に消滅（インフレ防止）
          laser.splitCount++;
          if (laser.splitCount >= 3) {
            laser.active = false;
            laser.timer = 0; // クールダウン開始
          }
          break;
        }
      }
    }

    // サイバー・カタパルトとの吸い込み判定（盤面最上部へ直接ワープ！倍率・特殊属性完全維持）
    if (m.zone === 'board' && m.vy > 0) {
      for (let i = 0; i < this.catapults.length; i++) {
        const cat = this.catapults[i];
        const cdist = Math.hypot(m.x - cat.x, m.y - cat.y);
        if (cdist <= cat.radius + 8) {
          cat.launchAnim = 1.0;
          const originX = m.x;
          const originY = m.y;

          // 最上部（y ≈ 65）へ瞬時ワープ
          // 左右カタパルトに応じて左右の上部ガイドレール直下にワープ
          const warpX = cat.side === 'left'
            ? 72 + Math.random() * 32
            : BOARD_WIDTH - 72 - Math.random() * 32;
          const warpY = 65;

          m.x = warpX;
          m.y = warpY;
          m.vy = 45 + Math.random() * 20; // 最上部からの自然な落下初速
          m.vx = cat.side === 'left' ? 18 : -18; // 盤面中央寄りへの緩やかな横初速
          m.contactFlash = 1.0;
          m.passedPocket = false;
          m.stuckSec = 0;
          m.anchorX = warpX;
          m.anchorY = warpY;
          // ※ m.chargeMultiplier（接触帯電倍率やオーブ倍率）および m.type（特殊効果）は100%完全維持！
          m.trail = [{ x: m.x, y: m.y }];

          callbacks.onCatapultLaunch?.(m, cat, originX, originY);
          break;
        }
      }
    }

    // ガイドレール（なめらかなL字・アール型コーナー装飾レール）との衝突
    for (let i = 0; i < this.guideRails.length; i++) {
      const rail = this.guideRails[i];
      let hit = false;
      for (let s = 0; s < rail.segments.length; s++) {
        const seg = rail.segments[s];
        if (this.collideWithCapsule(m, seg.x1, seg.y1, seg.x2, seg.y2, 4.0, true)) {
          hit = true;
        }
      }
      if (hit) {
        rail.hitAnim = 1.0;
        callbacks.onRailHit?.(m, rail);
      }
    }

    // ポケットの仕切り壁との衝突
    for (let i = 1; i < this.pockets.length; i++) {
      const divX = this.pockets[i].x1;
      this.collideWithCapsule(m, divX, POCKET_ENTRY_Y, divX, POCKET_EXIT_Y, 4, true);
    }
  }

  private collideWithCapsule(
    m: MedalEntity,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    halfThick: number,
    preventTopBalance: boolean
  ): boolean {
    const abx = x2 - x1;
    const aby = y2 - y1;
    const abLenSq = abx * abx + aby * aby;
    let t = 0;
    if (abLenSq > 0) {
      t = ((m.x - x1) * abx + (m.y - y1) * aby) / abLenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const cx = x1 + t * abx;
    const cy = y1 + t * aby;

    const dx = m.x - cx;
    const dy = m.y - cy;
    const minDist = m.radius + halfThick;
    const distSq = dx * dx + dy * dy;

    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq) || 0.001;
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      m.x += nx * overlap;
      m.y += ny * overlap;

      const tx = -ny;
      const ty = nx;
      const vn = m.vx * nx + m.vy * ny;
      const vt = m.vx * tx + m.vy * ty;

      if (vn < 0) {
        const approach = -vn;
        const newVn = approach < CONTACT_NORMAL_THRESHOLD ? 0 : approach * RESTITUTION;
        let newVt =
          vt * (approach < CONTACT_NORMAL_THRESHOLD ? TANGENT_CONTACT_RETENTION : TANGENT_COLLISION_RETENTION);

        if (preventTopBalance && Math.abs(nx) < 0.08 && Math.abs(newVt) < 15) {
          newVt += (m.id % 2 === 0 ? 1 : -1) * 28;
        }

        m.vx = newVn * nx + newVt * tx;
        m.vy = newVn * ny + newVt * ty;
      }
      return true;
    }
    return false;
  }

  private findPocketAt(x: number): PocketSlot | null {
    for (let i = 0; i < this.pockets.length; i++) {
      const p = this.pockets[i];
      if (x >= p.x1 && x <= p.x2) return p;
    }
    return this.pockets[2] || null;
  }
}
