import { FACES, NAMES, geometry, pieces, solved, validate, sequencePermutation, applyMoves, inverse, tokens } from './cube.js';

export const REDUCTION_STAGES=[
  {title:'拼好六面中心',goal:'把每种颜色的四个中心拼成 2×2 色块。保持白上、绿前、红右的配色。',why:'先拼白、黄中心，再拼侧面。用外层对齐和“转内层、调整、转回内层”拼合颜色；同色中心不必区分谁是哪一块。每组结束时保留已经完成的中心面。'},
  {title:'十二组翼棱配对',goal:'把颜色相同的两个小棱块配成一组，共十二组，不必送回最终位置。',why:'找到颜色相同的两块翼棱，用三块循环把伙伴送到一起。已经配好的一组直接保留。整套公式结束后，中心和先前配好的棱保持完整。'},
  {title:'降阶检查',goal:'确认中心、配棱和奇偶关系，随后只转外层，按三阶方法完成。',why:'四阶可能出现三阶不存在的单棱翻转或两组棱交换关系。只在检查发现问题时执行对应的特殊公式，再继续逐层法。'}
];
const all=pieces(4),centers=all.filter(p=>p.length===1).flat(),wings=all.filter(p=>p.length===2),g=geometry(4);
const centerBucket=new Map(centers.map((s,i)=>[s,i]));
const wingBucket=new Map(wings.flatMap((p,i)=>p.map(s=>[s,i])));
// Two wing slots share an edge when only their inner coordinate differs.
const edgeKey=p=>g[p[0]].p.map(v=>Math.abs(v)===1?0:v).join();
const twin=wings.map((p,i)=>wings.findIndex((q,j)=>i!==j&&edgeKey(p)===edgeKey(q)));
const pairedCount=at=>at.reduce((sum,v,i)=>sum+(twin[v]===at[twin[i]]?1:0),0)/2;
const outer=FACES.flatMap(f=>[f,f+"'",f+'2']);
let centerActions,cycleTable;
const centerTables=new Map();

function colorMask(state,color) {
  return centers.reduce((mask,i,k)=>mask|(state[i]===color?1<<k:0),0);
}
function moveMask(mask,map) {
  let next=0;
  while(mask){const bit=mask&-mask;next|=1<<map[31-Math.clz32(bit)];mask^=bit;}
  return next;
}

// Search only the four indistinguishable centers of one color (at most
// C(24,4)=10,626 masks). Costs count actual turns, including slice restoration.
function centerPlan(state,face,locked) {
  const start=colorMask(state,face),goal=15<<(face*4);
  if(start===goal)return [];
  if(!centerActions) {
    const inner=outer.map(m=>'2'+m),unique=new Map();
    for(const seq of [...outer,...inner,...inner.flatMap(s=>outer.map(m=>s+' '+m+' '+inverse(s)))]) {
      const p=sequencePermutation(4,seq),map=centers.map(i=>centerBucket.get(p[i])),key=map.join();
      if(!unique.has(key))unique.set(key,{seq,map,cost:tokens(seq).length});
    }
    centerActions=[...unique.values()];
  }
  const key=locked+':'+face;
  let table=centerTables.get(key);
  if(!table) {
    const actions=centerActions.filter(a=>locked.every(f=>a.map.slice(f*4,f*4+4).every(v=>Math.floor(v/4)===f)));
    const prev=new Map([[goal,goal]]),choice=new Map(),dist=new Map([[goal,0]]),buckets=[[goal]];
    for(let cost=0;cost<buckets.length;cost++)for(const code of buckets[cost]||[]) {
      if(dist.get(code)!==cost)continue;
      for(let a=0;a<actions.length;a++) {
        const next=moveMask(code,actions[a].map),d=cost+actions[a].cost;
        if(d>=(dist.get(next)??Infinity))continue;
        dist.set(next,d);prev.set(next,code);choice.set(next,a);(buckets[d]??=[]).push(next);
      }
    }
    table={prev,choice,actions};centerTables.set(key,table);
  }
  if(!table.prev.has(start))throw Error('中心拼合无法到达目标。');
  const plan=[];
  for(let code=start;code!==goal;code=table.prev.get(code))plan.push(inverse(table.actions[table.choice.get(code)].seq));
  return plan;
}

// Conjugate a pure wing three-cycle. Only three selected wings change after
// the complete group; search setup positions, never whole cube states.
function wingCycle(desired) {
  if(!cycleTable) {
    const base="2R U 2R' D 2R U' 2R' D'";
    const piecePerm=seq=>{const p=sequencePermutation(4,seq);return wings.map(w=>wingBucket.get(p[w[0]]));};
    const p=piecePerm(base),a=p.findIndex((v,i)=>v!==i),start=[a,p[a],p[p[a]]];
    if(p[start[2]]!==a||p.filter((v,i)=>v!==i).length!==3)throw Error('翼棱三循环基础公式验算失败。');
    const moves=FACES.flatMap(f=>[f,f+"'",f+'2','2'+f,'2'+f+"'",'2'+f+'2']);
    const maps=moves.map(piecePerm),rank=t=>t[0]*576+t[1]*24+t[2];
    const prev=new Int32Array(13824).fill(-1),choices=new Int8Array(13824),queue=new Int32Array(13824);
    const root=rank(start);prev[root]=root;queue[0]=root;let head=0,tail=1;
    while(head<tail){const code=queue[head++],triple=[Math.floor(code/576),Math.floor(code/24)%24,code%24];
      for(let m=0;m<moves.length;m++){const next=rank(triple.map(v=>maps[m][v]));if(prev[next]!==-1)continue;prev[next]=code;choices[next]=m;queue[tail++]=next;}
    }
    cycleTable={base,moves,prev,choices,root,rank};
  }
  const table=cycleTable;let code=table.rank(desired);const setup=[];
  if(table.prev[code]===-1)throw Error('翼棱准备动作无法到达目标。');
  while(code!==table.root){setup.push(table.moves[table.choices[code]]);code=table.prev[code];}
  setup.reverse();
  return {moves:[...tokens(inverse(setup)),...tokens(table.base),...setup],setup:inverse(setup),core:table.base};
}

export function reducedState(state) {
  for(let f=0;f<6;f++)for(const [a,b] of [[1,2],[4,8],[7,11],[13,14]]) {
    if(state[f*16+a]!==state[f*16+b])throw Error('配棱检查失败，无法降为三阶。');
  }
  return Array.from({length:54},(_,i)=>{
    const f=Math.floor(i/9),r=Math.floor(i%9/3),c=i%3;
    return state[f*16+[0,1,3][r]*4+[0,1,3][c]];
  });
}

// J Perm OLL parity, with x expanded as Rw Lw' and adjacent Rw merged.
// This keeps the fixed reference frame and needs no whole-cube regrip.
const OLL_PARITY="Rw U2 Rw2 Lw' U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'";
const PLL_PARITY='2R2 U2 2R2 Uw2 2R2 Uw2';

export function reduce4(initial,progress=()=>{}) {
  const checked=validate(initial,4);if(!checked.ok)throw Error(checked.error);
  let state=[...initial];const groups=[],home=solved(4),locked=[];
  const record=(moves,stage,explanation,details={})=>{
    state=applyMoves(state,4,moves);groups.push({moves:tokens(moves),formula:tokens(moves).join(' '),stage,explanation,...details});
  };
  progress(REDUCTION_STAGES[0].title);
  for(const face of [0,3,2,5,1]) {
    for(const seq of centerPlan(state,face,locked)) {
      const targets=centers.filter(i=>state[i]===face),moves=tokens(seq);
      const action=moves.length===3?'先转内层，把同色中心带入工作区；转动外层调整位置，再把内层转回。':'转动这一层，调整同色中心条的位置，为拼成 2×2 色块做准备。';
      record(moves,0,'目标：拼'+FACES[face]+'面的'+NAMES[face]+'色中心。'+action+(locked.length?'整组完成后，前面拼好的中心面保持同色。':'先观察同色中心如何随转动靠拢。'),{targets});
      const count=centers.filter(i=>Math.floor(i/16)===face&&state[i]===face).length;
      groups.at(-1).explanation+='本组结束后，目标面有 '+count+'/4 个'+NAMES[face]+'色中心。';
    }
    locked.push(face);
  }
  if(centers.some(i=>state[i]!==home[i]))throw Error('中心拼合回放验算失败。');
  if(groups.length)groups.at(-1).endStage=true;

  progress(REDUCTION_STAGES[1].title);
  const ids=validate(state,4).identities;let at=wings.map(p=>wingBucket.get(ids[p[0]]));
  for(let guard=0;pairedCount(at)<12;guard++) {
    if(guard>=12)throw Error('翼棱配对未收敛。');
    const paired=at.map((v,i)=>twin[v]===at[twin[i]]),before=pairedCount(at);let best;
    // Choose a partner and an unpaired buffer. Never touch a completed pair;
    // favor creating two pairs with one formula over fixing arbitrary labels.
    for(let dest=0;dest<24;dest++)if(!paired[dest]) {
      const anchor=twin[dest],source=at.indexOf(twin[at[anchor]]);
      for(let third=0;third<24;third++)if(!paired[third]&&third!==source&&third!==dest&&third!==anchor) {
        const cycle=[source,dest,third],plan=wingCycle(cycle),next=[...at];
        for(let i=0;i<3;i++)next[cycle[(i+1)%3]]=at[cycle[i]];
        const gain=pairedCount(next)-before,score=gain/plan.moves.length;
        if(!best||score>best.score)best={cycle,anchor,plan,next,gain,score};
      }
    }
    if(!best||best.gain<=0)throw Error('没有找到保留已配棱的下一组动作。');
    const {cycle,anchor,plan,next}=best,names=wings[anchor].map(i=>NAMES[state[i]]).join('、');
    record(plan.moves,1,'找到'+names+'色的两块翼棱，观察框标出伙伴和工作块。准备位置后做八步三循环，再撤销准备，把伙伴送到一起；不用放回最终位置。整组结束后中心和原有配棱恢复，已配好 '+pairedCount(next)+'/12 组。',{setup:plan.setup,core:plan.core,targets:[...new Set([anchor,...cycle])].flatMap(i=>wings[i])});
    at=next;
  }
  if(groups.at(-1)?.stage===1)groups.at(-1).endStage=true;
  let reduced=reducedState(state),valid=validate(reduced,3);
  if(!valid.ok&&/翻转/.test(valid.error)) {
    record(OLL_PARITY,2,'中心和十二组棱都已完成，但出现了三阶不允许的单棱翻转关系（OLL 奇偶）。执行这套特殊公式修正翻棱关系；整套结束时六面中心和十二组配棱仍然完整。每步仍按固定的上、前、右方向转动。');
    reduced=reducedState(state);valid=validate(reduced,3);
  }
  if(!valid.ok&&/奇偶/.test(valid.error)) {
    record(PLL_PARITY,2,'翻棱检查已通过，但还有三阶不允许的交换奇偶（PLL 奇偶）。用这套六步公式修正；中心和十二组配棱保持完整，然后进入三阶逐层法。');
    reduced=reducedState(state);valid=validate(reduced,3);
  }
  if(!valid.ok)throw Error('四阶降阶校验失败：'+valid.error);
  if(groups.at(-1)?.stage===2)groups.at(-1).endStage=true;
  return {groups,reduced,state};
}
