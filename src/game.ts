import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DROP_ZONE_MAX_Y,
  INSERT_BOX_BOTTOM,
  INSERT_BOX_LEFT,
  INSERT_BOX_RIGHT,
  INSERT_BOX_TOP,
  MEDAL_RADIUS,
  PhysicsWorld,
  POCKET_ENTRY_Y,
  POCKET_EXIT_Y,
  TRAY_BOTTOM_Y,
  TRAY_LEFT,
  TRAY_RIGHT,
  TRAY_TOP_Y,
  WALL_LEFT,
  WALL_RIGHT,
} from './physics';
import {
   getNodeEffectPreview,
  HEXAGRAM_LINES,
  ORBIT_R4,
  SKILL_NODES,
  SkillTreeState,
  TREE_ORBIT_RADII,
} from './skillTree';
import { sound } from './sound';
import {
  ComputedStats,
  FloatingText,
  LightningBolt,
  LuckyRing,
  MedalEntity,
  MedalType,
  PickupParticle,
  PinEntity,
  PocketSlot,
  PrismTarget,
  RuneDef,
  RuneId,
  RUNE_DEFINITIONS,
  getRuneSvgIcon,
  SkillNodeDef,
  SlotInsertAnim,
  SlotSymbol,
  WarpEffect,
} from './types';

const STORAGE_KEY = 'hexamedal_save_v3';

const MEDAL_STYLE: Record<
  MedalType,
  { c1: string; c2: string; rim: string; trail: string; label: string }
> = {
  normal: {
    c1: '#fde68a',
    c2: '#b45309',
    rim: '#fef3c7',
    trail: 'rgba(56, 189, 248, 0.55)',
    label: '★',
  },
  gold: {
    c1: '#fef08a',
    c2: '#eab308',
    rim: '#ffffff',
    trail: 'rgba(250, 204, 21, 0.75)',
    label: '×3',
  },
  plasma: {
    c1: '#f5d0fe',
    c2: '#9333ea',
    rim: '#f0abfc',
    trail: 'rgba(217, 70, 239, 0.75)',
    label: '⚡',
  },
  bounce: {
    c1: '#fecdd3',
    c2: '#e11d48',
    rim: '#ffe4e6',
    trail: 'rgba(244, 63, 94, 0.75)',
    label: '💥',
  },
  rush: {
    c1: '#38bdf8',
    c2: '#0284c7',
    rim: '#e0f2fe',
    trail: 'rgba(56, 189, 248, 0.75)',
    label: '💨',
  },
  chrono: {
    c1: '#e0e7ff',
    c2: '#4f46e5',
    rim: '#fde047',
    trail: 'rgba(250, 204, 21, 0.85)',
    label: '👑',
  },
  bonus: {
    c1: '#a5f3fc',
    c2: '#0891b2',
    rim: '#ecfeff',
    trail: 'rgba(34, 211, 238, 0.7)',
    label: 'B',
  },
};

export class MedalGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private carbonPattern: CanvasPattern | null = null;

  // ゲームフェーズ（起動時は 'home'）
  private phase: 'home' | 'play' | 'result' | 'tree' = 'home';
  private score: number = 0;
  private bestRoundScore: number = 0;
  private round: number = 1;
  private timeRemaining: number = 15;
  private totalPlayTimeSec: number = 0;
  private clearRecord: { timeSec: number; round: number } | null = null;

  // ラウンドリザルト集計用
  private roundGainedScore: number = 0;
  private roundPocketScore: number = 0;
  private roundPinScore: number = 0;
  private roundInsertedCount: number = 0;
  private roundDroppedCount: number = 0;
  private roundPocketCount: number = 0;
  private roundPinHits: number = 0;
  private roundMaxSingleHit: number = 0;
  private roundBonusMedals: number = 0;

  // スキルツリー目標ピン（最大3つ）＆購入演出管理
  private goalNodeIds: string[] = [];
  private milestoneBannerTimer: number = 0;
  private treeNodeBounceTimers = new Map<string, number>();
  private treePurchaseEffects: Array<{
    kind: 'ring' | 'chain';
    x: number;
    y: number;
    tx?: number;
    ty?: number;
    t: number;
    maxT: number;
    isMax: boolean;
    isMilestone: boolean;
  }> = [];

  // 物理＆スキルツリー
  private physics = new PhysicsWorld();
  private skillTree = new SkillTreeState();
  private stats!: ComputedStats;

  // 3段階手動操作用のメダルキュー
  private loadedQueue: MedalType[] = []; // 装填済み（上部ノズル内）
  private heldQueue: MedalType[] = []; // 手元所持（下皿から拾ったメダル）
  private dropCooldownTimer: number = 0;

  // 入力・長押し管理
  private isPointerDownOnBoard: boolean = false;
  private isPointerDownOnTray: boolean = false;
  private isPointerDownOnInsertSlot: boolean = false;
  private pointerBoardX: number = BOARD_WIDTH * 0.5;
  private pointerBoardY: number = 60;
  private pickupCooldownTimer: number = 0;
  private reloadHoldTimer: number = 0;

  // スキルツリー画面のカメラ＆拡大縮小（ピンチイン・アウト）状態
  private selectedNodeId: string = 'c0';
  private treeCamX: number = 0;
  private treeCamY: number = 0;
  private readonly defaultTreeZoom: number = 0.76;
  private treeZoom: number = this.defaultTreeZoom;
  private readonly minTreeZoom: number = 0.55;
  private readonly maxTreeZoom: number = 2.4;
  private isDraggingTree: boolean = false;
  private isPinchingTree: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragMoved: boolean = false;
  private pinchStartDist: number = 0;
  private pinchStartZoom: number = 1.0;
  private activeTreePointers = new Map<number, { x: number; y: number }>();
  private bgAngle: number = 0;

  // 演出用配列
  private floatingTexts: FloatingText[] = [];
  private pickupParticles: PickupParticle[] = [];
  private slotInsertAnims: SlotInsertAnim[] = [];
  private warpEffects: WarpEffect[] = [];
  private lightningBolts: LightningBolt[] = [];
  private prismShards: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    rot: number;
    vRot: number;
    life: number;
    maxLife: number;
    color: string;
  }> = [];

  // JACKPOTフィーバー演出管理
  private jackpotBannerTimer: number = 0;
  private jackpotFlashTimer: number = 0;
  private screenShakeTimer: number = 0;
  private jackpotShotsRemaining: number = 0;
  private jackpotShotInterval: number = 0;
  private isLeftJackpotShooter: boolean = true;
  private muzzleFlashLeft: number = 0;
  private muzzleFlashRight: number = 0;

  // JPフィーバー＆フリーズ演出管理
  private jpFeverTimer: number = 0; // 5秒間得点2倍タイマー
  private isJackpotFreezing: boolean = false; // ロングフリーズ中フラグ（時間停止＆演出）
  private jackpotFreezeTimer: number = 0; // 0〜4.4秒
  private freezeStockMedals: Array<{ x: number; y: number; type: MedalType }> = [];

  // ホットポケット＆簡易スロット管理
  private hotPocketIndex: number = 2; // 0〜4の現在HOTなポケット
  private hotPocketTimer: number = 5.0; // 5.0秒で次のポケットへ移動
  private readonly hotPocketInterval: number = 5.0;
  private slotHoldCount: number = 0; // 最大4保留
  private isSlotSpinning: boolean = false;
  private slotSpinElapsed: number = 2.5; // 0〜2.0秒
  private slotCurrentTarget: SlotSymbol = 'miss';
  private slotFinalSymbols: [string, string, string] = ['7', '7', '7'];
  private slotReelSymbols: [string, string, string] = ['7', '7', '7'];
  private slotReelStopped: [boolean, boolean, boolean] = [true, true, true];
  private slotWinFlashTimer: number = 0;
  private slotRestartCooldown: number = 0; // リール全停止後の再始動待機タイマー（0.6秒）
  private slotShootQueue: Array<{ type: MedalType; delay: number }> = [];
  private slotShootAlternator: boolean = false;

  // スロット出目バフタイマー
  private autoMagnetTimer: number = 0; // 🧲: 5秒間自動回収・装填・投下
  private autoMagnetPickupTimer: number = 0;
  private autoMagnetReloadTimer: number = 0;
  private autoMagnetDropTimer: number = 0;
  private slotScoreBoostTimer: number = 0; // 🕐: 5秒間全ポケット得点x1.5
  private slotPinBonusTimer: number = 0; // 💎: 5秒間ピン点数+3

  // ホーム画面3Dコイン手触り跳ねギミック＆固有演出用
  private homeCoinHopOffsets: number[] = [0, 0, 0, 0, 0, 0];
  private homeCoinHopVels: number[] = [0, 0, 0, 0, 0, 0];
  private homeNormalStackOffsets: number[] = [0, 0, 0, 0, 0];
  private homeNormalStackVels: number[] = [0, 0, 0, 0, 0];
  private homeShowcaseEffects: Array<{
    type: MedalType;
    x: number;
    y: number;
    timer: number;
    maxTimer: number;
    bolts?: Array<Array<{ x: number; y: number }>>;
    sparkles?: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: string }>;
    shockwaveRadius?: number;
    chronoAngle?: number;
    rushLines?: Array<{ x: number; y: number; length: number; alpha: number }>;
  }> = [];

  // DOM要素
  private elCabinetHeader = document.getElementById('cabinet-header')!;
  private elScore = document.getElementById('hud-score')!;
  private elTimer = document.getElementById('hud-timer')!;
  private elTimerBox = document.getElementById('timer-container')!;
  private elBtnHome = document.getElementById('btn-home')!;
  private elBtnSound = document.getElementById('btn-sound')!;

  // ホーム画面DOM
  private elHomeOverlay = document.getElementById('home-overlay')!;
  private elBtnHomeSound = document.getElementById('btn-home-sound')!;
  private elHomeScore = document.getElementById('home-score')!;
  private elHomeBestScore = document.getElementById('home-best-score')!;
  private elHomeCompletion = document.getElementById('home-completion')!;
  private elHomeClearBanner = document.getElementById('home-clear-banner')!;
  private elHomeClearDetail = document.getElementById('home-clear-detail')!;
  private elHomeMedalCanvas = document.getElementById('home-medal-canvas') as HTMLCanvasElement;
  private elHomeHexagramCanvas = document.getElementById('home-hexagram-canvas') as HTMLCanvasElement;
  private elTreeNotifyBadge = document.getElementById('tree-notify-badge')!;
  private elBtnStartPlay = document.getElementById('btn-start-play')!;
  private elBtnOpenTree = document.getElementById('btn-open-tree')!;
  private elBtnResetSave = document.getElementById('btn-reset-save')!;

  // 刻印機能（解放直後は初期装着なし）
  private equippedRunes: RuneId[] = [];
  private lastAltairPocketIdx: number = -1;
  private altairChainCount: number = 0;

  // 刻印関連DOM
  private elBtnOpenRunes = document.getElementById('btn-open-runes') as HTMLButtonElement | null;
  private elRuneModal = document.getElementById('rune-modal') as HTMLElement | null;
  private elRuneSocket1 = document.getElementById('rune-socket-1');
  private elSocket1RingSlot = document.getElementById('socket1-ring-slot');
  private elActiveRuneIcon = document.getElementById('active-rune-icon');
  private elActiveRuneName = document.getElementById('active-rune-name');
  private elRuneSocket2 = document.getElementById('rune-socket-2');
  private elSocket2RingSlot = document.getElementById('socket2-ring-slot');
  private elSocket2Icon = document.getElementById('socket2-rune-icon');
  private elSocket2Name = document.getElementById('socket2-rune-name');
  private elRuneCardList = document.getElementById('rune-card-list');
  private elBtnCloseRunes = document.getElementById('btn-close-runes') as HTMLButtonElement | null;

  // リザルト画面DOM
  private elResultOverlay = document.getElementById('result-overlay')!;
  private elResGainedScore = document.getElementById('res-gained-score')!;
  private elResTotalScore = document.getElementById('res-total-score')!;
  private elResRecordBadge = document.getElementById('res-record-badge');
  private elResPocketPt = document.getElementById('res-pocket-pt');
  private elResPinPt = document.getElementById('res-pin-pt');
  private elResBdBarPocket = document.getElementById('res-bd-bar-pocket') as HTMLElement | null;
  private elResBdBarPin = document.getElementById('res-bd-bar-pin') as HTMLElement | null;
  private elResInsertedCount = document.getElementById('res-inserted-count')!;
  private elResDroppedCount = document.getElementById('res-dropped-count')!;
  private elResPocketCount = document.getElementById('res-pocket-count')!;
  private elResPinHits = document.getElementById('res-pin-hits')!;
  private elResMaxHit = document.getElementById('res-max-hit')!;
  private elResBonusMedals = document.getElementById('res-bonus-medals')!;
  private elBtnResultTree = document.getElementById('btn-result-tree') as HTMLButtonElement | null;
  private elResultTreeBadge = document.getElementById('result-tree-badge');
  private elBtnResultOk = document.getElementById('btn-result-ok')!;
  private elBtnResultHome = document.getElementById('btn-result-home') as HTMLButtonElement | null;

  // スキルツリー画面DOM
  private elTreeOverlay = document.getElementById('tree-overlay')!;
  private elTreeCompletion = document.getElementById('tree-completion')!;
  private elTreeProgressFill = document.getElementById('tree-progress-fill')!;
  private elTreeScore = document.getElementById('tree-score')!;
  private elTreeGoalBar = document.getElementById('tree-goal-bar');
  private elTreeMilestoneBanner = document.getElementById('tree-milestone-banner');
  private elNodeTitle = document.getElementById('node-title')!;
  private elNodeLevel = document.getElementById('node-level')!;
  private elBtnPinNode = document.getElementById('btn-pin-node') as HTMLButtonElement | null;
  private elNodeDesc = document.getElementById('node-desc')!;
  private elNodeEffectPreview = document.getElementById('node-effect-preview');
  private elBtnBuyNode = document.getElementById('btn-buy-node') as HTMLButtonElement;
  private elBtnTreeBackHome = document.getElementById('btn-tree-back-home') as HTMLButtonElement;
  private elBtnTreeZoomIn = document.getElementById('btn-tree-zoom-in') as HTMLButtonElement | null;
  private elBtnTreeZoomOut = document.getElementById('btn-tree-zoom-out') as HTMLButtonElement | null;
  private elBtnTreeZoomReset = document.getElementById('btn-tree-zoom-reset') as HTMLButtonElement | null;
  private elBtnTreeDebugReveal = document.getElementById('btn-tree-debug-reveal') as HTMLButtonElement | null;
  private elBtnTreeDebugMax = document.getElementById('btn-tree-debug-max') as HTMLButtonElement | null;
  private elBtnTreeDebugPts = document.getElementById('btn-tree-debug-pts') as HTMLButtonElement | null;

  private lastFrameTime: number = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.carbonPattern = this.createCarbonPattern();

    this.loadSave();
    this.stats = this.skillTree.computeStats();
    this.sanitizeEquippedRunes();
    this.syncEngravingStats();
    this.physics.setupBoard(this.stats);

    this.bindEvents();
    this.updateRuneUI();
    this.resizeCanvas();
    this.enterHomePhase();

    requestAnimationFrame((t) => this.loop(t));
  }

  private createCarbonPattern(): CanvasPattern | null {
    const off = document.createElement('canvas');
    off.width = 12;
    off.height = 12;
    const octx = off.getContext('2d');
    if (!octx) return null;

    octx.fillStyle = '#090c14';
    octx.fillRect(0, 0, 12, 12);

    octx.fillStyle = '#121826';
    octx.fillRect(0, 0, 6, 6);
    octx.fillRect(6, 6, 6, 6);

    octx.fillStyle = '#192132';
    octx.fillRect(1, 1, 4, 2);
    octx.fillRect(7, 7, 4, 2);

    return this.ctx.createPattern(off, 'repeat');
  }

  private loadSave(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.score === 'number') this.score = data.score;
      if (typeof data.bestRoundScore === 'number') this.bestRoundScore = data.bestRoundScore;
      if (typeof data.round === 'number') this.round = data.round;
      if (typeof data.totalPlayTimeSec === 'number') this.totalPlayTimeSec = data.totalPlayTimeSec;
      if (data.clearRecord && typeof data.clearRecord === 'object') {
        this.clearRecord = data.clearRecord;
      }
      if (Array.isArray(data.equippedRunes)) {
        const validIds = new Set(RUNE_DEFINITIONS.map((r) => r.id));
        this.equippedRunes = data.equippedRunes.filter((id: RuneId) => validIds.has(id));
      }
      if (data.levels && typeof data.levels === 'object') {
        for (const k of Object.keys(data.levels)) {
          if (k in this.skillTree.levels) {
            const nodeDef = SKILL_NODES.find((n) => n.id === k);
            const rawLv = Number(data.levels[k]) || 0;
            this.skillTree.levels[k] = nodeDef
              ? Math.max(0, Math.min(rawLv, nodeDef.maxLevel))
              : 0;
          }
        }
      }
      if (Array.isArray(data.goalNodeIds)) {
        this.goalNodeIds = data.goalNodeIds.filter((id: unknown) => typeof id === 'string');
        this.sanitizeGoalPins();
      }
    } catch {
      // ignore
    }
  }

  private saveGame(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          score: this.score,
          bestRoundScore: this.bestRoundScore,
          round: this.round,
          totalPlayTimeSec: this.totalPlayTimeSec,
          clearRecord: this.clearRecord,
          levels: this.skillTree.levels,
          equippedRunes: this.equippedRunes,
          goalNodeIds: this.goalNodeIds.slice(0, 3),
        })
      );
    } catch {
      // ignore
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.resizeCanvas());

    this.elBtnHome.addEventListener('click', () => {
      sound.playMenuBack();
      this.enterHomePhase();
    });

    const toggleSound = () => {
      const on = sound.toggle();
      const icon = on ? '🔊' : '🔇';
      this.elBtnSound.textContent = icon;
      this.elBtnHomeSound.classList.toggle('is-muted', !on);
      this.elBtnHomeSound.setAttribute('aria-label', on ? 'サウンドON' : 'サウンドOFF');
    };

    this.elBtnSound.addEventListener('click', toggleSound);
    this.elBtnHomeSound.addEventListener('click', toggleSound);

    // ホーム画面ボタン（「プレイ」「強化」「刻印」）
    this.elBtnStartPlay.addEventListener('click', () => {
      sound.playMenuConfirm('play');
      this.startRound();
    });

    this.elBtnOpenTree.addEventListener('click', () => {
      sound.playMenuConfirm('tree');
      this.enterTreePhase();
    });

    this.elBtnOpenRunes?.addEventListener('click', () => {
      this.openRuneModal();
    });

    this.elBtnCloseRunes?.addEventListener('click', () => {
      this.closeRuneModal();
    });

    this.elRuneModal?.addEventListener('click', (e) => {
      if (e.target === this.elRuneModal) {
        this.closeRuneModal();
      }
    });

    this.elRuneSocket1?.addEventListener('click', () => this.unequipRuneAtSlot(0));
    this.elRuneSocket2?.addEventListener('click', () => this.unequipRuneAtSlot(1));

    this.elBtnResetSave.addEventListener('click', () => {
      if (window.confirm('セーブデータを初期化して最初から遊びますか？')) {
        localStorage.removeItem(STORAGE_KEY);
        this.score = 0;
        this.bestRoundScore = 0;
        this.round = 1;
        this.totalPlayTimeSec = 0;
        this.clearRecord = null;
        this.skillTree = new SkillTreeState();
        this.stats = this.skillTree.computeStats();
        this.selectedNodeId = 'c0';
        this.equippedRunes = [];
        this.goalNodeIds = [];
        this.lastAltairPocketIdx = -1;
        this.altairChainCount = 0;
        this.syncEngravingStats();
        this.updateRuneUI();
        this.enterHomePhase();
      }
    });

    // リザルト画面ボタン：「強化へ」と「もう一度」と「ホームへ戻る」
    this.elBtnResultTree?.addEventListener('click', () => {
      sound.playMenuConfirm('tree');
      this.round++;
      this.saveGame();
      this.enterTreePhase();
    });

    this.elBtnResultOk.addEventListener('click', () => {
      sound.playMenuConfirm('play');
      this.round++;
      this.saveGame();
      this.startRound();
    });

    this.elBtnResultHome?.addEventListener('click', () => {
      sound.playMenuBack();
      this.round++;
      this.saveGame();
      this.enterHomePhase();
    });

    // スキルツリー画面ボタン（単押し取得・強化、目標ピン登録、ホームへ戻る）
    this.elBtnBuyNode.addEventListener('click', () => {
      this.buySelectedNode();
    });

    this.elBtnPinNode?.addEventListener('click', () => {
      this.toggleGoalPin(this.selectedNodeId);
    });

    this.elBtnTreeBackHome.addEventListener('click', () => {
      sound.playMenuBack();
      this.enterHomePhase();
    });

    // 強化画面・ズーム操作ボタン
    this.elBtnTreeZoomIn?.addEventListener('click', () => {
      this.treeZoom = Math.min(this.maxTreeZoom, this.treeZoom * 1.25);
    });
    this.elBtnTreeZoomOut?.addEventListener('click', () => {
      this.treeZoom = Math.max(this.minTreeZoom, this.treeZoom * 0.8);
    });
    this.elBtnTreeZoomReset?.addEventListener('click', () => {
      this.treeZoom = this.defaultTreeZoom;
      this.treeCamX = 0;
      this.treeCamY = 0;
    });

    // スキルツリー デバッグ操作ボタン（全配置確認・テスト用）
    this.elBtnTreeDebugReveal?.addEventListener('click', () => {
      this.skillTree.debugShowAll = !this.skillTree.debugShowAll;
      this.elBtnTreeDebugReveal?.classList.toggle('active', this.skillTree.debugShowAll);
      this.updateTreeUI();
    });
    this.elBtnTreeDebugMax?.addEventListener('click', () => {
      this.skillTree.debugUnlockAll();
      this.stats = this.skillTree.computeStats();
      this.sanitizeEquippedRunes();
      this.syncEngravingStats();
      this.updateHomeRuneButtonState();
      this.updateRuneUI();
      this.updateTreeUI();
      sound.playUpgrade();
    });
    this.elBtnTreeDebugPts?.addEventListener('click', () => {
      this.score += 10000;
      this.updateScoreHUD();
      this.updateTreeUI();
      sound.playPocket(true);
    });

    // PCマウスホイールによる拡大縮小
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (this.phase === 'tree') {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.12 : 0.89;
          this.treeZoom = Math.max(
            this.minTreeZoom,
            Math.min(this.maxTreeZoom, this.treeZoom * factor)
          );
        }
      },
      { passive: false }
    );

    // ホーム画面3Dメダルショーケースのタップ跳ねギミック（案16）
    this.elHomeMedalCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const rect = this.elHomeMedalCanvas.getBoundingClientRect();
      const lx = ((e.clientX - rect.left) / rect.width) * 340;
      this.handleHomeShowcaseTap(lx);
    });

    // Canvasポインターイベント（スマホ二本指ピンチイン・アウト ＆ PCドラッグ対応）
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const pt = this.clientToLogical(e.clientX, e.clientY);

      if (this.phase === 'play') {
        this.pointerBoardX = pt.x;
        this.pointerBoardY = pt.y;

        if (this.isPointInInsertBox(pt.x, pt.y)) {
          // 右下：パチスロ式メダル投入口をタップ（上から下にメダルを入れて装填）
          this.isPointerDownOnInsertSlot = true;
          this.tryInsertMedalToSlot();
          this.reloadHoldTimer = this.stats.reloadInterval;
        } else if (pt.y >= TRAY_TOP_Y - 16 && pt.x <= TRAY_RIGHT + 14) {
          // 左下：下皿エリアをタップ（メダルを拾う）
          this.isPointerDownOnTray = true;
          this.tryPickupFromTray(pt.x, pt.y);
          this.pickupCooldownTimer = this.stats.pickupInterval;
        } else if (pt.y < POCKET_EXIT_Y) {
          // 上部〜盤面をタップ（装填済みメダルを投下）
          this.isPointerDownOnBoard = true;
          this.tryDropMedal(pt.x);
        }
      } else if (this.phase === 'tree') {
        this.activeTreePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (this.activeTreePointers.size === 1) {
          this.isDraggingTree = true;
          this.isPinchingTree = false;
          this.dragMoved = false;
          this.dragStartX = e.clientX - this.treeCamX;
          this.dragStartY = e.clientY - this.treeCamY;
        } else if (this.activeTreePointers.size >= 2) {
          // 2本指検知：ピンチイン・アウト（拡大縮小）開始
          this.isDraggingTree = false;
          this.isPinchingTree = true;
          this.dragMoved = true; // タップ誤認防止
          const pts = Array.from(this.activeTreePointers.values());
          this.pinchStartDist = Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
          this.pinchStartZoom = this.treeZoom;
        }
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const pt = this.clientToLogical(e.clientX, e.clientY);
      this.pointerBoardX = pt.x;
      this.pointerBoardY = pt.y;

      if (this.phase === 'play') {
        if (this.isPointerDownOnTray && (pt.y < TRAY_TOP_Y - 24 || pt.x > TRAY_RIGHT + 20)) {
          this.isPointerDownOnTray = false;
        }
        if (this.isPointerDownOnInsertSlot && !this.isPointInInsertBox(pt.x, pt.y)) {
          this.isPointerDownOnInsertSlot = false;
        }
      } else if (this.phase === 'tree') {
        if (this.activeTreePointers.has(e.pointerId)) {
          this.activeTreePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (this.isPinchingTree && this.activeTreePointers.size >= 2) {
          // 2本指の距離比率に応じて拡大率を更新
          const pts = Array.from(this.activeTreePointers.values());
          const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          if (this.pinchStartDist > 0) {
            const ratio = currentDist / this.pinchStartDist;
            this.treeZoom = Math.max(
              this.minTreeZoom,
              Math.min(this.maxTreeZoom, this.pinchStartZoom * ratio)
            );
          }
        } else if (this.isDraggingTree && this.activeTreePointers.size === 1) {
          const nx = e.clientX - this.dragStartX;
          const ny = e.clientY - this.dragStartY;
          if (Math.hypot(nx - this.treeCamX, ny - this.treeCamY) > 6) {
            this.dragMoved = true;
          }
          const limit = 260 * Math.max(1, this.treeZoom);
          this.treeCamX = Math.max(-limit, Math.min(limit, nx));
          this.treeCamY = Math.max(-limit, Math.min(limit, ny));
        }
      }
    });

    const endCanvasPointer = (e: PointerEvent) => {
      if (this.phase === 'tree') {
        const wasPinching = this.isPinchingTree;
        this.activeTreePointers.delete(e.pointerId);

        if (this.activeTreePointers.size === 0) {
          if (this.isDraggingTree && !this.dragMoved && !wasPinching) {
            const pt = this.clientToLogical(e.clientX, e.clientY);
            this.handleTreeTap(pt.x, pt.y);
          }
          this.isDraggingTree = false;
          this.isPinchingTree = false;
        } else if (this.activeTreePointers.size === 1) {
          // 1本指が離れた場合は残った指でスムーズにパン移動継続
          const [remaining] = Array.from(this.activeTreePointers.values());
          this.dragStartX = remaining.x - this.treeCamX;
          this.dragStartY = remaining.y - this.treeCamY;
          this.isDraggingTree = true;
          this.isPinchingTree = false;
        }
      }
      this.isPointerDownOnBoard = false;
      this.isPointerDownOnTray = false;
      this.isPointerDownOnInsertSlot = false;
    };

    window.addEventListener('pointerup', endCanvasPointer);
    window.addEventListener('pointercancel', endCanvasPointer);

    // デバッグ・テスト用キーショートカット（'J'でJACKPOT発動、'L'でランプ点灯トグル）
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyJ') {
        this.handleJackpotFever();
      } else if (e.code === 'KeyF') {
        this.handleJackpotFever(true); // JPロングフリーズ強制発動（デバッグ・演出確認用）
      } else if (e.code === 'KeyL') {
        // 次の未点灯スロットを点灯（すべて点灯ならJACKPOT）
        const unlit = this.physics.pockets.find((p) => !p.lit);
        if (unlit) {
          unlit.lit = true;
          this.handlePocketToggleLamp(unlit, true);
          if (this.physics.pockets.every((p) => p.lit)) {
            this.handleJackpotFever();
            this.physics.pockets.forEach((p) => (p.lit = false));
          }
        }
      }
    });
  }

  private isPointInInsertBox(x: number, y: number): boolean {
    return (
      x >= INSERT_BOX_LEFT - 8 &&
      x <= INSERT_BOX_RIGHT + 8 &&
      y >= INSERT_BOX_TOP - 10 &&
      y <= INSERT_BOX_BOTTOM + 10
    );
  }

  private resizeCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = BOARD_WIDTH * dpr;
    this.canvas.height = BOARD_HEIGHT * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private clientToLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = BOARD_WIDTH / rect.width;
    const scaleY = BOARD_HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // ① ホーム画面フェーズ
  private enterHomePhase(): void {
    this.phase = 'home';
    this.isPointerDownOnBoard = false;
    this.isPointerDownOnTray = false;
    this.isPointerDownOnInsertSlot = false;
    this.resetJackpotState();

    this.stats = this.skillTree.computeStats();
    this.sanitizeEquippedRunes();
    this.syncEngravingStats();
    const { percent } = this.skillTree.getCompletionRatio();

    this.elHomeScore.innerHTML = `${this.score.toLocaleString()} <span class="hs-unit">PT</span>`;
    this.elHomeBestScore.innerHTML = `${this.bestRoundScore.toLocaleString()} <span class="hs-unit">PT</span>`;
    this.elHomeCompletion.textContent = `${percent}%`;
    this.updateScoreHUD();
    this.updateHomeRuneButtonState();
    this.updateRuneUI();
    this.elTimer.textContent = `${this.stats.roundDuration.toFixed(1)}s`;
    this.elTimerBox.classList.remove('warning');

    // 1) 強化可能な項目が1つでもあれば「！」バッジを点灯
    const hasAffordableNode = SKILL_NODES.some(
      (n) => this.skillTree.isVisible(n) && this.skillTree.canBuy(n, this.score)
    );
    if (hasAffordableNode) {
      this.elTreeNotifyBadge.classList.remove('hidden');
    } else {
      this.elTreeNotifyBadge.classList.add('hidden');
    }

    // 2) 100%完全制覇バナーの表示更新
    if (this.clearRecord || percent >= 100) {
      const rec = this.clearRecord ?? {
        timeSec: Math.round(this.totalPlayTimeSec),
        round: this.round,
      };
      const mins = Math.floor(rec.timeSec / 60)
        .toString()
        .padStart(2, '0');
      const secs = (rec.timeSec % 60).toString().padStart(2, '0');
      this.elHomeClearDetail.textContent = `TIME ${mins}:${secs} / ROUND ${rec.round}`;
      this.elHomeClearBanner.classList.remove('hidden');
    } else {
      this.elHomeClearBanner.classList.add('hidden');
    }

    // ホーム画面では上部デジタルヘッダーを非表示にして案Fのフレームを画面全体に表示
    this.elCabinetHeader.classList.add('hidden');
    this.elHomeOverlay.classList.remove('hidden');
    this.elResultOverlay.classList.add('hidden');
    this.elTreeOverlay.classList.add('hidden');
    this.resizeCanvas();
    this.renderHomeMedalShowcase();
    this.renderHomeHexagramEmblem();
    this.saveGame();
  }

  // 刻印解放状態・装着バリデーション共通ヘルパー
  private isRuneUnlocked(def: RuneDef): boolean {
    switch (def.tier) {
      case 'initial':
        return this.stats.engravingUnlocked;
      case 'intermediate':
        return this.stats.engravingMidUnlocked;
      case 'advanced':
        return this.stats.engravingAdvUnlocked;
    }
  }

  private isRuneActive(id: RuneId): boolean {
    return this.stats.engravingUnlocked && this.equippedRunes.includes(id);
  }

  private syncEngravingStats(): void {
    this.stats.runeCometActive = this.isRuneActive('comet');
    this.stats.runeCentaurusActive = this.isRuneActive('centaurus');
  }

  private sanitizeEquippedRunes(): void {
    const unlockedIds = new Set(
      RUNE_DEFINITIONS.filter((r) => this.isRuneUnlocked(r)).map((r) => r.id)
    );
    const filtered: RuneId[] = [];
    for (const id of this.equippedRunes) {
      if (unlockedIds.has(id) && !filtered.includes(id)) {
        filtered.push(id);
      }
    }
    const maxSlots = this.stats.engravingSlot2Unlocked ? 2 : 1;
    this.equippedRunes = filtered.slice(0, maxSlots);
  }

  private updateHomeRuneButtonState(): void {
    if (!this.elBtnOpenRunes) return;
    const unlocked = this.stats.engravingUnlocked;
    this.elBtnOpenRunes.disabled = !unlocked;
    this.elBtnOpenRunes.classList.toggle('is-locked', !unlocked);
    this.elBtnOpenRunes.title = unlocked ? '刻印装備' : 'スキルツリー「刻印開放」で解放';
  }

  // 刻印選択モーダル操作
  private openRuneModal(): void {
    if (!this.elRuneModal) return;
    if (!this.stats.engravingUnlocked) {
      sound.playMenuBack();
      return;
    }
    this.sanitizeEquippedRunes();
    this.updateRuneUI();
    this.renderRuneCards();
    this.elRuneModal.classList.remove('hidden');
    sound.playMenuConfirm('rune');
  }

  private closeRuneModal(): void {
    if (!this.elRuneModal) return;
    this.elRuneModal.classList.add('hidden');
    sound.playMenuBack();
  }

  private equipRune(id: RuneId): void {
    const def = RUNE_DEFINITIONS.find((r) => r.id === id);
    if (!def || !this.isRuneUnlocked(def)) return;

    const existingIdx = this.equippedRunes.indexOf(id);
    if (existingIdx !== -1) {
      // 装備中の刻印を再タップした場合は解除
      this.equippedRunes.splice(existingIdx, 1);
      sound.playMenuBack();
    } else {
      const maxSlots = this.stats.engravingSlot2Unlocked ? 2 : 1;
      if (this.equippedRunes.length < maxSlots) {
        this.equippedRunes.push(id);
      } else if (maxSlots === 1) {
        this.equippedRunes = [id];
      } else {
        this.equippedRunes = [this.equippedRunes[1], id];
      }
      sound.playMenuConfirm('rune');
    }

    this.syncEngravingStats();
    this.saveGame();
    this.updateRuneUI();
    this.renderRuneCards();
  }

  private unequipRuneAtSlot(slotIdx: number): void {
    if (slotIdx < 0 || slotIdx >= this.equippedRunes.length) return;
    if (slotIdx === 1 && !this.stats.engravingSlot2Unlocked) return;
    this.equippedRunes.splice(slotIdx, 1);
    this.syncEngravingStats();
    this.saveGame();
    this.updateRuneUI();
    this.renderRuneCards();
    sound.playMenuBack();
  }

  private getZodiacRingMarkup(mode: 'active' | 'lock'): string {
    if (mode === 'lock') {
      return `
        <svg class="zodiac-ring-svg lock-ring" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="60" cy="60" r="55" stroke="#94a3b8" stroke-opacity="0.45" stroke-width="1.1" stroke-dasharray="3 2.5"/>
          <circle cx="60" cy="60" r="44" stroke="#cbd5e1" stroke-opacity="0.38" stroke-width="0.9"/>
          <circle cx="60" cy="60" r="41" fill="#040612" fill-opacity="0.95"/>
          <rect x="33" y="33" width="54" height="54" stroke="#64748b" stroke-opacity="0.35" stroke-width="0.8"/>
          <rect x="33" y="33" width="54" height="54" stroke="#64748b" stroke-opacity="0.35" stroke-width="0.8" transform="rotate(45 60 60)"/>
        </svg>
      `;
    }
    const angles12 = Array.from({ length: 12 }, (_, i) => i * 30);
    const dividers = angles12
      .map(
        (a) =>
          `<line x1="60" y1="3.5" x2="60" y2="20" transform="rotate(${a + 15} 60 60)"/>`
      )
      .join('');
    const glyphs = angles12
      .map((a) => {
        if (a % 90 === 0) {
          return `<path d="M60 7.5 L61.2 10.8 L64.5 12 L61.2 13.2 L60 16.5 L58.8 13.2 L55.5 12 L58.8 10.8 Z" transform="rotate(${a} 60 60)"/>`;
        }
        if (a % 90 === 30) {
          return `<path d="M60 8.5 L62.5 12 L60 15.5 L57.5 12 Z" fill="none" stroke="#fde68a" stroke-width="0.9" transform="rotate(${a} 60 60)"/>`;
        }
        return `<circle cx="60" cy="12" r="1.7" transform="rotate(${a} 60 60)"/>`;
      })
      .join('');

    return `
      <svg class="zodiac-ring-svg active-ring" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="56.5" stroke="#fde68a" stroke-opacity="0.82" stroke-width="1.2"/>
        <circle cx="60" cy="60" r="53.5" stroke="#fef3c7" stroke-opacity="0.38" stroke-width="0.6"/>
        <circle cx="60" cy="60" r="47.5" stroke="#fde68a" stroke-opacity="0.35" stroke-width="5.5" stroke-dasharray="0.9 4.07"/>
        <circle cx="60" cy="60" r="40" stroke="#fde68a" stroke-opacity="0.72" stroke-width="1.1"/>
        <circle cx="60" cy="60" r="37.5" fill="#060b1c" fill-opacity="0.92"/>
        <g stroke="#fde68a" stroke-opacity="0.52" stroke-width="0.8">${dividers}</g>
        <g fill="#fef3c7" fill-opacity="0.9">${glyphs}</g>
      </svg>
    `;
  }

  private updateSocketSlotUI(
    slotEl: Element | null,
    ringSlotEl: Element | null,
    iconEl: Element | null,
    nameEl: Element | null,
    state: 'equipped' | 'empty' | 'locked',
    runeDef?: RuneDef
  ): void {
    if (slotEl) {
      slotEl.classList.toggle('equipped', state === 'equipped');
      slotEl.classList.toggle('empty', state === 'empty');
      slotEl.classList.toggle('locked', state === 'locked');
    }
    const ringMode: 'active' | 'lock' = state === 'locked' ? 'lock' : 'active';
    if (ringSlotEl && ringSlotEl.getAttribute('data-ring-mode') !== ringMode) {
      ringSlotEl.setAttribute('data-ring-mode', ringMode);
      ringSlotEl.innerHTML = this.getZodiacRingMarkup(ringMode);
    }
    if (iconEl) {
      if (state === 'equipped' && runeDef) {
        iconEl.innerHTML = getRuneSvgIcon(runeDef.id);
      } else if (state === 'locked') {
        iconEl.innerHTML = getRuneSvgIcon('lock');
      } else {
        iconEl.textContent = '✦';
      }
    }
    if (nameEl) {
      if (state === 'equipped' && runeDef) {
        nameEl.textContent = runeDef.name;
      } else if (state === 'locked') {
        nameEl.textContent = 'ロック中';
      } else {
        nameEl.textContent = '未装備';
      }
    }
  }

  private updateRuneUI(): void {
    const slot1Id = this.equippedRunes[0];
    const slot1Def = slot1Id ? RUNE_DEFINITIONS.find((r) => r.id === slot1Id) : undefined;
    this.updateSocketSlotUI(
      this.elRuneSocket1,
      this.elSocket1RingSlot,
      this.elActiveRuneIcon,
      this.elActiveRuneName,
      slot1Def ? 'equipped' : 'empty',
      slot1Def
    );

    if (!this.stats.engravingSlot2Unlocked) {
      this.updateSocketSlotUI(
        this.elRuneSocket2,
        this.elSocket2RingSlot,
        this.elSocket2Icon,
        this.elSocket2Name,
        'locked'
      );
    } else {
      const slot2Id = this.equippedRunes[1];
      const slot2Def = slot2Id ? RUNE_DEFINITIONS.find((r) => r.id === slot2Id) : undefined;
      this.updateSocketSlotUI(
        this.elRuneSocket2,
        this.elSocket2RingSlot,
        this.elSocket2Icon,
        this.elSocket2Name,
        slot2Def ? 'equipped' : 'empty',
        slot2Def
      );
    }
  }

  private renderRuneCards(): void {
    if (!this.elRuneCardList) return;
    this.elRuneCardList.innerHTML = '';

    const makeFiligreeCorner = (pos: string) => `
      <svg class="card-filigree-corner ${pos}" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M1 14 V5 Q1 1 5 1 H14" stroke="currentColor" stroke-width="1.25" stroke-opacity="0.88"/>
        <path d="M3.5 18 C3.5 10, 4 3.5, 18 3.5" stroke="currentColor" stroke-width="0.9" stroke-opacity="0.68"/>
        <path d="M4 9.5 C7.5 9.5, 9.5 7.5, 9.5 4" stroke="currentColor" stroke-width="0.95" stroke-opacity="0.82"/>
        <circle cx="6.2" cy="6.2" r="1.25" fill="currentColor" fill-opacity="0.92"/>
      </svg>
    `;

    for (const r of RUNE_DEFINITIONS) {
      const unlocked = this.isRuneUnlocked(r);
      const isEquipped = unlocked && this.equippedRunes.includes(r.id);

      const card = document.createElement('div');
      card.className = `rune-item-card${isEquipped ? ' equipped' : ''}${!unlocked ? ' locked' : ''}`;

      const statusBadge = isEquipped
        ? '<span class="rune-status-badge equipped">装備中</span>'
        : '';

      const iconHtml = unlocked ? getRuneSvgIcon(r.id) : getRuneSvgIcon('lock');
      const displayName = unlocked ? r.name : '？？？';
      const displayDesc = unlocked ? r.description : '？？？';

      card.innerHTML = `
        ${makeFiligreeCorner('tl')}
        ${makeFiligreeCorner('tr')}
        ${makeFiligreeCorner('bl')}
        ${makeFiligreeCorner('br')}
        <div class="rune-card-icon">${iconHtml}</div>
        <div class="rune-card-info">
          <div class="rune-card-name-row">
            <span class="rune-card-name">${displayName}</span>
          </div>
          <div class="rune-card-desc">${displayDesc}</div>
        </div>
        ${statusBadge}
      `;

      if (unlocked) {
        card.addEventListener('click', () => {
          this.equipRune(r.id);
        });
      }

      this.elRuneCardList.appendChild(card);
    }
  }

  // ホーム画面の六芒星ミニエンブレム描画（現在のスキルツリー解放状況を縮小投影）
  // 同一円軌道上の隣接ノード間は最短円弧で結び、異なる軌道間は直線で結ぶヘルパー
  private traceTreeConnection(
    ctx: CanvasRenderingContext2D,
    a: SkillNodeDef,
    b: SkillNodeDef,
    scale: number = 1
  ): void {
    const ra = Math.hypot(a.gx, a.gy);
    const rb = Math.hypot(b.gx, b.gy);
    if (ra > 10 && Math.abs(ra - rb) < 1.5) {
      const r = (ra + rb) * 0.5 * scale;
      const angA = Math.atan2(a.gy, a.gx);
      const angB = Math.atan2(b.gy, b.gx);
      let diff = angB - angA;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ctx.arc(0, 0, r, angA, angA + diff, diff < 0);
    } else {
      ctx.moveTo(a.gx * scale, a.gy * scale);
      ctx.lineTo(b.gx * scale, b.gy * scale);
    }
  }

  private renderHomeHexagramEmblem(): void {
    const c = this.elHomeHexagramCanvas;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 62;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size * 0.5;
    const cy = size * 0.5;
    const scale = 0.098; // 第4円256px → 約25pxに縮小

    const nodeMap = new Map<string, SkillNodeDef>();
    for (const n of SKILL_NODES) nodeMap.set(n.id, n);

    ctx.save();
    ctx.translate(cx, cy);

    // 1. 案B-1 天体レーダー十字軸・同心円目盛り＆アイスシアンガイド
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.14)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-29, 0);
    ctx.lineTo(29, 0);
    ctx.moveTo(0, -29);
    ctx.lineTo(0, 29);
    ctx.stroke();

    // 外周レーダー目盛りティック（24分割）
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
    ctx.lineWidth = 0.75;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r0 = i % 6 === 0 ? 25.5 : 27.2;
      const r1 = 29.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.stroke();
    }

    const ringGrad = ctx.createLinearGradient(-27, -27, 27, 27);
    ringGrad.addColorStop(0, 'rgba(224, 247, 255, 0.72)');
    ringGrad.addColorStop(1, 'rgba(103, 232, 249, 0.45)');
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, 0, 27.2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.22)';
    ctx.lineWidth = 0.75;
    for (const or of TREE_ORBIT_RADII) {
      ctx.beginPath();
      ctx.arc(0, 0, or * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(186, 230, 253, 0.28)';
    ctx.lineWidth = 1.0;
    for (const [idA, idB] of HEXAGRAM_LINES) {
      const a = nodeMap.get(idA);
      const b = nodeMap.get(idB);
      if (!a || !b) continue;
      ctx.beginPath();
      this.traceTreeConnection(ctx, a, b, scale);
      ctx.stroke();
    }

    // 2. 解放済みノード間の接続ライン（アイスシアン発光）
    for (const node of SKILL_NODES) {
      if (!this.skillTree.isVisible(node)) continue;
      const lvA = this.skillTree.getLevel(node.id);
      if (lvA <= 0) continue;

      for (const nid of node.neighbors) {
        if (node.id > nid) continue;
        const target = nodeMap.get(nid);
        if (!target || this.skillTree.getLevel(target.id) <= 0) continue;

        ctx.save();
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 4;
        ctx.strokeStyle = '#a5f3fc';
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        this.traceTreeConnection(ctx, node, target, scale);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. 点灯した六芒星ライン
    for (const [idA, idB] of HEXAGRAM_LINES) {
      const a = nodeMap.get(idA);
      const b = nodeMap.get(idB);
      if (!a || !b) continue;
      if (this.skillTree.getLevel(idA) > 0 && this.skillTree.getLevel(idB) > 0) {
        ctx.save();
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 5;
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 1.65;
        ctx.beginPath();
        ctx.moveTo(a.gx * scale, a.gy * scale);
        ctx.lineTo(b.gx * scale, b.gy * scale);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 4. ノードの光点描画
    for (const node of SKILL_NODES) {
      if (!this.skillTree.isVisible(node)) continue;
      const lv = this.skillTree.getLevel(node.id);
      const isMax = lv >= node.maxLevel;
      const canBuy = this.skillTree.canBuy(node, this.score);

      const nx = node.gx * scale;
      const ny = node.gy * scale;
      const r = node.category === 'core' ? 2.6 : lv > 0 ? 2.1 : 1.45;

      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      if (isMax) {
        ctx.fillStyle = '#fde047';
      } else if (lv > 0) {
        ctx.fillStyle = '#bae6fd';
      } else if (canBuy) {
        ctx.fillStyle = '#f472b6';
      } else {
        ctx.fillStyle = 'rgba(186, 230, 253, 0.48)';
      }
      ctx.fill();
    }

    ctx.restore();
  }

  // 未解放メダルスロットのコロナ歯車メダリオン＋南京錠アイコン描画（案B-1準拠）
  private drawLockedMedalMedallion(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    ringColor: string,
    glowColor: string,
    glowAlpha: number
  ): void {
    ctx.save();

    // 背後のほのかなコロナ光彩
    const halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, 24);
    halo.addColorStop(0, glowColor);
    halo.addColorStop(1, 'rgba(6, 15, 35, 0)');
    ctx.globalAlpha = glowAlpha;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 16歯の天体コロナ外周ノッチ
    const spikes = 16;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.25;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const r0 = 15.2;
      const r1 = i % 2 === 0 ? 18.2 : 16.9;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }

    // 外輪＆内輪ダブルリング
    ctx.fillStyle = 'rgba(10, 20, 44, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, 15.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.65;
    ctx.beginPath();
    ctx.arc(cx, cy, 15.0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.arc(cx, cy, 11.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 中央の端正な南京錠アイコン
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 2.2, 3.2, Math.PI, 0);
    ctx.stroke();

    ctx.fillStyle = ringColor;
    ctx.beginPath();
    ctx.roundRect(cx - 4.8, cy - 0.5, 9.6, 7.2, 1.8);
    ctx.fill();

    ctx.fillStyle = '#08132b';
    ctx.beginPath();
    ctx.arc(cx, cy + 3.0, 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ホーム画面の所持メダル3Dショーケース描画（案B-1：星空ガラスディスプレイケース仕様）
  private renderHomeMedalShowcase(): void {
    const c = this.elHomeMedalCanvas;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = 340;
    const h = 104;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 深宇宙ナイトブルー＆星雲背景
    const spaceGrad = ctx.createRadialGradient(w * 0.5, 44, 12, w * 0.5, 48, 200);
    spaceGrad.addColorStop(0, 'rgba(24, 52, 102, 0.72)');
    spaceGrad.addColorStop(0.55, 'rgba(11, 24, 54, 0.88)');
    spaceGrad.addColorStop(1, 'rgba(5, 11, 28, 0.98)');
    ctx.fillStyle = spaceGrad;
    ctx.fillRect(0, 0, w, h);

    // 星空ショーケースの決定論的スターダスト
    const stars = [
      [18, 18, 0.9, 0.55], [64, 24, 0.7, 0.4], [116, 16, 1.0, 0.6],
      [166, 28, 0.8, 0.45], [218, 18, 0.9, 0.55], [274, 22, 0.7, 0.4],
      [322, 16, 1.0, 0.5], [82, 74, 0.8, 0.35], [176, 72, 0.9, 0.4],
      [230, 76, 0.7, 0.35], [292, 70, 0.8, 0.4], [134, 62, 0.6, 0.3],
    ];
    for (const [sx, sy, sr, sa] of stars) {
      ctx.fillStyle = `rgba(224, 242, 254, ${sa})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // ガラス棚の下辺ハイライト
    const floorGrad = ctx.createLinearGradient(0, h - 22, 0, h);
    floorGrad.addColorStop(0, 'rgba(125, 211, 252, 0)');
    floorGrad.addColorStop(1, 'rgba(186, 230, 253, 0.14)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, h - 22, w, 22);

    ctx.strokeStyle = 'rgba(186, 230, 253, 0.26)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, h - 21);
    ctx.lineTo(w - 8, h - 21);
    ctx.stroke();

    // 左端：ノーマルメダルの3Dスタック（最大4段表示、タップで跳ねる）
    const normalCount =
      this.stats.specialMedals.filter((t) => t === 'normal').length + this.stats.extraStartMedals;
    const stackPreview = Math.min(normalCount, 4);
    const nx = 38;
    const normalHop = this.homeCoinHopOffsets[0] || 0;

    ctx.fillStyle = 'rgba(2, 6, 18, 0.75)';
    ctx.beginPath();
    ctx.ellipse(nx, 66, 20, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let s = 0; s < stackPreview; s++) {
      const stackHop = this.homeNormalStackOffsets[s] || normalHop;
      this.draw3DTrayCoin(ctx, nx, 56 - s * 5.8 + stackHop, 17, 'normal');
    }
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '700 12px Outfit, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`×${normalCount}`, nx, h - 7);

    // 特殊メダル5種のスロット（RUSH, BOUNCE, GOLD, PLASMA, CHRONO）
    const specialSlots: {
      type: MedalType;
      name: string;
      lockRing: string;
      lockGlow: string;
      lockAlpha: number;
    }[] = [
      { type: 'rush', name: 'RUSH', lockRing: '#f5d061', lockGlow: 'rgba(250, 204, 21, 0.45)', lockAlpha: 0.75 },
      { type: 'bounce', name: 'BOUNCE', lockRing: '#7dd3fc', lockGlow: 'rgba(56, 189, 248, 0.48)', lockAlpha: 0.75 },
      { type: 'gold', name: 'GOLD', lockRing: '#94a3b8', lockGlow: 'rgba(148, 163, 184, 0.25)', lockAlpha: 0.45 },
      { type: 'plasma', name: 'PLASMA', lockRing: '#7c90aa', lockGlow: 'rgba(124, 144, 170, 0.2)', lockAlpha: 0.38 },
      { type: 'chrono', name: 'CHRONO', lockRing: '#6c7e98', lockGlow: 'rgba(108, 126, 152, 0.16)', lockAlpha: 0.32 },
    ];

    specialSlots.forEach((slot, idx) => {
      const sx = 98 + idx * 52;
      const hopY = this.homeCoinHopOffsets[idx + 1] || 0;
      const sy = 46 + hopY;
      const unlocked = this.stats.specialMedals.includes(slot.type);

      if (unlocked) {
        ctx.fillStyle = 'rgba(2, 6, 18, 0.72)';
        ctx.beginPath();
        ctx.ellipse(sx, 64, 19, 7.5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (slot.type === 'bounce' && hopY < 0) {
          ctx.save();
          const squash = Math.sin(Math.min(1, -hopY / 22) * Math.PI) * 0.16;
          ctx.translate(sx, sy);
          ctx.scale(1 + squash * 0.8, 1 - squash);
          this.draw3DTrayCoin(ctx, 0, 0, 18, slot.type);
          ctx.restore();
        } else if (
          slot.type === 'plasma' &&
          (hopY < 0 || this.homeShowcaseEffects.some((e) => e.type === 'plasma'))
        ) {
          const jx = (Math.random() - 0.5) * 2.6;
          const jy = (Math.random() - 0.5) * 2.0;
          this.draw3DTrayCoin(ctx, sx + jx, sy + jy, 18, slot.type);
        } else {
          this.draw3DTrayCoin(ctx, sx, sy, 18, slot.type);
        }

        ctx.fillStyle = '#bae6fd';
        ctx.font = '700 9.5px Outfit, Consolas, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(slot.name, sx, h - 7);
      } else {
        // 未解放スロット：案B-1準拠のコロナ光環メダリオン＆南京錠アイコン
        this.drawLockedMedalMedallion(ctx, sx, sy + 2, slot.lockRing, slot.lockGlow, slot.lockAlpha);

        ctx.fillStyle = idx <= 1 ? 'rgba(226, 232, 240, 0.82)' : 'rgba(148, 163, 184, 0.65)';
        ctx.font = '600 8.5px Outfit, Consolas, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('LOCKED', sx, h - 7);
      }
    });

    // ショーケース専用の動的エフェクト描画（電撃アーク、黄金星屑、ピンク波紋、時計ギア等）
    for (const eff of this.homeShowcaseEffects) {
      if (eff.type === 'plasma' && eff.bolts) {
        // プラズマ：紫＆水色のギザギザ稲妻アーク
        ctx.save();
        const alpha = Math.min(1, eff.timer / (eff.maxTimer * 0.7));
        for (const bolt of eff.bolts) {
          if (bolt.length < 2) continue;
          ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.85})`;
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(bolt[0].x, bolt[0].y);
          for (let p = 1; p < bolt.length; p++) ctx.lineTo(bolt[p].x, bolt[p].y);
          ctx.stroke();

          ctx.strokeStyle = `rgba(240, 249, 255, ${alpha})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(bolt[0].x, bolt[0].y);
          for (let p = 1; p < bolt.length; p++) ctx.lineTo(bolt[p].x, bolt[p].y);
          ctx.stroke();
        }
        ctx.restore();
      } else if (eff.type === 'gold' && eff.sparkles) {
        // ゴールド：ゴールド星屑スパークル（✦）
        ctx.save();
        for (const sp of eff.sparkles) {
          ctx.fillStyle = sp.color;
          ctx.globalAlpha = Math.max(0, sp.alpha);
          const r = sp.size;
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y - r * 1.5);
          ctx.quadraticCurveTo(sp.x, sp.y, sp.x + r * 1.5, sp.y);
          ctx.quadraticCurveTo(sp.x, sp.y, sp.x, sp.y + r * 1.5);
          ctx.quadraticCurveTo(sp.x, sp.y, sp.x - r * 1.5, sp.y);
          ctx.quadraticCurveTo(sp.x, sp.y, sp.x, sp.y - r * 1.5);
          ctx.fill();
        }
        ctx.restore();
      } else if (eff.type === 'bounce' && eff.shockwaveRadius !== undefined) {
        // バウンス：ピンクの衝撃波紋リング
        ctx.save();
        const alpha = Math.max(0, eff.timer / eff.maxTimer);
        ctx.strokeStyle = `rgba(244, 114, 182, ${alpha * 0.85})`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.ellipse(eff.x, 62, eff.shockwaveRadius * 1.35, eff.shockwaveRadius * 0.58, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (eff.type === 'rush' && eff.rushLines) {
        // ラッシュ：シアンの垂直スピードライン（疾風）
        ctx.save();
        const alpha = Math.max(0, eff.timer / eff.maxTimer);
        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.9})`;
        ctx.lineWidth = 1.8;
        for (const line of eff.rushLines) {
          ctx.beginPath();
          ctx.moveTo(line.x, line.y);
          ctx.lineTo(line.x, line.y - line.length);
          ctx.stroke();
        }
        ctx.restore();
      } else if (eff.type === 'chrono' && eff.chronoAngle !== undefined) {
        // クロノ：黄金の時計文字盤サークル＆回転秒針
        ctx.save();
        const alpha = Math.min(1, eff.timer / (eff.maxTimer * 0.5));
        ctx.globalAlpha = alpha;
        const cx = eff.x;
        const cy = 46;
        const r = 24;

        ctx.strokeStyle = 'rgba(253, 224, 71, 0.75)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const innerR = i % 3 === 0 ? r - 4.5 : r - 2.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR);
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          ctx.stroke();
        }

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(eff.chronoAngle) * (r - 5), cy + Math.sin(eff.chronoAngle) * (r - 5));
        ctx.stroke();

        ctx.restore();
      }
    }
  }

  private handleHomeShowcaseTap(lx: number): void {
    const slotCenters = [38, 98, 150, 202, 254, 306];
    const slotTypes: MedalType[] = ['normal', 'rush', 'bounce', 'gold', 'plasma', 'chrono'];

    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < slotCenters.length; i++) {
      const d = Math.abs(lx - slotCenters[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestDist > 32) return;

    const type = slotTypes[bestIdx];
    const unlocked =
      bestIdx === 0 || this.stats.specialMedals.includes(type);

    if (!unlocked) {
      // 未解放時はカチッと小さく震えるだけ
      this.homeCoinHopVels[bestIdx] = -90;
      sound.playMedalClink(0.25);
      this.renderHomeMedalShowcase();
      return;
    }

    const sx = slotCenters[bestIdx];
    const sy = 46;

    // 各メダルごとの固有挙動と専用サウンド＆エフェクト
    switch (type) {
      case 'normal': {
        // 通常メダルスタック：上から順にカチャチャチャッと時間差ウェーブ跳ね
        this.homeCoinHopVels[0] = -240;
        for (let s = 0; s < this.homeNormalStackVels.length; s++) {
          this.homeNormalStackVels[s] = -190 - s * 22;
        }
        sound.playMedalClink(0.85);
        break;
      }
      case 'rush': {
        // ラッシュメダル：超俊敏な垂直ハイスピード突き上がり＆シアンの疾風スピードライン
        this.homeCoinHopVels[bestIdx] = -380;
        sound.playLaserSplit();

        const lines = [];
        for (let l = 0; l < 6; l++) {
          lines.push({
            x: sx + (Math.random() - 0.5) * 28,
            y: sy + 10 + Math.random() * 15,
            length: 12 + Math.random() * 14,
            alpha: 1.0,
          });
        }
        this.homeShowcaseEffects.push({
          type: 'rush',
          x: sx,
          y: sy,
          timer: 0.35,
          maxTimer: 0.35,
          rushLines: lines,
        });
        break;
      }
      case 'bounce': {
        // バウンスメダル：高反発「ボヨヨン！」連続バウンド＆ピンク波紋
        this.homeCoinHopVels[bestIdx] = -320;
        sound.playPinHit(true);

        this.homeShowcaseEffects.push({
          type: 'bounce',
          x: sx,
          y: sy,
          timer: 0.45,
          maxTimer: 0.45,
          shockwaveRadius: 4,
        });
        break;
      }
      case 'gold': {
        // ゴールドメダル：黄金フラッシュ＆キラキラ星屑・ゴールドスパークル散布
        this.homeCoinHopVels[bestIdx] = -260;
        sound.playUpgrade();

        const sparkles = [];
        for (let k = 0; k < 12; k++) {
          const angle = (k / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
          const speed = 40 + Math.random() * 65;
          sparkles.push({
            x: sx,
            y: sy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 20,
            size: 2.2 + Math.random() * 2.2,
            alpha: 1.0,
            color: k % 2 === 0 ? '#fef08a' : '#f59e0b',
          });
        }
        this.homeShowcaseEffects.push({
          type: 'gold',
          x: sx,
          y: sy,
          timer: 0.55,
          maxTimer: 0.55,
          sparkles,
        });
        break;
      }
      case 'plasma': {
        // プラズマメダル：バチバチッ！と紫＆水色のギザギザ稲妻アークが全方位＆隣接メダルへ放電！
        this.homeCoinHopVels[bestIdx] = -270;
        sound.playElectricSpark();

        const bolts: Array<Array<{ x: number; y: number }>> = [];
        const leftTargetX = slotCenters[bestIdx - 1];
        const rightTargetX = slotCenters[bestIdx + 1];

        const generateBolt = (x1: number, y1: number, x2: number, y2: number, segments: number) => {
          const pts = [{ x: x1, y: y1 }];
          for (let seg = 1; seg < segments; seg++) {
            const t = seg / segments;
            const bx = x1 + (x2 - x1) * t;
            const by = y1 + (y2 - y1) * t;
            const perpX = -(y2 - y1);
            const perpY = x2 - x1;
            const len = Math.hypot(perpX, perpY) || 1;
            const jitter = (Math.random() - 0.5) * 16;
            pts.push({
              x: bx + (perpX / len) * jitter,
              y: by + (perpY / len) * jitter,
            });
          }
          pts.push({ x: x2, y: y2 });
          return pts;
        };

        if (leftTargetX !== undefined) {
          bolts.push(generateBolt(sx - 14, sy, leftTargetX + 14, sy, 5));
        }
        if (rightTargetX !== undefined) {
          bolts.push(generateBolt(sx + 14, sy, rightTargetX - 14, sy, 5));
        }

        for (let b = 0; b < 5; b++) {
          const ang = (b / 5) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
          const dist = 18 + Math.random() * 16;
          const ex = sx + Math.cos(ang) * dist;
          const ey = sy + Math.sin(ang) * dist;
          bolts.push(generateBolt(sx, sy, ex, ey, 4));
        }

        this.homeShowcaseEffects.push({
          type: 'plasma',
          x: sx,
          y: sy,
          timer: 0.42,
          maxTimer: 0.42,
          bolts,
        });
        break;
      }
      case 'chrono': {
        // クロノメダル：黄金の時計文字盤・ギアサークル出現 ＆ タイム浮遊スピン
        this.homeCoinHopVels[bestIdx] = -280;
        sound.playTimeTick();

        this.homeShowcaseEffects.push({
          type: 'chrono',
          x: sx,
          y: sy,
          timer: 0.6,
          maxTimer: 0.6,
          chronoAngle: 0,
        });
        break;
      }
    }

    this.renderHomeMedalShowcase();
  }

  private updateHomeShowcaseAnim(dtSec: number): void {
    let active = false;

    // メダルごとの重力・跳ね返り係数（重さを完全解消し、シャープでキレのあるスナッピーな反発を実現）
    const gravityList = [2400, 3600, 1900, 2100, 2200, 2100];
    const bounceList = [0.35, 0.25, 0.68, 0.38, 0.35, 0.32];

    for (let i = 0; i < this.homeCoinHopOffsets.length; i++) {
      if (this.homeCoinHopOffsets[i] < 0 || this.homeCoinHopVels[i] !== 0) {
        active = true;
        const g = gravityList[i] || 2200;
        const b = bounceList[i] || 0.35;

        let currentDt = dtSec;
        if (i === 5 && Math.abs(this.homeCoinHopVels[i]) < 60 && this.homeCoinHopOffsets[i] < -8) {
          currentDt *= 0.35; // クロノのみ空中タイム浮遊
        }

        this.homeCoinHopVels[i] += g * currentDt;
        this.homeCoinHopOffsets[i] += this.homeCoinHopVels[i] * currentDt;

        if (this.homeCoinHopOffsets[i] >= 0) {
          this.homeCoinHopOffsets[i] = 0;
          if (Math.abs(this.homeCoinHopVels[i]) > 40) {
            this.homeCoinHopVels[i] = -this.homeCoinHopVels[i] * b;
          } else {
            this.homeCoinHopVels[i] = 0;
          }
        }
      }
    }

    // 通常メダルスタックの各段ウェーブ更新
    for (let s = 0; s < this.homeNormalStackOffsets.length; s++) {
      if (this.homeNormalStackOffsets[s] < 0 || this.homeNormalStackVels[s] !== 0) {
        active = true;
        this.homeNormalStackVels[s] += 2400 * dtSec;
        this.homeNormalStackOffsets[s] += this.homeNormalStackVels[s] * dtSec;
        if (this.homeNormalStackOffsets[s] >= 0) {
          this.homeNormalStackOffsets[s] = 0;
          if (Math.abs(this.homeNormalStackVels[s]) > 40) {
            this.homeNormalStackVels[s] = -this.homeNormalStackVels[s] * 0.35;
          } else {
            this.homeNormalStackVels[s] = 0;
          }
        }
      }
    }

    // エフェクトの更新
    for (let eIdx = this.homeShowcaseEffects.length - 1; eIdx >= 0; eIdx--) {
      active = true;
      const eff = this.homeShowcaseEffects[eIdx];
      eff.timer -= dtSec;

      if (eff.type === 'bounce' && eff.shockwaveRadius !== undefined) {
        eff.shockwaveRadius += 65 * dtSec;
      } else if (eff.type === 'chrono' && eff.chronoAngle !== undefined) {
        eff.chronoAngle += 3.8 * dtSec;
      } else if (eff.type === 'gold' && eff.sparkles) {
        for (const sp of eff.sparkles) {
          sp.x += sp.vx * dtSec;
          sp.y += sp.vy * dtSec;
          sp.vy += 120 * dtSec;
          sp.alpha = Math.max(0, eff.timer / eff.maxTimer);
        }
      } else if (eff.type === 'plasma' && eff.bolts) {
        if (Math.random() < 0.35) {
          for (const bolt of eff.bolts) {
            for (let p = 1; p < bolt.length - 1; p++) {
              bolt[p].x += (Math.random() - 0.5) * 3;
              bolt[p].y += (Math.random() - 0.5) * 3;
            }
          }
        }
      }

      if (eff.timer <= 0) {
        this.homeShowcaseEffects.splice(eIdx, 1);
      }
    }

    if (active) {
      this.renderHomeMedalShowcase();
    }
  }

  // JACKPOT状態（射出残数・インターバル・フィーバー・フリーズ・演出タイマー・ランプ）の完全リセット
  private resetJackpotState(): void {
    this.jackpotShotsRemaining = 0;
    this.jackpotShotInterval = 0;
    this.jackpotBannerTimer = 0;
    this.jackpotFlashTimer = 0;
    this.screenShakeTimer = 0;
    this.muzzleFlashLeft = 0;
    this.muzzleFlashRight = 0;
    this.isLeftJackpotShooter = true;
    this.jpFeverTimer = 0;
    this.isJackpotFreezing = false;
    this.jackpotFreezeTimer = 0;
    this.freezeStockMedals = [];
    this.slotShootQueue = [];
    this.slotRestartCooldown = 0;
    this.autoMagnetTimer = 0;
    this.slotScoreBoostTimer = 0;
    this.slotPinBonusTimer = 0;
    if (this.physics) {
      this.physics.resetPocketsLit();
    }
  }

  // ② メダルゲーム開始（下皿のメダルを拾うところからスタート）
  private startRound(): void {
    this.phase = 'play';
    this.stats = this.skillTree.computeStats();
    this.sanitizeEquippedRunes();
    this.syncEngravingStats();
    this.lastAltairPocketIdx = -1;
    this.altairChainCount = 0;
    this.timeRemaining = this.stats.roundDuration;
    this.dropCooldownTimer = 0;
    this.resetJackpotState();

    // リザルト統計リセット
    this.roundGainedScore = 0;
    this.roundPocketScore = 0;
    this.roundPinScore = 0;
    this.roundInsertedCount = 0;
    this.roundDroppedCount = 0;
    this.roundPocketCount = 0;
    this.roundPinHits = 0;
    this.roundMaxSingleHit = 0;
    this.roundBonusMedals = 0;

    // 開始時は装填済み0枚・手元0枚
    this.loadedQueue = [];
    this.heldQueue = [];
    this.floatingTexts = [];
    this.pickupParticles = [];
    this.slotInsertAnims = [];
    this.warpEffects = [];
    this.lightningBolts = [];
    this.prismShards = [];

    // ホットポケット＆スロット初期化
    this.hotPocketIndex = Math.floor(Math.random() * 5);
    this.hotPocketTimer = this.hotPocketInterval;
    this.slotHoldCount = 0;
    this.isSlotSpinning = false;
    this.slotSpinElapsed = 2.5;
    this.slotCurrentTarget = 'miss';
    this.slotFinalSymbols = ['7', '7', '7'];
    this.slotReelSymbols = ['7', '7', '7'];
    this.slotReelStopped = [true, true, true];
    this.slotWinFlashTimer = 0;
    this.slotRestartCooldown = 0;
    this.slotShootQueue = [];
    this.slotShootAlternator = false;
    this.autoMagnetTimer = 0;
    this.autoMagnetPickupTimer = 0;
    this.autoMagnetReloadTimer = 0;
    this.autoMagnetDropTimer = 0;
    this.slotScoreBoostTimer = 0;
    this.slotPinBonusTimer = 0;

    this.physics.medals = [];
    this.physics.setupBoard(this.stats);
    this.physics.resetPocketsLit();

    // 初期5枚（＋外周ボーナス枚数）を下皿に物理配置
    const initialMedals: MedalType[] = [...this.stats.specialMedals];
    for (let i = 0; i < this.stats.extraStartMedals; i++) {
      initialMedals.push('normal');
    }
    this.physics.spawnInitialTrayMedals(initialMedals);

    this.elCabinetHeader.classList.remove('hidden');
    this.elHomeOverlay.classList.add('hidden');
    this.elResultOverlay.classList.add('hidden');
    this.elTreeOverlay.classList.add('hidden');
    this.elTimerBox.classList.remove('warning');
    this.resizeCanvas();

    this.updateScoreHUD();
  }

  // ③ ラウンド終了 → リザルト画面表示
  private enterResultPhase(): void {
    this.phase = 'result';
    this.isPointerDownOnBoard = false;
    this.isPointerDownOnTray = false;
    this.isPointerDownOnInsertSlot = false;
    this.resetJackpotState();

    // 1. それまでの自己ベスト表示＆内部ベスト記録更新（通知・アニメーション・直近比較なし）
    const prevBest = this.bestRoundScore;
    if (this.roundGainedScore > this.bestRoundScore) {
      this.bestRoundScore = this.roundGainedScore;
    }
    if (this.elResRecordBadge) {
      this.elResRecordBadge.textContent = `それまでの自己ベスト: ${prevBest.toLocaleString()} PT`;
    }

    // 2. スコア内訳バー（スロット vs バンパー）
    if (this.elResPocketPt) {
      this.elResPocketPt.textContent = `+${this.roundPocketScore.toLocaleString()} PT`;
    }
    if (this.elResPinPt) {
      this.elResPinPt.textContent = `+${this.roundPinScore.toLocaleString()} PT`;
    }
    const totalBD = Math.max(1, this.roundPocketScore + this.roundPinScore);
    const pocketPct =
      this.roundPocketScore + this.roundPinScore === 0
        ? 100
        : Math.round((this.roundPocketScore / totalBD) * 100);
    const pinPct = 100 - pocketPct;
    if (this.elResBdBarPocket) this.elResBdBarPocket.style.width = `${pocketPct}%`;
    if (this.elResBdBarPin) this.elResBdBarPin.style.width = `${pinPct}%`;

    // 3. 獲得ポイント＆統計行をアニメーションなしで確定表示
    this.elTimerBox.classList.remove('warning');
    this.elTimer.textContent = '0.0s';

    this.elResGainedScore.textContent = `+${this.roundGainedScore.toLocaleString()} PT`;
    this.elResTotalScore.textContent = `所持合計: ${this.score.toLocaleString()} PT`;
    this.elResInsertedCount.textContent = `${this.roundInsertedCount} 枚`;
    this.elResDroppedCount.textContent = `${this.roundDroppedCount} 枚`;
    this.elResPocketCount.textContent = `${this.roundPocketCount} 枚`;
    this.elResPinHits.textContent = `${this.roundPinHits} 回`;
    this.elResMaxHit.textContent = `+${this.roundMaxSingleHit.toLocaleString()} PT`;
    this.elResBonusMedals.textContent = `+${this.roundBonusMedals} 枚`;

    // 5. 強化可能ノード数の判定＆「強化へ」ボタンバッジ表示
    this.sanitizeGoalPins();
    const affordableNodes = SKILL_NODES.filter(
      (n) => this.skillTree.isVisible(n) && this.skillTree.canBuy(n, this.score)
    );
    const affordableCount = affordableNodes.length;
    this.elResultTreeBadge?.classList.toggle('hidden', affordableCount === 0);

    this.elCabinetHeader.classList.remove('hidden');
    this.elHomeOverlay.classList.add('hidden');
    this.elTreeOverlay.classList.add('hidden');
    this.elResultOverlay.classList.remove('hidden');

    sound.playPocket(true);
    this.saveGame();
  }

  // ④ スキルツリー画面フェーズ（上部ヘッダー領域は非表示にして画面を広く使う）
  private enterTreePhase(): void {
    this.phase = 'tree';
    this.isPointerDownOnBoard = false;
    this.isPointerDownOnTray = false;
    this.isPointerDownOnInsertSlot = false;
    this.treeCamX = 0;
    this.treeCamY = 0;
    this.treeZoom = this.defaultTreeZoom;
    this.activeTreePointers.clear();
    this.isDraggingTree = false;
    this.isPinchingTree = false;

    this.elCabinetHeader.classList.add('hidden');
    this.elHomeOverlay.classList.add('hidden');
    this.elResultOverlay.classList.add('hidden');
    this.elTreeOverlay.classList.remove('hidden');
    this.elTimerBox.classList.remove('warning');
    this.resizeCanvas();

    const cur = SKILL_NODES.find((n) => n.id === this.selectedNodeId);
    if (
      !cur ||
      !this.skillTree.isVisible(cur) ||
      this.skillTree.getLevel(cur.id) >= cur.maxLevel
    ) {
      const candidate = SKILL_NODES.find(
        (n) => this.skillTree.isVisible(n) && this.skillTree.getLevel(n.id) < n.maxLevel
      );
      if (candidate) this.selectedNodeId = candidate.id;
    }

    this.saveGame();
    this.updateTreeUI();
  }

  // 操作1：下皿からメダルを拾う（3Dスタックの一番上のコインから優先回収、回収枚数増加に対応）
  private tryPickupFromTray(tx: number, ty: number): void {
    const maxRadius = this.stats.pickupRadius + MEDAL_RADIUS + 8;
    const batchSize = Math.max(1, this.stats.pickupBatchSize || 1);
    let pickedAny = false;

    for (let b = 0; b < batchSize; b++) {
      let bestIndex = -1;
      let bestScore = Infinity;

      for (let i = 0; i < this.physics.medals.length; i++) {
        const m = this.physics.medals[i];
        if (m.zone !== 'tray') continue;
        const dx = Math.abs(m.x - tx);
        const dy = Math.abs(m.y - ty);
        const dist = Math.hypot(dx, dy * 0.65);
        if (dist <= maxRadius) {
          // 同じ山の中では一番上（yが小さい方）を優先して拾う
          const score = dx * 0.8 + (m.y - TRAY_TOP_Y) * 0.35;
          if (score < bestScore) {
            bestScore = score;
            bestIndex = i;
          }
        }
      }

      if (bestIndex !== -1) {
        const picked = this.physics.medals.splice(bestIndex, 1)[0];
        this.heldQueue.push(picked.type);
        this.pickupParticles.push({
          x: picked.x,
          y: picked.y,
          tx: (INSERT_BOX_LEFT + INSERT_BOX_RIGHT) * 0.5,
          ty: INSERT_BOX_TOP + 34,
          progress: 0,
          type: picked.type,
        });
        pickedAny = true;
      } else {
        break;
      }
    }

    if (pickedAny) {
      sound.playPickup();
    }
  }

  // 操作2：右下パチスロ投入口をタップして上から下にメダルを入れて装填
  private tryInsertMedalToSlot(): void {
    if (this.heldQueue.length === 0) {
      this.addFloatingText(
        (INSERT_BOX_LEFT + INSERT_BOX_RIGHT) * 0.5,
        INSERT_BOX_TOP - 8,
        '左の下皿から拾おう！',
        '#f472b6',
        0.9
      );
      return;
    }

    const count = Math.min(this.stats.reloadBatchSize, this.heldQueue.length);
    for (let i = 0; i < count; i++) {
      const m = this.heldQueue.shift()!;
      this.loadedQueue.push(m);
      this.roundInsertedCount++;
      this.slotInsertAnims.push({
        progress: 0,
        type: m,
      });
    }
    sound.playReload();
  }

  // 操作3：上部盤面をタップしてメダルを投下
  private tryDropMedal(x: number): void {
    if (this.dropCooldownTimer > 0) return;
    if (this.loadedQueue.length === 0) {
      const msg =
        this.heldQueue.length > 0
          ? '右下の投入口をタップして装填！'
          : 'まず左の下皿からメダルを拾おう！';
      this.addFloatingText(
        Math.max(115, Math.min(BOARD_WIDTH - 115, x)),
        76,
        msg,
        '#f472b6',
        0.92
      );
      return;
    }

    const medalType = this.loadedQueue.shift()!;
    // ラッシュ等の連続投下時に完全縦直列衝突でスタック・振動するのを防ぐため、微細な自然の横オフセットを付与
    const dropX = x + (Math.random() - 0.5) * 3.6;
    this.physics.spawnMedal(dropX, 54, medalType, 'board');
    this.roundDroppedCount++;

    if (medalType === 'rush') {
      // ラッシュメダル：投下クールダウン即時ゼロで連続投下可能！
      this.dropCooldownTimer = 0;
      sound.playLaserSplit();
    } else {
      this.dropCooldownTimer = this.stats.dropCooldown;
    }
    sound.playDrop();
  }

  private getMedalBaseScoreMult(type: MedalType): number {
    switch (type) {
      case 'gold':
        return 3.0;
      case 'chrono':
        return 3.0;
      case 'plasma':
        return 2.0;
      case 'rush':
        return 2.0;
      case 'bounce':
        return 1.5;
      case 'bonus':
        return 1.5;
      default:
        return 1.0;
    }
  }

  private handlePinHit(medal: MedalEntity, pin: PinEntity): void {
    this.roundPinHits++;

    const slotPinBonus = this.slotPinBonusTimer > 0 ? 3 : 0;
    const effectiveBase = pin.baseScore + slotPinBonus;

    // バンパー（ピン）は初期状態では点数なし（0点）。ただしダイヤスロット効果発動中は基礎点+3
    if ((this.stats.basePinScore <= 0 && slotPinBonus <= 0) || effectiveBase <= 0) {
      sound.playMedalClink(0.35);
      return;
    }

    const bounceMult = medal.type === 'bounce' && pin.kind === 'bumper' ? 2.8 : 1.0;
    const feverMult = this.jpFeverTimer > 0 ? 2.0 : 1.0;
    const dracoMult =
      this.isRuneActive('draco') && medal.type === 'normal' && this.timeRemaining <= 10.0
        ? 1.25
        : 1.0;
    // ピン衝突得点には接触倍率は掛けず、基礎点×特効×全体倍率×フィーバー×ドラコで計算
    const raw =
      effectiveBase * bounceMult * this.stats.globalScoreMultiplier * feverMult * dracoMult;
    const gained = Math.max(1, Math.round(raw));

    this.score += gained;
    this.roundGainedScore += gained;
    this.roundPinScore += gained;
    if (gained > this.roundMaxSingleHit) {
      this.roundMaxSingleHit = gained;
    }

    sound.playPinHit(pin.kind === 'bumper');
    const pinBadge =
      feverMult > 1 && dracoMult > 1
        ? ` (x2/🐉)`
        : feverMult > 1
          ? ` (x2!)`
          : dracoMult > 1
            ? ` (🐉+25%)`
            : '';
    this.addFloatingText(
      pin.x,
      pin.y - 12,
      `+${gained}${pinBadge}`,
      pin.kind === 'bumper' ? '#f472b6' : '#00f2fe',
      pin.kind === 'bumper' ? 1.1 : 0.88
    );

    // 🏹 サジタリウス（中級刻印）：通常メダル衝突時 5%で会心 +10 PT
    if (
      this.isRuneActive('sagittarius') &&
      medal.type === 'normal' &&
      Math.random() < 0.05
    ) {
      const crit = 10;
      this.score += crit;
      this.roundGainedScore += crit;
      this.roundPinScore += crit;
      this.addFloatingText(pin.x, pin.y - 28, `+${crit} 🏹会心!`, '#f472b6', 1.2);
    }

    this.updateScoreHUD();
  }

  private handlePocketPass(medal: MedalEntity, pocket: PocketSlot): void {
    this.roundPocketCount++;

    const feverMult = this.jpFeverTimer > 0 ? 2.0 : 1.0;
    const isNormal = medal.type === 'normal';
    const dracoMult =
      this.isRuneActive('draco') && isNormal && this.timeRemaining <= 10.0
        ? 1.25
        : 1.0;
    const pegasusMult =
      this.isRuneActive('pegasus') && isNormal && medal.pinBounceCount > 0
        ? 1 + Math.min(10, medal.pinBounceCount) * 0.04
        : 1.0;
    const centaurusMult =
      this.isRuneActive('centaurus') && isNormal && medal.boardElapsedSec <= 2.0
        ? 1.40
        : 1.0;

    let altairMult = 1.0;
    if (this.isRuneActive('altair') && isNormal) {
      if (this.lastAltairPocketIdx !== -1 && this.lastAltairPocketIdx !== pocket.index) {
        this.altairChainCount = Math.min(5, this.altairChainCount + 1);
      } else if (this.lastAltairPocketIdx === pocket.index) {
        this.altairChainCount = 0;
      }
      this.lastAltairPocketIdx = pocket.index;
      if (this.altairChainCount > 0) {
        altairMult = 1 + this.altairChainCount * 0.10;
      }
    }

    let fortunaMult = 1.0;
    if (this.isRuneActive('fortuna') && isNormal) {
      const roll = Math.random();
      if (roll < 0.15) {
        fortunaMult = 2.00;
      } else if (roll < 0.50) {
        fortunaMult = 1.25;
      } else {
        fortunaMult = 1.05;
      }
    }

    const totalEngravingMult =
      dracoMult * pegasusMult * centaurusMult * altairMult * fortunaMult;
    const slotScoreBoost = this.slotScoreBoostTimer > 0 ? 1.5 : 1.0;
    const raw =
      this.stats.basePocketScore *
      pocket.scoreMultiplier *
      medal.chargeMultiplier *
      this.stats.globalScoreMultiplier *
      feverMult *
      slotScoreBoost *
      totalEngravingMult;
    const gained = Math.max(1, Math.round(raw));

    // 通常メダルへの刻印効果適用（固定加算・発動タグ収集）
    let runeBonus = 0;
    const tagParts: string[] = [];
    if (isNormal) {
      // ☀️ ソーラー：中央ポケット（index === 2）入賞時 +50 PT
      if (this.isRuneActive('solar') && pocket.index === 2) {
        runeBonus = 50;
        tagParts.push('☀️+50');
      }
      // ✨ トゥインクル：両端ポケット（index === 0 または 4）入賞時 +10 PT
      else if (
        this.isRuneActive('twinkle') &&
        (pocket.index === 0 || pocket.index === 4)
      ) {
        runeBonus = 10;
        tagParts.push('✨+10');
      }
    }

    if (dracoMult > 1) tagParts.push('🐉+25%');
    if (pegasusMult > 1) tagParts.push(`🦋+${Math.round((pegasusMult - 1) * 100)}%`);
    if (centaurusMult > 1) tagParts.push('🎯+40%');
    if (altairMult > 1) tagParts.push(`🔄+${Math.round((altairMult - 1) * 100)}%`);
    if (fortunaMult > 1) {
      tagParts.push(`🎲+${Math.round((fortunaMult - 1) * 100)}%${fortunaMult >= 2.0 ? '!' : ''}`);
    }
    if (slotScoreBoost > 1.0) tagParts.push('🕐x1.5');

    const totalGained = gained + runeBonus;
    this.score += totalGained;
    this.roundGainedScore += totalGained;
    this.roundPocketScore += totalGained;
    if (totalGained > this.roundMaxSingleHit) {
      this.roundMaxSingleHit = totalGained;
    }

    const centerX = (pocket.x1 + pocket.x2) * 0.5;
    const tagText = tagParts.join(' ');
    const txt = tagText
      ? `+${totalGained} PT (${tagText})`
      : feverMult > 1
        ? `+${gained} PT (x2!)`
        : `+${gained} PT`;

    const isBigFortuna = fortunaMult >= 2.0;
    const textColor =
      isBigFortuna
        ? '#f472b6'
        : runeBonus > 0 || totalEngravingMult > 1
          ? '#fde047'
          : pocket.scoreMultiplier >= 4
            ? '#00f2fe'
            : '#fde047';
    const textScale =
      isBigFortuna
        ? 1.35
        : pocket.scoreMultiplier >= 4 || runeBonus > 0 || totalEngravingMult > 1
          ? 1.25
          : 1.05;

    this.addFloatingText(centerX, POCKET_ENTRY_Y - 8, txt, textColor, textScale);

    // ♊ ジェミニ（中級刻印）：通常メダルの中左・中右ポケット入賞時 35%で上空から1枚追加投下
    if (
      this.isRuneActive('gemini') &&
      medal.type === 'normal' &&
      (pocket.index === 1 || pocket.index === 3) &&
      Math.random() < 0.35 &&
      this.physics.medals.length < 60
    ) {
      this.roundBonusMedals++;
      const dropX = 180 + Math.random() * 100;
      const clone = this.physics.spawnMedal(dropX, 54, 'normal', 'board');
      clone.contactFlash = 0.8;
      this.addFloatingText(centerX, POCKET_ENTRY_Y - 28, '♊ +1枚投下!', '#6ee7b7', 1.15);
      sound.playLaserSplit();
    }

    if (medal.type === 'chrono') {
      this.timeRemaining += 0.4;
      this.addFloatingText(centerX, POCKET_ENTRY_Y - 28, '+0.4s TIME!', '#f472b6', 1.15);
    }

    const shouldSpawnBonus = pocket.spawnsBonusMedal;
    if (shouldSpawnBonus && this.physics.medals.length < 60) {
      const extra = Math.random() < this.stats.bonusMedalExtraChance ? 2 : 1;
      this.roundBonusMedals += extra;
      for (let i = 0; i < extra; i++) {
        const spawnX = this.physics.pickTrayStackColumnX(centerX + (i - 0.5) * 45, this.roundBonusMedals + i);
        const bonusMedal = this.physics.spawnMedal(
          spawnX,
          TRAY_TOP_Y + 14,
          'bonus',
          'tray'
        );
        bonusMedal.vx = 0;
        bonusMedal.vy = 140;
      }
      this.addFloatingText(
        (TRAY_LEFT + TRAY_RIGHT) * 0.5,
        TRAY_TOP_Y + 4,
        `+${extra} BONUS MEDAL!`,
        '#00f2fe',
        1.12
      );
      sound.playPocket(true);
    } else {
      sound.playPocket(false);
    }

    // HOTポケット入賞＆スロット保留判定
    if (this.stats.hotSlotUnlocked && pocket.index === this.hotPocketIndex) {
      if (this.slotHoldCount < 4) {
        this.slotHoldCount++;
        this.addFloatingText(
          centerX,
          POCKET_ENTRY_Y - 26,
          `HOLD +1 (${this.slotHoldCount}/4)`,
          '#facc15',
          1.2
        );
        if (!this.isSlotSpinning && this.slotRestartCooldown <= 0) {
          this.startSlotSpin();
        }
      }
    }

    this.updateScoreHUD();
  }

  // ラッキーリング（通過ゲート）通過時の効果発動
  private handleLuckyRingPass(medal: MedalEntity, ring: LuckyRing): void {
    const stats = this.stats;
    if (ring.kind === 'mult') {
      const boostMult = stats.boostRingLevel >= 3 ? 4.0 : (stats.boostRingLevel >= 2 ? 3.0 : 2.0);
      medal.chargeMultiplier = Math.min(16.0, medal.chargeMultiplier * boostMult);
      medal.contactFlash = 1.0;
      this.addFloatingText(ring.x, ring.y - 10, `RING ×${boostMult} BOOST!`, '#fde047', 1.25);
      sound.playPocket(true);
    } else {
      // クローンオーブ：Lv1=+1枚, Lv2=+1枚(倍率x1.5), Lv3=+2枚
      const cloneCount = stats.cloneRingLevel >= 3 ? 2 : 1;
      const cloneBonus = stats.cloneRingLevel >= 2 ? 1.5 : 1.0;
      for (let c = 0; c < cloneCount; c++) {
        if (this.physics.medals.length < 60) {
          const dir = c === 0 ? 1 : -1;
          const clone = this.physics.spawnMedal(ring.x + dir * (12 + c * 6), ring.y, medal.type, 'board');
          clone.vx = dir * 50;
          clone.vy = Math.max(60, medal.vy * 0.85);
          clone.chargeMultiplier = medal.chargeMultiplier * cloneBonus;
          clone.contactFlash = 0.8;
          this.roundBonusMedals++;
        }
      }
      const label =
        cloneCount > 1
          ? `ORB SPLIT +${cloneCount}!`
          : cloneBonus > 1.0
          ? 'ORB SPLIT +1 (x1.5)!'
          : 'ORB SPLIT +1!';
      this.addFloatingText(ring.x, ring.y - 10, label, '#34d399', 1.25);
      sound.playPocket(true);
    }
  }

  private handlePocketToggleLamp(pocket: PocketSlot, lit: boolean): void {
    sound.playJackpotLamp(lit);
  }

  // JP時の射出メダル抽選（通常率：未強化80%〜強化で50%、特殊枠：ゴールド32/プラズマ24/バウンス20/ラッシュ18/クロノ6%）
  private rollJackpotMedalType(): MedalType {
    if (Math.random() < this.stats.jpNormalMedalRate) {
      return 'normal';
    }

    const baseWeights: Record<string, number> = {
      gold: 32,
      plasma: 24,
      bounce: 20,
      rush: 18,
      chrono: 6,
    };

    const unlockedTypes = new Set(this.stats.specialMedals.filter((t) => t !== 'normal'));
    const candidateWeights: { type: MedalType; weight: number }[] = [];
    for (const t of unlockedTypes) {
      if (baseWeights[t]) {
        candidateWeights.push({ type: t, weight: baseWeights[t] });
      }
    }

    if (candidateWeights.length === 0) {
      return 'normal';
    }

    const totalWeight = candidateWeights.reduce((sum, c) => sum + c.weight, 0);
    let r = Math.random() * totalWeight;
    for (const item of candidateWeights) {
      if (r < item.weight) return item.type;
      r -= item.weight;
    }
    return candidateWeights[0].type;
  }

  private handleJackpotFever(forceFreeze: boolean = false): void {
    // JPフィーバー（3秒間全得点2倍）解放済みならタイマーセット
    if (this.stats.jpFeverUnlocked) {
      this.jpFeverTimer = 3.0;
    }

    // JPロングフリーズ抽選（解放済みかつ2%、またはforceFreeze時）
    const triggerFreeze =
      (this.stats.jpFreezeUnlocked && Math.random() < 0.02) || forceFreeze;
    if (triggerFreeze) {
      this.startJackpotFreeze();
      return;
    }

    // 通常のJACKPOT発動（強化に応じた枚数射出：10, 15, 20, 25枚）
    sound.playJackpotFanfare();
    this.jackpotFlashTimer = 0.8;
    this.screenShakeTimer = 0.7;
    this.jackpotShotsRemaining = this.stats.jpShotsCount;
    this.jackpotShotInterval = 0.04; // すぐに1発目を射出
    this.isLeftJackpotShooter = true;

    this.addFloatingText(
      BOARD_WIDTH * 0.5,
      270,
      '★ JACKPOT ★',
      '#facc15',
      2.2
    );
  }

  // JPロングフリーズ演出開始（5.0秒演出：通常JP偽装→砂嵐グリッチ→プチュン暗転→巨大PREMIUM JPカットイン→100枚待機）
  private startJackpotFreeze(): void {
    sound.playJackpotFanfare(); // フリーズ突入時もJACKPOTファンファーレを再生！
    this.isJackpotFreezing = true;
    this.jackpotFreezeTimer = 0;
    this.jackpotFlashTimer = 0.8;
    this.screenShakeTimer = 0.5;

    // 100枚のストックメダルを事前生成（上部整列用：20枚×5行、純粋な確率抽選）
    this.freezeStockMedals = [];
    const count = 100;
    for (let i = 0; i < count; i++) {
      const col = i % 20;
      const row = Math.floor(i / 20);
      const x = 42 + col * 19.8;
      const y = 20 + row * 11.5;
      const type = this.rollJackpotMedalType();
      this.freezeStockMedals.push({ x, y, type });
    }

    this.addFloatingText(
      BOARD_WIDTH * 0.5,
      270,
      '★ JACKPOT ★',
      '#facc15',
      2.2
    );
  }

  private updateJackpotFreeze(dtSec: number): void {
    const prevT = this.jackpotFreezeTimer;
    this.jackpotFreezeTimer += dtSec;
    const t = this.jackpotFreezeTimer;

    // 1.0s: ザザッ…砂嵐・走査線ノイズ音
    if (prevT < 1.0 && t >= 1.0) {
      sound.playFreezeGlitchNoise();
    }

    // 1.45s: バシィッ！プチュン消音＆暗転収束
    if (prevT < 1.45 && t >= 1.45) {
      sound.playFreezePutsun();
      this.screenShakeTimer = 0.35;
    }

    // 2.3s: ドガァァン！PREMIUM JACKPOT 激突カットイン（クラッシュ＆荘厳ロングファンファーレ）
    if (prevT < 2.3 && t >= 2.3) {
      sound.playFreezeCrash();
      this.screenShakeTimer = 0.65;
    }

    // 6.0s: 演出完了！タイマー再開＆100枚一気放出（+1.0s延長でロングファンファーレを堪能）
    if (t >= 6.0) {
      this.releaseFreezeStockMedals();
    }
  }

  private releaseFreezeStockMedals(): void {
    this.isJackpotFreezing = false;
    this.jackpotFreezeTimer = 0;
    this.screenShakeTimer = 1.4;
    this.jackpotFlashTimer = 1.0;
    sound.playJackpotFanfare();

    // 100枚を一斉に盤面へ射出！
    for (let i = 0; i < this.freezeStockMedals.length; i++) {
      const stock = this.freezeStockMedals[i];
      const medal = this.physics.spawnMedal(stock.x, stock.y, stock.type, 'board');
      const spreadX = (stock.x - BOARD_WIDTH * 0.5) * 1.5;
      medal.vx = spreadX + (Math.random() - 0.5) * 90;
      medal.vy = 220 + Math.random() * 150;
      medal.chargeMultiplier = this.getMedalBaseScoreMult(medal.type);
    }
  }

  private addFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale: number = 1.0
  ): void {
    if (this.floatingTexts.length > 45) {
      this.floatingTexts.shift();
    }
    this.floatingTexts.push({
      x,
      y,
      vy: -46,
      text,
      color,
      alpha: 1.0,
      scale,
    });
  }

  // 本格プラズマ稲妻エフェクト（ジグザグアーク放電）生成
  private spawnLightning(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string = '#c084fc'
  ): void {
    if (this.lightningBolts.length > 25) {
      this.lightningBolts.shift();
    }
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) return;

    const nx = -dy / dist;
    const ny = dx / dist;

    // 4〜6セグメントの有機的ジグザグ中継点を算出
    const segCount = Math.max(3, Math.min(6, Math.floor(dist / 14)));
    const points: { x: number; y: number }[] = [{ x: x1, y: y1 }];

    for (let i = 1; i < segCount; i++) {
      const t = i / segCount;
      const envelope = Math.sin(t * Math.PI); // 両端はブレず中間が大きく揺らぐ
      const jitter = (Math.random() * 2 - 1) * 8.5 * envelope;
      points.push({
        x: x1 + dx * t + nx * jitter,
        y: y1 + dy * t + ny * jitter,
      });
    }
    points.push({ x: x2, y: y2 });

    this.lightningBolts.push({
      id: Math.random(),
      points,
      life: 1.0,
      maxLife: 0.12,
      color,
    });
  }

  // 稲妻アーク放電描画（白芯コア＋紫・シアン多重ネオングロー）
  private drawLightningBolts(ctx: CanvasRenderingContext2D): void {
    if (this.lightningBolts.length === 0) return;
    ctx.save();
    for (const bolt of this.lightningBolts) {
      const pts = bolt.points;
      if (pts.length < 2) continue;

      const alpha = Math.max(0, Math.min(1, bolt.life));

      // 1. 外側の広域ネオングロー
      ctx.strokeStyle = bolt.color;
      ctx.globalAlpha = alpha * 0.75;
      ctx.lineWidth = 3.4;
      ctx.shadowColor = bolt.color;
      ctx.shadowBlur = 12;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();

      // 2. 内側の高輝度白芯コア（熱線）
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = alpha * 0.95;
      ctx.lineWidth = 1.3;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 5;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private updateScoreHUD(): void {
    this.elScore.textContent = this.roundGainedScore.toLocaleString();
  }

  private loop(now: number): void {
    const dtSec = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    this.bgAngle += dtSec * 0.25;

    if (this.phase === 'play') {
      this.totalPlayTimeSec += dtSec;
      this.updatePlayPhase(dtSec);
      this.renderPlayPhase();
    } else if (this.phase === 'tree') {
      this.totalPlayTimeSec += dtSec;
      this.updateTreePhase(dtSec);
      this.renderTreePhase();
    } else {
      if (this.phase === 'home') {
        this.updateHomeShowcaseAnim(dtSec);
      }
      // ホーム画面・リザルト画面の背景として筐体を描画
      this.renderPlayPhase();
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  private updateTreePhase(dtSec: number): void {
    // 1. 購入エフェクト更新
    for (let i = this.treePurchaseEffects.length - 1; i >= 0; i--) {
      const eff = this.treePurchaseEffects[i];
      eff.t += dtSec;
      if (eff.t >= eff.maxT) {
        this.treePurchaseEffects.splice(i, 1);
      }
    }

    // 2. ノード購入バウンス更新
    for (const [nid, rem] of this.treeNodeBounceTimers.entries()) {
      const next = rem - dtSec;
      if (next <= 0) {
        this.treeNodeBounceTimers.delete(nid);
      } else {
        this.treeNodeBounceTimers.set(nid, next);
      }
    }

    // 3. マイルストーンバナータイマー更新
    if (this.milestoneBannerTimer > 0) {
      this.milestoneBannerTimer -= dtSec;
      if (this.milestoneBannerTimer <= 0) {
        this.elTreeMilestoneBanner?.classList.add('hidden');
      }
    }
  }

  private updatePlayPhase(dtSec: number): void {
    // JPロングフリーズ演出中はタイマー減算・物理演算・通常入力を完全停止
    if (this.isJackpotFreezing) {
      this.updateJackpotFreeze(dtSec);
      return;
    }

    this.timeRemaining -= dtSec;
    if (this.jpFeverTimer > 0) {
      this.jpFeverTimer = Math.max(0, this.jpFeverTimer - dtSec);
    }
    if (this.timeRemaining <= 5.0) {
      this.elTimerBox.classList.add('warning');
    } else {
      this.elTimerBox.classList.remove('warning');
    }

    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      // 時間切れ時はリザルト画面へ移行
      this.enterResultPhase();
      return;
    }
    this.elTimer.textContent = `${this.timeRemaining.toFixed(1)}s`;

    // 投下クールタイム＆長押し連続投下
    if (this.dropCooldownTimer > 0) {
      this.dropCooldownTimer = Math.max(0, this.dropCooldownTimer - dtSec);
    }
    if (
      this.isPointerDownOnBoard &&
      this.stats.holdDropUnlocked &&
      this.dropCooldownTimer <= 0 &&
      this.loadedQueue.length > 0
    ) {
      this.tryDropMedal(this.pointerBoardX);
    }

    // 下皿スワイプ/長押し連続回収
    if (this.pickupCooldownTimer > 0) {
      this.pickupCooldownTimer = Math.max(0, this.pickupCooldownTimer - dtSec);
    }
    if (
      this.isPointerDownOnTray &&
      this.stats.swipePickupUnlocked &&
      this.pickupCooldownTimer <= 0
    ) {
      this.tryPickupFromTray(this.pointerBoardX, this.pointerBoardY);
      this.pickupCooldownTimer = this.stats.pickupInterval;
    }

    // 右下パチスロ投入口の長押し連続装填
    if (this.isPointerDownOnInsertSlot && this.stats.holdReloadUnlocked) {
      this.reloadHoldTimer -= dtSec;
      if (this.reloadHoldTimer <= 0 && this.heldQueue.length > 0) {
        this.tryInsertMedalToSlot();
        this.reloadHoldTimer = this.stats.reloadInterval;
      }
    }

    // 物理演算更新（1/240秒固定ステップ）
    this.physics.update(dtSec, this.stats, {
      onPinHit: (m, p) => this.handlePinHit(m, p),
      onPocketPass: (m, pk) => this.handlePocketPass(m, pk),
      onMedalClink: (intensity) => sound.playMedalClink(intensity),
      onLaserSplit: (x, y) => {
        sound.playLaserSplit();
        this.addFloatingText(x, y - 10, 'SPLIT! x2', '#38bdf8', 1.0);
      },
      onCatapultLaunch: (m, cat, originX, originY, cloned) => {
        sound.playCatapultLaunch();
        const sx = originX ?? cat.x;
        const sy = originY ?? cat.y;
        // 吸い込み消滅エフェクト（入口ポータル）
        this.warpEffects.push({
          x: sx,
          y: sy,
          progress: 0,
          maxR: 32,
          color: '#a855f7',
          kind: 'implosion',
        });
        // 入口→出口へのワープ光線アーク
        this.warpEffects.push({
          x: cat.x,
          y: cat.y,
          tx: cat.exitX,
          ty: cat.exitY,
          progress: 0,
          maxR: 1,
          color: '#00f2fe',
          kind: 'arc',
        });
        // 出現拡散エフェクト（上空出口ゲート）
        this.warpEffects.push({
          x: cat.exitX,
          y: cat.exitY,
          progress: 0,
          maxR: 38,
          color: '#00f2fe',
          kind: 'explosion',
        });

        if (cloned) {
          this.roundBonusMedals++;
        }
        const multLabel = `x${m.chargeMultiplier.toFixed(1)}`;
        this.addFloatingText(
          cat.exitX,
          cat.exitY + 18,
          cloned ? `WARP +0.5 & 複製! (${multLabel})` : `WARP +0.5! (${multLabel})`,
          cloned ? '#f472b6' : '#00f2fe',
          cloned ? 1.22 : 1.12
        );
        this.addFloatingText(cat.x, cat.y - 20, 'HYPER WARP!', '#c084fc', 0.95);
      },
      onLuckyRingPass: (m, ring) => this.handleLuckyRingPass(m, ring),
      onPrismHit: (_medal, prism) => {
        sound.playPrismHit(prism.hp);
        // ヒット時の結晶欠片スパーク（残HPに応じた段階カラー）
        const hitColor =
          prism.hp <= 1
            ? '#f43f5e'
            : prism.hp === 2
            ? '#fb923c'
            : prism.hp === 3
            ? '#fde047'
            : prism.hp === 4
            ? '#34d399'
            : '#38bdf8';
        for (let k = 0; k < 4; k++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 70 + Math.random() * 80;
          this.prismShards.push({
            x: prism.x,
            y: prism.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 30,
            size: 3 + Math.random() * 2.5,
            rot: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 14,
            life: 0.35,
            maxLife: 0.35,
            color: hitColor,
          });
        }
        this.addFloatingText(prism.x, prism.y - 16, 'CRACK!', hitColor, 0.98);
      },
      onPrismBreak: (_medal, prism, spawnedCount) => {
        sound.playPrismBreak();
        const feverMult = this.jpFeverTimer > 0 ? 2.0 : 1.0;
        const breakPt = Math.max(
          15,
          Math.round(15 * this.stats.basePocketScore * this.stats.slotMultiplier * feverMult)
        );
        this.score += breakPt;
        this.roundGainedScore += breakPt;
        this.roundPocketScore += breakPt;
        if (breakPt > this.roundMaxSingleHit) {
          this.roundMaxSingleHit = breakPt;
        }
        this.roundBonusMedals += spawnedCount;
        this.updateScoreHUD();

        this.warpEffects.push({
          x: prism.x,
          y: prism.y,
          progress: 0,
          maxR: 46,
          color: '#f472b6',
          kind: 'explosion',
        });
        const colors = ['#38bdf8', '#fde047', '#f472b6', '#ffffff'];
        for (let k = 0; k < 14; k++) {
          const ang = (k / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
          const spd = 95 + Math.random() * 145;
          this.prismShards.push({
            x: prism.x,
            y: prism.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 45,
            size: 4 + Math.random() * 4.5,
            rot: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 16,
            life: 0.65,
            maxLife: 0.65,
            color: colors[k % colors.length],
          });
        }

        const label =
          spawnedCount > 0
            ? `PRISM +${breakPt}PT +${spawnedCount}枚!`
            : `PRISM +${breakPt}PT!`;
        this.addFloatingText(prism.x, prism.y - 18, label, '#fde047', 1.28);
      },
      onJackpot: () => this.handleJackpotFever(),
      onPocketToggleLamp: (pk, lit) => this.handlePocketToggleLamp(pk, lit),
      onRailHit: () => sound.playMedalClink(0.35),
      onPinElectrified: (pin, medal) => {
        this.spawnLightning(medal.x, medal.y, pin.x, pin.y, '#c084fc');
        sound.playMedalClink(0.4);
      },
      onElectrifiedPinHit: (pin, medal, newMultiplier) => {
        this.spawnLightning(pin.x, pin.y, medal.x, medal.y, '#c084fc');
        // 最終倍率だけをクリーンに表示（絵文字なし！）
        this.addFloatingText(medal.x, medal.y - 14, `x${newMultiplier.toFixed(1)}`, '#c084fc', 1.05);
        sound.playLaserSplit();
      },
      onMedalElectrified: (a, b) => {
        this.spawnLightning(a.x, a.y, b.x, b.y, '#c084fc');
      },
    });

    // JACKPOT 連続射出処理（左上・右上から交互に計10枚射出）
    if (this.jackpotShotsRemaining > 0) {
      this.jackpotShotInterval -= dtSec;
      if (this.jackpotShotInterval <= 0) {
        this.jackpotShotInterval = 0.085; // 0.085秒ごとに1枚射出
        this.jackpotShotsRemaining--;

        sound.playJackpotShoot();
        const isLeft = this.isLeftJackpotShooter;
        this.isLeftJackpotShooter = !this.isLeftJackpotShooter;

        const spawnX = isLeft ? 45 : 415;
        const spawnY = 62;
        // 中央3連バンパーに向けて斜め下へ射出
        const targetX = isLeft ? 170 + Math.random() * 50 : 290 - Math.random() * 50;
        const targetY = 240 + Math.random() * 60;
        const angle = Math.atan2(targetY - spawnY, targetX - spawnX) + (Math.random() - 0.5) * 0.18;
        const speed = 320 + Math.random() * 60;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        if (isLeft) {
          this.muzzleFlashLeft = 1.0;
        } else {
          this.muzzleFlashRight = 1.0;
        }

        // JP特殊確率ノード連動抽選（通常確率：未強化70%〜強化で30%、特殊枠：ゴールド35/プラズマ25/バウンス18/クローン13/クロノ9）
        const type = this.rollJackpotMedalType();

        const medal = this.physics.spawnMedal(spawnX, spawnY, type, 'board');
        medal.vx = vx;
        medal.vy = vy;
        medal.chargeMultiplier = 1.0;
      }
    }

    if (this.jackpotBannerTimer > 0) this.jackpotBannerTimer -= dtSec;
    if (this.jackpotFlashTimer > 0) this.jackpotFlashTimer -= dtSec;
    if (this.screenShakeTimer > 0) this.screenShakeTimer -= dtSec;
    if (this.muzzleFlashLeft > 0) this.muzzleFlashLeft -= dtSec * 4.5;
    if (this.muzzleFlashRight > 0) this.muzzleFlashRight -= dtSec * 4.5;

    for (let i = this.pickupParticles.length - 1; i >= 0; i--) {
      const pt = this.pickupParticles[i];
      pt.progress += dtSec * 6.5;
      if (pt.progress >= 1) {
        this.pickupParticles.splice(i, 1);
      }
    }

    for (let i = this.slotInsertAnims.length - 1; i >= 0; i--) {
      const anim = this.slotInsertAnims[i];
      anim.progress += dtSec * 5.2;
      if (anim.progress >= 1) {
        this.slotInsertAnims.splice(i, 1);
      }
    }

    for (let i = this.warpEffects.length - 1; i >= 0; i--) {
      const we = this.warpEffects[i];
      we.progress += dtSec * 3.8;
      if (we.progress >= 1) {
        this.warpEffects.splice(i, 1);
      }
    }

    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const bolt = this.lightningBolts[i];
      bolt.life -= dtSec / bolt.maxLife;
      if (bolt.life <= 0) {
        this.lightningBolts.splice(i, 1);
      }
    }

    for (let i = this.prismShards.length - 1; i >= 0; i--) {
      const sh = this.prismShards[i];
      sh.life -= dtSec;
      sh.x += sh.vx * dtSec;
      sh.y += sh.vy * dtSec;
      sh.vy += 460 * dtSec;
      sh.rot += sh.vRot * dtSec;
      if (sh.life <= 0) {
        this.prismShards.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dtSec;
      ft.alpha -= dtSec * 1.35;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // ホットポケット移動タイマー更新
    if (this.stats.hotSlotUnlocked) {
      this.hotPocketTimer -= dtSec;
      if (this.hotPocketTimer <= 0) {
        this.hotPocketTimer = this.hotPocketInterval;
        const others = [0, 1, 2, 3, 4].filter((idx) => idx !== this.hotPocketIndex);
        this.hotPocketIndex = others[Math.floor(Math.random() * others.length)];
      }
    }

    // スロット出目バフタイマー更新
    if (this.slotScoreBoostTimer > 0) {
      this.slotScoreBoostTimer = Math.max(0, this.slotScoreBoostTimer - dtSec);
    }
    if (this.slotPinBonusTimer > 0) {
      this.slotPinBonusTimer = Math.max(0, this.slotPinBonusTimer - dtSec);
    }

    // 🧲 オート機能（5秒間自動回収・装填・投下）
    if (this.autoMagnetTimer > 0) {
      this.autoMagnetTimer = Math.max(0, this.autoMagnetTimer - dtSec);

      // 1. 自動回収（トレイから手元ストックへ）
      this.autoMagnetPickupTimer -= dtSec;
      if (this.autoMagnetPickupTimer <= 0) {
        this.autoMagnetPickupTimer = 0.08;
        const trayMedal = this.physics.medals.find((m) => m.zone === 'tray');
        if (trayMedal) {
          this.tryPickupFromTray(trayMedal.x, trayMedal.y);
        }
      }

      // 2. 自動装填（手元ストックから投入口へ）
      this.autoMagnetReloadTimer -= dtSec;
      if (this.autoMagnetReloadTimer <= 0) {
        this.autoMagnetReloadTimer = 0.08;
        this.tryInsertMedalToSlot();
      }

      // 3. 自動投下（投入口装填メダルを盤面へ）
      this.autoMagnetDropTimer -= dtSec;
      if (this.autoMagnetDropTimer <= 0) {
        this.autoMagnetDropTimer = 0.12;
        const rx = WALL_LEFT + 25 + Math.random() * (WALL_RIGHT - WALL_LEFT - 50);
        this.tryDropMedal(rx);
      }
    }

    // 簡易スロット＆サイドシューター更新
    if (this.stats.hotSlotUnlocked) {
      this.updateSlot(dtSec);
    }
    this.updateSlotShooter(dtSec);
  }

  private renderPlayPhase(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    ctx.save();
    // 画面揺れ演出（JACKPOT発動時）
    if (this.screenShakeTimer > 0) {
      const shakeMag = this.screenShakeTimer * 7.5;
      const sx = (Math.random() - 0.5) * shakeMag;
      const sy = (Math.random() - 0.5) * shakeMag;
      ctx.translate(sx, sy);
    }

    // 0. ガンメタル筐体ベース背景
    const cabGrad = ctx.createLinearGradient(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    cabGrad.addColorStop(0, '#161b26');
    cabGrad.addColorStop(0.5, '#0d1119');
    cabGrad.addColorStop(1, '#141923');
    ctx.fillStyle = cabGrad;
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // 1. 盤面カーボンファイバー背景
    ctx.save();
    this.tracePlayfieldPath(ctx);
    ctx.clip();

    if (this.carbonPattern) {
      ctx.fillStyle = this.carbonPattern;
    } else {
      ctx.fillStyle = '#090d16';
    }
    ctx.fillRect(WALL_LEFT, 10, WALL_RIGHT - WALL_LEFT, POCKET_EXIT_Y);

    const spotGrad = ctx.createRadialGradient(
      BOARD_WIDTH * 0.5,
      260,
      20,
      BOARD_WIDTH * 0.5,
      260,
      260
    );
    spotGrad.addColorStop(0, 'rgba(0, 242, 254, 0.08)');
    spotGrad.addColorStop(0.6, 'rgba(181, 53, 246, 0.05)');
    spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(WALL_LEFT, 10, WALL_RIGHT - WALL_LEFT, POCKET_EXIT_Y);

    this.drawCornerGrilles(ctx);
    this.drawGuideRails(ctx);
    this.drawCornerShooters(ctx);
    this.drawTopDispenser(ctx);

    // 3. サイバー・カタパルト＆スプリットライン描画
    this.drawCyberCatapults(ctx);
    this.drawSplitLasers(ctx);

    this.drawNeonPockets(ctx);
    this.drawLuckyRing(ctx);
    this.drawPrismTarget(ctx);
    this.drawPins(ctx);

    for (const m of this.physics.medals) {
      if (m.zone === 'board' && m.trail.length > 1) {
        this.drawMedalTrail(ctx, m);
      }
    }

    for (const m of this.physics.medals) {
      if (m.zone === 'board') {
        this.drawMedalGraphic(
          ctx,
          m.x,
          m.y,
          m.radius,
          m.type,
          m.chargeMultiplier,
          m.contactFlash
        );
      }
    }

    // カタパルト・ワープエフェクト（吸い込み光輪＆出現スパーク）描画
    this.drawWarpEffects(ctx);
    this.drawPrismShards(ctx);

    // プラズマ稲妻アーク放電描画
    this.drawLightningBolts(ctx);

    // 簡易スロット窓描画（盤面上部）
    if (this.stats.hotSlotUnlocked) {
      this.drawSlotWindow(ctx);
    }

    ctx.restore();

    this.drawPlayfieldNeonFrame(ctx);
    this.drawBottomTrayAndInsertConsole(ctx);

    for (const pt of this.pickupParticles) {
      const cx = pt.x + (pt.tx - pt.x) * pt.progress;
      const cy = pt.y + (pt.ty - pt.y) * pt.progress - Math.sin(pt.progress * Math.PI) * 26;
      const r = MEDAL_RADIUS * (1 - pt.progress * 0.16);
      this.draw3DTrayCoin(ctx, cx, cy, r, pt.type);
    }

    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `900 ${Math.round(14 * ft.scale)}px 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#050811';
      ctx.lineWidth = 3.5;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // JACKPOT 画面全体フラッシュ演出
    if (this.jackpotFlashTimer > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.65, this.jackpotFlashTimer * 0.9)})`;
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      ctx.restore();
    }

    // JPロングフリーズ演出オーバーレイ描画
    if (this.isJackpotFreezing) {
      this.drawJackpotFreezeOverlay(ctx);
    }

    // 画面揺れのリストア
    ctx.restore();
  }

  // JPロングフリーズ演出描画（5.0秒タイムライン：通常偽装→ザザ砂嵐→プチュン画像再現→巨大PREMIUM JPカットイン→100枚待機）
  private drawJackpotFreezeOverlay(ctx: CanvasRenderingContext2D): void {
    const t = this.jackpotFreezeTimer;

    // === Stage 1: 0.0s〜1.0s (通常JPと同じ、ノイズ一切なしでプレイヤーを油断させる) ===
    if (t < 1.0) {
      return;
    }

    // === Stage 2: 1.0s〜1.45s (突如走る「ザザッ…」という砂嵐・走査線・RGBグリッチノイズ) ===
    if (t < 1.45) {
      const glitchProg = (t - 1.0) / 0.45; // 0 -> 1
      ctx.save();
      // 走査線ノイズ（ランダムな高さのライン）
      const lineCount = 8 + Math.floor(Math.random() * 8);
      for (let i = 0; i < lineCount; i++) {
        const gy = Math.floor(Math.random() * BOARD_HEIGHT);
        const gh = 2 + Math.floor(Math.random() * 8);
        const colors = [
          'rgba(0, 242, 254, 0.45)', // シアン
          'rgba(244, 63, 94, 0.45)',  // マゼンタ
          'rgba(255, 255, 255, 0.6)',  // 白
          'rgba(0, 0, 0, 0.8)'         // 黒遮断
        ];
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillRect(0, gy, BOARD_WIDTH, gh);
      }

      // 砂嵐グレイン（細かいノイズ点群）
      const grainCount = 120;
      for (let i = 0; i < grainCount; i++) {
        const gx = Math.random() * BOARD_WIDTH;
        const gy = Math.random() * BOARD_HEIGHT;
        const size = Math.random() < 0.2 ? 3 : 1.5;
        ctx.fillStyle =
          Math.random() < 0.5 ? 'rgba(255, 255, 255, 0.35)' : 'rgba(168, 85, 247, 0.35)';
        ctx.fillRect(gx, gy, size, size);
      }

      // 画面暗転の兆候（終盤にかけて点滅）
      if (Math.random() < glitchProg * 0.7) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      }
      ctx.restore();
      return;
    }

    // === Stage 3: 1.45s〜2.05s (プチュン：添付画像完全再現の紫アナモルフィックフレア＆4条ダイヤモンドスターバースト) ===
    if (t < 2.05) {
      const p = (t - 1.45) / 0.6; // 0 -> 1
      ctx.save();
      // 完全な漆黒
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      const cx = BOARD_WIDTH * 0.5;
      const cy = BOARD_HEIGHT * 0.5;

      // 収束イージング：前半は力強く輝き、後半急速に中央1点へ吸い込まれる
      // p: 0.0〜0.2 は最大発光、0.2〜1.0 で中央へ収束
      const scaleProg = p < 0.2 ? 1.0 : 1.0 - Math.pow((p - 0.2) / 0.8, 1.8);
      const intensity = Math.max(0, 1.0 - Math.pow(p, 1.4));

      if (scaleProg > 0.001 && intensity > 0.001) {
        // --- 1. 水平アナモルフィック・レンズフレア（画面を横一線に貫く光条） ---
        const beamHalfW = BOARD_WIDTH * 0.5 * Math.max(0.05, scaleProg);

        // 外周紫ネオングロー
        ctx.save();
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 28 * intensity;
        ctx.strokeStyle = `rgba(168, 85, 247, ${0.7 * intensity})`;
        ctx.lineWidth = Math.max(1, 16 * intensity);
        ctx.beginPath();
        ctx.moveTo(cx - beamHalfW, cy);
        ctx.lineTo(cx + beamHalfW, cy);
        ctx.stroke();

        // 中層マゼンタ光条
        ctx.shadowColor = '#e879f9';
        ctx.shadowBlur = 14 * intensity;
        ctx.strokeStyle = `rgba(232, 121, 249, ${0.9 * intensity})`;
        ctx.lineWidth = Math.max(1, 6 * intensity);
        ctx.beginPath();
        ctx.moveTo(cx - beamHalfW, cy);
        ctx.lineTo(cx + beamHalfW, cy);
        ctx.stroke();

        // 中心白芯（高輝度コア）
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6 * intensity;
        ctx.strokeStyle = `rgba(255, 255, 255, ${1.0 * intensity})`;
        ctx.lineWidth = Math.max(0.8, 2.2 * intensity);
        ctx.beginPath();
        ctx.moveTo(cx - beamHalfW, cy);
        ctx.lineTo(cx + beamHalfW, cy);
        ctx.stroke();
        ctx.restore();

        // --- 2. 中央4条ダイヤモンド・スターバースト（鋭い星型クロス光冠） ---
        const rx = 160 * scaleProg; // 水平方向の伸び
        const ry = 65 * scaleProg; // 垂直方向の伸び

        ctx.save();
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 24 * intensity;

        // 星型アストロイドパス
        ctx.beginPath();
        ctx.moveTo(cx, cy - ry);
        ctx.quadraticCurveTo(cx, cy, cx + rx, cy);
        ctx.quadraticCurveTo(cx, cy, cx, cy + ry);
        ctx.quadraticCurveTo(cx, cy, cx - rx, cy);
        ctx.quadraticCurveTo(cx, cy, cx, cy - ry);
        ctx.closePath();

        const starGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, Math.max(rx, ry));
        starGrad.addColorStop(0.0, `rgba(255, 255, 255, ${1.0 * intensity})`);
        starGrad.addColorStop(0.2, `rgba(245, 208, 254, ${0.95 * intensity})`);
        starGrad.addColorStop(0.6, `rgba(192, 132, 252, ${0.6 * intensity})`);
        starGrad.addColorStop(1.0, `rgba(168, 85, 247, 0)`);
        ctx.fillStyle = starGrad;
        ctx.fill();

        // 星型の白芯コア（さらにシャープな光冠）
        const coreRx = rx * 0.45;
        const coreRy = ry * 0.45;
        ctx.beginPath();
        ctx.moveTo(cx, cy - coreRy);
        ctx.quadraticCurveTo(cx, cy, cx + coreRx, cy);
        ctx.quadraticCurveTo(cx, cy, cx, cy + coreRy);
        ctx.quadraticCurveTo(cx, cy, cx - coreRx, cy);
        ctx.quadraticCurveTo(cx, cy, cx, cy - coreRy);
        ctx.closePath();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * intensity})`;
        ctx.fill();

        // 中心グロー球
        const centerR = Math.max(2, 14 * scaleProg);
        const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerR);
        centerGrad.addColorStop(0, `rgba(255, 255, 255, ${1.0 * intensity})`);
        centerGrad.addColorStop(0.4, `rgba(232, 121, 249, ${0.8 * intensity})`);
        centerGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
        ctx.fillStyle = centerGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      return;
    }

    // === Stage 4: 2.05s〜2.3s (完全な漆黒の静寂・タメ) ===
    if (t < 2.3) {
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      ctx.restore();
      return;
    }

    // === Stage 5: 2.3s〜4.9s (【案A改】4段階シンクロ！1音目PREMIUM激突→2音目チャージ→3音目JACKPOT激突→4音目大団円最大発光) ===
    if (t < 4.9) {
      const elapsed = t - 2.3;
      const prog = elapsed / 2.6; // 0 -> 1 (じっくり2.6秒間表示)
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      const cx = BOARD_WIDTH * 0.5;
      const cy = 295;
      const premY = cy - 28;
      const jackY = cy + 28;

      // --- 4音目以降 (1.35s〜): 背後で回転するゴッドレイ（神々しい16本放射状光条） ---
      if (elapsed >= 1.35) {
        const t4 = elapsed - 1.35;
        const godrayAlpha = Math.min(1.0, t4 / 0.3);
        ctx.save();
        ctx.translate(cx, cy);
        const rotAngle = t4 * 0.28;
        ctx.rotate(rotAngle);
        const rayCount = 16;
        for (let i = 0; i < rayCount; i++) {
          const a1 = (i / rayCount) * Math.PI * 2;
          const a2 = a1 + (Math.PI / rayCount) * 0.55;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 420, a1, a2);
          ctx.closePath();
          const rayGrad = ctx.createRadialGradient(0, 0, 25, 0, 0, 420);
          const rayColor =
            i % 2 === 0
              ? `rgba(250, 204, 21, ${0.16 * godrayAlpha})`
              : `rgba(192, 132, 252, ${0.16 * godrayAlpha})`;
          rayGrad.addColorStop(0, rayColor);
          rayGrad.addColorStop(0.65, rayColor);
          rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = rayGrad;
          ctx.fill();
        }
        ctx.restore();

        // 4音目以降の星屑スパーク粒子（60個）
        for (let i = 0; i < 60; i++) {
          const seedAngle = i * 2.39996;
          const speed = 75 + (i % 8) * 38;
          const dist = Math.min(280, t4 * speed);
          const px = cx + Math.cos(seedAngle + t4 * 0.25) * dist;
          const py = cy + Math.sin(seedAngle + t4 * 0.25) * (dist * 0.85);
          const pr = (Math.sin(t4 * 8 + i) * 0.5 + 0.5) * 2.5 + 1.2;
          const pAlpha = Math.max(
            0,
            (1 - (elapsed / 2.6) * 0.65) * (Math.sin(t4 * 6 + i * 2) * 0.4 + 0.6)
          );
          ctx.fillStyle =
            i % 3 === 0
              ? `rgba(254, 240, 138, ${pAlpha})`
              : i % 3 === 1
              ? `rgba(244, 63, 94, ${pAlpha})`
              : `rgba(192, 132, 252, ${pAlpha})`;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- 2音目 (0.45s〜0.90s): 下部JACKPOT位置へのエネルギーチャージ粒子 ---
      if (elapsed >= 0.45 && elapsed < 0.9) {
        const t2 = (elapsed - 0.45) / 0.45; // 0 -> 1
        for (let i = 0; i < 24; i++) {
          const ang = i * ((Math.PI * 2) / 24) + t2 * 5;
          const dist = (1 - t2) * 120 + 10;
          const px = cx + Math.cos(ang) * dist;
          const py = jackY + Math.sin(ang) * (dist * 0.5);
          ctx.fillStyle =
            i % 2 === 0 ? 'rgba(192, 132, 252, 0.75)' : 'rgba(254, 240, 138, 0.75)';
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- ホワイト閃光フラッシュ（1音目激突時、3音目激突時、4音目合体時） ---
      let flashAlpha = 0;
      if (elapsed < 0.08) {
        flashAlpha = (1 - elapsed / 0.08) * 0.5;
      } else if (elapsed >= 0.9 && elapsed < 0.98) {
        flashAlpha = (1 - (elapsed - 0.9) / 0.08) * 0.55;
      } else if (elapsed >= 1.35 && elapsed < 1.45) {
        flashAlpha = (1 - (elapsed - 1.35) / 0.1) * 0.65;
      }
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      }

      // --- 衝撃波リング（1音目: 上部、3音目: 下部） ---
      if (elapsed < 0.45) {
        const sp = elapsed / 0.45;
        const sr = Math.pow(sp, 0.7) * 220;
        const sa = (1 - sp) * 0.85;
        ctx.save();
        ctx.strokeStyle = `rgba(254, 240, 138, ${sa})`;
        ctx.lineWidth = 4 * (1 - sp);
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(cx, premY, sr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (elapsed >= 0.9 && elapsed < 1.35) {
        const sp = (elapsed - 0.9) / 0.45;
        const sr = Math.pow(sp, 0.7) * 260;
        const sa = (1 - sp) * 0.95;
        ctx.save();
        ctx.strokeStyle = `rgba(192, 132, 252, ${sa * 0.8})`;
        ctx.lineWidth = 8 * (1 - sp);
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(cx, jackY, sr, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(254, 240, 138, ${sa})`;
        ctx.lineWidth = 4 * (1 - sp);
        ctx.beginPath();
        ctx.arc(cx, jackY, sr * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // --- 文字共通スタイル・グラデーション ---
      const logoGrad = ctx.createLinearGradient(0, -22, 0, 22);
      logoGrad.addColorStop(0.0, '#ffffff');
      logoGrad.addColorStop(0.18, '#fef08a');
      logoGrad.addColorStop(0.48, '#facc15');
      logoGrad.addColorStop(0.78, '#d97706');
      logoGrad.addColorStop(1.0, '#451a03');

      // --- 1. 『PREMIUM』描画（1音目: 0.0s〜常時表示） ---
      {
        const zoomDur = 0.22;
        let scale = 1.0;
        if (elapsed < zoomDur) {
          const zp = elapsed / zoomDur;
          const ease = 1 - Math.pow(1 - zp, 3.5);
          scale = 3.6 - ease * 2.6;
        } else if (elapsed >= 1.35) {
          scale = 1.0 + Math.sin((elapsed - 1.35) * 3.5) * 0.025;
        }

        ctx.save();
        ctx.translate(cx, premY);
        ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = "900 42px 'Segoe UI Black', 'Impact', sans-serif";
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillText('PREMIUM', 0, 5);
        ctx.fillText('PREMIUM', 0, 3);

        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = elapsed >= 1.35 ? 35 : 24;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6.0;
        ctx.strokeText('PREMIUM', 0, 0);

        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3.0;
        ctx.strokeText('PREMIUM', 0, 0);

        ctx.fillStyle = logoGrad;
        ctx.fillText('PREMIUM', 0, 0);

        // 光沢ハイライト
        ctx.save();
        ctx.beginPath();
        ctx.rect(-160, -22, 320, 14);
        ctx.clip();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.fillText('PREMIUM', 0, 0);
        ctx.restore();

        ctx.restore();
      }

      // --- 2. 『JACKPOT』描画（3音目: 0.90s〜常時表示） ---
      if (elapsed >= 0.9) {
        const t3 = elapsed - 0.9;
        const zoomDur = 0.22;
        let scale = 1.0;
        if (t3 < zoomDur) {
          const zp = t3 / zoomDur;
          const ease = 1 - Math.pow(1 - zp, 3.5);
          scale = 3.8 - ease * 2.8;
        } else if (elapsed >= 1.35) {
          scale = 1.0 + Math.sin((elapsed - 1.35) * 3.5) * 0.025;
        }

        ctx.save();
        ctx.translate(cx, jackY);
        ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = "900 48px 'Segoe UI Black', 'Impact', sans-serif";
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillText('JACKPOT', 0, 6);
        ctx.fillText('JACKPOT', 0, 3);

        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = elapsed >= 1.35 ? 38 : 26;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6.5;
        ctx.strokeText('JACKPOT', 0, 0);

        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3.2;
        ctx.strokeText('JACKPOT', 0, 0);

        ctx.fillStyle = logoGrad;
        ctx.fillText('JACKPOT', 0, 0);

        // 光沢ハイライト
        ctx.save();
        ctx.beginPath();
        ctx.rect(-170, -24, 340, 16);
        ctx.clip();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.fillText('JACKPOT', 0, 0);
        ctx.restore();

        ctx.restore();
      }

      // --- 3. 4音目以降 (1.35s〜): 上下のゴールド装飾モールディングライン完成 ---
      if (elapsed >= 1.35) {
        const lineAlpha = Math.min(1.0, (elapsed - 1.35) / 0.2);
        ctx.save();
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.9 * lineAlpha})`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(cx - 170, cy - 62);
        ctx.lineTo(cx + 170, cy - 62);
        ctx.moveTo(cx - 170, cy + 62);
        ctx.lineTo(cx + 170, cy + 62);
        ctx.stroke();

        ctx.strokeStyle = `rgba(254, 240, 138, ${0.65 * lineAlpha})`;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(cx - 130, cy - 67);
        ctx.lineTo(cx + 130, cy - 67);
        ctx.moveTo(cx - 130, cy + 67);
        ctx.lineTo(cx + 130, cy + 67);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
      return;
    }

    // === Stage 6: 4.9s〜6.0s (ソフト明転＆上部に100枚待機メダルウォール) ===
    const fadeProg = (t - 4.9) / 1.1; // 0 -> 1
    ctx.save();
    // 漆黒からゲーム盤面がソフトに明転
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, 0.82 - fadeProg * 0.65)})`;
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // 盤面最上部に待機する100枚のストックメダルを描画
    for (const m of this.freezeStockMedals) {
      const style = MEDAL_STYLE[m.type] || MEDAL_STYLE.normal;
      ctx.save();
      ctx.shadowColor = style.c1;
      ctx.shadowBlur = 6;

      // メダル本体（直径12.4pxのコンパクトサイズで美しく整列）
      const grad = ctx.createRadialGradient(m.x - 1.5, m.y - 1.5, 1, m.x, m.y, 6.2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, style.c1);
      grad.addColorStop(1, style.c2);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = style.rim;
      ctx.lineWidth = 1.0;
      ctx.stroke();

      ctx.restore();
    }

    // 上部中央に待機アナウンスネオン（絵文字なし）
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "900 14px 'Segoe UI', sans-serif";
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fbcfe8';
    ctx.fillText('100 MEDALS READY...', BOARD_WIDTH * 0.5, 84);
    ctx.restore();

    ctx.restore();
  }

  private drawCornerShooters(ctx: CanvasRenderingContext2D): void {
    // 左上サイバーシューター (x: 42, y: 60)
    ctx.save();
    ctx.translate(42, 60);
    ctx.rotate(0.92);

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 1.6;
    ctx.fillRect(-7, -10, 14, 20);
    ctx.strokeRect(-7, -10, 14, 20);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-8, 8, 16, 4);

    if (this.muzzleFlashLeft > 0) {
      const flashR = 26 * this.muzzleFlashLeft;
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 12, flashR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.lineTo(Math.cos(ang) * (flashR + 10), 12 + Math.sin(ang) * (flashR + 10));
        ctx.stroke();
      }
    }
    ctx.restore();

    // 右上サイバーシューター (x: 418, y: 60)
    ctx.save();
    ctx.translate(418, 60);
    ctx.rotate(-0.92);

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#ff0878';
    ctx.lineWidth = 1.6;
    ctx.fillRect(-7, -10, 14, 20);
    ctx.strokeRect(-7, -10, 14, 20);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-8, 8, 16, 4);

    if (this.muzzleFlashRight > 0) {
      const flashR = 26 * this.muzzleFlashRight;
      ctx.shadowColor = '#ff0878';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 12, flashR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.lineTo(Math.cos(ang) * (flashR + 10), 12 + Math.sin(ang) * (flashR + 10));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private tracePlayfieldPath(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.roundRect(WALL_LEFT, 12, WALL_RIGHT - WALL_LEFT, POCKET_EXIT_Y - 12, [28, 28, 8, 8]);
  }

  private drawPlayfieldNeonFrame(ctx: CanvasRenderingContext2D): void {
    const neonGrad = ctx.createLinearGradient(WALL_LEFT, 0, WALL_RIGHT, 0);
    neonGrad.addColorStop(0, '#00f2fe');
    neonGrad.addColorStop(0.5, '#a855f7');
    neonGrad.addColorStop(1, '#ff0878');

    ctx.save();
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = neonGrad;
    ctx.lineWidth = 3.5;
    this.tracePlayfieldPath(ctx);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    this.tracePlayfieldPath(ctx);
    ctx.stroke();
    ctx.restore();
  }

  private drawGuideRails(ctx: CanvasRenderingContext2D): void {
    for (const rail of this.physics.guideRails) {
      if (!rail.points || rail.points.length === 0) continue;
      const isLeft = rail.side === 'left';
      const mainColor = isLeft ? '#00f2fe' : '#ff0878';
      const glowColor = isLeft ? 'rgba(0, 242, 254, 0.45)' : 'rgba(255, 8, 120, 0.45)';
      const pts = rail.points;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 1. レール土台プレート（ブラケットベース）
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y - 8);
      for (let i = 0; i < pts.length; i++) {
        const offset = isLeft ? 6 : -6;
        ctx.lineTo(pts[i].x + offset, pts[i].y);
      }
      for (let i = pts.length - 1; i >= 0; i--) {
        const offset = isLeft ? -4 : 4;
        ctx.lineTo(pts[i].x + offset, pts[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.fill();

      // 2. 固定リベット・ボルト金具
      for (let i = 0; i < pts.length; i += 2) {
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(pts[i].x - 0.8, pts[i].y - 0.8, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // レール曲線のパスを構築
      const railPath = new Path2D();
      railPath.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        railPath.lineTo(pts[i].x, pts[i].y);
      }

      // 3. レール外側ネオングロー
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = rail.hitAnim > 0 ? 18 : 9;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 8.5;
      ctx.stroke(railPath);

      // 4. レールメインチューブ
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 4.5;
      ctx.stroke(railPath);

      // 5. 芯のハイライト（光沢ライン）
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rail.hitAnim > 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.stroke(railPath);

      // 6. レール先端のエンドキャップ（丸いネオン球）
      const lastPt = pts[pts.length - 1];
      ctx.fillStyle = rail.hitAnim > 0 ? '#ffffff' : mainColor;
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(lastPt.x, lastPt.y, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private drawCornerGrilles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.55)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(WALL_LEFT + 14, 38 + i * 10);
      ctx.lineTo(WALL_LEFT + 44 - i * 6, 18 + i * 6);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 8, 120, 0.55)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(WALL_RIGHT - 14, 38 + i * 10);
      ctx.lineTo(WALL_RIGHT - 44 + i * 6, 18 + i * 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTopDispenser(ctx: CanvasRenderingContext2D): void {
    const cx = BOARD_WIDTH * 0.5;

    ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(WALL_LEFT + 10, DROP_ZONE_MAX_Y);
    ctx.lineTo(WALL_RIGHT - 10, DROP_ZONE_MAX_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    const previewX = Math.max(
      WALL_LEFT + MEDAL_RADIUS + 6,
      Math.min(WALL_RIGHT - MEDAL_RADIUS - 6, this.pointerBoardX)
    );

    if (this.loadedQueue.length > 0) {
      const nextType = this.loadedQueue[0];
      ctx.save();
      ctx.globalAlpha = this.dropCooldownTimer > 0 ? 0.35 : 0.82;
      this.drawMedalGraphic(ctx, previewX, 58, MEDAL_RADIUS, nextType, 1.0, 0);
      ctx.restore();
    }

    if (this.dropCooldownTimer > 0) {
      const ratio = 1 - this.dropCooldownTimer / this.stats.dropCooldown;
      const barW = 58;
      ctx.fillStyle = 'rgba(6, 9, 17, 0.9)';
      ctx.fillRect(previewX - barW * 0.5, 83, barW, 5);
      ctx.fillStyle = '#00f2fe';
      ctx.fillRect(previewX - barW * 0.5, 83, barW * ratio, 5);
    }
  }

  // 盤面サイバーオーブ（旧ラッキーリング：通過ゲート宝珠）描画
  private drawLuckyRing(ctx: CanvasRenderingContext2D): void {
    const stats = this.stats;
    // どちらのオーブも未解放の場合は描画を完全にスキップ
    if (stats.boostRingLevel <= 0 && stats.cloneRingLevel <= 0) {
      return;
    }

    const ring = this.physics.luckyRing;
    // 非アクティブ（再出現待機中）は予告（もやもや光）も含め一切描画しない
    if (!ring.active) {
      return;
    }

    const isMult = ring.kind === 'mult';
    const mainColor = isMult ? '#fde047' : '#34d399';
    const glowColor = isMult ? 'rgba(250, 204, 21, 0.45)' : 'rgba(52, 211, 153, 0.45)';
    const coreDeepColor = isMult ? '#78350f' : '#064e3b';
    const coreMidColor = isMult ? '#eab308' : '#10b981';
    const coreLightColor = isMult ? '#fef08a' : '#a7f3d0';

    ctx.save();

    // 2. アクティブ時の立体サイバーオーブ（旧リングと同等の半径22pxサイズ感）
    const pulse = Math.sin(ring.pulsePhase * 2.2) * 0.9;
    const r = 16.5 + pulse; // コア球体半径（メダルとほぼ同等、公転光環込みで最大22px）

    // ① 外周オーラ・グロー
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 14;
    const auraGrad = ctx.createRadialGradient(ring.x, ring.y, r * 0.5, ring.x, ring.y, r * 1.3);
    auraGrad.addColorStop(0, glowColor);
    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, r * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // ② 立体ガラス球体（コア）
    const lightX = ring.x - r * 0.32;
    const lightY = ring.y - r * 0.32;
    const sphereGrad = ctx.createRadialGradient(lightX, lightY, r * 0.08, ring.x, ring.y, r);
    sphereGrad.addColorStop(0, '#ffffff');
    sphereGrad.addColorStop(0.25, coreLightColor);
    sphereGrad.addColorStop(0.7, coreMidColor);
    sphereGrad.addColorStop(1, coreDeepColor);

    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
    ctx.fill();

    // ③ 球体エッジのネオン発光リム
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // ④ 天球儀のような公転リング（自転・公転する3Dオービット光環）
    ctx.save();
    ctx.translate(ring.x, ring.y);

    // 第1リング（斜め傾斜＋右回転）
    ctx.rotate(ring.pulsePhase * 0.65);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.3, r * 0.52, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 第1リング上の回転パーティクル（小球）
    const p1Angle = ring.pulsePhase * 1.4;
    const p1x = Math.cos(p1Angle) * r * 1.3;
    const p1y = Math.sin(p1Angle) * r * 0.52;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p1x, p1y, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 第2リング（逆傾斜＋左回転）
    ctx.rotate(1.1 - ring.pulsePhase * 0.9);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.25, r * 0.48, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // ⑤ 球体表面のクリスタル・スペキュラハイライト（光沢反射）
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(ring.x - r * 0.35, ring.y - r * 0.35, r * 0.36, r * 0.2, -Math.PI * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ⑥ 中央シンボル表示（立体テキスト）
    ctx.save();
    const multText = isMult
      ? stats.boostRingLevel >= 3
        ? '×4'
        : stats.boostRingLevel >= 2
        ? '×3'
        : '×2'
      : stats.cloneRingLevel >= 3
      ? '+2'
      : stats.cloneRingLevel >= 2
      ? 'x1.5'
      : '+1';

    const labelText = isMult ? 'BOOST' : 'CLONE';

    // テキストシャドウ
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 12px "Zen Maru Gothic", Consolas, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(multText, ring.x, ring.y - 3.5);

    ctx.fillStyle = coreLightColor;
    ctx.font = '900 7.5px "Zen Maru Gothic", sans-serif';
    ctx.fillText(labelText, ring.x, ring.y + 7.5);
    ctx.restore();

    ctx.restore();
  }

  // スプリットライン（通過メダル分裂ネオンライン）描画：最大3回通過で消滅
  private drawSplitLasers(ctx: CanvasRenderingContext2D): void {
    for (const laser of this.physics.splitLasers) {
      const dx = laser.x2 - laser.x1;
      const dy = laser.y2 - laser.y1;
      const ang = Math.atan2(dy, dx);
      const len = Math.hypot(dx, dy);

      if (laser.active) {
        ctx.save();
        const pulse = 1.0 + Math.sin(this.totalPlayTimeSec * 22 + laser.id * 2) * 0.12;

        // レイヤー1：広域プラズマオーラ
        ctx.save();
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 24 * pulse;
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.32)';
        ctx.lineWidth = 13 * pulse;
        ctx.beginPath();
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y2);
        ctx.stroke();
        ctx.restore();

        // レイヤー2：高輝度シアンビーム
        ctx.save();
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 6.2 * pulse;
        ctx.beginPath();
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y2);
        ctx.stroke();
        ctx.restore();

        // レイヤー3：高集束スカイシアン
        ctx.save();
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y2);
        ctx.stroke();
        ctx.restore();

        // レイヤー4：中心超高熱ピュアホワイトコア
        ctx.save();
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y2);
        ctx.stroke();
        ctx.restore();

        // ビーム上の動的放電スパーク（プラズマ粒子）
        const sparkCount = 3;
        for (let s = 0; s < sparkCount; s++) {
          const sparkT = ((this.totalPlayTimeSec * 3.5 + s * 0.33 + laser.id * 0.2) % 1.0);
          const sx = laser.x1 + dx * sparkT;
          const sy = laser.y1 + dy * sparkT;
          const jitterX = (Math.sin(this.totalPlayTimeSec * 45 + s * 7) * 2.2);
          const jitterY = (Math.cos(this.totalPlayTimeSec * 45 + s * 7) * 2.2);

          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#00f2fe';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(sx + jitterX, sy + jitterY, 1.8, 0, Math.PI * 2);
          ctx.fill();

          // 微小放電アーク
          ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + jitterX * 2, sy + jitterY * 2);
          ctx.stroke();
          ctx.restore();
        }

        // 両端エミッター装置（メカニカルプロジェクターポッド）
        const drawEmitterPod = (ex: number, ey: number, emitterAng: number) => {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(emitterAng);

          // エミッターベースボディ（ダークチタン金属ブロック）
          ctx.fillStyle = '#0b1120';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = '#00f2fe';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.roundRect(-4.5, -6, 7, 12, 2.5);
          ctx.fill();
          ctx.stroke();

          // 照射口レンズ（超高輝度シアン＆ホワイト）
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#00f2fe';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(2.5, 0, 2.8, 0, Math.PI * 2);
          ctx.fill();

          // マズルフレア（小さな放射状グロー）
          const flareGrad = ctx.createRadialGradient(2.5, 0, 1, 2.5, 0, 7);
          flareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          flareGrad.addColorStop(0.4, 'rgba(0, 242, 254, 0.6)');
          flareGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = flareGrad;
          ctx.beginPath();
          ctx.arc(2.5, 0, 7, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        };

        drawEmitterPod(laser.x1, laser.y1, ang);
        drawEmitterPod(laser.x2, laser.y2, ang + Math.PI);

        ctx.restore();
      }
    }
  }

  // サイバー・カタパルト（ワープホール入口＋上空クロス出口ゲート）描画
  private drawCyberCatapults(ctx: CanvasRenderingContext2D): void {
    if (!this.stats.catapultUnlocked) return;

    const t = this.totalPlayTimeSec;

    for (const cat of this.physics.catapults) {
      const isLeft = cat.side === 'left';
      const r = cat.radius + cat.launchAnim * 3.5;
      const rotDir = isLeft ? 1 : -1;

      // === A. 下部入口ポータル（ブラックホール特異点＋ネオン多重渦リング） ===
      ctx.save();

      // 吸い込み時の昇天ビーム光柱
      if (cat.launchAnim > 0) {
        ctx.save();
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 24 * cat.launchAnim;
        const beamGrad = ctx.createLinearGradient(cat.x, cat.y, cat.x, cat.y - 125);
        beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        beamGrad.addColorStop(0.28, 'rgba(192, 132, 252, 0.85)');
        beamGrad.addColorStop(0.65, 'rgba(0, 242, 254, 0.42)');
        beamGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(cat.x - r * 0.72, cat.y);
        ctx.lineTo(cat.x - r * 0.22, cat.y - 115 * cat.launchAnim);
        ctx.lineTo(cat.x + r * 0.22, cat.y - 115 * cat.launchAnim);
        ctx.lineTo(cat.x + r * 0.72, cat.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 広域パープル＆シアン外周オーラ
      const auraGrad = ctx.createRadialGradient(cat.x, cat.y, r * 0.3, cat.x, cat.y, r * 1.48);
      auraGrad.addColorStop(0, 'rgba(168, 85, 247, 0.42)');
      auraGrad.addColorStop(0.6, 'rgba(0, 242, 254, 0.18)');
      auraGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cat.x, cat.y, r * 1.48, 0, Math.PI * 2);
      ctx.fill();

      // ポータル外殻＆特異点コア
      ctx.shadowColor = cat.launchAnim > 0.1 ? '#ffffff' : '#a855f7';
      ctx.shadowBlur = 14 + cat.launchAnim * 12;
      const holeGrad = ctx.createRadialGradient(cat.x, cat.y, 1, cat.x, cat.y, r * 0.95);
      holeGrad.addColorStop(0, '#020617');
      holeGrad.addColorStop(0.55, '#1e1b4b');
      holeGrad.addColorStop(0.85, '#0e7490');
      holeGrad.addColorStop(1, '#38bdf8');
      ctx.fillStyle = holeGrad;
      ctx.beginPath();
      ctx.arc(cat.x, cat.y, r * 0.95, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = cat.launchAnim > 0.15 ? '#ffffff' : '#00f2fe';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cat.x, cat.y, r, 0, Math.PI * 2);
      ctx.stroke();

      // 逆回転する多重渦巻きアーク＆吸引衛星粒子
      ctx.save();
      ctx.translate(cat.x, cat.y);

      ctx.save();
      ctx.rotate(t * 3.8 * rotDir);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.8;
      for (let a = 0; a < 3; a++) {
        const start = (a * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.72, start, start + Math.PI * 0.36);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.rotate(-t * 5.0 * rotDir);
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      for (let s = 0; s < 3; s++) {
        const satAng = t * 4.4 * rotDir + (s * Math.PI * 2) / 3;
        const sx = Math.cos(satAng) * (r + 2.5);
        const sy = Math.sin(satAng) * (r + 2.5);
        ctx.fillStyle = s % 2 === 0 ? '#ffffff' : '#e879f9';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = '#e0f2fe';
      ctx.font = '900 7.5px "Segoe UI", Consolas, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('IN', cat.x, cat.y);
      ctx.restore();

      // === B. 上空出口受信ゲート（斜め高速射出ノズル） ===
      ctx.save();
      const er = 14.5 + cat.launchAnim * 4.0;
      const ex = cat.exitX;
      const ey = cat.exitY;
      const shootAng = isLeft ? Math.PI * 0.78 : Math.PI * 0.22;

      const exitGlow = ctx.createRadialGradient(ex, ey, 2, ex, ey, er * 1.6);
      exitGlow.addColorStop(0, 'rgba(0, 242, 254, 0.55)');
      exitGlow.addColorStop(0.55, 'rgba(168, 85, 247, 0.22)');
      exitGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = exitGlow;
      ctx.beginPath();
      ctx.arc(ex, ey, er * 1.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(ex, ey);

      // 回転ダイヤ外枠
      ctx.save();
      ctx.rotate(-t * 3.4 * rotDir);
      ctx.strokeStyle = cat.launchAnim > 0.15 ? '#ffffff' : '#38bdf8';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 10 + cat.launchAnim * 12;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let v = 0; v < 4; v++) {
        const va = (v * Math.PI) / 2;
        const px = Math.cos(va) * er;
        const py = Math.sin(va) * er;
        if (v === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 内円コア
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, er * 0.56, 0, Math.PI * 2);
      ctx.stroke();

      // 中央バンパー方向への射出シェブロンガイド
      ctx.save();
      ctx.rotate(shootAng);
      const chevPulse = 0.45 + 0.45 * Math.sin(t * 7);
      ctx.strokeStyle = `rgba(103, 232, 249, ${Math.min(1, chevPulse + cat.launchAnim * 0.5).toFixed(2)})`;
      ctx.lineWidth = 1.8;
      for (let c = 0; c < 2; c++) {
        const ox = er + 5 + c * 6;
        ctx.beginPath();
        ctx.moveTo(ox - 4, -4.5);
        ctx.lineTo(ox + 1, 0);
        ctx.lineTo(ox - 4, 4.5);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 6.5px "Segoe UI", Consolas, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('OUT', 0, 0.5);
      ctx.restore();
    }
  }

  // ワープエフェクト（吸い込み光輪・出現スパーク・入口→出口ワープビーム）描画
  private drawWarpEffects(ctx: CanvasRenderingContext2D): void {
    for (const we of this.warpEffects) {
      const alpha = Math.max(0, 1 - we.progress);
      ctx.save();

      if (we.kind === 'arc' && we.tx !== undefined && we.ty !== undefined) {
        // 入口から出口へ一気に駆け抜けるプラズマ・ワープアーク
        const ctrlX = BOARD_WIDTH * 0.5;
        const ctrlY = (we.y + we.ty) * 0.48;

        ctx.globalAlpha = alpha * 0.9;
        ctx.shadowColor = we.color;
        ctx.shadowBlur = 16;
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 4.2 * (1 - we.progress * 0.55);
        ctx.beginPath();
        ctx.moveTo(we.x, we.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, we.tx, we.ty);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6 * (1 - we.progress * 0.4);
        ctx.beginPath();
        ctx.moveTo(we.x, we.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, we.tx, we.ty);
        ctx.stroke();

        // 軌道上を高速移動する星光ヘッド
        const ptT = Math.min(1, we.progress * 1.45);
        const inv = 1 - ptT;
        const hx = inv * inv * we.x + 2 * inv * ptT * ctrlX + ptT * ptT * we.tx;
        const hy = inv * inv * we.y + 2 * inv * ptT * ctrlY + ptT * ptT * we.ty;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hx, hy, 4.2 * (1 - ptT * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (we.kind === 'implosion') {
        // 吸い込みエフェクト：外側から中心へ収束するリング
        const r = Math.max(1, we.maxR * (1 - we.progress));
        ctx.shadowColor = we.color;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = we.color;
        ctx.globalAlpha = alpha * 0.85;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(we.x, we.y, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(we.x, we.y, r * 0.65, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // 出現エフェクト：中心から外側へ爆発的に広がる光輪＆スパーク
        const r = we.maxR * Math.sqrt(we.progress);
        ctx.shadowColor = we.color;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = we.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 2.8 * (1 - we.progress * 0.6);
        ctx.beginPath();
        ctx.arc(we.x, we.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // 内部ホワイトフラッシュ
        ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.75).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(we.x, we.y, r * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // 放射状スパーク線分
        const sparkCount = 8;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        for (let s = 0; s < sparkCount; s++) {
          const ang = (s * Math.PI * 2) / sparkCount + we.progress * 1.5;
          const innerDist = r * 0.5;
          const outerDist = r * 1.25;
          ctx.beginPath();
          ctx.moveTo(we.x + Math.cos(ang) * innerDist, we.y + Math.sin(ang) * innerDist);
          ctx.lineTo(we.x + Math.cos(ang) * outerDist, we.y + Math.sin(ang) * outerDist);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  // プリズム（破壊型ネオンクリスタル）描画（複数同時出現対応）
  private drawPrismTarget(ctx: CanvasRenderingContext2D): void {
    if (this.stats.prismTargetCount <= 0) return;
    for (const prism of this.physics.prismTargets) {
      if (!prism.active) continue;
      this.drawSinglePrismTarget(ctx, prism);
    }
  }

  private drawSinglePrismTarget(ctx: CanvasRenderingContext2D, prism: PrismTarget): void {
    const r = prism.radius * (1 + prism.hitAnim * 0.25);
    // 残HP（5〜1）をHPバー・ドットではなく5段階のクリスタル発光色で表現
    const theme =
      prism.hp >= 5
        ? { main: '#38bdf8', edge: '#bae6fd', core: '#e0f2fe', glow: '#00f2fe' } // 5: シアン（無傷）
        : prism.hp === 4
        ? { main: '#34d399', edge: '#a7f3d0', core: '#ecfdf5', glow: '#10b981' } // 4: エメラルド
        : prism.hp === 3
        ? { main: '#facc15', edge: '#fef08a', core: '#ffffff', glow: '#eab308' } // 3: イエロー
        : prism.hp === 2
        ? { main: '#fb923c', edge: '#fed7aa', core: '#ffffff', glow: '#f97316' } // 2: オレンジ
        : { main: '#f43f5e', edge: '#fecdd3', core: '#ffffff', glow: '#ec4899' }; // 1: クリムゾンピンク（瀕死）

    ctx.save();
    ctx.translate(prism.x, prism.y);

    // 外周ネオンオーラ
    const aura = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.55);
    aura.addColorStop(0, `${theme.main}55`);
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2);
    ctx.fill();

    // 回転六角クリスタル本体
    ctx.save();
    ctx.rotate(prism.rotAngle);
    ctx.shadowColor = prism.hitAnim > 0.2 ? '#ffffff' : theme.glow;
    ctx.shadowBlur = 14 + prism.hitAnim * 10;

    const sides = 6;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i * Math.PI * 2) / sides;
      const rad = i % 2 === 0 ? r : r * 0.86;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, theme.core);
    grad.addColorStop(0.5, theme.main);
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = prism.hitAnim > 0.2 ? '#ffffff' : theme.edge;
    ctx.stroke();

    // 内部ファセットカット線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.0;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
      ctx.lineTo(-Math.cos(a) * r * 0.72, -Math.sin(a) * r * 0.72);
      ctx.stroke();
    }

    // 耐久低下時の段階的ヒビ割れ表現（HP4以下で徐々に亀裂が増加）
    if (prism.hp < prism.maxHp) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = prism.hp <= 2 ? 1.8 : 1.4;
      ctx.beginPath();
      // HP4以下：第1亀裂
      ctx.moveTo(-r * 0.55, -r * 0.2);
      ctx.lineTo(-r * 0.1, r * 0.08);
      if (prism.hp <= 3) {
        // HP3以下：第2亀裂
        ctx.lineTo(r * 0.38, -r * 0.32);
      }
      if (prism.hp <= 2) {
        // HP2以下：第3分岐亀裂
        ctx.moveTo(-r * 0.1, r * 0.08);
        ctx.lineTo(r * 0.2, r * 0.52);
        ctx.lineTo(r * 0.55, r * 0.22);
      }
      if (prism.hp <= 1) {
        // HP1：逆側にも深い亀裂
        ctx.moveTo(r * 0.12, -r * 0.12);
        ctx.lineTo(-r * 0.38, r * 0.45);
        ctx.moveTo(-r * 0.1, r * 0.08);
        ctx.lineTo(-r * 0.52, r * 0.18);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  // プリズム破片パーティクル描画
  private drawPrismShards(ctx: CanvasRenderingContext2D): void {
    for (const sh of this.prismShards) {
      const alpha = Math.max(0, sh.life / sh.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.rot);
      ctx.shadowColor = sh.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = sh.color;
      ctx.beginPath();
      ctx.moveTo(0, -sh.size);
      ctx.lineTo(sh.size * 0.75, sh.size * 0.65);
      ctx.lineTo(-sh.size * 0.65, sh.size * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawNeonPockets(ctx: CanvasRenderingContext2D): void {
    for (const pk of this.physics.pockets) {
      const pw = pk.x2 - pk.x1;
      const isCenter4x = pk.scoreMultiplier >= 4;
      const is2x = pk.scoreMultiplier === 2;

      const gateX = pk.x1 + 5;
      const gateY = POCKET_ENTRY_Y + 8;
      const gateW = pw - 10;
      const gateH = POCKET_EXIT_Y - POCKET_ENTRY_Y - 12;

      ctx.save();
      const borderColor = pk.lit
        ? '#00f2fe'
        : isCenter4x
        ? '#38bdf8'
        : is2x
        ? '#60a5fa'
        : 'rgba(226, 232, 240, 0.55)';

      if (pk.flashAnim > 0 || pk.lit || isCenter4x) {
        ctx.shadowColor = pk.lit ? '#00f2fe' : isCenter4x ? '#38bdf8' : '#f472b6';
        ctx.shadowBlur = 8 + (pk.lit ? 10 : 0) + pk.flashAnim * 12;
      }

      ctx.fillStyle = pk.flashAnim > 0
        ? 'rgba(0, 242, 254, 0.35)'
        : pk.lit
        ? 'rgba(14, 165, 233, 0.22)'
        : isCenter4x
        ? 'rgba(0, 242, 254, 0.12)'
        : 'rgba(10, 15, 28, 0.85)';

      ctx.beginPath();
      ctx.roundRect(gateX, gateY, gateW, gateH, 8);
      ctx.fill();

      ctx.lineWidth = pk.lit ? 2.8 : isCenter4x ? 2.4 : 1.8;
      ctx.strokeStyle = borderColor;
      ctx.stroke();

      // 倍率テキスト
      ctx.fillStyle = pk.lit ? '#ffffff' : isCenter4x ? '#67e8f9' : '#f8fafc';
      ctx.font = '900 17px Consolas, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`x${pk.scoreMultiplier}`, pk.x1 + pw * 0.5, gateY + gateH * 0.5);

      if (pk.spawnsBonusMedal) {
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('+1 MEDAL', pk.x1 + pw * 0.5, gateY - 6);
      }
      ctx.restore();

      // HOTポケットオーラ＆バッジ描画
      if (this.stats.hotSlotUnlocked && pk.index === this.hotPocketIndex) {
        this.drawHotPocketAura(ctx, pk);
      }

      // === JACKPOT LED ランプ（スロット上部中央：トグル点灯インジケーター） ===
      const lampX = pk.x1 + pw * 0.5;
      const lampY = gateY - 11;
      const lampR = 6.5;

      ctx.save();
      if (pk.lit) {
        // 点灯状態：眩いネオンシアン＆ゴールド
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(lampX, lampY, lampR + 1.2, 0, Math.PI * 2);
        ctx.stroke();

        const lampGrad = ctx.createRadialGradient(lampX - 2, lampY - 2, 1, lampX, lampY, lampR);
        lampGrad.addColorStop(0, '#ffffff');
        lampGrad.addColorStop(0.35, '#38bdf8');
        lampGrad.addColorStop(0.85, '#0284c7');
        lampGrad.addColorStop(1, '#0369a1');
        ctx.fillStyle = lampGrad;
        ctx.beginPath();
        ctx.arc(lampX, lampY, lampR, 0, Math.PI * 2);
        ctx.fill();

        // 中央の輝き
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(lampX, lampY, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 消灯状態：落ち着いたダークスレート（消えたLED）
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(lampX, lampY, lampR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.beginPath();
        ctx.arc(lampX, lampY, lampR - 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(100, 116, 139, 0.35)';
        ctx.beginPath();
        ctx.arc(lampX, lampY, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // スロット仕切り線
    for (let i = 1; i < this.physics.pockets.length; i++) {
      const divX = this.physics.pockets[i].x1;
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(divX - 2.5, POCKET_ENTRY_Y - 4, 5, POCKET_EXIT_Y - POCKET_ENTRY_Y + 4);
      ctx.fillStyle = '#00f2fe';
      ctx.beginPath();
      ctx.arc(divX, POCKET_ENTRY_Y - 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 簡易スロット抽選（合計100%）
   * ハズレ: 60%
   * ベル: 20%
   * オート: 7%
   * 時計: 6%
   * ダイヤ: 5%
   * 赤7: 2%
   */
  private rollSlotTarget(): SlotSymbol {
    const roll = Math.random() * 100;
    if (roll < 2.0) return '7';
    if (roll < 7.0) return 'dia';
    if (roll < 13.0) return 'clock';
    if (roll < 20.0) return 'auto';
    if (roll < 40.0) return 'bell';
    return 'miss';
  }

  /**
   * スロットスピン開始（保留を1消費）
   */
  private startSlotSpin(): void {
    if (this.slotHoldCount <= 0 || this.isSlotSpinning) return;
    this.slotHoldCount--;
    this.isSlotSpinning = true;
    this.slotSpinElapsed = 0;
    this.slotReelStopped = [false, false, false];
    this.slotCurrentTarget = this.rollSlotTarget();

    const symbols: Array<'bell' | 'auto' | 'clock' | 'dia' | '7'> = ['bell', 'auto', 'clock', 'dia', '7'];

    if (this.slotCurrentTarget !== 'miss') {
      // 当選：3リールすべて揃う
      this.slotFinalSymbols = [this.slotCurrentTarget, this.slotCurrentTarget, this.slotCurrentTarget];
    } else {
      // ハズレ（60%）
      // 約20%の確率でリーチハズレ [A, A, B]
      const isReachMiss = Math.random() < 0.33;
      if (isReachMiss) {
        const symA = symbols[Math.floor(Math.random() * symbols.length)];
        const otherSymbols = symbols.filter((s) => s !== symA);
        const symB = otherSymbols[Math.floor(Math.random() * otherSymbols.length)];
        this.slotFinalSymbols = [symA, symA, symB];
      } else {
        // 通常ハズレ：バラケ
        const s0 = symbols[Math.floor(Math.random() * symbols.length)];
        const s1Candidates = symbols.filter((s) => s !== s0);
        const s1 = s1Candidates[Math.floor(Math.random() * s1Candidates.length)];
        const s2Candidates = symbols.filter((s) => s !== s0 && s !== s1);
        const s2 =
          s2Candidates.length > 0
            ? s2Candidates[Math.floor(Math.random() * s2Candidates.length)]
            : symbols[Math.floor(Math.random() * symbols.length)];
        this.slotFinalSymbols = [s0, s1, s2];
      }
    }

    sound.playSlotSpin();
  }

  /**
   * スロットスピン・リール停止・保留自動回転の更新
   */
  private updateSlot(dtSec: number): void {
    if (this.slotWinFlashTimer > 0) {
      this.slotWinFlashTimer = Math.max(0, this.slotWinFlashTimer - dtSec);
    }
    if (this.slotRestartCooldown > 0) {
      this.slotRestartCooldown = Math.max(0, this.slotRestartCooldown - dtSec);
    }

    if (!this.isSlotSpinning) {
      // スピン中でなく保留がある場合、リール全停止から0.6秒空けて自動で次をスピン
      if (this.slotHoldCount > 0 && this.slotRestartCooldown <= 0) {
        this.startSlotSpin();
      }
      return;
    }

    this.slotSpinElapsed += dtSec;
    const isReach = this.slotFinalSymbols[0] === this.slotFinalSymbols[1];
    const leftStopTime = 0.7;
    const centerStopTime = 1.2;
    const rightStopTime = isReach ? 1.95 : 1.7;

    const symbols: Array<'bell' | 'auto' | 'clock' | 'dia' | '7'> = ['bell', 'auto', 'clock', 'dia', '7'];

    // 左リール
    if (this.slotSpinElapsed < leftStopTime) {
      const idx = Math.floor(this.slotSpinElapsed * 24) % symbols.length;
      this.slotReelSymbols[0] = symbols[idx];
    } else if (!this.slotReelStopped[0]) {
      this.slotReelStopped[0] = true;
      this.slotReelSymbols[0] = this.slotFinalSymbols[0];
      sound.playSlotReelStop(false);
    }

    // 中リール
    if (this.slotSpinElapsed < centerStopTime) {
      const idx = Math.floor(this.slotSpinElapsed * 24 + 1) % symbols.length;
      this.slotReelSymbols[1] = symbols[idx];
    } else if (!this.slotReelStopped[1]) {
      this.slotReelStopped[1] = true;
      this.slotReelSymbols[1] = this.slotFinalSymbols[1];
      sound.playSlotReelStop(isReach);
    }

    // 右リール
    if (this.slotSpinElapsed < rightStopTime) {
      // リーチ時は後半スロードラッグ回転（緊張感演出）
      const speed = isReach && this.slotSpinElapsed > 1.2 ? 10 : 24;
      const idx = Math.floor(this.slotSpinElapsed * speed + 2) % symbols.length;
      this.slotReelSymbols[2] = symbols[idx];
    } else if (!this.slotReelStopped[2]) {
      this.slotReelStopped[2] = true;
      this.slotReelSymbols[2] = this.slotFinalSymbols[2];
      sound.playSlotReelStop(false);
      this.isSlotSpinning = false;
      this.slotRestartCooldown = 0.6; // リール全停止後0.6秒空けてから再始動

      // 当選判定
      if (this.slotCurrentTarget !== 'miss') {
        this.applySlotReward(this.slotCurrentTarget);
      }
    }
  }

  /**
   * スロット当選時の報酬・演出適用（文字バナーは出さず演出のみ）
   */
  private applySlotReward(symbol: SlotSymbol): void {
    if (symbol === 'miss') return;
    sound.playSlotWin(symbol);
    this.slotWinFlashTimer = 1.2;

    switch (symbol) {
      case 'bell':
        // 🔔 ベル: 通常メダル4枚射出
        this.enqueueSlotShoots('normal', 4);
        break;
      case 'auto':
        // 🧲 オート: 5秒間自動回収・装填・投下
        this.autoMagnetTimer = 5.0;
        break;
      case 'clock':
        // 🕐 時計: 残り時間+2秒 ＆ 5秒間全ポケット得点x1.5
        this.timeRemaining += 2.0;
        this.slotScoreBoostTimer = 5.0;
        break;
      case 'dia':
        // 💎 ダイヤ: バウンスメダル5枚射出 ＆ 5秒間ピン点数+3
        this.enqueueSlotShoots('bounce', 5);
        this.slotPinBonusTimer = 5.0;
        break;
      case '7':
        // 赤7: ゴールドメダル10枚射出 ＆ 画面揺れ演出
        this.enqueueSlotShoots('gold', 10);
        this.screenShakeTimer = 0.5;
        break;
    }
  }

  /**
   * サイドシューターへのメダル射出キュー追加
   */
  private enqueueSlotShoots(type: MedalType, count: number): void {
    for (let i = 0; i < count; i++) {
      this.slotShootQueue.push({
        type,
        delay: i * 0.15,
      });
    }
  }

  /**
   * スロット当選メダルの左右シューター射出更新
   */
  private updateSlotShooter(dtSec: number): void {
    if (this.slotShootQueue.length === 0) return;

    for (let i = this.slotShootQueue.length - 1; i >= 0; i--) {
      const item = this.slotShootQueue[i];
      item.delay -= dtSec;
      if (item.delay <= 0) {
        this.slotShootQueue.splice(i, 1);

        sound.playJackpotShoot();
        const isLeft = this.slotShootAlternator;
        this.slotShootAlternator = !this.slotShootAlternator;

        const spawnX = isLeft ? 45 : 415;
        const spawnY = 62;
        const targetX = isLeft ? 170 + Math.random() * 50 : 290 - Math.random() * 50;
        const targetY = 240 + Math.random() * 60;
        const angle = Math.atan2(targetY - spawnY, targetX - spawnX) + (Math.random() - 0.5) * 0.18;
        const speed = 320 + Math.random() * 60;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        if (isLeft) {
          this.muzzleFlashLeft = 1.0;
        } else {
          this.muzzleFlashRight = 1.0;
        }

        const medal = this.physics.spawnMedal(spawnX, spawnY, item.type, 'board');
        medal.vx = vx;
        medal.vy = vy;
        medal.chargeMultiplier = 1.0;
      }
    }
  }

  /**
   * 盤面上部 簡易スロット窓＆保留ランプの描画
   * 位置: cx = 230, cy = 38, w = 156, h = 42
   */
  private drawSlotWindow(ctx: CanvasRenderingContext2D): void {
    const cx = BOARD_WIDTH * 0.5; // 230
    const cy = 38;
    const w = 156;
    const h = 42;
    const x = cx - w * 0.5; // 152
    const y = cy - h * 0.5; // 17

    ctx.save();

    // 1. スロット外枠（サイバーダーククローム＆ゴールドベゼル）
    const isWinFlash = this.slotWinFlashTimer > 0;
    const flashPhase = isWinFlash ? Math.sin(this.slotWinFlashTimer * 18) : 0;
    const isRed7Win = isWinFlash && this.slotCurrentTarget === '7';

    if (isWinFlash) {
      ctx.shadowColor = isRed7Win ? '#f43f5e' : '#facc15';
      ctx.shadowBlur = 14 + flashPhase * 8;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 8;
    }

    // 外枠ベゼル背景
    const bezelGrad = ctx.createLinearGradient(x, y, x, y + h);
    if (isRed7Win) {
      bezelGrad.addColorStop(0, '#fda4af');
      bezelGrad.addColorStop(0.5, '#be123c');
      bezelGrad.addColorStop(1, '#4c0519');
    } else if (isWinFlash) {
      bezelGrad.addColorStop(0, '#fef08a');
      bezelGrad.addColorStop(0.5, '#ca8a04');
      bezelGrad.addColorStop(1, '#422006');
    } else {
      bezelGrad.addColorStop(0, '#475569');
      bezelGrad.addColorStop(0.5, '#1e293b');
      bezelGrad.addColorStop(1, '#0f172a');
    }
    ctx.fillStyle = bezelGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();

    // 外枠境界線
    ctx.strokeStyle = isRed7Win
      ? '#ffe4e6'
      : isWinFlash
      ? '#fef9c3'
      : 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = isWinFlash ? 2.0 : 1.2;
    ctx.stroke();

    // 2. 3リール窓（左・中・右）
    const reelW = 38;
    const reelH = 26;
    const reelY = y + 5;
    const reelSpacing = 44;
    const reelCenters = [cx - reelSpacing, cx, cx + reelSpacing];

    for (let i = 0; i < 3; i++) {
      const rx = reelCenters[i] - reelW * 0.5;
      const ry = reelY;

      // リール窓背景（深黒クリスタル）
      ctx.fillStyle = '#060a12';
      ctx.beginPath();
      ctx.roundRect(rx, ry, reelW, reelH, 4);
      ctx.fill();

      // リール内光沢（上下シャドウ）
      const reelInnerGrad = ctx.createLinearGradient(rx, ry, rx, ry + reelH);
      reelInnerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      reelInnerGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.0)');
      reelInnerGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.0)');
      reelInnerGrad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
      ctx.fillStyle = reelInnerGrad;
      ctx.fill();

      // リール枠線
      ctx.strokeStyle = this.slotReelStopped[i]
        ? 'rgba(100, 116, 139, 0.5)'
        : 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      // リール図柄描画
      const sym = this.slotReelSymbols[i];
      this.drawSlotSymbol(ctx, sym, reelCenters[i], reelY + reelH * 0.5);
    }

    // 3. 保留インジケーターランプ（下部：4灯）
    const holdY = y + h - 6;
    const holdStartX = cx - 24;
    const holdSpacing = 16;

    for (let hIdx = 0; hIdx < 4; hIdx++) {
      const hx = holdStartX + hIdx * holdSpacing;
      const isLit = hIdx < this.slotHoldCount;

      ctx.beginPath();
      ctx.arc(hx, holdY, 2.8, 0, Math.PI * 2);

      if (isLit) {
        ctx.fillStyle = this.slotHoldCount >= 4 ? '#fbbf24' : '#38bdf8';
        ctx.shadowColor = this.slotHoldCount >= 4 ? '#f59e0b' : '#00f2fe';
        ctx.shadowBlur = 6;
        ctx.fill();
        // 中心芯
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hx, holdY, 1.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(51, 65, 85, 0.6)';
        ctx.shadowBlur = 0;
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * スロットリールシンボル描画
   */
  private drawSlotSymbol(ctx: CanvasRenderingContext2D, sym: string, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);

    if (sym === '7') {
      // 赤7（静止画、深紅/ルビーグラデーション＋シャンパンゴールド縁取り）
      this.drawRedSeven(ctx, 0, 0, 22, 22);
    } else if (sym === 'bell') {
      // 🔔 ベル
      ctx.font = '16px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔔', 0, 0);
    } else if (sym === 'auto') {
      // 🧲 オート
      ctx.font = '16px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧲', 0, 0);
    } else if (sym === 'clock') {
      // 🕐 時計
      ctx.font = '16px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🕐', 0, 0);
    } else if (sym === 'dia') {
      // 💎 ダイヤ
      ctx.font = '16px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💎', 0, 0);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sym, 0, 0);
    }

    ctx.restore();
  }

  /**
   * 赤7の描画（静止画、アニメーションなし、深紅/ルビーグラデーション＋シャンパンゴールド縁取り）
   */
  private drawRedSeven(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.save();
    ctx.translate(x, y);

    const hw = w * 0.5;
    const hh = h * 0.5;

    // 「7」のパス
    ctx.beginPath();
    ctx.moveTo(-hw * 0.75, -hh * 0.75);
    ctx.lineTo(hw * 0.75, -hh * 0.75);
    ctx.lineTo(0, hh * 0.78);
    ctx.lineTo(-hw * 0.28, hh * 0.78);
    ctx.lineTo(hw * 0.32, -hh * 0.35);
    ctx.lineTo(-hw * 0.75, -hh * 0.35);
    ctx.closePath();

    // ルビーレッドグラデーション
    const redGrad = ctx.createLinearGradient(0, -hh, 0, hh);
    redGrad.addColorStop(0, '#f43f5e'); // ローズレッド
    redGrad.addColorStop(0.45, '#e11d48'); // クリムゾン
    redGrad.addColorStop(1, '#9f1239'); // ディープルビー
    ctx.fillStyle = redGrad;
    ctx.fill();

    // シャンパンゴールドの枠線
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'miter';
    ctx.stroke();

    // ハイライト芯線
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.65, -hh * 0.6);
    ctx.lineTo(hw * 0.65, -hh * 0.6);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * HOTポケットの炎オーラ＆バッジ描画
   */
  private drawHotPocketAura(ctx: CanvasRenderingContext2D, pk: PocketSlot): void {
    const pw = pk.x2 - pk.x1;
    const gateX = pk.x1 + 5;
    const gateY = POCKET_ENTRY_Y + 8;
    const gateW = pw - 10;
    const gateH = POCKET_EXIT_Y - POCKET_ENTRY_Y - 12;

    const isWarning = this.hotPocketTimer <= 1.0;
    const blinkAlpha = isWarning ? (Math.sin(this.totalPlayTimeSec * 20) > 0 ? 0.3 : 1.0) : 1.0;

    ctx.save();
    ctx.globalAlpha = blinkAlpha;

    // 燃え盛る金色の炎オーラグロウ
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.roundRect(gateX - 1, gateY - 1, gateW + 2, gateH + 2, 9);
    ctx.stroke();

    // 内側炎グラデーション
    const flameGrad = ctx.createLinearGradient(gateX, gateY + gateH, gateX, gateY);
    flameGrad.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
    flameGrad.addColorStop(0.6, 'rgba(239, 68, 68, 0.25)');
    flameGrad.addColorStop(1, 'rgba(254, 240, 138, 0.15)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.roundRect(gateX, gateY, gateW, gateH, 8);
    ctx.fill();

    // HOT バッジ（ゲート上部中央）
    const badgeX = pk.x1 + pw * 0.5;
    const badgeY = gateY - 10;
    const bw = 32;
    const bh = 14;

    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(badgeX - bw * 0.5, badgeY - bh * 0.5, bw, bh, 4);
    ctx.fill();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOT', badgeX, badgeY);

    ctx.restore();
  }

  private drawPins(ctx: CanvasRenderingContext2D): void {
    const pinActive = this.stats.basePinScore > 0;

    for (const pin of this.physics.pins) {
      const isBumper = pin.kind === 'bumper';
      const r = pin.radius + pin.hitAnim * (isBumper ? 6.0 : 3.0);
      ctx.save();

      if (isBumper) {
        // === 大型ネオンバンパー描画 ===
        // 1. ヒット衝撃波リング
        if (pin.hitAnim > 0.05) {
          ctx.strokeStyle = `rgba(0, 242, 254, ${pin.hitAnim * 0.8})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(pin.x, pin.y, r + pin.hitAnim * 16, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 2. 外周二重ネオンリング
        ctx.shadowColor = pin.hitAnim > 0.1 ? '#ffffff' : '#00f2fe';
        ctx.shadowBlur = pin.hitAnim > 0.1 ? 18 : 10;
        ctx.strokeStyle = pin.hitAnim > 0.1 ? '#ffffff' : '#00f2fe';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, r + 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(244, 114, 182, 0.7)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, r + 1.5, 0, Math.PI * 2);
        ctx.stroke();

        // 3. バンパー本体（立体的ドーム球体）
        const bGrad = ctx.createRadialGradient(
          pin.x - r * 0.35,
          pin.y - r * 0.35,
          2,
          pin.x,
          pin.y,
          r
        );
        if (pin.hitAnim > 0.15) {
          bGrad.addColorStop(0, '#ffffff');
          bGrad.addColorStop(0.4, '#7dd3fc');
          bGrad.addColorStop(1, '#0284c7');
        } else {
          bGrad.addColorStop(0, '#e0f2fe');
          bGrad.addColorStop(0.3, '#38bdf8');
          bGrad.addColorStop(0.7, '#1e3a8a');
          bGrad.addColorStop(1, '#0f172a');
        }
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, r, 0, Math.PI * 2);
        ctx.fill();

        // 4. 中央のスターエンブレム（✦）
        ctx.fillStyle = pin.hitAnim > 0.1 ? '#ffffff' : '#fde047';
        ctx.font = `900 ${Math.round(r * 0.75)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦', pin.x, pin.y + 0.5);
      } else {
        // === 通常の釘（クロームピン） ===
        const g = ctx.createRadialGradient(
          pin.x - r * 0.3,
          pin.y - r * 0.3,
          1,
          pin.x,
          pin.y,
          r
        );
        if (pin.hitAnim > 0.15) {
          g.addColorStop(0, '#ffffff');
          g.addColorStop(1, '#00f2fe');
        } else if (pinActive) {
          g.addColorStop(0, '#e0f2fe');
          g.addColorStop(0.6, '#38bdf8');
          g.addColorStop(1, '#1e3a8a');
        } else {
          g.addColorStop(0, '#f1f5f9');
          g.addColorStop(0.55, '#64748b');
          g.addColorStop(1, '#1e293b');
        }

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // === プラズマ帯電エフェクト（3秒間のパルス放電） ===
      if (pin.electrifiedTimer > 0) {
        const elecRatio = Math.min(1, pin.electrifiedTimer / 3.0);
        const pulse = Math.sin(Date.now() * 0.015 + pin.id) * 0.25 + 0.75;

        // 1. ピン周囲の紫プラズマ放電オーラ
        ctx.save();
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 14 * pulse;
        ctx.strokeStyle = `rgba(192, 132, 252, ${0.85 * pulse * elecRatio})`;
        ctx.lineWidth = isBumper ? 2.8 : 2.0;
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, r + (isBumper ? 5 : 3.5) * pulse, 0, Math.PI * 2);
        ctx.stroke();

        // 2. ピン周囲の微小スパーク（チリチリ周回するプラズマアーク）
        const sparkAngle = (Date.now() * 0.009 + pin.id * 1.7) % (Math.PI * 2);
        const sparkR = r + (isBumper ? 4.5 : 3.0);
        const sx1 = pin.x + Math.cos(sparkAngle) * sparkR;
        const sy1 = pin.y + Math.sin(sparkAngle) * sparkR;
        const midR = sparkR + ((pin.id % 2 === 0 ? 2.5 : -2.0) * pulse);
        const sxMid = pin.x + Math.cos(sparkAngle + 0.35) * midR;
        const syMid = pin.y + Math.sin(sparkAngle + 0.35) * midR;
        const sx2 = pin.x + Math.cos(sparkAngle + 0.7) * sparkR;
        const sy2 = pin.y + Math.sin(sparkAngle + 0.7) * sparkR;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sxMid, syMid);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }
  }

  private drawMedalTrail(ctx: CanvasRenderingContext2D, m: MedalEntity): void {
    const st = MEDAL_STYLE[m.type];
    const len = m.trail.length;
    const isWarped = Boolean(m.warpTrailTimer && m.warpTrailTimer > 0);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 1; i < len; i++) {
      const p0 = m.trail[i - 1];
      const p1 = m.trail[i];
      const ratio = i / len;
      if (isWarped) {
        ctx.strokeStyle = i % 2 === 0 ? '#00f2fe' : '#c084fc';
        ctx.globalAlpha = ratio * 0.85;
        ctx.lineWidth = m.radius * 1.35 * ratio;
      } else {
        ctx.strokeStyle = m.chargeMultiplier > 1.2 ? 'rgba(217, 70, 239, 0.65)' : st.trail;
        ctx.globalAlpha = ratio * 0.55;
        ctx.lineWidth = m.radius * 1.15 * ratio;
      }
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBottomTrayAndInsertConsole(ctx: CanvasRenderingContext2D): void {
    const trayW = TRAY_RIGHT - TRAY_LEFT;
    const trayH = TRAY_BOTTOM_Y - TRAY_TOP_Y;

    // 左側：コンパクト下皿（3Dコイン積載トレイ）
    const rimGrad = ctx.createLinearGradient(TRAY_LEFT, TRAY_TOP_Y, TRAY_LEFT, TRAY_BOTTOM_Y + 8);
    rimGrad.addColorStop(0, '#64748b');
    rimGrad.addColorStop(0.5, '#cbd5e1');
    rimGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.roundRect(TRAY_LEFT - 4, TRAY_TOP_Y - 4, trayW + 8, trayH + 9, 11);
    ctx.fill();

    const innerGrad = ctx.createLinearGradient(0, TRAY_TOP_Y, 0, TRAY_BOTTOM_Y);
    innerGrad.addColorStop(0, '#04060b');
    innerGrad.addColorStop(0.45, '#0f172a');
    innerGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.roundRect(TRAY_LEFT, TRAY_TOP_Y, trayW, trayH, 8);
    ctx.fill();

    // 下皿の奥行きフロア面（3Dパース底面）
    ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
    ctx.beginPath();
    ctx.moveTo(TRAY_LEFT + 10, TRAY_TOP_Y + 24);
    ctx.lineTo(TRAY_RIGHT - 10, TRAY_TOP_Y + 24);
    ctx.lineTo(TRAY_RIGHT - 3, TRAY_BOTTOM_Y - 3);
    ctx.lineTo(TRAY_LEFT + 3, TRAY_BOTTOM_Y - 3);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 242, 254, 0.35)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(TRAY_LEFT + 10, TRAY_BOTTOM_Y - 2);
    ctx.lineTo(TRAY_RIGHT - 10, TRAY_BOTTOM_Y - 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    const trayText = this.stats.swipePickupUnlocked
      ? '【下皿】なぞり / 長押しで連続回収'
      : '【下皿】タップしてメダルを拾う';
    ctx.fillText(trayText, (TRAY_LEFT + TRAY_RIGHT) * 0.5, TRAY_TOP_Y + 13);

    // 下皿内のメダルを下（yが大きい＝底面側）から上（yが小さい＝スタック上部）の順に3D描画
    const trayMedals = this.physics.medals
      .filter((m) => m.zone === 'tray')
      .sort((a, b) => b.y - a.y || a.id - b.id);

    for (const m of trayMedals) {
      this.draw3DTrayCoin(ctx, m.x, m.y, m.radius, m.type);
    }

    if (this.isPointerDownOnTray) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(
        this.pointerBoardX,
        this.pointerBoardY,
        this.stats.pickupRadius,
        this.stats.pickupRadius * 0.65,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }

    // 右側：コンパクト化したパチスロ式メダル投入口（上から下へ入れるスリット構造）
    const boxW = INSERT_BOX_RIGHT - INSERT_BOX_LEFT;
    const boxH = INSERT_BOX_BOTTOM - INSERT_BOX_TOP;
    const boxCX = (INSERT_BOX_LEFT + INSERT_BOX_RIGHT) * 0.5;

    const panelGrad = ctx.createLinearGradient(
      INSERT_BOX_LEFT,
      INSERT_BOX_TOP,
      INSERT_BOX_RIGHT,
      INSERT_BOX_BOTTOM
    );
    panelGrad.addColorStop(0, '#1e293b');
    panelGrad.addColorStop(0.5, '#0f172a');
    panelGrad.addColorStop(1, '#1e293b');

    ctx.fillStyle = panelGrad;
    ctx.beginPath();
    ctx.roundRect(INSERT_BOX_LEFT, INSERT_BOX_TOP - 4, boxW, boxH + 9, 10);
    ctx.fill();

    ctx.strokeStyle = this.heldQueue.length > 0 ? '#00f2fe' : '#334155';
    ctx.lineWidth = this.heldQueue.length > 0 ? 2.2 : 1.5;
    ctx.stroke();

    ctx.fillStyle = '#060911';
    ctx.beginPath();
    ctx.roundRect(INSERT_BOX_LEFT + 7, INSERT_BOX_TOP + 3, boxW - 14, 16, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#67e8f9';
    ctx.font = '900 9.5px Consolas, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('INSERT MEDAL', boxCX, INSERT_BOX_TOP + 12);

    const funnelTopY = INSERT_BOX_TOP + 40;
    const slitY = INSERT_BOX_TOP + 64;

    const slotBezelGrad = ctx.createLinearGradient(
      boxCX - 42,
      funnelTopY - 10,
      boxCX + 42,
      slitY + 14
    );
    slotBezelGrad.addColorStop(0, '#94a3b8');
    slotBezelGrad.addColorStop(0.5, '#475569');
    slotBezelGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = slotBezelGrad;
    ctx.beginPath();
    ctx.roundRect(boxCX - 42, funnelTopY - 8, 84, 44, 8);
    ctx.fill();

    const chuteGrad = ctx.createLinearGradient(0, funnelTopY - 4, 0, slitY + 3);
    chuteGrad.addColorStop(0, '#334155');
    chuteGrad.addColorStop(0.7, '#0f172a');
    chuteGrad.addColorStop(1, '#020617');
    ctx.fillStyle = chuteGrad;
    ctx.beginPath();
    ctx.moveTo(boxCX - 32, funnelTopY - 3);
    ctx.lineTo(boxCX + 32, funnelTopY - 3);
    ctx.lineTo(boxCX + 22, slitY + 3);
    ctx.lineTo(boxCX - 22, slitY + 3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.heldQueue.length > 0 ? '#00f2fe' : '#475569';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('▼', boxCX, funnelTopY + 10);

    // 手元所持メダルを投入口上部に3D積層コインとして表示（最大4段表示）
    if (this.heldQueue.length > 0) {
      const previewCount = Math.min(this.heldQueue.length, 4);
      for (let s = 0; s < previewCount; s++) {
        const mType = this.heldQueue[previewCount - 1 - s];
        const stackY = funnelTopY - 3 - s * 5.2;
        this.draw3DTrayCoin(ctx, boxCX, stackY, 17, mType);
      }
    }

    // 投入口スリットへ3Dコインが上から下へ吸い込まれるアニメーション
    for (const anim of this.slotInsertAnims) {
      const ay = funnelTopY - 4 + anim.progress * (slitY - funnelTopY + 14);
      ctx.save();
      ctx.beginPath();
      ctx.rect(boxCX - 38, funnelTopY - 32, 76, slitY - (funnelTopY - 32) + 1);
      ctx.clip();

      this.draw3DTrayCoin(ctx, boxCX, ay, 17.5, anim.type);
      ctx.restore();
    }

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(boxCX - 25, slitY - 3, 50, 8, 3);
    ctx.fill();

    ctx.strokeStyle = this.heldQueue.length > 0 ? '#00f2fe' : '#64748b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(boxCX - 26, slitY + 4);
    ctx.lineTo(boxCX + 26, slitY + 4);
    ctx.stroke();

    ctx.fillStyle = this.heldQueue.length > 0 ? '#fde047' : '#94a3b8';
    ctx.font = '900 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`手元: ${this.heldQueue.length} 枚`, boxCX, INSERT_BOX_BOTTOM - 17);

    ctx.fillStyle = this.heldQueue.length > 0 ? '#67e8f9' : '#64748b';
    ctx.font = 'bold 9.5px sans-serif';
    const insertHint = this.stats.holdReloadUnlocked ? '長押しで連続投入' : 'タップで投入装填';
    ctx.fillText(insertHint, boxCX, INSERT_BOX_BOTTOM - 5);
  }

  // 下皿用の3Dパース・積層コイン描画（円柱の厚み・ギザギザ側面・楕円天面）
  private draw3DTrayCoin(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    type: MedalType
  ): void {
    const st = MEDAL_STYLE[type];
    const rx = r * 0.92; // 横半径 (~19.3px)
    const ry = r * 0.48; // 縦楕円半径 (~10.1px)
    const depth = 6.8; // 3Dコインの厚み

    ctx.save();

    // 1. 下段コインへのドロップシャドウ
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y + depth + 2.2, rx * 1.04, ry * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 3Dコインの円柱側面（金属の厚み）
    const sideGrad = ctx.createLinearGradient(x - rx, y, x + rx, y);
    sideGrad.addColorStop(0, '#451a03');
    sideGrad.addColorStop(0.22, st.c2);
    sideGrad.addColorStop(0.48, st.c1);
    sideGrad.addColorStop(0.78, st.c2);
    sideGrad.addColorStop(1, '#1e293b');

    ctx.fillStyle = sideGrad;
    ctx.beginPath();
    ctx.moveTo(x - rx, y);
    ctx.lineTo(x - rx, y + depth);
    ctx.ellipse(x, y + depth, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(x + rx, y);
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();

    // 3. 側面のギザギザ（コインエッジの縦リブ）
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      const ang = Math.PI * 0.5 + i * 0.19;
      const gx = x + Math.cos(ang) * rx;
      const gy = y + Math.sin(ang) * ry;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx, gy + depth);
      ctx.stroke();
    }

    // 側面下端の輪郭線
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y + depth, rx, ry, 0, 0, Math.PI);
    ctx.stroke();

    // 4. 3Dコインの楕円天面
    const topGrad = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
    topGrad.addColorStop(0, '#ffffff');
    topGrad.addColorStop(0.25, st.c1);
    topGrad.addColorStop(0.75, st.c2);
    topGrad.addColorStop(1, '#451a03');

    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // 天面リム（外周の輝き）
    ctx.strokeStyle = st.rim;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 天面内側の刻印リング
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 0.72, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 天面のパース刻印テキスト
    ctx.save();
    ctx.translate(x, y + 0.5);
    ctx.scale(1, 0.56);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(r * 0.54)}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.label, 0, 0);
    ctx.restore();

    ctx.restore();
  }

  private drawMedalGraphic(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    type: MedalType,
    chargeMult: number,
    contactFlash: number
  ): void {
    const st = MEDAL_STYLE[type];
    ctx.save();

    if (chargeMult > 1.05 || type !== 'normal') {
      ctx.shadowColor = chargeMult > 1.2 ? '#d946ef' : st.c1;
      ctx.shadowBlur = chargeMult > 1.2 ? 12 : 6;
    }

    const grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    grad.addColorStop(0, st.c1);
    grad.addColorStop(0.5, st.c2);
    grad.addColorStop(1, '#0f172a');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = contactFlash > 0.1 ? '#ffffff' : st.rim;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(r * 0.52)}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelText =
      chargeMult >= 1.15 ? `×${chargeMult.toFixed(1)}` : st.label;
    ctx.fillText(labelText, x, y + 0.5);

    ctx.restore();
  }

  private renderTreePhase(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // 深宇宙のコズミック・ヴォイド背景（星雲の透き通るインディゴネイビー深奥グラデーション）
    const bgGrad = ctx.createRadialGradient(
      BOARD_WIDTH * 0.5,
      BOARD_HEIGHT * 0.44,
      10,
      BOARD_WIDTH * 0.5,
      BOARD_HEIGHT * 0.44,
      390
    );
    bgGrad.addColorStop(0, '#101736');
    bgGrad.addColorStop(0.35, '#090e24');
    bgGrad.addColorStop(0.7, '#050715');
    bgGrad.addColorStop(1, '#020309');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    const cx = BOARD_WIDTH * 0.5 + this.treeCamX;
    const cy = BOARD_HEIGHT * 0.44 + this.treeCamY;
    const { percent } = this.skillTree.getCompletionRatio();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(this.treeZoom, this.treeZoom);

    // === 1. 宇宙星雲ダスト（Nebula Cloud Layers） ===
    const neb1 = ctx.createRadialGradient(-100, -130, 20, -100, -130, 210);
    neb1.addColorStop(0, 'rgba(56, 189, 248, 0.09)');
    neb1.addColorStop(0.5, 'rgba(99, 102, 241, 0.04)');
    neb1.addColorStop(1, 'transparent');
    ctx.fillStyle = neb1;
    ctx.beginPath();
    ctx.arc(-100, -130, 210, 0, Math.PI * 2);
    ctx.fill();

    const neb2 = ctx.createRadialGradient(120, 110, 20, 120, 110, 220);
    neb2.addColorStop(0, 'rgba(244, 114, 182, 0.08)');
    neb2.addColorStop(0.6, 'rgba(168, 85, 247, 0.03)');
    neb2.addColorStop(1, 'transparent');
    ctx.fillStyle = neb2;
    ctx.beginPath();
    ctx.arc(120, 110, 220, 0, Math.PI * 2);
    ctx.fill();

    // === 2. セレスティアル・アストロロジー天球儀（第1円〜第4円の等間隔同心円軌道＆黄道目盛りリング） ===
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.24)';
    ctx.lineWidth = 1.0;
    for (const or of TREE_ORBIT_RADII) {
      ctx.beginPath();
      ctx.arc(0, 0, or, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 外周目盛り（天測計・黄道目盛り刻み）
    ctx.save();
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.22)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, 295, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.28)';
    ctx.lineWidth = 1;
    for (let deg = 0; deg < 360; deg += 6) {
      const rad = (deg * Math.PI) / 180;
      const len = deg % 30 === 0 ? 8 : 4;
      const x1 = Math.cos(rad) * (295 - len);
      const y1 = Math.sin(rad) * (295 - len);
      const x2 = Math.cos(rad) * 295;
      const y2 = Math.sin(rad) * 295;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    // 天球儀アングル刻印ラベル
    ctx.fillStyle = 'rgba(125, 211, 252, 0.4)';
    ctx.font = '8px Consolas, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('20° ECLIP', -235, -170);
    ctx.fillText('30° CELEST', 235, -170);
    ctx.fillText('AST 350°', 220, 205);
    ctx.fillText('POLARIS 0°', 0, -305);
    ctx.restore();

    // 背景の瞬く天体星団（微細スター＋4点星座星 ✦）
    const bgStars = [
      { x: -180, y: -240, r: 1.2, spark: true, phase: 0.1 },
      { x: 190, y: -220, r: 1.5, spark: true, phase: 1.4 },
      { x: -240, y: 80, r: 1.1, spark: false, phase: 2.1 },
      { x: 250, y: 60, r: 1.4, spark: true, phase: 0.8 },
      { x: -80, y: 270, r: 1.2, spark: false, phase: 3.2 },
      { x: 110, y: 260, r: 1.6, spark: true, phase: 2.7 },
      { x: -40, y: -190, r: 0.9, spark: false, phase: 0.5 },
      { x: 60, y: -260, r: 1.0, spark: false, phase: 1.9 },
      { x: -160, y: -80, r: 0.8, spark: false, phase: 3.0 },
      { x: 180, y: -70, r: 0.9, spark: false, phase: 2.2 },
      { x: -210, y: 190, r: 1.0, spark: false, phase: 1.1 },
      { x: 230, y: 180, r: 0.8, spark: false, phase: 0.3 },
    ];
    for (const st of bgStars) {
      const twinkle = 0.45 + Math.sin(this.totalPlayTimeSec * 2.5 + st.phase) * 0.35;
      ctx.fillStyle = `rgba(254, 240, 138, ${twinkle.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();

      if (st.spark) {
        // 4点星（✦）のきらめき光条
        const len = st.r * (2.8 + Math.sin(this.totalPlayTimeSec * 3 + st.phase) * 1.2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${(twinkle * 0.7).toFixed(2)})`;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(st.x - len, st.y);
        ctx.lineTo(st.x + len, st.y);
        ctx.moveTo(st.x, st.y - len);
        ctx.lineTo(st.x, st.y + len);
        ctx.stroke();
      }
    }

    // 100%達成時の神聖外周光環
    if (percent >= 100) {
      ctx.save();
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.7)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, ORBIT_R4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // === 3. 神聖幾何学・六芒星星座線（Constellation Rays） ===
    const nodeMap = new Map<string, SkillNodeDef>();
    for (const n of SKILL_NODES) nodeMap.set(n.id, n);

    for (const node of SKILL_NODES) {
      if (!this.skillTree.isVisible(node)) continue;
      const lvA = this.skillTree.getLevel(node.id);

      for (const nid of node.neighbors) {
        if (node.id > nid) continue;
        const target = nodeMap.get(nid);
        if (!target || !this.skillTree.isVisible(target)) continue;

        const lvB = this.skillTree.getLevel(target.id);
        if (lvA === 0 && lvB === 0) {
          if (this.skillTree.debugShowAll) {
            // デバッグ表示時：未開放同士の接続ラインも薄い点線で可視化（同一円上は円弧）
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            this.traceTreeConnection(ctx, node, target);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          continue;
        }

        const bothActive = lvA > 0 && lvB > 0;
        if (bothActive) {
          // 解放済み同士の光彩レイライン（シアン×ホワイトの二重発光・同一円上は円弧）
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.75)';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          this.traceTreeConnection(ctx, node, target);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          this.traceTreeConnection(ctx, node, target);
          ctx.stroke();
        } else {
          // 解放可能ルートのサクラピンク点線（同一円上は円弧）
          ctx.strokeStyle = 'rgba(244, 114, 182, 0.5)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          this.traceTreeConnection(ctx, node, target);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 六芒星の主骨格ライン（点灯時：優しいスカイシアンオーラ）
    for (const [idA, idB] of HEXAGRAM_LINES) {
      const a = nodeMap.get(idA);
      const b = nodeMap.get(idB);
      if (!a || !b) continue;
      if (this.skillTree.getLevel(idA) > 0 && this.skillTree.getLevel(idB) > 0) {
        ctx.save();
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(a.gx, a.gy);
        ctx.lineTo(b.gx, b.gy);
        ctx.stroke();
        ctx.restore();
      }
    }

    // === 4. 完全正円・サイズ統一 3D天体ノード（Planetary Spheres） ===
    const r = 16; // 全ノードのサイズをコンパクトに最適化（重なり・はみ出し解消）

    for (const node of SKILL_NODES) {
      if (!this.skillTree.isVisible(node)) continue;

      const lv = this.skillTree.getLevel(node.id);
      const isMax = lv >= node.maxLevel;
      const canBuy = this.skillTree.canBuy(node, this.score);
      const isSelected = node.id === this.selectedNodeId;
      const isGoalPinned = !isMax && this.goalNodeIds.includes(node.id);
      const bounceRem = this.treeNodeBounceTimers.get(node.id) || 0;

      ctx.save();

      if (bounceRem > 0) {
        const bScale = 1 + Math.sin((bounceRem / 0.32) * Math.PI) * 0.2;
        ctx.translate(node.gx, node.gy);
        ctx.scale(bScale, bScale);
        ctx.translate(-node.gx, -node.gy);
      }

      // 0. 目標ピン設定ノードの黄金星光リング（Target Pin Star Orbit）
      if (isGoalPinned) {
        ctx.save();
        const pinRot = -this.totalPlayTimeSec * 1.8;
        ctx.translate(node.gx, node.gy);
        ctx.rotate(pinRot);
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, r + 5.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 2つの公転スターマーカー
        for (let s = 0; s < 2; s++) {
          const sa = s * Math.PI;
          const sx = Math.cos(sa) * (r + 5.2);
          const sy = Math.sin(sa) * (r + 5.2);
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // ① 深宇宙に落ちる完全正円シャドウ
      ctx.fillStyle = 'rgba(2, 4, 14, 0.85)';
      ctx.beginPath();
      ctx.arc(node.gx, node.gy + 1.5, r + 0.8, 0, Math.PI * 2);
      ctx.fill();

      // ② 選択天体の星光光輪（Starlight Halo & Orbiting Satellite）
      if (isSelected) {
        ctx.save();
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(node.gx, node.gy, r + 3.2, 0, Math.PI * 2);
        ctx.stroke();

        // 衛星の公転光点
        const orbitAngle = this.totalPlayTimeSec * 3;
        const satX = node.gx + Math.cos(orbitAngle) * (r + 3.2);
        const satY = node.gy + Math.sin(orbitAngle) * (r + 3.2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(satX, satY, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ③ 天体の外枠強調（強化可能ノードは外枠のみピンク発光で強調、最大Lvは優しい水色光彩）
      if (isMax) {
        // 最大Lv：優しい水色の星光リング（まぶしさを排した上品な輝き）
        ctx.save();
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(node.gx, node.gy, r + 1.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (canBuy) {
        // 強化・取得可能：パターンB（高輝度グロウ太枠＋ホワイトピンク芯＋外周ネオンハロー）
        ctx.save();
        const halo = ctx.createRadialGradient(node.gx, node.gy, r * 0.65, node.gx, node.gy, r + 12);
        halo.addColorStop(0, 'rgba(236, 72, 153, 0.65)');
        halo.addColorStop(0.55, 'rgba(244, 114, 182, 0.32)');
        halo.addColorStop(1, 'transparent');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(node.gx, node.gy, r + 12, 0, Math.PI * 2);
        ctx.fill();

        // 太く力強いソリッドネオンピンク枠
        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(node.gx, node.gy, r + 1.9, 0, Math.PI * 2);
        ctx.stroke();

        // 内縁のシャープなホワイトピンク芯
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fdf2f8';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(node.gx, node.gy, r + 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (lv > 0) {
        // 取得済み：スターライトシアンリング
        ctx.save();
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(node.gx, node.gy, r + 1.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        // 未取得・取得不可：清潔なスレートグレーリング
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(node.gx, node.gy, r + 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ④ 完全正円 3D天体球体グラデーション（内側）
      const lightX = node.gx - r * 0.28;
      const lightY = node.gy - r * 0.28;
      const planetGrad = ctx.createRadialGradient(
        lightX,
        lightY,
        1,
        node.gx,
        node.gy,
        r
      );

      if (isMax) {
        // 最大Lv：透き通る優しい水色の天体球体（パステルフロストシアン）
        planetGrad.addColorStop(0, '#ffffff');
        planetGrad.addColorStop(0.25, '#e0f2fe');
        planetGrad.addColorStop(0.65, '#7dd3fc');
        planetGrad.addColorStop(1, '#0284c7');
      } else if (lv > 0) {
        // 取得済み：サファイア惑星球体（蒼い天体）
        planetGrad.addColorStop(0, '#38bdf8');
        planetGrad.addColorStop(0.35, '#0284c7');
        planetGrad.addColorStop(0.8, '#0369a1');
        planetGrad.addColorStop(1, '#0c1a3a');
      } else if (canBuy) {
        // 強化・取得可能：外枠ピンク強調、内側は白アイコンがくっきり映える濃紺
        planetGrad.addColorStop(0, '#334155');
        planetGrad.addColorStop(0.35, '#1e293b');
        planetGrad.addColorStop(0.8, '#0f172a');
        planetGrad.addColorStop(1, '#050814');
      } else {
        // 未取得（取得不可）：背景の闇に埋没しない、整然としたグレーアウト天体球体
        planetGrad.addColorStop(0, '#64748b');
        planetGrad.addColorStop(0.35, '#475569');
        planetGrad.addColorStop(0.8, '#334155');
        planetGrad.addColorStop(1, '#1e293b');
      }

      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(node.gx, node.gy, r, 0, Math.PI * 2);
      ctx.fill();

      // ⑤ 完全正円の柔らかな光沢ハイライト
      ctx.fillStyle = isMax ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(lightX, lightY, r * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // ⑥ ノードのシンボルアイコン（高コントラスト描画）
      if (isMax) {
        ctx.fillStyle = '#082f49'; // 澄んだ水色背景に上品に映えるディープスカイネイビー
      } else if (canBuy || lv > 0) {
        ctx.fillStyle = '#ffffff'; // 強化可能＆取得済みは鮮明な白アイコン
      } else {
        ctx.fillStyle = 'rgba(241, 245, 249, 0.8)'; // 未取得（グレーアウト）は自然なシルバーグレー
      }

      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.icon, node.gx, node.gy + 0.5);

      // ⑦ 惑星軌道カプセル（レベル表示）
      ctx.save();
      const badgeY = node.gy + r + 6.5;
      ctx.fillStyle = 'rgba(6, 10, 26, 0.94)';
      ctx.strokeStyle = isMax
        ? '#7dd3fc'
        : canBuy
        ? '#f472b6'
        : lv > 0
        ? '#38bdf8'
        : '#64748b';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.roundRect(node.gx - 13, badgeY - 5.5, 26, 11, 5.5);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 8px Consolas, sans-serif';
      ctx.fillStyle = isMax ? '#e0f2fe' : canBuy ? '#fbcfe8' : lv > 0 ? '#7dd3fc' : '#cbd5e1';
      ctx.fillText(`${lv}/${node.maxLevel}`, node.gx, badgeY);
      ctx.restore();

      ctx.restore();
    }

    // === 5. ノード取得・強化時のキャンバス演出（衝撃波リング・MAX黄金光輪・隣接解放チェーン粒子） ===
    for (const eff of this.treePurchaseEffects) {
      const prog = Math.min(1, eff.t / eff.maxT);
      const alpha = Math.max(0, 1 - prog);
      ctx.save();

      if (eff.kind === 'ring') {
        const ease = 1 - Math.pow(1 - prog, 2.2);
        const maxR = eff.isMilestone ? 64 : eff.isMax ? 50 : 36;
        const curR = 16 + (maxR - 16) * ease;
        const mainCol = eff.isMilestone
          ? '#fde047'
          : eff.isMax
            ? '#7dd3fc'
            : '#f472b6';

        ctx.shadowColor = mainCol;
        ctx.shadowBlur = 16 * alpha;
        ctx.strokeStyle = mainCol;
        ctx.globalAlpha = alpha * 0.9;
        ctx.lineWidth = (eff.isMax ? 3.2 : 2.2) * (1 - prog * 0.5);
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, curR, 0, Math.PI * 2);
        ctx.stroke();

        if (eff.isMax || eff.isMilestone) {
          const innerR = 14 + (maxR * 0.72 - 14) * ease;
          ctx.strokeStyle = '#fef08a';
          ctx.globalAlpha = alpha * 0.75;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, innerR, 0, Math.PI * 2);
          ctx.stroke();

          // 放射状の星屑スパーク
          const sparkCount = eff.isMilestone ? 8 : 6;
          for (let i = 0; i < sparkCount; i++) {
            const ang = (i / sparkCount) * Math.PI * 2 + prog * 0.6;
            const sr = curR * 0.95;
            const sx = eff.x + Math.cos(ang) * sr;
            const sy = eff.y + Math.sin(ang) * sr;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sx, sy, 2.0 * alpha, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (eff.kind === 'chain' && eff.tx !== undefined && eff.ty !== undefined) {
        const ease = 1 - Math.pow(1 - prog, 1.8);
        const px = eff.x + (eff.tx - eff.x) * ease;
        const py = eff.y + (eff.ty - eff.y) * ease;

        // 接続ラインのハイライトフラッシュ
        ctx.strokeStyle = `rgba(244, 114, 182, ${(alpha * 0.65).toFixed(2)})`;
        ctx.lineWidth = 2.6 * alpha;
        ctx.beginPath();
        ctx.moveTo(eff.x, eff.y);
        ctx.lineTo(px, py);
        ctx.stroke();

        // 走る星光粒子
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#fef08a';
        ctx.globalAlpha = Math.min(1, alpha * 1.4);
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();

        // 到達時のターゲット天体リング波紋
        if (prog > 0.55) {
          const ringP = (prog - 0.55) / 0.45;
          ctx.strokeStyle = '#f472b6';
          ctx.globalAlpha = (1 - ringP) * 0.85;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(eff.tx, eff.ty, 16 + ringP * 12, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private sanitizeGoalPins(): void {
    const validIds = new Set(SKILL_NODES.map((n) => n.id));
    this.goalNodeIds = this.goalNodeIds
      .filter((id) => {
        if (!validIds.has(id)) return false;
        const node = SKILL_NODES.find((n) => n.id === id);
        if (!node) return false;
        return this.skillTree.getLevel(id) < node.maxLevel;
      })
      .slice(0, 3);
  }

  private showTreeMilestoneBanner(text: string, durationSec: number = 2.2): void {
    if (!this.elTreeMilestoneBanner) return;
    this.elTreeMilestoneBanner.textContent = text;
    this.elTreeMilestoneBanner.classList.remove('hidden');
    this.milestoneBannerTimer = durationSec;
  }

  private toggleGoalPin(nodeId: string): void {
    this.sanitizeGoalPins();
    const node = SKILL_NODES.find((n) => n.id === nodeId);
    if (!node) return;
    if (this.skillTree.getLevel(node.id) >= node.maxLevel) return;

    const existingIdx = this.goalNodeIds.indexOf(nodeId);
    if (existingIdx !== -1) {
      this.goalNodeIds.splice(existingIdx, 1);
      sound.playMenuBack();
    } else {
      if (this.goalNodeIds.length >= 3) {
        this.showTreeMilestoneBanner('★ 目標ピンは最大3つまで登録できます', 1.8);
        sound.playMenuBack();
        return;
      }
      this.goalNodeIds.push(nodeId);
      sound.playPocket(false);
    }

    this.saveGame();
    this.updateTreeUI();
  }

  private handleTreeTap(lx: number, ly: number): void {
    const cx = BOARD_WIDTH * 0.5 + this.treeCamX;
    const cy = BOARD_HEIGHT * 0.44 + this.treeCamY;
    const tx = (lx - cx) / this.treeZoom;
    const ty = (ly - cy) / this.treeZoom;

    for (const node of SKILL_NODES) {
      if (!this.skillTree.isVisible(node)) continue;

      const dist = Math.hypot(tx - node.gx, ty - node.gy);
      if (dist <= 22) {
        // ノードタップ時は選択のみ行う（解放ボタンを押さない限り解放しない）
        this.selectedNodeId = node.id;
        this.updateTreeUI();
        return;
      }
    }
  }

  private buySelectedNode(): void {
    const node = SKILL_NODES.find((n) => n.id === this.selectedNodeId);
    if (!node) return;
    if (!this.skillTree.canBuy(node, this.score)) return;

    // 解放前の隣接ノードのアンロック状態を記録（新規ルート開通演出用）
    const prevUnlocked = new Set(
      SKILL_NODES.filter((n) => this.skillTree.isUnlocked(n)).map((n) => n.id)
    );

    const cost = this.skillTree.getCost(node);
    this.score -= cost;
    this.skillTree.levels[node.id] = this.skillTree.getLevel(node.id) + 1;
    this.stats = this.skillTree.computeStats();
    this.sanitizeEquippedRunes();
    this.syncEngravingStats();
    this.sanitizeGoalPins();

    const newLv = this.skillTree.getLevel(node.id);
    const nowMax = newLv >= node.maxLevel;
    const milestoneIds = new Set([
      'm2_2',
      'hot_slot',
      'r3_0',
      'star_1',
      'star_4',
      'star_0',
      'outer_0',
      'outer_3',
      'outer_5',
      'prism_target',
      'jp_fever',
      'jp_freeze',
      'engraving_slot2',
      'engraving_adv',
    ]);
    const isMilestone = milestoneIds.has(node.id);

    // 1. キャンバス演出：バウンス＆衝撃波リング
    this.treeNodeBounceTimers.set(node.id, 0.32);
    this.treePurchaseEffects.push({
      kind: 'ring',
      x: node.gx,
      y: node.gy,
      t: 0,
      maxT: isMilestone ? 0.75 : nowMax ? 0.6 : 0.42,
      isMax: nowMax,
      isMilestone,
    });

    // 2. キャンバス演出：新たにアンロックされた隣接ノードへ光の粒子が走る
    for (const nid of node.neighbors) {
      if (!prevUnlocked.has(nid)) {
        const nb = SKILL_NODES.find((n) => n.id === nid);
        if (nb && this.skillTree.isUnlocked(nb)) {
          this.treePurchaseEffects.push({
            kind: 'chain',
            x: node.gx,
            y: node.gy,
            tx: nb.gx,
            ty: nb.gy,
            t: 0,
            maxT: 0.48,
            isMax: nowMax,
            isMilestone,
          });
        }
      }
    }

    // 3. キーノード解放時のトーストバナー表示
    if (isMilestone) {
      this.showTreeMilestoneBanner(`✦ UNLOCKED: ${node.name} ✦`, 2.4);
      sound.playPocket(true);
    } else if (nowMax) {
      sound.playPocket(false);
    }

    // 100%完全制覇の瞬間を記録
    const { percent } = this.skillTree.getCompletionRatio();
    if (percent >= 100 && !this.clearRecord) {
      this.clearRecord = {
        timeSec: Math.round(this.totalPlayTimeSec),
        round: this.round,
      };
    }

    sound.playUpgrade();
    this.saveGame();
    this.updateTreeUI();
  }

  private updateTreeUI(): void {
    this.updateScoreHUD();
    this.sanitizeGoalPins();
    this.elTreeScore.innerHTML = `${this.score.toLocaleString()} <span class="twp-unit">PT</span>`;
    const { percent } = this.skillTree.getCompletionRatio();
    this.elTreeCompletion.textContent = `${percent}%`;
    this.elTreeProgressFill.style.width = `${percent}%`;

    // 1. ヘッダー内の目標ピンバー更新（最大3つ・3列グリッド2段表示）
    if (this.elTreeGoalBar) {
      if (this.goalNodeIds.length === 0) {
        this.elTreeGoalBar.classList.add('hidden');
        this.elTreeOverlay.classList.remove('has-goals');
        this.elTreeGoalBar.innerHTML = '';
      } else {
        this.elTreeGoalBar.classList.remove('hidden');
        this.elTreeOverlay.classList.add('has-goals');
        this.elTreeGoalBar.innerHTML = '';
        for (const gid of this.goalNodeIds) {
          const gNode = SKILL_NODES.find((n) => n.id === gid);
          if (!gNode) continue;
          const cost = this.skillTree.getCost(gNode);
          const rem = Math.max(0, cost - this.score);
          const unlocked = this.skillTree.isUnlocked(gNode);
          const isReady = rem === 0 && unlocked;
          const remLabel = isReady
            ? '強化可能!'
            : rem === 0
              ? '前提未解放'
              : `あと${rem.toLocaleString()}PT`;

          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = `tree-goal-chip${isReady ? ' is-ready' : ''}`;
          chip.innerHTML = `<span class="tgc-name">★${gNode.name}</span><span class="tgc-rem">${remLabel}</span>`;
          chip.addEventListener('click', () => {
            this.selectedNodeId = gNode.id;
            // 該当ノードが見やすい位置へカメラをスムーズに寄せる
            this.treeCamX = -gNode.gx * this.treeZoom * 0.45;
            this.treeCamY = -gNode.gy * this.treeZoom * 0.45;
            this.updateTreeUI();
          });
          this.elTreeGoalBar.appendChild(chip);
        }
      }
    }

    let node = SKILL_NODES.find((n) => n.id === this.selectedNodeId);
    if (!node || !this.skillTree.isVisible(node)) {
      node = SKILL_NODES[0];
      this.selectedNodeId = node.id;
    }

    const lv = this.skillTree.getLevel(node.id);
    const isMax = lv >= node.maxLevel;

    this.elNodeTitle.textContent = node.name;
    this.elNodeLevel.textContent = `Lv.${lv}/${node.maxLevel}`;
    this.elNodeDesc.textContent = node.description;

    // 2. 目標ピン登録ボタンの状態更新
    if (this.elBtnPinNode) {
      if (isMax) {
        this.elBtnPinNode.classList.add('hidden');
      } else {
        this.elBtnPinNode.classList.remove('hidden');
        const isPinned = this.goalNodeIds.includes(node.id);
        this.elBtnPinNode.classList.toggle('is-pinned', isPinned);
        this.elBtnPinNode.textContent = isPinned
          ? `★ 目標中 (${this.goalNodeIds.length}/3)`
          : `☆ 目標 (${this.goalNodeIds.length}/3)`;
      }
    }

    // 3. 現在値 → 強化後数値の動的プレビュー描画
    if (this.elNodeEffectPreview) {
      const previews = getNodeEffectPreview(this.skillTree, node);
      if (previews.length === 0) {
        this.elNodeEffectPreview.innerHTML = '';
      } else {
        this.elNodeEffectPreview.innerHTML = previews
          .map((row) =>
            isMax
              ? `<span class="ep-chip is-max"><span class="ep-label">${row.label}:</span><span class="ep-after">${row.to} (MAX)</span></span>`
              : `<span class="ep-chip"><span class="ep-label">${row.label}:</span><span class="ep-before">${row.from}</span><span class="ep-arrow">→</span><span class="ep-after">${row.to}</span></span>`
          )
          .join('');
      }
    }

    if (isMax) {
      this.elBtnBuyNode.disabled = true;
      this.elBtnBuyNode.classList.add('is-max');
      this.elBtnBuyNode.textContent = '最大レベル';
    } else {
      this.elBtnBuyNode.classList.remove('is-max');
      const cost = this.skillTree.getCost(node);
      const canBuy = this.score >= cost;
      this.elBtnBuyNode.disabled = !canBuy;
      const actionLabel = lv === 0 ? '取得' : '強化';
      this.elBtnBuyNode.textContent = `${actionLabel} (${cost.toLocaleString()} PT)`;
    }
  }
}
