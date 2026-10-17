import test from 'node:test';
import assert from 'node:assert/strict';
import { solved, applyMoves, inverse, validate, geometry } from '../src/cube.js';

test('真实转层：四次还原，公式与逆公式抵消，外层不会移动三阶中心', () => {
  for (const n of [3, 4]) {
    for (const m of ['R', 'U', 'F', 'D', 'L', 'B', ...(n === 4 ? ['2R', '2U', 'Rw'] : [])]) {
      const s = solved(n);
      assert.deepEqual(applyMoves(s, n, `${m} ${m} ${m} ${m}`), s);
      assert.deepEqual(applyMoves(applyMoves(s, n, m), n, inverse(m)), s);
    }
    const seq = "R U2 F' L D B2 Rw".replace(' Rw', n === 4 ? ' Rw' : '');
    assert.deepEqual(applyMoves(applyMoves(solved(n), n, seq), n, inverse(seq)), solved(n));
    assert.equal(validate(applyMoves(solved(n), n, seq), n).ok, true);
  }
  const s = applyMoves(solved(3), 3, "R U F D L B");
  for (let f = 0; f < 6; f++) assert.equal(s[f * 9 + 4], f);
});

test('拒绝颜色数量错误、单棱翻转、单角扭转和两棱交换', () => {
  let s = solved(3); s[0] = 1; assert.equal(validate(s, 3).ok, false);
  s = solved(3); [s[7], s[19]] = [s[19], s[7]]; assert.match(validate(s, 3).error, /翻转/);
  s = solved(3); [s[8], s[9], s[20]] = [s[9], s[20], s[8]]; assert.match(validate(s, 3).error, /扭转/);
  s = solved(3); [s[19], s[10]] = [s[10], s[19]]; assert.match(validate(s, 3).error, /奇偶|交换/);
  assert.equal(geometry(4).length, 96);
});

test('生成逆公式不会修改调用者的准备动作数组', () => {
  const setup=['R','U','F'];
  assert.equal(inverse(setup),"F' U' R'");
  assert.deepEqual(setup,['R','U','F']);
});
