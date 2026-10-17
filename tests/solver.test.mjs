import test from 'node:test';
import assert from 'node:assert/strict';
import { solved, applyMoves, isSolved, scramble } from '../src/cube.js';
import { solve, stageChecks } from '../src/solver.js';
let seed=12345;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
test('三阶：人工状态逐层还原，每阶段保留前面成果', () => {
  for(let sample=0;sample<30;sample++) {
    const initial=applyMoves(solved(3),3,scramble(3,25,random));
    const lesson=solve(initial,3);
    let state=initial;
    for(const group of lesson.groups) {
      state=applyMoves(state,3,group.moves);
      if(group.endStage) assert.equal(stageChecks(state,3)[group.stage],true,`第${sample}例阶段${group.stage}`);
      assert.ok(group.explanation.length>5);
    }
    assert.equal(isSolved(state,3),true,`第${sample}例最终状态`);
  }
});
test('已还原状态不生成多余转动，无效输入不会生成解法', () => {
  assert.equal(solve(solved(3),3).groups.length,0);
  const bad=solved(3);bad[0]=1;
  assert.throws(()=>solve(bad,3),/色/);
});

test('四阶：任意人工涂色状态经中心、配棱及三阶教学完整还原', () => {
  for(let sample=0;sample<20;sample++) {
    const initial=applyMoves(solved(4),4,scramble(4,35,random));
    const lesson=solve(initial,4);
    let state=initial;
    for(const group of lesson.groups) {
      state=applyMoves(state,4,group.moves);
      if(group.stage===0 && group.endStage) {
        for(let face=0;face<6;face++)for(const offset of [5,6,9,10])assert.equal(state[face*16+offset],face);
      }
    }
    assert.equal(isSolved(state,4),true,`四阶第${sample}例`);
  }
});

test('四阶：单内层奇偶与已配棱的交换特殊情况均能处理',()=>{
  for(const formula of ['2R', '2R2 U2 2R2 Uw2 2R2 Uw2', "R U R' U'",'']) {
    const input=applyMoves(solved(4),4,formula),result=solve(input,4);
    assert.equal(isSolved(applyMoves(input,4,result.groups.flatMap(g=>g.moves)),4),true);
  }
});

test('四阶复用三阶教学时，观察框覆盖整组翼棱而非错误的三阶下标',()=>{
  const input=applyMoves(solved(4),4,'R U F2 L D B');
  const result=solve(input,4);
  const edgeGroups=result.groups.filter(g=>[3,5,6,7].includes(g.stage)&&g.targets?.length);
  assert.ok(edgeGroups.length>0);
  for(const group of edgeGroups)assert.equal(group.targets.length,4);
  for(const group of result.groups.filter(g=>[4,8,9].includes(g.stage)&&g.targets?.length))assert.equal(group.targets.length,3);
});
