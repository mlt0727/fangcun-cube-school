import {FACES, geometry, pieces, solved, validate, isSolved, applyMoves, inverse, tokens, sequencePermutation, applyPermutation} from './cube.js';
import {reduce4,REDUCTION_STAGES} from './reduction.js';

export const STAGES = [
  {title:'底层十字',goal:'把四条带黄色的棱块放到底层。侧面的颜色也要与中心一致。',why:'中心决定每一面的颜色。先完成十字，后面的角块才有清楚的参照。'},
  {title:'底层角块',goal:'放入四个带黄色的角块，让整个底层及侧面第一排都正确。',why:'使用“抬起、转开、放下、转回”的四步动作，把角块逐个送入，同时保留底层十字。'},
  {title:'中层棱块',goal:'把不带白色的四条中层棱块送入对应的左右插槽。',why:'先把目标棱块移到顶层，再用插入公式换入中层。公式结束时底层会恢复。'},
  {title:'顶层十字',goal:'让顶面四条棱块的白色朝上，暂时不用管顶层角块。',why:'用同一个翻棱公式，把点形、拐角形或直线形逐步变成十字。'},
  {title:'顶棱归位',goal:'让白色十字侧面的四种颜色都对齐中心。',why:'十字朝向正确后，再循环交换顶层棱块的位置，保留下面两层。'},
  {title:'顶角归位',goal:'每个顶角的三种颜色与它所在位置的三个中心匹配，朝向暂时可以不对。',why:'用三角循环换位公式调整位置。判断一个角的位置时，要同时看它的三种颜色。'},
  {title:'顶角调向',goal:'逐个把顶角白色转到上方，最后完成整个魔方。',why:'始终保持绿面朝前。对右前上角重复四步动作，再只转顶层换下一个角；过程中底层暂时变乱是正常的，完成所有角后会恢复。'}
];
const tables=new Map();
const turnFaces=['F','R','B','L'];
const around=(seq,k)=>tokens(seq).map(m=>m.replace(/[FRBL]/,f=>turnFaces[(turnFaces.indexOf(f)+k)%4])).join(' ');
const variants=seq=>[0,1,2,3].flatMap(k=>{const s=around(seq,k);return [s,inverse(s)];});
const ALL=FACES.flatMap(f=>[f,f+"'",f+'2']);

// A small table searches only the pieces of one teaching stage, using that
// stage's beginner moves. It never substitutes a whole-cube shortest solution.
function projectionPlan(ids, goals, orbit, sequences, {sort=false, byPiece=false, cacheKey=''}={}) {
  const n=3, groupList=pieces(n).filter(p=>p.length===3);
  const bucket=new Map();
  if(byPiece)groupList.forEach((p,i)=>p.forEach(s=>bucket.set(s,i)));
  else orbit.forEach((s,i)=>bucket.set(s,i));
  const base=byPiece?8:orbit.length, k=goals.length;
  const rank=arr=>arr.reduce((v,a)=>v*base+a,0);
  const decode=(code)=>{const a=Array(k);for(let i=k-1;i>=0;i--){a[i]=code%base;code=Math.floor(code/base);}return a;};
  const encode=arr=>rank(sort?arr.sort((a,b)=>a-b):arr);
  const target=encode(goals.map(g=>bucket.get(g)));
  const start=encode(goals.map(g=>bucket.get(ids.indexOf(g))));
  if(start===target)return [];
  const key=cacheKey+':'+target;
  let table=tables.get(key);
  if(!table) {
    const maps=sequences.map(seq=>{
      const p=sequencePermutation(n,seq);
      return byPiece?groupList.map(g=>bucket.get(p[g[0]])):orbit.map(s=>bucket.get(p[s]));
    });
    const size=base**k, prev=new Int32Array(size).fill(-1), choice=new Int8Array(size).fill(-1), queue=new Int32Array(size);
    prev[target]=target;queue[0]=target;let head=0,tail=1;
    while(head<tail) {
      const code=queue[head++], values=decode(code);
      for(let a=0;a<maps.length;a++) {
        const next=encode(values.map(v=>maps[a][v]));
        if(prev[next]!==-1)continue;
        prev[next]=code;choice[next]=a;queue[tail++]=next;
      }
    }
    table={prev,choice};tables.set(key,table);
  }
  if(table.prev[start]===-1)throw Error(`教学阶段无法到达目标：${cacheKey}`);
  const result=[];let code=start;
  while(code!==target){result.push(inverse(sequences[table.choice[code]]));code=table.prev[code];}
  return result;
}

export function stageChecks(state,n=3) {
  if(n!==3)return [];
  const g=geometry(n), home=solved(n), groups=pieces(n);
  const exact=p=>p.every(i=>state[i]===home[i]);
  const cross=groups.filter(p=>p.length===2 && g[p[0]].p[1]===-2).every(exact);
  const bottom=cross && groups.filter(p=>p.length===3 && g[p[0]].p[1]===-2).every(exact);
  const middle=bottom && groups.filter(p=>p.length===2 && g[p[0]].p[1]===0).every(exact);
  const topCross=middle && [1,3,5,7].every(i=>state[i]===0);
  const topEdges=topCross && groups.filter(p=>p.length===2 && g[p[0]].p[1]===2).every(exact);
  const cornerPos=topEdges && groups.filter(p=>p.length===3&&g[p[0]].p[1]===2).every(p=>p.map(i=>state[i]).sort().join()===p.map(i=>home[i]).sort().join());
  return [cross,bottom,middle,topCross,topEdges,cornerPos,isSolved(state,n)];
}

export function solve3(initial,progress=()=>{}) {
  const checked=validate(initial,3);if(!checked.ok)throw Error(checked.error);
  if(isSolved(initial,3))return {groups:[],stages:STAGES};
  let ids=checked.identities,state=[...initial];const groups=[];
  const g=geometry(3), allPieces=pieces(3), edges=allPieces.filter(p=>p.length===2), corners=allPieces.filter(p=>p.length===3);
  const primary=(p,f)=>p.find(i=>g[i].f===f);
  const lowerEdges=edges.filter(p=>g[p[0]].p[1]===-2).map(p=>primary(p,3));
  const lowerCorners=corners.filter(p=>g[p[0]].p[1]===-2).map(p=>primary(p,3));
  const middleEdges=edges.filter(p=>g[p[0]].p[1]===0).map(p=>p[0]);
  const upperEdges=edges.filter(p=>g[p[0]].p[1]===2).map(p=>primary(p,0));
  const upperCorners=corners.filter(p=>g[p[0]].p[1]===2).map(p=>primary(p,0));
  const edgeOrbit=edges.flat(),cornerOrbit=corners.flat();
  const stageGoals=[lowerEdges,lowerCorners,middleEdges,upperEdges,upperEdges,upperCorners,upperCorners];
  const record=(moves,stage,explanation)=>{
    const nextIds=applyMoves(ids,3,moves),goals=stageGoals[stage];
    const chosen=goals.find(goal=>ids[goal]!==goal&&nextIds[goal]===goal)??goals.find(goal=>ids[goal]!==goal);
    const targets=chosen===undefined?[]:allPieces.find(p=>p.includes(ids.indexOf(chosen)));
    const names=['白','红','绿','黄','橙','蓝'];
    if(targets?.length)explanation=`本组观察${targets.map(i=>names[Math.floor(ids[i]/9)]).join('、')}色${targets.length===3?'角':'棱'}块。${explanation}`;
    state=applyMoves(state,3,moves);ids=nextIds;
    groups.push({moves:tokens(moves),stage,explanation,formula:moves,targets});
  };
  const phases=[
    {goals:lowerEdges,orbit:edgeOrbit,actions:ALL,text:'观察黄色棱块，把它移到底面，同时让另一种颜色对齐侧面中心。'},
    {goals:lowerCorners,orbit:cornerOrbit,actions:['U',"U'",'U2',...variants("R U R' U'")],text:'将黄色角块带到对应插槽上方，重复四步插角动作；完成公式后，底层十字保持正确。'},
    {goals:middleEdges,orbit:edgeOrbit,actions:['U',"U'",'U2',...variants("U R U' R' U' F' U F")],text:'顶层转动用于对齐目标棱；八步插棱动作把它送入中层，同时恢复整个底层。'},
    {goals:upperEdges,orbit:edgeOrbit,actions:['U',"U'",'U2',...variants("F R U R' U' F'")],sort:true,text:'只观察顶面四条棱的白色。调整顶层方向，再用翻棱公式把白色转到上方，下面两层在公式结束后恢复。'},
    {goals:upperEdges,orbit:edgeOrbit,actions:['U',"U'",'U2',...variants("R U R' U R U2 R' U")],text:'观察顶层棱块侧面的颜色。循环换位后重新检查四个侧面，白色十字的朝向保持不变。'},
    {goals:upperCorners,orbit:cornerOrbit,actions:variants("U R U' L' U R' U' L"),byPiece:true,text:'同时看顶角的三种颜色。用三角循环换位，把角块送到正确位置；这一步先不要求白色朝上。'}
  ];
  for(let stage=0;stage<phases.length;stage++) {
    progress(STAGES[stage].title);
    const phase=phases[stage];
    const plan=projectionPlan(ids,phase.goals,phase.orbit,phase.actions,{...phase,cacheKey:'stage'+stage});
    for(const seq of plan)record(seq,stage,phase.text);
    if(groups.length&&groups.at(-1).stage===stage)groups.at(-1).endStage=true;
    if(!stageChecks(state)[stage])throw Error(`阶段验算失败：${STAGES[stage].title}`);
  }
  if(!isSolved(state,3)) {
    progress(STAGES[6].title);
    for(let corner=0;corner<4;corner++) {
      let repeat=0;
      while(state[8]!==0) {
        if(repeat++>=6)throw Error('顶角调向验算失败。');
        record("R' D' R D",6,'保持绿面朝前，只处理右前上角。完整执行四步，即使第三步白色已经朝上，也必须转完第四步。底层暂时变乱是正常现象。');
      }
      record('U',6,'右前上角白色已经朝上。只转顶层，把下一个角带到右前上方；不要转动整个魔方。');
    }
    groups.at(-1).endStage=true;
  }
  if(!isSolved(state,3))throw Error('最终回放验算未通过，未返回错误解法。');
  return {groups,stages:STAGES};
}
export function solve(initial,n,progress) {
  if(n===3)return solve3(initial,progress);
  const checked=validate(initial,n);if(!checked.ok)throw Error(checked.error);
  if(isSolved(initial,n))return {groups:[],stages:[...REDUCTION_STAGES,...STAGES]};
  const reduction=reduce4(initial,progress),three=solve3(reduction.reduced,progress);
  const expandTarget=i=>{
    const f=Math.floor(i/9),r=Math.floor(i%9/3),c=i%3;
    const rows=r===1?[1,2]:[r===0?0:3],cols=c===1?[1,2]:[c===0?0:3];
    return rows.flatMap(row=>cols.map(col=>f*16+row*4+col));
  };
  const groups=[...reduction.groups,...three.groups.map(g=>({...g,stage:g.stage+3,targets:g.targets?.flatMap(expandTarget)}))];
  if(!isSolved(applyMoves(initial,4,groups.flatMap(g=>g.moves)),4))throw Error('四阶完整回放验算未通过。');
  return {groups,stages:[...REDUCTION_STAGES,...STAGES]};
}
