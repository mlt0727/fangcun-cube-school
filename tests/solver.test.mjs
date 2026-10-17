import test from 'node:test';
import assert from 'node:assert/strict';
import { solved, applyMoves, isSolved, scramble, pieces, geometry } from '../src/cube.js';
import { solve, stageChecks } from '../src/solver.js';
import { reducedState } from '../src/reduction.js';
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
  const geo=geometry(4),edges=new Map();
  for(const wing of pieces(4).filter(p=>p.length===2)) {
    const key=geo[wing[0]].p.map(v=>Math.abs(v)===1?0:v).join();
    if(!edges.has(key))edges.set(key,[]);edges.get(key).push(wing);
  }
  const paired=(s,[a,b])=>a.every(i=>s[i]===s[b.find(j=>geo[j].f===geo[i].f)]);
  for(let sample=0;sample<20;sample++) {
    const initial=applyMoves(solved(4),4,scramble(4,35,random));
    const lesson=solve(initial,4);
    let state=initial;
    for(const group of lesson.groups) {
      const previousPairs=[...edges.values()].filter(edge=>paired(state,edge));
      state=applyMoves(state,4,group.moves);
      if(group.stage===0 && group.endStage) {
        for(let face=0;face<6;face++)for(const offset of [5,6,9,10])assert.equal(state[face*16+offset],face);
      }
      if(group.stage===1) {
        for(const offset of [5,6,9,10])for(let f=0;f<6;f++)assert.equal(state[f*16+offset],f);
        assert.ok(previousPairs.every(edge=>paired(state,edge)),'完整配棱公式必须保留已经配好的棱');
        assert.ok([...edges.values()].filter(edge=>paired(state,edge)).length>previousPairs.length,'每组配棱都应有实际进展');
      }
      if(group.stage===2)assert.doesNotThrow(()=>reducedState(state),'特殊公式不能拆开配棱');
    }
    assert.equal(isSolved(state,4),true,`四阶第${sample}例`);
  }
});

test('四阶：确定的打乱样本不再产生数百次多余降阶转动',()=>{
  let sampleSeed=20261017,total=0,reductionTotal=0;
  const rng=()=>((sampleSeed=(Math.imul(sampleSeed,1664525)+1013904223)>>>0)/4294967296);
  for(let sample=0;sample<30;sample++) {
    const input=applyMoves(solved(4),4,scramble(4,35,rng)),lesson=solve(input,4);
    const moves=lesson.groups.flatMap(g=>g.moves);
    assert.ok(moves.length<=340,`样本 ${sample}：${moves.length} 次转动`);
    assert.equal(isSolved(applyMoves(input,4,moves),4),true);
    total+=moves.length;reductionTotal+=lesson.groups.filter(g=>g.stage<3).flatMap(g=>g.moves).length;
  }
  assert.ok(total/30<=280,'这一组固定样本的平均总转动数应低于 280');
  assert.ok(reductionTotal/30<=140,'这一组固定样本的平均降阶转动数应低于 140');
});

test('四阶：单内层奇偶与已配棱的交换特殊情况均能处理',()=>{
  for(const formula of ['2R', '2R2 U2 2R2 Uw2 2R2 Uw2', "R U R' U'",'']) {
    const input=applyMoves(solved(4),4,formula),result=solve(input,4);
    assert.equal(isSolved(applyMoves(input,4,result.groups.flatMap(g=>g.moves)),4),true);
  }
});

test('四阶：已降阶的翻棱、交换及两者并存，仅执行必要的特殊公式',()=>{
  const oll="Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'";
  const pll='2R2 U2 2R2 Uw2 2R2 Uw2';
  for(const [formula,parityTurns] of [[oll,18],[pll,6],[oll+' '+pll,24]]) {
    const input=applyMoves(solved(4),4,formula),result=solve(input,4);
    assert.equal(result.groups.filter(g=>g.stage<2).length,0,'不能重做已完成的中心与配棱');
    assert.equal(result.groups.filter(g=>g.stage===2).flatMap(g=>g.moves).length,parityTurns);
    assert.equal(isSolved(applyMoves(input,4,result.groups.flatMap(g=>g.moves)),4),true);
  }
  const inner=applyMoves(solved(4),4,'2R');
  assert.deepEqual(solve(inner,4).groups.flatMap(g=>g.moves),["2R'"]);
});

test('四阶：已经降阶的状态直接进入三阶，不拆开中心和配棱',()=>{
  for(const formula of ['R', 'R U F2 L D B', "R U R' U'"]) {
    const input=applyMoves(solved(4),4,formula),result=solve(input,4);
    assert.equal(result.groups.filter(g=>g.stage<3).length,0,formula);
    assert.equal(isSolved(applyMoves(input,4,result.groups.flatMap(g=>g.moves)),4),true);
    if(formula==='R')assert.equal(result.groups.flatMap(g=>g.moves).length,1);
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
