import { FACES, NAMES, geometry, pieces, solved, validate, sequencePermutation, applyMoves, inverse, tokens } from './cube.js';

export const REDUCTION_STAGES=[
  {title:'拼好六面中心',goal:'把每种颜色的四个中心拼成 2×2 色块。保持白上、绿前、红右的配色。',why:'四阶没有固定中心。先建立六面的颜色位置，再逐块归并。本教程用“准备、三块循环、撤销准备”保护已拼好的部分。'},
  {title:'十二组翼棱配对',goal:'把颜色相同的两个小棱块配成一组，共十二组。',why:'用三块循环逐个归位翼棱。每套完整公式只改变三块翼棱，中心和角块会恢复；配成的一组就能当作三阶的一条棱。'},
  {title:'降阶检查',goal:'确认中心、配棱和置换关系，随后只转外层，按三阶方法完成。',why:'四阶可能出现三阶不存在的交换关系。如果降阶后有两组棱的奇偶问题，先用固定公式修正，再继续逐层法。'}
];
const cycleTables=new Map();
const parity=a=>a.reduce((sum,v,i)=>sum+a.slice(i+1).filter(x=>x<v).length,0)%2;

// Conjugating an elementary three-cycle only moves the three selected pieces.
// The setup is searched over three positions (24*23*22), not whole cube states.
function threeCycle(orbit,desired,kind) {
  let table=cycleTables.get(kind);
  if(!table) {
    const base=kind==='center'?"2R' 2U 2R U 2R' 2U' 2R U'":"2R U 2R' D 2R U' 2R' D'";
    const bucket=new Map(orbit.flatMap((p,i)=>p.map(s=>[s,i])));
    const piecePerm=seq=>{const p=sequencePermutation(4,seq);return orbit.map(g=>bucket.get(p[g[0]]));};
    const p=piecePerm(base), a=p.findIndex((v,i)=>v!==i), start=[a,p[a],p[p[a]]];
    if(p[start[2]]!==a||p.filter((v,i)=>v!==i).length!==3)throw Error('三循环基础公式验算失败。');
    const moves=FACES.flatMap(f=>[f,f+"'",f+'2','2'+f,'2'+f+"'",'2'+f+'2']);
    const maps=moves.map(piecePerm), rank=t=>t[0]*576+t[1]*24+t[2];
    const prev=new Int32Array(13824).fill(-1), choices=new Int8Array(13824), queue=new Int32Array(13824);
    const root=rank(start);prev[root]=root;queue[0]=root;let head=0,tail=1;
    while(head<tail){const code=queue[head++], triple=[Math.floor(code/576),Math.floor(code/24)%24,code%24];
      for(let m=0;m<moves.length;m++){const next=rank(triple.map(v=>maps[m][v]));if(prev[next]!==-1)continue;prev[next]=code;choices[next]=m;queue[tail++]=next;}
    }
    table={base,moves,prev,choices,root,rank};cycleTables.set(kind,table);
  }
  let code=table.rank(desired);const setup=[];
  if(table.prev[code]===-1)throw Error('三循环准备动作无法到达目标。');
  while(code!==table.root){setup.push(table.moves[table.choices[code]]);code=table.prev[code];}
  setup.reverse();
  return {moves:[...tokens(inverse(setup)),...tokens(table.base),...setup],setup:inverse(setup),base:table.base};
}

export function reducedState(state) {
  // Both wing stickers on each side must agree before collapsing a dedge.
  for(let f=0;f<6;f++)for(const [a,b] of [[1,2],[4,8],[7,11],[13,14]]) {
    if(state[f*16+a]!==state[f*16+b])throw Error('配棱检查失败，无法降为三阶。');
  }
  return Array.from({length:54},(_,i)=>{
    const f=Math.floor(i/9),r=Math.floor(i%9/3),c=i%3;
    return state[f*16+[0,1,3][r]*4+[0,1,3][c]];
  });
}

export function reduce4(initial,progress=()=>{}) {
  let state=[...initial];const groups=[],g=geometry(4),home=solved(4),all=pieces(4),centers=all.filter(p=>p.length===1),wings=all.filter(p=>p.length===2);
  const record=(moves,stage,explanation,details={})=>{
    state=applyMoves(state,4,moves);groups.push({moves:tokens(moves),formula:tokens(moves).join(' '),stage,explanation,...details});
  };
  const labels=orbit=>{
    const valid=validate(state,4);if(!valid.ok)throw Error(valid.error);
    const bucket=new Map(orbit.flatMap((p,i)=>p.map(s=>[s,i])));
    return orbit.map(p=>bucket.get(valid.identities[p[0]]));
  };
  if(parity(labels(wings)))record('2R',0,'先把右侧第二层顺时针转 90°，调整翼棱的奇偶关系。它会打散少量中心，接下来一起拼好；这样后续可以只用三块循环来完成配棱。');
  for(const [stage,orbit,kind] of [[0,centers,'center'],[1,wings,'wing']]) {
    progress(REDUCTION_STAGES[stage].title);
    const at=labels(orbit);
    if(stage===0 && parity(at)) {
      // Identical, unmarked centers are interchangeable. Choose the even
      // assignment; this changes identities only, never the user's colors.
      const a=at.findIndex(v=>home[orbit[v][0]]===0),b=at.findIndex((v,i)=>i!==a&&home[orbit[v][0]]===0);
      [at[a],at[b]]=[at[b],at[a]];
    }
    let guard=0;
    while(at.some((v,i)=>v!==i)) {
      if(guard++>48)throw Error('降阶三循环未收敛。');
      const dest=at.findIndex((v,i)=>v!==i),source=at.indexOf(dest),third=at.findIndex((v,i)=>i!==dest&&i!==source&&v!==i);
      if(third<0)throw Error('降阶剩余两块的奇偶检查失败。');
      const cycle=[source,dest,third], plan=threeCycle(orbit,cycle,kind), target=g[orbit[dest][0]];
      const color=NAMES[home[orbit[dest][0]]];
      const explanation=stage===0?`目标：把${color}色中心送到${FACES[target.f]}面的第${target.r+1}行第${target.c+1}列。先把三块中心带到工作位置，做八步三循环，再撤销准备动作。整套完成后只有这三块中心换位，角块和翼棱保持原样。`:
        `目标：让 ${FACES[target.f]} 面这条翼棱与同色伙伴配成一组。先准备三块翼棱，做八步循环，再撤销准备动作。完整公式只交换三块翼棱的位置，六面中心和角块保持原样。`;
      record(plan.moves,stage,explanation,{setup:plan.setup,core:plan.base,targets:cycle.flatMap(i=>orbit[i])});
      const old=[...at];for(let i=0;i<3;i++)at[cycle[(i+1)%3]]=old[cycle[i]];
    }
    if(groups.length&&groups.at(-1).stage===stage)groups.at(-1).endStage=true;
    if(stage===0 && centers.some(([i])=>state[i]!==home[i]))throw Error('中心归并回放验算失败。');
  }
  let reduced=reducedState(state),valid=validate(reduced,3);
  if(!valid.ok) {
    if(!/奇偶/.test(valid.error))throw Error(`降阶校验：${valid.error}`);
    record('2R2 U2 2R2 Uw2 2R2 Uw2',2,'十二组翼棱已配好，但降阶后存在三阶不允许的交换奇偶。这套六步公式修正该关系，完成后中心及配棱仍然保持，随后继续三阶逐层法。');
    groups.at(-1).endStage=true;
    reduced=reducedState(state);valid=validate(reduced,3);
    if(!valid.ok)throw Error(`四阶特殊情况修正失败：${valid.error}`);
  }
  return {groups,reduced,state};
}
