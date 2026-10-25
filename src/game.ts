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
  LuckyRing,
  MedalEntity,
  MedalType,
  PickupParticle,
  PinEntity,
  PocketSlot,
  SkillNodeDef,
  SlotInsertAnim,
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
  clone: {
    c1: '#a7f3d0',
    c2: '#059669',
    rim: '#d1fae5',
    trail: 'rgba(16, 185, 129, 0.75)',
    label: '+1',
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
  private roundInsertedCount: number = 0;
  private roundDroppedCount: number = 0;
  private roundPocketCount: number = 0;
  private roundPinHits: number = 0;
  private roundMaxSingleHit: number = 0;
  private roundBonusMedals: number = 0;

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
  private treeZoom: number = 1.0;
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

  // ホーム画面3Dコイン手触り跳ねギミック用
  private homeCoinHopOffsets: number[] = [0, 0, 0, 0, 0, 0];
  private homeCoinHopVels: number[] = [0, 0, 0, 0, 0, 0];
  private homeShowcasePopup: { text: string; x: number; alpha: number } | null = null;

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

  // リザルト画面DOM
  private elResultOverlay = document.getElementById('result-overlay')!;
  private elResGainedScore = document.getElementById('res-gained-score')!;
  private elResTotalScore = document.getElementById('res-total-score')!;
  private elResInsertedCount = document.getElementById('res-inserted-count')!;
  private elResDroppedCount = document.getElementById('res-dropped-count')!;
  private elResPocketCount = document.getElementById('res-pocket-count')!;
  private elResPinHits = document.getElementById('res-pin-hits')!;
  private elResMaxHit = document.getElementById('res-max-hit')!;
  private elResBonusMedals = document.getElementById('res-bonus-medals')!;
  private elBtnResultOk = document.getElementById('btn-result-ok')!;

  // スキルツリー画面DOM
  private elTreeOverlay = document.getElementById('tree-overlay')!;
  private elTreeCompletion = document.getElementById('tree-completion')!;
  private elTreeProgressFill = document.getElementById('tree-progress-fill')!;
  private elTreeScore = document.getElementById('tree-score')!;
  private elNodeTitle = document.getElementById('node-title')!;
  private elNodeLevel = document.getElementById('node-level')!;
  private elNodeDesc = document.getElementById('node-desc')!;
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
    this.physics.setupBoard(this.stats);

    this.bindEvents();
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
      if (data.levels && typeof data.levels === 'object') {
        for (const k of Object.keys(data.levels)) {
          if (k in this.skillTree.levels) {
            this.skillTree.levels[k] = data.levels[k];
          }
        }
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
        })
      );
    } catch {
      // ignore
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.resizeCanvas());

    this.elBtnHome.addEventListener('click', () => {
      this.enterHomePhase();
    });

    const toggleSound = () => {
      const on = sound.toggle();
      const icon = on ? '🔊' : '🔇';
      this.elBtnSound.textContent = icon;
      this.elBtnHomeSound.textContent = icon;
    };

    this.elBtnSound.addEventListener('click', toggleSound);
    this.elBtnHomeSound.addEventListener('click', toggleSound);

    // ホーム画面ボタン（「プレイ」「強化」）
    this.elBtnStartPlay.addEventListener('click', () => {
      this.startRound();
    });

    this.elBtnOpenTree.addEventListener('click', () => {
      this.enterTreePhase();
    });

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
        this.enterHomePhase();
      }
    });

    // リザルト画面の確認ボタン → ホームに戻る
    this.elBtnResultOk.addEventListener('click', () => {
      this.round++;
      this.saveGame();
      this.enterHomePhase();
    });

    // スキルツリー画面ボタン（解放ボタン押下時のみ解放、ホームに戻るボタンでホームへ）
    this.elBtnBuyNode.addEventListener('click', () => {
      this.buySelectedNode();
    });
    this.elBtnTreeBackHome.addEventListener('click', () => {
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
      this.treeZoom = 1.0;
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
      this.updateTreeUI();
      sound.playUpgrade(true);
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
    const { percent } = this.skillTree.getCompletionRatio();

    this.elHomeScore.textContent = `${this.score.toLocaleString()} PT`;
    this.elHomeBestScore.textContent = `${this.bestRoundScore.toLocaleString()} PT`;
    this.elHomeCompletion.textContent = `${percent}%`;
    this.elScore.textContent = this.score.toLocaleString();
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
    const size = 68;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size * 0.5;
    const cy = size * 0.5;
    const scale = 0.108; // 第4円256px → 約27.6pxに縮小

    const nodeMap = new Map<string, SkillNodeDef>();
    for (const n of SKILL_NODES) nodeMap.set(n.id, n);

    ctx.save();
    ctx.translate(cx, cy);

    // 1. 外周ミルキー水色＆ピンクのリングと第1〜第4円ガイド（未解放でも美しく見えるガイド）
    const ringGrad = ctx.createLinearGradient(-28, -28, 28, 28);
    ringGrad.addColorStop(0, 'rgba(125, 211, 252, 0.55)');
    ringGrad.addColorStop(1, 'rgba(244, 114, 182, 0.55)');
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 29.8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.22)';
    ctx.lineWidth = 0.8;
    for (const or of TREE_ORBIT_RADII) {
      ctx.beginPath();
      ctx.arc(0, 0, or * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(216, 180, 254, 0.28)';
    ctx.lineWidth = 1.1;
    for (const [idA, idB] of HEXAGRAM_LINES) {
      const a = nodeMap.get(idA);
      const b = nodeMap.get(idB);
      if (!a || !b) continue;
      ctx.beginPath();
      this.traceTreeConnection(ctx, a, b, scale);
      ctx.stroke();
    }

    // 2. 解放済みノード間の接続ライン（ミルキーシアン＆ピンク）
    for (const node of SKILL_NODES) {
      if (!this.skillTree.isVisible(node)) continue;
      const lvA = this.skillTree.getLevel(node.id);
      if (lvA <= 0) continue;

      for (const nid of node.neighbors) {
        if (node.id > nid) continue;
        const target = nodeMap.get(nid);
        if (!target || this.skillTree.getLevel(target.id) <= 0) continue;

        ctx.save();
        ctx.shadowColor = '#7dd3fc';
        ctx.shadowBlur = 4;
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        this.traceTreeConnection(ctx, node, target, scale);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. 点灯した優しい水色＆ホワイトの六芒星ライン
    for (const [idA, idB] of HEXAGRAM_LINES) {
      const a = nodeMap.get(idA);
      const b = nodeMap.get(idB);
      if (!a || !b) continue;
      if (this.skillTree.getLevel(idA) > 0 && this.skillTree.getLevel(idB) > 0) {
        ctx.save();
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 5;
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 1.8;
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
      const r = node.category === 'core' ? 2.8 : lv > 0 ? 2.3 : 1.6;

      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      if (isMax) {
        ctx.fillStyle = '#fde047';
      } else if (lv > 0) {
        ctx.fillStyle = '#7dd3fc';
      } else if (canBuy) {
        ctx.fillStyle = '#f472b6';
      } else {
        ctx.fillStyle = 'rgba(203, 213, 225, 0.45)';
      }
      ctx.fill();
    }

    ctx.restore();
  }

  // ホーム画面の所持メダル3Dショーケース描画（案E原画準拠：サロン風ジュエリーボックス・ふかふかプラムクッション仕様）
  private renderHomeMedalShowcase(): void {
    const c = this.elHomeMedalCanvas;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = 340;
    const h = 104; // ユーザー要望により縦幅を拡張
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // ジュエリーボックス内のプラムパープル・高級ベルベットクッション背景
    const velvetGrad = ctx.createRadialGradient(w * 0.5, 42, 10, w * 0.5, 42, 180);
    velvetGrad.addColorStop(0, 'rgba(64, 28, 98, 0.55)');
    velvetGrad.addColorStop(0.55, 'rgba(32, 14, 56, 0.75)');
    velvetGrad.addColorStop(1, 'rgba(15, 6, 28, 0.95)');
    ctx.fillStyle = velvetGrad;
    ctx.fillRect(0, 0, w, h);

    // クッション中央のふかふか沈み込み曲面ライン（ゴールドの極細光沢糸）
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.16)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(12, 76);
    ctx.quadraticCurveTo(w * 0.5, 82, w - 12, 76);
    ctx.stroke();

    // 左端：ノーマルメダルの3Dスタック（最大4段表示、タップで跳ねる）
    const normalCount =
      this.stats.specialMedals.filter((t) => t === 'normal').length + this.stats.extraStartMedals;
    const stackPreview = Math.min(normalCount, 4);
    const nx = 38;
    const normalHop = this.homeCoinHopOffsets[0] || 0;

    // クッションの沈み込み影（楕円シャドウ）
    ctx.fillStyle = 'rgba(8, 3, 16, 0.75)';
    ctx.beginPath();
    ctx.ellipse(nx, 64, 20, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let s = 0; s < stackPreview; s++) {
      // 上の段ほど大きく跳ねる手触り演出
      const hopScale = 0.55 + (s / Math.max(1, stackPreview - 1)) * 0.55;
      this.draw3DTrayCoin(ctx, nx, 54 - s * 5.8 + normalHop * hopScale, 17, 'normal');
    }
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 10.5px Consolas, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`×${normalCount}`, nx, h - 7);

    // 特殊メダル5種のスロット（GOLD, PLASMA, BOUNCE, CLONE, CHRONO）
    const specialSlots: { type: MedalType; name: string }[] = [
      { type: 'gold', name: 'GOLD' },
      { type: 'plasma', name: 'PLASMA' },
      { type: 'bounce', name: 'BOUNCE' },
      { type: 'clone', name: 'CLONE' },
      { type: 'chrono', name: 'CHRONO' },
    ];

    specialSlots.forEach((slot, idx) => {
      const sx = 98 + idx * 52;
      const hopY = this.homeCoinHopOffsets[idx + 1] || 0;
      const sy = 46 + hopY;
      const unlocked = this.stats.specialMedals.includes(slot.type);

      if (unlocked) {
        ctx.fillStyle = 'rgba(8, 3, 16, 0.72)';
        ctx.beginPath();
        ctx.ellipse(sx, 62, 19, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        this.draw3DTrayCoin(ctx, sx, sy, 18, slot.type);
        ctx.fillStyle = '#bae6fd';
        ctx.font = 'bold 9.5px Consolas, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(slot.name, sx, h - 7);
      } else {
        // 未解放シルエット（ベルベットクッションのくぼみスロット）
        ctx.save();
        ctx.fillStyle = 'rgba(16, 7, 32, 0.9)';
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(sx, sy + 6, 17, 9.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(203, 213, 225, 0.55)';
        ctx.font = 'bold 11px Consolas, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', sx, sy + 6);

        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.font = 'bold 8.5px Consolas, sans-serif';
        ctx.fillText('LOCKED', sx, h - 7);
        ctx.restore();
      }
    });

    // タップ時のミニ効果ラベルポップアップ
    if (this.homeShowcasePopup && this.homeShowcasePopup.alpha > 0) {
      const p = this.homeShowcasePopup;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.alpha);
      const px = Math.max(88, Math.min(w - 88, p.x));
      ctx.fillStyle = 'rgba(20, 10, 40, 0.96)';
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(px - 86, 4, 172, 18, 9);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, px, 13);
      ctx.restore();
    }
  }

  private handleHomeShowcaseTap(lx: number): void {
    const slotCenters = [38, 98, 150, 202, 254, 306];
    const slotEffects: { type: MedalType; desc: string }[] = [
      { type: 'normal', desc: 'NORMAL: 基礎メダル (1 PT)' },
      { type: 'gold', desc: 'GOLD: 基礎得点 ×3' },
      { type: 'plasma', desc: 'PLASMA: 接触倍率上昇 ×2.5' },
      { type: 'bounce', desc: 'BOUNCE: 高反発＆バンパー×2.8' },
      { type: 'clone', desc: 'CLONE: 入賞時にメダル増殖' },
      { type: 'chrono', desc: 'CHRONO: 得点×3＆時間+1.2秒' },
    ];

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

    const info = slotEffects[bestIdx];
    const unlocked =
      bestIdx === 0 || this.stats.specialMedals.includes(info.type);

    this.homeCoinHopVels[bestIdx] = unlocked ? -135 : -65;
    this.homeShowcasePopup = {
      text: unlocked ? info.desc : '未解放: スキルツリーで解放',
      x: slotCenters[bestIdx],
      alpha: 1.6,
    };

    if (unlocked) {
      sound.playPickup();
    } else {
      sound.playMedalClink(0.25);
    }
    this.renderHomeMedalShowcase();
  }

  private updateHomeShowcaseAnim(dtSec: number): void {
    let active = false;
    for (let i = 0; i < this.homeCoinHopOffsets.length; i++) {
      if (this.homeCoinHopOffsets[i] < 0 || this.homeCoinHopVels[i] !== 0) {
        active = true;
        this.homeCoinHopVels[i] += 520 * dtSec;
        this.homeCoinHopOffsets[i] += this.homeCoinHopVels[i] * dtSec;
        if (this.homeCoinHopOffsets[i] >= 0) {
          this.homeCoinHopOffsets[i] = 0;
          if (Math.abs(this.homeCoinHopVels[i]) > 45) {
            this.homeCoinHopVels[i] = -this.homeCoinHopVels[i] * 0.32;
          } else {
            this.homeCoinHopVels[i] = 0;
          }
        }
      }
    }
    if (this.homeShowcasePopup && this.homeShowcasePopup.alpha > 0) {
      active = true;
      this.homeShowcasePopup.alpha = Math.max(0, this.homeShowcasePopup.alpha - dtSec * 0.9);
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
    if (this.physics) {
      this.physics.resetPocketsLit();
    }
  }

  // ② メダルゲーム開始（下皿のメダルを拾うところからスタート）
  private startRound(): void {
    this.phase = 'play';
    this.stats = this.skillTree.computeStats();
    this.timeRemaining = this.stats.roundDuration;
    this.dropCooldownTimer = 0;
    this.resetJackpotState();

    // リザルト統計リセット
    this.roundGainedScore = 0;
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

    if (this.roundGainedScore > this.bestRoundScore) {
      this.bestRoundScore = this.roundGainedScore;
    }

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
    this.treeZoom = 1.0;
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

  // 操作1：下皿からメダルを拾う（3Dスタックの一番上のコインから優先回収）
  private tryPickupFromTray(tx: number, ty: number): void {
    let bestIndex = -1;
    let bestScore = Infinity;
    const maxRadius = this.stats.pickupRadius + MEDAL_RADIUS + 8;

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
    this.physics.spawnMedal(x, 54, medalType, 'board');
    this.roundDroppedCount++;
    this.dropCooldownTimer = this.stats.dropCooldown;
    sound.playDrop();
  }

  private getMedalBaseScoreMult(type: MedalType): number {
    switch (type) {
      case 'gold':
        return 3.0;
      case 'plasma':
        return 2.0;
      case 'bounce':
        return 1.5;
      case 'clone':
        return 1.5;
      case 'chrono':
        return 3.0;
      case 'bonus':
        return 1.5;
      default:
        return 1.0;
    }
  }

  private handlePinHit(medal: MedalEntity, pin: PinEntity): void {
    this.roundPinHits++;

    // バンパー（ピン）は初期状態では点数なし（0点）
    if (this.stats.basePinScore <= 0 || pin.baseScore <= 0) {
      sound.playMedalClink(0.35);
      return;
    }

    const typeMult = this.getMedalBaseScoreMult(medal.type) * (medal.type === 'bounce' ? 2.8 : 1.0);
    const feverMult = this.jpFeverTimer > 0 ? 2.0 : 1.0;
    const raw =
      pin.baseScore * typeMult * medal.chargeMultiplier * this.stats.globalScoreMultiplier * feverMult;
    const gained = Math.max(1, Math.round(raw));

    this.score += gained;
    this.roundGainedScore += gained;
    if (gained > this.roundMaxSingleHit) {
      this.roundMaxSingleHit = gained;
    }

    sound.playPinHit(pin.kind === 'bumper');
    this.addFloatingText(
      pin.x,
      pin.y - 12,
      feverMult > 1 ? `+${gained} (x2!)` : `+${gained}`,
      pin.kind === 'bumper' ? '#f472b6' : '#00f2fe',
      pin.kind === 'bumper' ? 1.1 : 0.88
    );
    this.updateScoreHUD();
  }

  private handlePocketPass(medal: MedalEntity, pocket: PocketSlot): void {
    this.roundPocketCount++;

    const typeMult = this.getMedalBaseScoreMult(medal.type);
    const feverMult = this.jpFeverTimer > 0 ? 2.0 : 1.0;
    const raw =
      this.stats.basePocketScore *
      pocket.scoreMultiplier *
      typeMult *
      medal.chargeMultiplier *
      this.stats.globalScoreMultiplier *
      feverMult;
    const gained = Math.max(1, Math.round(raw));

    this.score += gained;
    this.roundGainedScore += gained;
    if (gained > this.roundMaxSingleHit) {
      this.roundMaxSingleHit = gained;
    }

    const centerX = (pocket.x1 + pocket.x2) * 0.5;
    this.addFloatingText(
      centerX,
      POCKET_ENTRY_Y - 8,
      feverMult > 1 ? `+${gained} PT (x2!)` : `+${gained} PT`,
      pocket.scoreMultiplier >= 4 ? '#00f2fe' : '#fde047',
      pocket.scoreMultiplier >= 4 ? 1.25 : 1.05
    );

    if (medal.type === 'chrono') {
      this.timeRemaining += 1.2;
      this.addFloatingText(centerX, POCKET_ENTRY_Y - 28, '+1.2s TIME!', '#f472b6', 1.15);
    }

    const shouldSpawnBonus = pocket.spawnsBonusMedal || medal.type === 'clone';
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

  // JP時の射出メダル抽選（通常率：未強化70%〜強化で最大30%、特殊枠：ゴールド35/プラズマ25/バウンス18/クローン13/クロノ9）
  private rollJackpotMedalType(): MedalType {
    if (Math.random() < this.stats.jpNormalMedalRate) {
      return 'normal';
    }

    const baseWeights: Record<string, number> = {
      gold: 35,
      plasma: 25,
      bounce: 18,
      clone: 13,
      chrono: 9,
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
    // JPフィーバー（5秒間全得点2倍）解放済みならタイマーセット
    if (this.stats.jpFeverUnlocked) {
      this.jpFeverTimer = 5.0;
    }

    // JPロングフリーズ抽選（解放済みかつ1%、またはforceFreeze時）
    const triggerFreeze =
      (this.stats.jpFreezeUnlocked && Math.random() < 0.01) || forceFreeze;
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

  // JPロングフリーズ演出開始（4.4秒演出：停止・プチュン暗転・虹色ロゴ・50枚待機）
  private startJackpotFreeze(): void {
    sound.playJackpotFanfare(); // フリーズ突入時もJACKPOTファンファーレを再生！
    this.isJackpotFreezing = true;
    this.jackpotFreezeTimer = 0;
    this.jackpotFlashTimer = 0.8;
    this.screenShakeTimer = 0.7;

    // 50枚のストックメダルを事前生成（上部整列用）
    this.freezeStockMedals = [];
    const count = 50;
    for (let i = 0; i < count; i++) {
      const col = i % 17;
      const row = Math.floor(i / 17);
      const x = 54 + col * 22;
      const y = 30 + row * 18;
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

    // 1.0s: プチュン消音＆暗転
    if (prevT < 1.0 && t >= 1.0) {
      sound.playFreezePutsun();
    }

    // 1.6s: PREMIUM JACKPOT 虹色ネオン開始（荘厳プレミアム和音）
    if (prevT < 1.6 && t >= 1.6) {
      sound.playFreezePremium();
    }

    // 4.4s: 演出完了！タイマー再開＆50枚一気放出
    if (t >= 4.4) {
      this.releaseFreezeStockMedals();
    }
  }

  private releaseFreezeStockMedals(): void {
    this.isJackpotFreezing = false;
    this.jackpotFreezeTimer = 0;
    this.screenShakeTimer = 1.3;
    this.jackpotFlashTimer = 1.0;
    sound.playJackpotFanfare();

    // 50枚を一斉に盤面へ射出！
    for (let i = 0; i < this.freezeStockMedals.length; i++) {
      const stock = this.freezeStockMedals[i];
      const medal = this.physics.spawnMedal(stock.x, stock.y, stock.type, 'board');
      const spreadX = (stock.x - BOARD_WIDTH * 0.5) * 1.6;
      medal.vx = spreadX + (Math.random() - 0.5) * 80;
      medal.vy = 240 + Math.random() * 140;
      medal.chargeMultiplier = 1.0;
    }

    this.addFloatingText(
      BOARD_WIDTH * 0.5,
      200,
      '★ 50 MEDALS OVERDRIVE!! ★',
      '#f43f5e',
      2.0
    );
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

  private updateScoreHUD(): void {
    this.elScore.textContent = this.score.toLocaleString();
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
      onCatapultLaunch: (m, cat, originX, originY) => {
        sound.playCatapultLaunch();
        // 吸い込み消滅エフェクト（カタパルト位置）
        this.warpEffects.push({
          x: originX ?? cat.x,
          y: originY ?? cat.y,
          progress: 0,
          maxR: 28,
          color: '#38bdf8',
          kind: 'implosion',
        });
        // 出現拡散エフェクト（最上部ワープ先位置）
        this.warpEffects.push({
          x: m.x,
          y: m.y,
          progress: 0,
          maxR: 34,
          color: '#00f2fe',
          kind: 'explosion',
        });

        // 倍率情報・特殊タイプ維持を視覚的に伝えるフローティングテキスト
        const multLabel = m.chargeMultiplier > 1.0 ? `x${m.chargeMultiplier.toFixed(1)} ` : '';
        this.addFloatingText(m.x, m.y - 12, `WARP! ${multLabel}🛸`, '#00f2fe', 1.15);
        this.addFloatingText(cat.x, cat.y - 16, 'WARPING! 🌀', '#38bdf8', 0.95);
      },
      onLuckyRingPass: (m, ring) => this.handleLuckyRingPass(m, ring),
      onJackpot: () => this.handleJackpotFever(),
      onPocketToggleLamp: (pk, lit) => this.handlePocketToggleLamp(pk, lit),
      onRailHit: () => sound.playMedalClink(0.35),
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

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dtSec;
      ft.alpha -= dtSec * 1.35;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
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

    // 3. サイバー・カタパルト＆スプリット・レーザー描画
    this.drawCyberCatapults(ctx);
    this.drawSplitLasers(ctx);

    this.drawNeonPockets(ctx);
    this.drawLuckyRing(ctx);
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

  // JPロングフリーズ演出描画（4.4秒タイムライン：静止グリッチ→プチュン暗転→虹色PREMIUM JACKPOT→50枚待機）
  private drawJackpotFreezeOverlay(ctx: CanvasRenderingContext2D): void {
    const t = this.jackpotFreezeTimer;

    // === Stage 1: 0.0s〜1.0s (完全静止＆微細グリッチ) ===
    if (t < 1.0) {
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const gy = Math.floor((Math.sin(t * 20 + i * 2) * 0.5 + 0.5) * BOARD_HEIGHT);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(0, 242, 254, 0.18)' : 'rgba(244, 63, 94, 0.18)';
        ctx.fillRect(0, gy, BOARD_WIDTH, 4 + (i % 3) * 3);
      }
      ctx.restore();
      return;
    }

    // === Stage 2: 1.0s〜1.6s (プチュン CRTテレビ電源オフ＆暗転) ===
    if (t < 1.6) {
      const p = (t - 1.0) / 0.6; // 0 -> 1
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      // 中央に収束するホワイトライン＆ドット
      const beamAlpha = Math.max(0, 1 - p * 1.5);
      if (beamAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${beamAlpha})`;
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 12;
        const h = Math.max(1.5, (1 - p) * 12);
        const w = Math.max(4, (1 - p) * BOARD_WIDTH);
        ctx.fillRect((BOARD_WIDTH - w) * 0.5, BOARD_HEIGHT * 0.5 - h * 0.5, w, h);
      }
      ctx.restore();
      return;
    }

    // === Stage 3: 1.6s〜3.4s (漆黒の背景に虹色立体 PREMIUM JACKPOT) ===
    if (t < 3.4) {
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      // 上品な星屑パーティクル（静かに漂う光の粒子）
      for (let i = 0; i < 28; i++) {
        const px = (Math.sin(i * 1.7 + t * 0.5) * 0.5 + 0.5) * BOARD_WIDTH;
        const py = (Math.cos(i * 2.3 + t * 0.4) * 0.5 + 0.5) * (BOARD_HEIGHT * 0.7) + 80;
        const pr = (Math.sin(t * 3 + i) * 0.5 + 0.5) * 2 + 1;
        const pAlpha = (Math.sin(t * 4 + i * 2) * 0.5 + 0.5) * 0.8 + 0.2;
        ctx.fillStyle = i % 2 === 0 ? `rgba(250, 204, 21, ${pAlpha})` : `rgba(244, 114, 182, ${pAlpha})`;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 中央の主役：虹色立体ネオン PREMIUM JACKPOT
      const centerY = 310;
      const pulse = 1.0 + Math.sin((t - 1.6) * 4) * 0.035;

      ctx.save();
      ctx.translate(BOARD_WIDTH * 0.5, centerY);
      ctx.scale(pulse, pulse);

      // 虹色リニアグラデーション
      const rainbowGrad = ctx.createLinearGradient(-190, 0, 190, 0);
      rainbowGrad.addColorStop(0.0, '#f43f5e');
      rainbowGrad.addColorStop(0.2, '#fb923c');
      rainbowGrad.addColorStop(0.4, '#facc15');
      rainbowGrad.addColorStop(0.6, '#4ade80');
      rainbowGrad.addColorStop(0.8, '#38bdf8');
      rainbowGrad.addColorStop(1.0, '#c084fc');

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 立体シャドウ（深みのある重厚感）
      ctx.font = "900 34px 'Segoe UI', sans-serif";
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillText('PREMIUM JACKPOT', 0, 4);

      // 虹色発光グロー
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 24;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4.5;
      ctx.strokeText('PREMIUM JACKPOT', 0, 0);

      ctx.fillStyle = rainbowGrad;
      ctx.fillText('PREMIUM JACKPOT', 0, 0);

      // サブタイトル（ゴールド装飾ライン）
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 10;
      ctx.font = "800 13px 'Segoe UI', sans-serif";
      ctx.fillStyle = '#fde047';
      ctx.fillText('✦ 50 MEDALS OVERDRIVE ✦', 0, 36);

      ctx.restore();
      ctx.restore();
      return;
    }

    // === Stage 4: 3.4s〜4.4s (ソフト明転＆上部に50枚待機) ===
    const fadeProg = (t - 3.4) / 1.0; // 0 -> 1
    ctx.save();
    // 漆黒からゲーム盤面がソフトに明転
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, 0.85 - fadeProg * 0.65)})`;
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // 盤面最上部に待機する50枚のストックメダルを描画
    for (const m of this.freezeStockMedals) {
      const style = MEDAL_STYLE[m.type] || MEDAL_STYLE.normal;
      ctx.save();
      ctx.shadowColor = style.c1;
      ctx.shadowBlur = 8;

      // メダル本体（直径17pxのコンパクトサイズで美しく整列）
      const grad = ctx.createRadialGradient(m.x - 2, m.y - 2, 1, m.x, m.y, 8.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, style.c1);
      grad.addColorStop(1, style.c2);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 8.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = style.rim;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();
    }

    // 上部中央に待機アナウンスネオン
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "900 14px 'Segoe UI', sans-serif";
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fbcfe8';
    ctx.fillText('⚡ 50 MEDALS READY... ⚡', BOARD_WIDTH * 0.5, 88);
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

    const nozGrad = ctx.createLinearGradient(cx - 38, 12, cx + 38, 12);
    nozGrad.addColorStop(0, '#1e293b');
    nozGrad.addColorStop(0.35, '#94a3b8');
    nozGrad.addColorStop(0.5, '#f8fafc');
    nozGrad.addColorStop(0.65, '#64748b');
    nozGrad.addColorStop(1, '#0f172a');

    ctx.fillStyle = nozGrad;
    ctx.beginPath();
    ctx.roundRect(cx - 38, 12, 76, 26, [0, 0, 12, 12]);
    ctx.fill();
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#090d16';
    ctx.fillRect(cx - 28, 16, 56, 17);
    ctx.fillStyle = this.loadedQueue.length > 0 ? '#00f2fe' : '#64748b';
    ctx.font = '900 11px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`CREDIT:${this.loadedQueue.length}`, cx, 25);

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
    } else {
      ctx.fillStyle = 'rgba(244, 114, 182, 0.75)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const guide =
        this.heldQueue.length > 0
          ? '↘ 右下の投入口をタップしてメダルを装填！'
          : '↙ 左下の下皿からメダルをタップして拾おう！';
      ctx.fillText(guide, cx, 62);
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
    const isMult = ring.kind === 'mult';
    const mainColor = isMult ? '#fde047' : '#34d399';
    const glowColor = isMult ? 'rgba(250, 204, 21, 0.45)' : 'rgba(52, 211, 153, 0.45)';
    const coreDeepColor = isMult ? '#78350f' : '#064e3b';
    const coreMidColor = isMult ? '#eab308' : '#10b981';
    const coreLightColor = isMult ? '#fef08a' : '#a7f3d0';

    ctx.save();

    if (!ring.active) {
      // 1. 再出現待機中（ゲージは完全撤去、再出現直前に微かな光の種がふわりと凝縮）
      const respawnDur = Math.max(0.1, ring.respawnDuration || 1.0);
      const ratio = Math.max(0, 1 - ring.respawnTimer / respawnDur);
      // 再出現の直前（進行度50%以降）のみ淡く光の粒子が凝縮
      if (ratio > 0.4) {
        const appearRatio = (ratio - 0.4) / 0.6;
        const chargeRadius = ring.radius * (0.2 + appearRatio * 0.6);
        ctx.globalAlpha = appearRatio * 0.7;
        const coreGrad = ctx.createRadialGradient(ring.x, ring.y, 0, ring.x, ring.y, chargeRadius);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.4, coreLightColor);
        coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, chargeRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      return;
    }

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

  // スプリット・レーザー（通過メダル分裂ネオンライン）描画：本格SF高エネルギーレーザー
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
      } else if (laser.cooldownDuration - laser.timer < 0.8) {
        // 出現予兆チャージアップ（エミッター高速点滅＆ガイドロックオンレーザー）
        const remaining = laser.cooldownDuration - laser.timer;
        const blinkRate = Math.sin(remaining * 28) * 0.5 + 0.5;

        ctx.save();
        // 両端エミッター点滅
        ctx.fillStyle = `rgba(244, 114, 182, ${(0.4 + blinkRate * 0.6).toFixed(2)})`;
        ctx.shadowColor = '#f472b6';
        ctx.shadowBlur = 10 * blinkRate;
        ctx.beginPath();
        ctx.arc(laser.x1, laser.y1, 4, 0, Math.PI * 2);
        ctx.arc(laser.x2, laser.y2, 4, 0, Math.PI * 2);
        ctx.fill();

        // 極細ガイドロックオンビーム
        ctx.strokeStyle = `rgba(56, 189, 248, ${(0.2 + blinkRate * 0.5).toFixed(2)})`;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // サイバー・カタパルト（盤面最上部ワープポータル）描画
  private drawCyberCatapults(ctx: CanvasRenderingContext2D): void {
    if (!this.stats.catapultUnlocked) return;

    for (const cat of this.physics.catapults) {
      ctx.save();
      const isLeft = cat.side === 'left';
      const r = cat.radius;

      // ① ワープ転送フラッシュ・光柱（接触時に上空へ向かって光の柱が伸びる）
      if (cat.launchAnim > 0) {
        ctx.save();
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 24 * cat.launchAnim;
        const beamGrad = ctx.createLinearGradient(cat.x, cat.y, cat.x, cat.y - 120);
        beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        beamGrad.addColorStop(0.3, 'rgba(0, 242, 254, 0.85)');
        beamGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.4)');
        beamGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(cat.x - r * 0.7, cat.y);
        ctx.lineTo(cat.x - r * 0.3, cat.y - 110 * cat.launchAnim);
        ctx.lineTo(cat.x + r * 0.3, cat.y - 110 * cat.launchAnim);
        ctx.lineTo(cat.x + r * 0.7, cat.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // ② ポッド外殻ベゼル（ダークチタン×サイバーネオンシアン）
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#0b1120';
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(cat.x, cat.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // ③ 吸い込みワープホール内径（深奥ブラックホール・グラデーション）
      const holeGrad = ctx.createRadialGradient(cat.x, cat.y, 1, cat.x, cat.y, r * 0.82);
      holeGrad.addColorStop(0, '#020617');
      holeGrad.addColorStop(0.65, '#0c4a6e');
      holeGrad.addColorStop(1, '#0284c7');
      ctx.fillStyle = holeGrad;
      ctx.beginPath();
      ctx.arc(cat.x, cat.y, r * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // ④ 回転サイバーワープリング（ポータル渦巻きアニメーション）
      ctx.save();
      ctx.translate(cat.x, cat.y);
      const rot = this.totalPlayTimeSec * (isLeft ? 3.2 : -3.2);
      ctx.rotate(rot);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // ⑤ ワープラベル
      ctx.fillStyle = '#e0f2fe';
      ctx.font = '900 7px "Segoe UI", Consolas, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('WARP', cat.x, cat.y);

      ctx.restore();
    }
  }

  // ワープエフェクト（吸い込み光輪＆出現スパーク）描画
  private drawWarpEffects(ctx: CanvasRenderingContext2D): void {
    for (const we of this.warpEffects) {
      const alpha = Math.max(0, 1 - we.progress);
      ctx.save();

      if (we.kind === 'implosion') {
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

      ctx.restore();
    }
  }

  private drawMedalTrail(ctx: CanvasRenderingContext2D, m: MedalEntity): void {
    const st = MEDAL_STYLE[m.type];
    const len = m.trail.length;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 1; i < len; i++) {
      const p0 = m.trail[i - 1];
      const p1 = m.trail[i];
      const ratio = i / len;
      ctx.strokeStyle = m.chargeMultiplier > 1.2 ? 'rgba(217, 70, 239, 0.65)' : st.trail;
      ctx.globalAlpha = ratio * 0.55;
      ctx.lineWidth = m.radius * 1.15 * ratio;
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

      ctx.save();

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
        // 強化・取得可能：外枠のみサクラピンク発光＆微パルスで強調（内側は濃色にしてアイコン視認性を保持）
        const pulse = Math.sin(this.totalPlayTimeSec * 4) * 1.0;
        ctx.save();
        ctx.shadowColor = '#f472b6';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(node.gx, node.gy, r + 1.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(node.gx, node.gy, r + 2.8 + pulse, 0, Math.PI * 2);
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

    ctx.restore();
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

    const cost = this.skillTree.getCost(node);
    this.score -= cost;
    this.skillTree.levels[node.id] = this.skillTree.getLevel(node.id) + 1;
    this.stats = this.skillTree.computeStats();

    // 100%完全制覇の瞬間を記録
    const { percent } = this.skillTree.getCompletionRatio();
    if (percent >= 100 && !this.clearRecord) {
      this.clearRecord = {
        timeSec: Math.round(this.totalPlayTimeSec),
        round: this.round,
      };
    }

    sound.playUpgrade(
      node.category === 'milestone' || node.category === 'medal' || node.category === 'core'
    );
    this.saveGame();
    this.updateTreeUI();
  }

  private updateTreeUI(): void {
    this.updateScoreHUD();
    this.elTreeScore.textContent = `${this.score.toLocaleString()} PT`;
    const { percent } = this.skillTree.getCompletionRatio();
    this.elTreeCompletion.textContent = `${percent}%`;
    this.elTreeProgressFill.style.width = `${percent}%`;

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
