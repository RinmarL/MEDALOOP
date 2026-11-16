# 実装計画書 (Plan.md) — 第118版（スロット保留消化時のリール全停止後0.6秒インターバル導入）

## 1. タスク概要・背景
ユーザーより「保留がある場合、スロットでリールが回り終わったら0.6秒空けてから再始動して」とのご指示を受け、簡易スロットのリールがすべて停止した後に `0.6秒` の間隔（インターバル）を設け、その後に次の保留スピンを再始動する制御を導入する。

## 2. 現状の課題と変更方針
- **現状の課題**:
  - 全リール停止時、ハズレ（`miss`）の場合は即座に `isSlotSpinning = false` となり、次フレーム（0秒）で直ちに次の保留が回転し始めてしまい、停止した出目を確認する余韻がなかった。
  - また、当選時もフラッシュ時間（1.2秒）と連動しており、リール停止後の余韻時間が一貫していなかった。
- **変更方針**:
  - `src/game.ts` に `slotRestartCooldown: number = 0` を追加。
  - リールが全停止した瞬間（右リール停止時）に、ハズレ・当選を問わず `this.slotRestartCooldown = 0.6`（0.6秒）を設定。
  - `updateSlot(dtSec)` 内で毎フレーム `slotRestartCooldown` を減算し、`this.slotHoldCount > 0 && this.slotRestartCooldown <= 0` になった段階で自動的に次の保留スピン（`startSlotSpin()`）を開始する。
  - HOTポケット入賞時の即時始動判定も `!this.isSlotSpinning && this.slotRestartCooldown <= 0` とし、直前のリール停止から0.6秒以内の場合はクールダウン終了まで待機してから回転を開始する。

## 3. 修正対象ファイル
- `src/game.ts`: `slotRestartCooldown` の追加、全リール停止時の0.6秒設定、再始動待機判定の実装
- `for_agent/SPECIFICATION.md`: 第118版改訂内容の追記
- `AICHANGELOG.md`: 変更履歴の記録
- `task.md`, `implementation_plan.md`, `walkthrough.md`: 成果物の更新

## 4. 検証手順
1. `npx tsc --noEmit` & `npm run build` による型チェックとビルド正常確認。
2. スクリプト・ブラウザによるスロット動作検証（リール停止後0.6秒空いてから次が回ることを確認）。
