# 実装計画書 (Plan.md) — 第107版（プリズム名称変更 ＆ リザルト画面整理）

## 1. 実装目標（ユーザー指定仕様）
1. **名称統一（「プリズム・ターゲット」→「プリズム」）**
   - [src/skillTree.ts](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/skillTree.ts) の `prism_target` 表示名・効果プレビュー表記および [for_agent/SPECIFICATION.md](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/for_agent/SPECIFICATION.md) の表記を「**プリズム**」に統一する。
2. **リザルト画面整理（自己ベスト通知・アニメーション・直近比較の撤去／それまでの自己ベスト表示）**
   - [index.html](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/index.html) / [src/style.css](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/style.css) / [src/game.ts](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/game.ts)
   - `🏆 NEW RECORD!` 通知・`.is-new` パルスアニメ・`.is-new-record` 枠光彩・獲得PTカウントアップアニメ・直近平均比較（`#res-avg-badge`）を撤去し、獲得スコアを即時確定表示する。
   - 更新前の自己ベスト値を `それまでの自己ベスト: X PT` として `#res-record-badge` にシンプルに表示する（内部記録 `bestRoundScore` は従来通り最大値で保存）。

## 2. 変更完了ファイル
- `src/skillTree.ts`, `index.html`, `src/style.css`, `src/game.ts`, `for_agent/SPECIFICATION.md`, `AICHANGELOG.md`

## 3. 検証結果
- `npx tsc --noEmit` / `npm run build` 成功。
- `verify_v105.cjs` 単体＆実機ヘッドレスChrome（`480x820`）で `プリズム` 表示・即時確定リザルト表示・コンソールエラー `0` 件を確認。
