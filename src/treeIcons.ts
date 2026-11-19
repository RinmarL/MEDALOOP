import { TreeIconId } from './types';

/**
 * スキルツリーノード用 天体SVGベクター紋章ライブラリ（viewBox="0 0 24 24"）
 *
 * 【今後ノードを追加する際の共通ルール】
 * 1. 絵文字は使用禁止。必ず `TreeIconId` に追加して単色SVGパスで定義する。
 * 2. 座標系は `viewBox="0 0 24 24"`、パディング 2.5〜3.0 を確保し円形ノード内でバランスよく収める。
 * 3. 色は `currentColor` のみを使用（ノード状態：MAX金・途中青・未取得グレーに自動連動する）。
 * 4. 線の太さは `1.5〜2.0`、`stroke-linecap="round"` / `stroke-linejoin="round"` を基本とし、
 *    機能モチーフ（砂時計・渦・矢印・歯車など）に天体意匠（4点星・星粒・軌道リング・六芒星）を掛け合わせる。
 */

export type TreeIconTone = 'max' | 'active' | 'locked';

const TONE_COLOR_MAP: Record<TreeIconTone, string> = {
  max: '#451a03', // MAX（シャンパンゴールド背景）にくっきり映えるディープアンバー
  active: '#ffffff', // 強化途中（サファイア青）＆強化可能（ピンク枠）に映える純白
  locked: 'rgba(241, 245, 249, 0.84)', // 未取得（スレートグレー）に調和する銀灰
};

export const TREE_ICON_SVG_INNER: Record<TreeIconId, string> = {
  // 中央スロット：六芒星・星核
  hexagram:
    '<path d="M12 2.5 L20 16.5 L4 16.5 Z M12 21.5 L4 7.5 L20 7.5 Z" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>',

  // 投下間隔短縮 I〜III：流星・降下星矢
  meteor_speed:
    '<path d="M16.5 3.5 L10 11.5 L14.2 11.5 L7.5 20.5 L15.8 12.2 L12.2 12.2 Z" fill="currentColor"/><path d="M5.5 7 L6.3 8.8 L8 9.5 L6.3 10.2 L5.5 12 L4.7 10.2 L3 9.5 L4.7 8.8 Z" fill="currentColor"/><circle cx="18.5" cy="15.5" r="1.15" fill="currentColor"/>',

  // 制限時間延長 I〜III：天体砂時計
  hourglass:
    '<path d="M6.5 3.5 H17.5 M6.5 20.5 H17.5 M7.5 3.5 C7.5 8.5 11.2 10.2 12 12 C12.8 10.2 16.5 8.5 16.5 3.5 M7.5 20.5 C7.5 15.5 11.2 13.8 12 12 C12.8 13.8 16.5 15.5 16.5 20.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 18.5 L12 15.5 L14 18.5 Z" fill="currentColor"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/>',

  // メダル基礎点 I：星結晶ダイヤ
  crystal:
    '<path d="M12 3 L19 10 L12 21 L5 10 Z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M5 10 H19 M12 3 L9.5 10 L12 21 L14.5 10 Z" fill="none" stroke="currentColor" stroke-width="1.15" opacity="0.85"/><circle cx="12" cy="10" r="1.5" fill="currentColor"/>',

  // ストラグル：極限双晶星結晶（外周星芒付きダイヤ）
  struggle_star:
    '<path d="M12 3.5 L17.8 10.5 L12 20.5 L6.2 10.5 Z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M12 7.2 L13 10 L15.8 11 L13 12 L12 14.8 L11 12 L8.2 11 L11 10 Z" fill="currentColor"/><path d="M4.5 5.5 L5.2 7.2 L6.9 7.9 L5.2 8.6 L4.5 10.3 L3.8 8.6 L2.1 7.9 L3.8 7.2 Z" fill="currentColor"/><circle cx="19.5" cy="7" r="1.2" fill="currentColor"/>',

  // バンパー基礎点 I・II：天球衝撃ターゲット
  orbit_target:
    '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3.2 2.2"/><circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',

  // ダブルバウンド：二重星環クラウン衝撃
  double_bound:
    '<circle cx="12" cy="13.5" r="6.2" fill="none" stroke="currentColor" stroke-width="1.65"/><circle cx="12" cy="13.5" r="2.8" fill="currentColor"/><path d="M6.5 7.5 L8.5 4.2 L12 6.8 L15.5 4.2 L17.5 7.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="3.2" r="1.1" fill="currentColor"/>',

  // 回収範囲拡大：三日月引力
  gravity_crescent:
    '<path d="M6.5 7.5 A6.5 6.5 0 1 0 17.5 7.5" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><path d="M6.5 5 V8.5 M17.5 5 V8.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 4.5 L12.9 7 L15.4 7.9 L12.9 8.8 L12 11.3 L11.1 8.8 L8.6 7.9 L11.1 7 Z" fill="currentColor"/>',

  // ラッシュメダル：彗星ダッシュ
  comet_rush:
    '<path d="M19.5 5.5 L11 11.5 L14 13.5 Z" fill="currentColor" opacity="0.55"/><path d="M19.5 5.5 L9.5 14.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M14.5 4.5 L7.5 10.5 M19.5 10.5 L13.5 16.5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/><circle cx="8" cy="16" r="3.4" fill="currentColor"/><circle cx="8" cy="16" r="5.3" fill="none" stroke="currentColor" stroke-width="1.1" opacity="0.7"/>',

  // バウンスメダル：跳躍軌道星
  bounce_star:
    '<path d="M4 17 Q8 6 12 15 Q16 7 20 12" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M12 3.5 L12.9 6.1 L15.5 7 L12.9 7.9 L12 10.5 L11.1 7.9 L8.5 7 L11.1 6.1 Z" fill="currentColor"/><circle cx="20" cy="12" r="2.2" fill="currentColor"/>',

  // ゴールドメダル：太陽金貨
  solar_coin:
    '<circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/><path d="M12 5.2 V7.2 M12 16.8 V18.8 M5.2 12 H7.2 M16.8 12 H18.8 M7.2 7.2 L8.7 8.7 M15.3 15.3 L16.8 16.8 M16.8 7.2 L15.3 8.7 M8.7 15.3 L7.2 16.8" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>',

  // プラズマメダル：雷電プラズマ星球
  plasma_orb:
    '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 6.2 L9.5 12 H12.6 L11 17.8 L14.8 11.8 H11.8 Z" fill="currentColor"/><path d="M4.5 6.5 L6.2 7.5 M19.5 17.5 L17.8 16.5 M19.5 6.5 L17.8 7.5 M4.5 17.5 L6.2 16.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',

  // クロノメダル：時の星冠
  chrono_crown:
    '<circle cx="12" cy="13.5" r="6.4" fill="none" stroke="currentColor" stroke-width="1.65"/><path d="M12 10 V13.6 L14.6 15.2" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 6.8 L9.3 3.8 L12 6 L14.7 3.8 L16.5 6.8" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>',

  // JPロングフリーズ：氷晶六花星
  frost_star:
    '<path d="M12 2.8 V21.2 M4 7.4 L20 16.6 M20 7.4 L4 16.6" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/><path d="M10 5 L12 6.8 L14 5 M10 19 L12 17.2 L14 19 M6.2 10.6 L7.5 9.4 L6.8 7.5 M17.8 13.4 L16.5 14.6 L17.2 16.5" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/><circle cx="12" cy="12" r="2.1" fill="currentColor"/>',

  // JP特殊確率 I・II：三連星・運命星
  jp_star_reel:
    '<path d="M12 4.5 L13.1 8 L16.6 9.1 L13.1 10.2 L12 13.7 L10.9 10.2 L7.4 9.1 L10.9 8 Z" fill="currentColor"/><path d="M6.5 13 L7.2 15.1 L9.3 15.8 L7.2 16.5 L6.5 18.6 L5.8 16.5 L3.7 15.8 L5.8 15.1 Z" fill="currentColor"/><path d="M17.5 13 L18.2 15.1 L20.3 15.8 L18.2 16.5 L17.5 18.6 L16.8 16.5 L14.7 15.8 L16.8 15.1 Z" fill="currentColor"/><path d="M5 20.2 H19" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.75"/>',

  // JP枚数増加 I〜III：流星雨・重ね星貨
  starfall_coins:
    '<circle cx="9.2" cy="14.5" r="4.8" fill="none" stroke="currentColor" stroke-width="1.65"/><circle cx="9.2" cy="14.5" r="1.6" fill="currentColor"/><path d="M12.6 10.4 A4.8 4.8 0 1 1 14 18.6" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/><path d="M15.5 3.5 L16.3 5.8 L18.6 6.6 L16.3 7.4 L15.5 9.7 L14.7 7.4 L12.4 6.6 L14.7 5.8 Z" fill="currentColor"/><circle cx="7" cy="6.5" r="1.15" fill="currentColor"/>',

  // JPフィーバー！：太陽フレア・超新星
  supernova_flame:
    '<path d="M12 2.8 C14.5 6.2 18 8.2 18 13 A6 6 0 1 1 6 13 C6 10.2 7.8 8.2 9.4 6.5 C9.2 8.4 10.2 9.4 10.8 9.6 C10.4 7.2 10.8 4.8 12 2.8 Z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M12 10.2 L13 13 L15.8 14 L13 15 L12 17.8 L11 15 L8.2 14 L11 13 Z" fill="currentColor"/>',

  // ホットスロット：星図3連窓
  astral_slot:
    '<rect x="3" y="6.5" width="18" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.65"/><path d="M9 6.5 V17.5 M15 6.5 V17.5" stroke="currentColor" stroke-width="1.2" opacity="0.75"/><path d="M12 9 L12.7 11.2 L14.9 12 L12.7 12.8 L12 15 L11.3 12.8 L9.1 12 L11.3 11.2 Z" fill="currentColor"/><circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>',

  // スプリットライン：星光線スプリット分岐
  beam_split:
    '<path d="M12 3.5 V10.5 L6 19.5 M12 10.5 L18 19.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7.2 L13.1 9.9 L15.8 11 L13.1 12.1 L12 14.8 L10.9 12.1 L8.2 11 L10.9 9.9 Z" fill="currentColor"/><circle cx="6" cy="19.5" r="1.6" fill="currentColor"/><circle cx="18" cy="19.5" r="1.6" fill="currentColor"/>',

  // ワープホール：銀河渦・ワームホール
  galaxy_vortex:
    '<path d="M12 12 C12 9 15.5 8 17 10.5 C19 14 15.5 19.5 10.5 19 C5.5 18.5 3.5 13 5.5 8.5 C7 5 11.5 3.8 15.5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="18.5" cy="6.5" r="1.15" fill="currentColor"/>',

  // スターフォール：きらめく流星群
  starfall_meteor:
    '<path d="M19.5 4.5 L10.5 13.5 M15.2 4.2 L10.5 8.9 M19.8 8.8 L15.1 13.5" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/><path d="M8.8 11 L10.1 14.1 L13.2 15.4 L10.1 16.7 L8.8 19.8 L7.5 16.7 L4.4 15.4 L7.5 14.1 Z" fill="currentColor"/><circle cx="17.8" cy="15.8" r="1.1" fill="currentColor"/><circle cx="7.2" cy="7.2" r="1.0" fill="currentColor"/>',

  // 長押し投下：連続降下星流
  stream_down:
    '<path d="M7.5 8.5 L12 13 L16.5 8.5 M7.5 14 L12 18.5 L16.5 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="5.2" r="1.6" fill="currentColor"/>',

  // ブーストオーブ：公転惑星オーブ
  boost_orb:
    '<circle cx="12" cy="12" r="4.5" fill="currentColor"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(-26 12 12)" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="19.2" cy="8.5" r="1.4" fill="currentColor"/>',

  // ポケット倍率 I・II：星受け皿・星座杯
  pocket_mult:
    '<path d="M4.5 12.5 L6.5 18.5 H17.5 L19.5 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 4.5 L13.1 8.4 L17 9.5 L13.1 10.6 L12 14.5 L10.9 10.6 L7 9.5 L10.9 8.4 Z" fill="currentColor"/>',

  // クローンオーブ：双子星・連星分裂オーブ
  binary_orbs:
    '<circle cx="8" cy="14" r="3.8" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="8" cy="14" r="1.4" fill="currentColor"/><circle cx="16" cy="10" r="3.8" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="16" cy="10" r="1.4" fill="currentColor"/><path d="M5.5 8.5 Q12 4.5 18.5 15.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.5 2.2" stroke-linecap="round"/>',

  // プリズム：六角星晶プリズム
  star_prism:
    '<polygon points="12,2.8 20,7.5 20,16.5 12,21.2 4,16.5 4,7.5" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/><path d="M12 2.8 L12 21.2 M4 7.5 L20 16.5 M20 7.5 L4 16.5" stroke="currentColor" stroke-width="0.95" opacity="0.55"/><path d="M12 8.2 L13.1 10.9 L15.8 12 L13.1 13.1 L12 15.8 L10.9 13.1 L8.2 12 L10.9 10.9 Z" fill="currentColor"/>',

  // 接触強化Ⅰ：星座連鎖スパーク
  star_chain:
    '<circle cx="6.5" cy="16.5" r="2.6" fill="currentColor"/><circle cx="17.5" cy="7.5" r="2.6" fill="currentColor"/><path d="M8.5 14.5 L11.8 11 L13 13 L15.5 9.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="16.5" r="1.2" fill="currentColor"/>',

  // 接触強化Ⅱ：高圧星雷・三点星座スパーク
  star_storm:
    '<circle cx="5.5" cy="17.5" r="2.1" fill="currentColor"/><circle cx="18.5" cy="17.5" r="2.1" fill="currentColor"/><circle cx="12" cy="5.5" r="2.3" fill="currentColor"/><path d="M12 7.8 L9.5 12 L12.8 12 L10.6 16.5 M12 7.8 L17.2 15.8 M7.4 17.5 H16.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',

  // 長押し装填：連続上昇星流
  stream_up:
    '<path d="M7.5 15.5 L12 11 L16.5 15.5 M7.5 10 L12 5.5 L16.5 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="18.8" r="1.6" fill="currentColor"/>',

  // 装填枚数増加：星層チャージ
  star_stack:
    '<path d="M5.5 16.5 L12 19.5 L18.5 16.5 M5.5 12.8 L12 15.8 L18.5 12.8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 4 L13.1 7.4 L16.5 8.5 L13.1 9.6 L12 13 L10.9 9.6 L7.5 8.5 L10.9 7.4 Z" fill="currentColor"/>',

  // 装填速度増加 I・II：高速上昇軌道
  swift_orbit_up:
    '<path d="M12 19 V5.5 M8 9.5 L12 5.5 L16 9.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 15.5 A7 7 0 0 1 8 7.5 M18.5 15.5 A7 7 0 0 0 16 7.5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" opacity="0.75"/><circle cx="12" cy="19.5" r="1.5" fill="currentColor"/>',

  // 装填自動化：天文時計歯車
  astrolabe_gear:
    '<circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3.2 V5.6 M12 18.4 V20.8 M3.2 12 H5.6 M18.4 12 H20.8 M5.8 5.8 L7.5 7.5 M16.5 16.5 L18.2 18.2 M18.2 5.8 L16.5 7.5 M7.5 16.5 L5.8 18.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 9.2 L12.8 11.2 L14.8 12 L12.8 12.8 L12 14.8 L11.2 12.8 L9.2 12 L11.2 11.2 Z" fill="currentColor"/>',

  // 刻印開放：4点星紋章
  engraving_star:
    '<path d="M12 2.5 Q12.8 11.2 21.5 12 Q12.8 12.8 12 21.5 Q11.2 12.8 2.5 12 Q11.2 11.2 12 2.5 Z" fill="currentColor"/><circle cx="17.8" cy="6.2" r="1.2" fill="currentColor"/><circle cx="6.2" cy="17.8" r="1.2" fill="currentColor"/>',

  // 中級刻印開放：8点星環紋章
  engraving_octa:
    '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.25" stroke-dasharray="2.5 2.2"/><path d="M12 3 L13.4 10.6 L21 12 L13.4 13.4 L12 21 L10.6 13.4 L3 12 L10.6 10.6 Z" fill="currentColor"/><path d="M6.8 6.8 L10.5 10.5 M17.2 17.2 L13.5 13.5 M17.2 6.8 L13.5 10.5 M6.8 17.2 L10.5 13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',

  // スロット2枠目開放：双星二連紋章
  engraving_twin:
    '<path d="M8.5 5.5 L12.5 12 L8.5 18.5 L4.5 12 Z" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/><path d="M15.5 5.5 L19.5 12 L15.5 18.5 L11.5 12 Z" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/><circle cx="8.5" cy="12" r="1.4" fill="currentColor"/><circle cx="15.5" cy="12" r="1.4" fill="currentColor"/>',

  // 上級刻印開放：黄道十二宮・日蝕星冠
  engraving_zodiac:
    '<circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.7"/><path d="M12 5.2 L13.1 10.9 L18.8 12 L13.1 13.1 L12 18.8 L10.9 13.1 L5.2 12 L10.9 10.9 Z" fill="currentColor"/><circle cx="12" cy="3.8" r="1.2" fill="currentColor"/><circle cx="12" cy="20.2" r="1.2" fill="currentColor"/>',

  // 連続回収：星すくい弧
  gather_sweep:
    '<path d="M4.5 13.5 C6 18.5 14 20 19 15.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M15.8 14.5 L19.4 15.2 L18.2 18.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 5 L11.4 7.6 L14 8.5 L11.4 9.4 L10.5 12 L9.6 9.4 L7 8.5 L9.6 7.6 Z" fill="currentColor"/><circle cx="16.5" cy="7.5" r="1.4" fill="currentColor"/>',

  // 回収枚数増加：星団収束
  cluster_gather:
    '<path d="M12 5 L12.9 7.5 L15.4 8.4 L12.9 9.3 L12 11.8 L11.1 9.3 L8.6 8.4 L11.1 7.5 Z" fill="currentColor"/><circle cx="6.8" cy="12.5" r="1.9" fill="currentColor"/><circle cx="17.2" cy="12.5" r="1.9" fill="currentColor"/><path d="M5.5 16.5 Q12 20.5 18.5 16.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',

  // 回収速度増加 I・II：高速収束軌道
  swift_orbit_in:
    '<circle cx="12" cy="12" r="2.8" fill="currentColor"/><path d="M4.5 7.5 L9 10.2 M19.5 7.5 L15 10.2 M12 20.5 V15.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6.8 6.4 L9.2 10.3 L5.2 10.6 M17.2 6.4 L14.8 10.3 L18.8 10.6" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>',
};

const iconImageCache = new Map<string, HTMLImageElement>();

function getOrCreateIconImage(iconId: TreeIconId, tone: TreeIconTone): HTMLImageElement {
  const key = `${iconId}:${tone}`;
  const cached = iconImageCache.get(key);
  if (cached) return cached;

  const color = TONE_COLOR_MAP[tone];
  const inner = (TREE_ICON_SVG_INNER[iconId] || TREE_ICON_SVG_INNER.hexagram).replace(
    /currentColor/g,
    color
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">${inner}</svg>`;

  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  iconImageCache.set(key, img);
  return img;
}

/**
 * 全天体SVGアイコンを3トーン分プリロードしておく（初回ツリー表示時のチラつき防止）
 */
export function preloadTreeIcons(): void {
  const tones: TreeIconTone[] = ['max', 'active', 'locked'];
  const ids = Object.keys(TREE_ICON_SVG_INNER) as TreeIconId[];
  for (const id of ids) {
    for (const tone of tones) {
      getOrCreateIconImage(id, tone);
    }
  }
}

/**
 * Canvas 2D上に天体SVGアイコンを描画する
 */
export function drawTreeIcon(
  ctx: CanvasRenderingContext2D,
  iconId: TreeIconId,
  tone: TreeIconTone,
  cx: number,
  cy: number,
  size: number
): void {
  const img = getOrCreateIconImage(iconId, tone);
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, cx - size * 0.5, cy - size * 0.5, size, size);
  }
}
