import {applyMoves,moveInfo,FACES,permutation,tokens} from './cube.js';
export function createTimeline(initial,n,lesson) {
  const states=[[...initial]],steps=[],ranges=[];
  lesson.groups.forEach((group,groupIndex)=>{
    const start=steps.length;
    let focus=group.targets||[];
    const setupLength=tokens(group.setup||'').length,coreLength=tokens(group.core||'').length;
    group.moves.forEach((move,moveIndex)=>{
      const role=coreLength?(moveIndex<setupLength?'准备位置':moveIndex<setupLength+coreLength?'三块循环':'撤销准备'):'';
      steps.push({move,moveIndex,groupIndex,stage:group.stage,focus,role});
      states.push(applyMoves(states.at(-1),n,move));
      const perm=permutation(n,move);focus=focus.map(i=>perm[i]);
    });
    ranges.push({start,end:steps.length});
  });
  return {states,steps,ranges};
}
export function describeMove(move,n=3) {
  const {base,suffix}=moveInfo(move,n),face=base.replace(/[2w]/g,'');
  const names=['上面','右面','前面','下面','左面','后面'];
  let part=names[FACES.indexOf(face)]||'整个魔方';
  if(base.startsWith('2'))part=part.slice(0,1)+'侧第二层（只转内层）';
  if(base.endsWith('w'))part=part.slice(0,1)+'侧两层一起';
  return `${part}${suffix==='2'?'转 180°':suffix==="'"?'逆时针转 90°':'顺时针转 90°'}`;
}
