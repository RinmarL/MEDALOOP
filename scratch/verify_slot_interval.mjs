// scratch/verify_slot_interval.mjs
// スロット停止後の再始動タイマーロジックの単体検証

class SlotSimulation {
  constructor() {
    this.slotHoldCount = 2;
    this.isSlotSpinning = false;
    this.slotSpinElapsed = 0;
    this.slotRestartCooldown = 0;
    this.slotReelStopped = [true, true, true];
    this.spinsStarted = 0;
  }

  startSlotSpin() {
    if (this.slotHoldCount <= 0 || this.isSlotSpinning) return;
    this.slotHoldCount--;
    this.isSlotSpinning = true;
    this.slotSpinElapsed = 0;
    this.slotReelStopped = [false, false, false];
    this.spinsStarted++;
    console.log(`[t=${this.totalT.toFixed(2)}s] startSlotSpin: 第${this.spinsStarted}スピン開始 (残保留: ${this.slotHoldCount})`);
  }

  updateSlot(dtSec) {
    if (this.slotRestartCooldown > 0) {
      this.slotRestartCooldown = Math.max(0, this.slotRestartCooldown - dtSec);
    }

    if (!this.isSlotSpinning) {
      if (this.slotHoldCount > 0 && this.slotRestartCooldown <= 0) {
        this.startSlotSpin();
      }
      return;
    }

    this.slotSpinElapsed += dtSec;
    const rightStopTime = 1.7; // ハズレ時
    if (this.slotSpinElapsed >= rightStopTime && !this.slotReelStopped[2]) {
      this.slotReelStopped[2] = true;
      this.isSlotSpinning = false;
      this.slotRestartCooldown = 0.6;
      console.log(`[t=${this.totalT.toFixed(2)}s] 全リール停止！ slotRestartCooldown = 0.6s を設定`);
    }
  }

  run() {
    this.totalT = 0;
    const dt = 0.05; // 50ms刻み
    console.log('--- スロット始動 ---');
    this.startSlotSpin();

    let stoppedT = -1;
    let nextStartT = -1;

    for (let step = 0; step < 80; step++) {
      this.totalT += dt;
      const prevSpinning = this.isSlotSpinning;
      this.updateSlot(dt);

      if (prevSpinning && !this.isSlotSpinning && stoppedT === -1) {
        stoppedT = this.totalT;
      }
      if (stoppedT !== -1 && this.isSlotSpinning && nextStartT === -1) {
        nextStartT = this.totalT;
        const interval = nextStartT - stoppedT;
        console.log(`[t=${this.totalT.toFixed(2)}s] 次スピン始動！ 停止からのインターバル実測: ${interval.toFixed(2)}s (目標: 0.60s)`);
        break;
      }
    }
  }
}

new SlotSimulation().run();
