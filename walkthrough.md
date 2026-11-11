# ウォークスルー (walkthrough.md) — 第98版

ユーザー報告の上部ピン間における「3枚ピラミッドアーチ」スタックの原因を再現実験で特定し、物理演算およびピン配置の根本改修を実施しました。

## 変更内容 ([types.ts](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/types.ts), [physics.ts](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/physics.ts))
- **上部1列目ピンの `±6px` 千鳥チルト化** ([`setupBoard`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/physics.ts#L118)): `y = 175` 横一列から `169 / 181 / 169 / 181 / 169` へ交互高低差を設け、左右対称な組石ロック成立を阻止。
- **ピン頭頂部滑落の内向き締め付け解消** ([`resolveBoardConstraints`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/physics.ts#L879)): 発動範囲を真上低速（`ny < -0.78 && speed < 120`）に限定し、斜め側面接触時の強制 `0.35px` 内側シフトを廃止。
- **メダル間ピラミッド崩し拡張・バグ修正** ([`resolveMedalPair`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/physics.ts#L723)): 60°組石角度を捕捉できるよう `|nx| < 0.72` へ広げ、`upper/lower` を明確に左右別方向へ分離。低速水平膠着時の高さズレ付与も追加。
- **XY滞留ベースの脱出安全弁** ([`MedalEntity`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/types.ts#L15), [`stepPhysics`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/physics.ts#L495)): 盤面で半径 `16px` 超の移動または下方 `12px` 進行がなく `0.65〜0.89s` 停滞したメダルのみ脱出インパルスを発動（通常プレイでは1ゲーム平均 `0.4〜0.5回` のみ作動し、自然挙動を維持）。

## 検証結果
- **型チェック＆本番ビルド**: `npx tsc --noEmit` ＆ `npm run build` エラー0件（PASS）。
- **実コードChromeヘッドレス検証**:
  - 再現ピラミッド40回×3環境（通常 / コメット / コメ×ケンタ）計120ケース：**全120ケース即時崩落（スタック 0件 / 最長 `0.65〜0.85秒`）**。
  - 集中40枚連射60ゲーム（計2,400枚）：カタパルトOFF時 **残留 0件**、カタパルトON時のワープ中残余も追加3秒流動で **`leftoverAfterDrain: 0`（スタック0件）** を確認。
  - 上部チルトピン配置を含む盤面スクリーンショットで自然な外観を確認済み。
