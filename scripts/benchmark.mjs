import {solved,applyMoves,scramble,isSolved} from '../src/cube.js';
import {solve} from '../src/solver.js';

let seed=20261017;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const rows=[];
for(let sample=0;sample<30;sample++) {
  const input=applyMoves(solved(4),4,scramble(4,35,random)),lesson=solve(input,4),counts=[0,0,0,0];
  for(const group of lesson.groups)counts[Math.min(group.stage,3)]+=group.moves.length;
  if(!isSolved(applyMoves(input,4,lesson.groups.flatMap(g=>g.moves)),4))throw Error(`样本 ${sample} 未还原`);
  rows.push([...counts,counts.reduce((a,b)=>a+b)]);
}
console.log('四阶固定样本：种子 20261017，30 个独立的 35 次打乱；每个公式符号计 1 次转动，180° 和宽层转动各计 1 次。');
console.table(['中心','配棱','奇偶修正','三阶逐层法','总计'].map((阶段,i)=>({
  阶段,平均:Number((rows.reduce((sum,r)=>sum+r[i],0)/rows.length).toFixed(1)),
  最少:Math.min(...rows.map(r=>r[i])),最多:Math.max(...rows.map(r=>r[i]))
})));
console.log('30 个样本均已按实际贴纸状态完整回放并还原。样本步数不代表所有状态的上限。');
