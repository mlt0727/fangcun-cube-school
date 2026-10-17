import test from 'node:test';
import assert from 'node:assert/strict';
import {solved,applyMoves} from '../src/cube.js';
import {createTimeline,describeMove} from '../src/timeline.js';
test('逐步状态支持精确回退、重播，且不修改初始涂色',()=>{
  const input=solved(3),copy=[...input];
  const t=createTimeline(input,3,{groups:[{moves:['R','U',"R'"],setup:'R',core:'U',stage:0,explanation:'将目标棱块移入底层。'}]});
  assert.equal(t.steps.length,3);
  assert.deepEqual(t.states[0],copy);
  assert.deepEqual(t.states[2],applyMoves(copy,3,'R U'));
  assert.deepEqual(t.states[3],applyMoves(copy,3,"R U R'"));
  assert.deepEqual(input,copy);
  assert.deepEqual(t.steps.map(s=>s.role),['准备位置','三块循环','撤销准备']);
  assert.match(describeMove('2R2',4),/第二层.*180/);
  assert.match(describeMove("U'",3),/上面.*逆时针/);
});
