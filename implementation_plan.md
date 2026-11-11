# 実装計画書 (implementation_plan.md) — 第98版

上部1列目（`y=175`, 50px間隔）での3枚ピラミッドアーチ永久スタック（`+2` 微振動平衡）を解消するため、[types.ts](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/types.ts) と [physics.ts](file:///c:/Users/SHOOO/ドキュメント/Develop/MEDAL/src/physics.ts) に対し、①ピン頭頂滑落の真上低速限定＆位置ワープ撤廃、②`resolveMedalPair` の三角形角度（`|nx| < 0.72`）対応＆符号修正、③上部1列目ピンの `±6px` 千鳥チルト配置、④XY滞留ベースの安全弁を実装し、実コードビルド＆Chromeヘッドレス検証を完了しました。
