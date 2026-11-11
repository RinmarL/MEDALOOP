# ウォークスルー (walkthrough.md) — 第95版

通常メダル限定・スキルツリー取得非依存の上級刻印4種（**🦋ペガサス・🎲フォルトゥナ・🎯ケンタウルス・🔄アルタイル**）の追加と、初級刻印 **☄️コメット** のリワークを実施しました。

## 主な変更点
- [types.ts](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/types.ts):
  - [`MedalEntity`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/types.ts#L15) に `boardElapsedSec` と `pinBounceCount` を追加。
  - [`RUNE_DEFINITIONS`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/types.ts#L200) の `comet` を「反発係数 -15% ＆ 落下速度 +15%」へ更新し、上級4種（`pegasus`, `fortuna`, `centaurus`, `altair`）と案D準拠SVGアイコンを [`getRuneSvgIcon`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/types.ts#L287) に実装。
- [physics.ts](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/physics.ts):
  - [`stepPhysics`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/physics.ts#L491) にて通常メダルの重力・終端落下速度へコメット(`+15%`)・ケンタウルス(`+20%`)を適用し、`boardElapsedSec` を積算。
  - [`resolveBoardConstraints`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/physics.ts#L839) でコメットの壁・ピン反発倍率を `0.85` へ変更し、ピン・バンパー衝突ごとに `pinBounceCount` を加算。
- [game.ts](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/game.ts):
  - [`syncEngravingStats`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/game.ts#L748) で刻印状態の同期を集約し、[`handlePocketPass`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/game.ts#L1959) にて上級4種の倍率乗算および入賞テキスト演出を実装。
- [skillTree.ts](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/skillTree.ts) ＆ [style.css](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/style.css):
  - `engraving_adv` ノード説明文の更新、および全10種・装備中バッジ付帯時もカード説明が1行に収まるよう余白を調整。

## 検証結果
- **型チェック＆ビルド**: `npx tsc --noEmit` ＆ `npm run build`（Vite）エラー 0 件で成功。
- **実機ブラウザ検証（Chromeヘッドレス）**:
  - 中級開放時は上級4種が `？？？` ロック状態、全開放時は全10種選択・2枠装着（例：`ペガサス`＋`アルタイル`）・極細金色スクロールバーで1行崩れなく収まることを確認。
  - コメット＋ケンタウルス併用時の通常メダル落下終端速度 (`normVyBoth: 671` vs 特殊メダル `goldVyBoth: 496`)、コメット壁反発 (`96.25`)、ケンタウルス2秒境界 (`14` vs `10` PT)、ペガサス10回上限 (`11` / `14` PT)、アルタイル別穴連鎖＆特殊メダル挟み維持＆同穴リセット (`[10, 11, 10, 12, 10, 11]`)、フォルトゥナ3段階抽選分布 (`+5%:96 / +25%:77 / +100%:27 / other:0`) がすべて正常に動作することを確認済み。
