# 実装計画書 (Plan.md) — メダルタップ時重さ解消 ＆ 各メダル固有タップ演出（電撃等）の実装

## 1. 今回のタスクの目的
1. **「ここでクリックしたときの挙動が重い原因は何？」への回答と解消**:
   - 原因: 跳ねの重力加速度が `520 px/s²` と月面並みに低く設定されており、滞空時間（0.52秒）が長すぎて「フワ〜ッともっさり浮く」ため。さらにバウンド閾値のせいで着地時に1ミリも弾まず泥のようにベタッと止まっていた。
   - 改善: 重力加速度を `2200〜3600 px/s²`（約4〜7倍）に引き上げ、初速と反発係数をメダルごとに最適化。タップした瞬間に「パチンッ！」と俊敏に弾む小気味よいキレを実現。
2. **各特殊メダルごとの固有タップ挙動＆エフェクト・専用サウンドの実装**:
   - **通常メダル**: 5枚スタックがカチャチャチャッと時間差で波打つウェーブジャンプ ＆ 小気味よいコイン音。
   - **ラッシュメダル**: 2倍速の超俊敏ハイスピードジャンプ ＆ シアンの疾風・風リングエフェクト。
   - **バウンスメダル**: ぷるぷる楕円伸縮（スカッシュ＆ストレッチ）＆ 3連続「ボヨヨ〜ン」高反発バウンド・ピンク波紋。
   - **ゴールドメダル**: 黄金フラッシュ ＆ キラキラ輝くゴールド星屑・スパークル散布・高音チャイム。
   - **プラズマメダル**: ユーザー提案！紫＆水色のギザギザ稲妻（電撃アーク）が周囲や隣接メダルへバチバチ走り、コイン自身も高速ビリビリ振動・電撃クラックル音。
   - **クロノメダル**: 時計の文字盤・ギアサークルが浮かび上がり、空中タイムストップ浮遊 ＆ スピン着地。

---

## 2. 進行ステップ（全完了）
- **ステップ1**:
  - `Plan.md`, `task.md`, `implementation_plan.md` の策定。
- **ステップ2**:
  - `src/sound.ts`: 電撃音（`playElectricSpark`）、時計音（`playTimeTick`）の新設。
  - `src/game.ts`: ショーケースのエフェクトシステム（パーティクル・稲妻アーク・時計ギア・スカッシュ＆ストレッチ）の実装と、メダルごとの固有物理・SEトリガー。
- **ステップ3**:
  - 本番ビルド（`npm run build`）確認・成功。
  - 実機キャプチャ（`shot_showcase_plasma_lightning.png`, `shot_showcase_gold_sparkle.png`, `shot_showcase_chrono_gear.png`）の視覚検証完了。
  - 仕様書（`for_agent/SPECIFICATION.md` 第56版）、`AICHANGELOG.md`、`task.md`、`walkthrough.md` の同期完了。

---

## 3. 対象ファイル
- [`src/sound.ts`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/sound.ts)
- [`src/game.ts`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/game.ts)
- [`for_agent/SPECIFICATION.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/for_agent/SPECIFICATION.md)
- [`AICHANGELOG.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/AICHANGELOG.md)
- [`Plan.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/Plan.md)
- [`task.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/task.md)
- [`implementation_plan.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/implementation_plan.md)
- [`walkthrough.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/walkthrough.md)
