# 実装計画書 (implementation_plan.md) — 接触倍率の5段階ビジュアル可視化

## 1. 概要
接触・帯電・オーブ・ワープ等によって上昇するメダルの倍率（`chargeMultiplier`）を盤面上で直感的に把握できるよう、メダル本体の色（種別識別）を維持したまま、**外枠ネオンリング・外周オーラ・落下軌跡（トレイル）**を5段階で視覚進化させます。

---

## 2. ビジュアル仕様

| ティア | 倍率 (`chargeMultiplier`) | テーマ色 | 外枠・オーラ演出 | 落下軌跡 (Trail) |
| :---: | :--- | :--- | :--- | :--- |
| 0 | `〜 x1.99` | 通常（固有色） | `st.rim`（`lineWidth: 2.2`）、控えめ発光 | メダル固有色 (`st.trail`) |
| 1 | `x2.00 〜 x2.99` | **シアン（青）** | 太ネオン青枠 (`#00f2fe` / `#38bdf8`, `3.0px`) ＋ 外周ソフト青オーラ | シアン発光軌跡 |
| 2 | `x3.00 〜 x4.49` | **エメラルド（緑）** | 太ネオン緑枠 (`#34d399` / `#10b981`, `3.2px`) ＋ 内芯ハイライト ＋ 強緑オーラ | エメラルド発光軌跡 |
| 3 | `x4.50 〜 x5.99` | **クリムゾン（赤）** | 灼熱赤枠 (`#f43f5e` / `#fb7185`, `3.5px`) ＋ 脈動する二重赤リング ＋ 炎オーラ | クリムゾン赤炎軌跡 |
| 4 | `x6.00 〜` | **レインボー（虹）** | 時間回転する360°虹色コニックグラデーション枠 (`3.8px`) ＋ プリズム二重光輪 ＋ 対角2点周回星光 | セグメント色相遷移の虹軌跡 |

### 視認性向上の工夫
- **ダークセパレーター**: Tier 1 以上では本体塗りつぶしとネオン外枠の境界に極細の暗色リング（`rgba(2, 6, 23, 0.72)`）を挟み、青メダル×青枠や赤メダル×赤枠でも外枠が同化せず鮮明に際立つようにする。
- **中央倍率テキストの強化**: ダークアウトライン（`strokeText`）＋高コントラスト白文字を適用し、2桁倍率（`×10.0`〜`×16.0`）でも枠内に綺麗に収まるフォントサイズ調整を行う。

---

## 3. 対象ファイル
- [`src/game.ts`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/game.ts)
- [`for_agent/SPECIFICATION.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/for_agent/SPECIFICATION.md)
- [`AICHANGELOG.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/AICHANGELOG.md)
- [`Plan.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/Plan.md), [`task.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/task.md), [`walkthrough.md`](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/walkthrough.md)
