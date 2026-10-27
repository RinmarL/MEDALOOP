# 実装計画書 (Plan.md) — メダル開放ラインのT字分岐（バウンス直下にゴールド、左右にプラズマ・クロノ）再編

## 1. 今回のタスクの目的
メダル開放ライン（下部・6時方向）のノード配置を、一筆書き円弧から **美しいT字分岐（アンカー型）** へ再編する。
1. **バウンス直下にゴールド配置**:
   - `medal_1`（ラッシュ / 第2円 90°） → `medal_2`（バウンス / 第3円 90°） → **`medal_3`（ゴールド / 第4円 90°）** と垂直に真っ直ぐ直進配置。
2. **ゴールドから左右にプラズマとクロノを2分岐配置**:
   - ゴールド（第4円 90°）を親ノードとして、左右のノードへ分岐：
     - 左側: **`star_3`（プラズマ / 第4円 108°）**（580 PT）
     - 右側: **`medal_5`（クロノ / 第4円 72°）**（920 PT）
   - クロノの方が要求PTが高いため、プレイヤーは必然的にプラズマから順次取得する自然なゲーム進行となる。

---

## 2. 進行ステップ（全完了）
- **ステップ1**:
  - `Plan.md`, `task.md`, `implementation_plan.md` の策定完了。
- **ステップ2**:
  - `src/skillTree.ts`: `medal_3`（第4円 90°）、`star_3`（第4円 108°）、`medal_5`（第4円 72°）の座標と `neighbors` の更新完了。
- **ステップ3**:
  - `npx tsc --noEmit` 型チェック完了（エラーなし）。
  - `npm run build` 本番ビルド完了。
  - 実機キャプチャ（`shot_tree_medal_t_branch.png`）の視覚検証完了。
  - 仕様書（`for_agent/SPECIFICATION.md` 第62版）、`AICHANGELOG.md`、`task.md`、`walkthrough.md` の同期完了。

---

## 3. 対象ファイル
- [`src/skillTree.ts`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/skillTree.ts)
- [`for_agent/SPECIFICATION.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/for_agent/SPECIFICATION.md)
- [`AICHANGELOG.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/AICHANGELOG.md)
- [`Plan.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/Plan.md)
- [`task.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/task.md)
- [`implementation_plan.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/implementation_plan.md)
- [`walkthrough.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/walkthrough.md)
