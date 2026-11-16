// scratch/verify_v116.ts
import { SKILL_NODES, SkillTreeState, getNodeEffectPreview } from '../src/skillTree';

console.log('=== 1. スロット抽選確率 100,000回シミュレーション ===');
function rollSlotTarget(): string {
  const roll = Math.random() * 100;
  if (roll < 2.0) return '7';
  if (roll < 7.0) return 'dia';
  if (roll < 13.0) return 'clock';
  if (roll < 20.0) return 'auto';
  if (roll < 40.0) return 'bell';
  return 'miss';
}

const counts: Record<string, number> = { miss: 0, bell: 0, auto: 0, clock: 0, dia: 0, '7': 0 };
const N = 100000;
for (let i = 0; i < N; i++) {
  const sym = rollSlotTarget();
  counts[sym]++;
}

console.log(`ハズレ (目標 60.0%): ${(counts.miss / N * 100).toFixed(2)}% (${counts.miss})`);
console.log(`ベル   (目標 20.0%): ${(counts.bell / N * 100).toFixed(2)}% (${counts.bell})`);
console.log(`オート (目標  7.0%): ${(counts.auto / N * 100).toFixed(2)}% (${counts.auto})`);
console.log(`時計   (目標  6.0%): ${(counts.clock / N * 100).toFixed(2)}% (${counts.clock})`);
console.log(`ダイヤ (目標  5.0%): ${(counts.dia / N * 100).toFixed(2)}% (${counts.dia})`);
console.log(`赤7    (目標  2.0%): ${(counts['7'] / N * 100).toFixed(2)}% (${counts['7']})`);

console.log('\n=== 2. スキルツリー北東セクターノード検証 ===');
const hotSlotNode = SKILL_NODES.find(n => n.id === 'hot_slot');
console.log('hot_slot:', {
  id: hotSlotNode?.id,
  name: hotSlotNode?.name,
  maxLevel: hotSlotNode?.maxLevel,
  baseCost: hotSlotNode?.baseCost,
  neighbors: hotSlotNode?.neighbors,
});

const r3Node = SKILL_NODES.find(n => n.id === 'r3_0');
console.log('r3_0 (スプリットライン):', {
  id: r3Node?.id,
  name: r3Node?.name,
  maxLevel: r3Node?.maxLevel,
  baseCost: r3Node?.baseCost,
  costScale: r3Node?.costScale,
  neighbors: r3Node?.neighbors,
});

const outer0Node = SKILL_NODES.find(n => n.id === 'outer_0');
console.log('outer_0 (ワープホール):', {
  id: outer0Node?.id,
  name: outer0Node?.name,
  maxLevel: outer0Node?.maxLevel,
  baseCost: outer0Node?.baseCost,
  neighbors: outer0Node?.neighbors,
});

const r11Node = SKILL_NODES.find(n => n.id === 'r1_1');
console.log('r1_1 neighbors:', r11Node?.neighbors);

console.log('\n=== 3. 解放ステータス & コスト計算検証 ===');
const state = new SkillTreeState();
console.log('初期状態: hotSlotUnlocked =', state.computeStats().hotSlotUnlocked, 'splitLaserCount =', state.computeStats().splitLaserCount, 'catapultUnlocked =', state.computeStats().catapultUnlocked);

state.levels['hot_slot'] = 1;
console.log('hot_slot Lv1: hotSlotUnlocked =', state.computeStats().hotSlotUnlocked);

state.levels['r3_0'] = 1;
console.log('r3_0 Lv1: splitLaserCount =', state.computeStats().splitLaserCount, 'Lv2コスト =', state.getCost(r3Node!));

state.levels['r3_0'] = 2;
console.log('r3_0 Lv2: splitLaserCount =', state.computeStats().splitLaserCount);

state.levels['outer_0'] = 1;
console.log('outer_0 Lv1: catapultUnlocked =', state.computeStats().catapultUnlocked);

console.log('\n=== 4. ノードプレビュー検証 ===');
state.levels = {};
console.log('hot_slot preview:', getNodeEffectPreview(state, hotSlotNode!));
console.log('r3_0 Lv1 preview:', getNodeEffectPreview(state, r3Node!));
state.levels['r3_0'] = 1;
console.log('r3_0 Lv2 preview:', getNodeEffectPreview(state, r3Node!));
console.log('outer_0 preview:', getNodeEffectPreview(state, outer0Node!));
