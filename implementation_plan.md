# 実装計画書 (implementation_plan.md) — 第72版

## タスク概要
- **目的**: 
  1. ブラックホール（ノード、盤面物理、描画、サウンド）の完全削除。
  2. ポイントのインフレ幅が大きいノードの調査とランキング作成。

## 変更対象ファイル
- `src/types.ts`: `CyberBlackHole`, `blackHoleUnlocked` 削除
- `src/skillTree.ts`: `black_hole` ノード、statsプロパティ、neighbors 削除
- `src/physics.ts`: ブラックホール物理演算・コールバック削除
- `src/game.ts`: 描画呼び出し、`drawBlackHole` 実装削除
- `src/sound.ts`: `playBlackHoleEject` 削除
- `for_agent/SPECIFICATION.md`: 第72版仕様更新
- `AICHANGELOG.md`: 変更記録
- `task.md`, `Plan.md`, `walkthrough.md`: 同期更新

## 検証結果
- `npx tsc --noEmit`: エラー0件で完全合格。
- `npm run build`: 248msで本番ビルド完了。
- ヘッドレス実機キャプチャ（`shot_tree_after_remove.png`）:
  - スキルツリー第4円 -30° のブラックホールノードが完全削除され、ワープホール（`star_1`）が単独終端ノードへ戻ったことを確認。
- インフレ幅シミュレーション（`run_fast_ranking.js`）:
  - 投下短縮MAX（x4.1倍）、ポケット倍率II（x3.8倍）、スプリットレーザー（x2.9倍）、バウンスメダル（x2.7倍）、ストラグル（x2.2倍）のランキング結果を完全集計。
  - フルシナジー時の掛け算乗算（x105.3倍 / 408,255 PT）のインフレ爆発構造を解明。
