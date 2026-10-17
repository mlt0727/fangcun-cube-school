export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
export const NAMES = ['白', '红', '绿', '黄', '橙', '蓝'];
export const COLORS = ['#f4f1e8', '#d95a4e', '#52856a', '#edca58', '#e7974c', '#5485b0'];
export const NORMALS = [[0,1,0],[1,0,0],[0,0,1],[0,-1,0],[-1,0,0],[0,0,-1]];
const geoCache = new Map(), permCache = new Map();
export const tokens = seq => Array.isArray(seq) ? [...seq] : seq.trim().split(/\s+/).filter(Boolean);
export const solved = n => Array.from({length: 6*n*n}, (_, i) => Math.floor(i/(n*n)));
export const inverse = seq => tokens(seq).reverse().map(m => m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0,-1) : m+"'").join(' ');
export function geometry(n) {
  if (geoCache.has(n)) return geoCache.get(n);
  const a=n-1, out=[];
  for(let f=0;f<6;f++) for(let r=0;r<n;r++) for(let c=0;c<n;c++) {
    const x=-a+2*c, y=a-2*r;
    const p=[[x,a,-a+2*r],[a,y,a-2*c],[x,y,a],[x,-a,a-2*r],[-a,y,-a+2*c],[a-2*c,y,-a]][f];
    out.push({p, normal:NORMALS[f], f, r, c, i:out.length});
  }
  geoCache.set(n,out); return out;
}
export function moveInfo(move,n) {
  const match=/^(2?[URFDLB](?:w)?|[xyz])([2']?)$/.exec(move);
  if(!match) throw Error(`无法识别转动：${move}`);
  const [,base,suffix]=match;
  const face=base.replace(/[2w]/g,''), rotation='xyz'.includes(face);
  const normal=rotation ? NORMALS[[1,0,2]['xyz'.indexOf(face)]] : NORMALS[FACES.indexOf(face)];
  const axis=normal.findIndex(v=>v!==0), sign=normal[axis];
  const inner=base.startsWith('2'), wide=base.endsWith('w');
  if(inner && n!==4) throw Error('内层转动只适用于四阶。');
  return {axis,sign,angle:-sign*(suffix==="'"?-1:suffix==='2'?2:1),base,suffix,
    affected:p=>rotation || (wide ? p[axis]*sign>=n-3 : p[axis]*sign===(inner?n-3:n-1))};
}
export function rotate(v,axis,turns) {
  let out=[...v];
  for(let k=0;k<((turns%4)+4)%4;k++) {
    const [x,y,z]=out; out=axis===0?[x,-z,y]:axis===1?[z,y,-x]:[-y,x,z];
  }
  return out;
}
export function permutation(n,move) {
  const key=n+move;if(permCache.has(key))return permCache.get(key);
  const g=geometry(n), info=moveInfo(move,n);
  const lookup=new Map(g.map(s=>[[...s.p,...s.normal].join(','),s.i]));
  const p=g.map(s=>info.affected(s.p)?lookup.get([...rotate(s.p,info.axis,info.angle),...rotate(s.normal,info.axis,info.angle)].join(',')):s.i);
  permCache.set(key,p);return p;
}
export function applyPermutation(state,p) {const next=Array(state.length); for(let i=0;i<p.length;i++)next[p[i]]=state[i];return next;}
export function applyMoves(state,n,seq) {let out=[...state];for(const m of tokens(seq))out=applyPermutation(out,permutation(n,m));return out;}
export function sequencePermutation(n,seq) {
  const ids=Array.from({length:6*n*n},(_,i)=>i), at=applyMoves(ids,n,seq), p=[];
  at.forEach((id,i)=>p[id]=i);return p;
}
export function pieces(n) {
  const groups=new Map();for(const s of geometry(n)){const k=s.p.join(',');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s.i);}
  return [...groups.values()];
}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const parity=p=>p.reduce((sum,a,i)=>sum+p.slice(i+1).filter(b=>a>b).length,0)%2;
function cornerOrder(indices,n) {
  const g=geometry(n), first=indices.find(i=>g[i].f===0||g[i].f===3), others=indices.filter(i=>i!==first);
  if(dot(g[first].normal,cross(g[others[0]].normal,g[others[1]].normal))>0)others.reverse();
  return [first,...others];
}
function wingKey(indices,state,n) {
  const g=geometry(n), sorted=[...indices].sort((a,b)=>state[a]-state[b]);
  return sorted.map(i=>state[i]).join(',')+':'+Math.sign(dot(cross(g[sorted[0]].normal,g[sorted[1]].normal),g[sorted[0]].p));
}
export function validate(state,n) {
  const fail=error=>({ok:false,error});
  if(![3,4].includes(n)||state.length!==6*n*n)return fail('魔方数据长度不正确。');
  if(state.some(c=>!Number.isInteger(c)||c<0||c>5))return fail('请先涂完全部色块，再开始学习。');
  for(let c=0;c<6;c++)if(state.filter(v=>v===c).length!==n*n)return fail(`${NAMES[c]}色应有 ${n*n} 格，当前有 ${state.filter(v=>v===c).length} 格。`);
  const home=solved(n), g=geometry(n), groups=pieces(n), corners=groups.filter(p=>p.length===3).map(p=>cornerOrder(p,n));
  const edges=groups.filter(p=>p.length===2), centers=groups.filter(p=>p.length===1), identities=Array(state.length), cp=[],ep=[], usedC=new Set(),usedE=new Set();
  let twist=0,flip=0;
  const sortedKey=(p,s)=>p.map(i=>s[i]).sort().join(',');
  for(const p of corners) {
    const id=corners.findIndex(q=>sortedKey(q,home)===sortedKey(p,state));
    if(id<0||usedC.has(id))return fail('角块颜色组合不正确或出现了重复角块，请检查六面方向。');
    usedC.add(id);cp.push(id);
    const goal=corners[id].map(i=>home[i]), actual=p.map(i=>state[i]);
    const ori=actual.findIndex(c=>c===0||c===3);
    if(goal.some((c,k)=>c!==actual[(k+ori)%3]))return fail('发现镜像角块：同一个角上的颜色顺序不可能，请检查涂色方向。');
    twist+=ori;
    for(const i of p)identities[i]=corners[id].find(j=>home[j]===state[i]);
  }
  if(twist%3)return fail('角块扭转总量不正确：可能有一个角被单独拧过，或颜色录入有误。');
  for(const p of edges) {
    const id=edges.findIndex(q=>n===4?wingKey(q,home,n)===wingKey(p,state,n):sortedKey(q,home)===sortedKey(p,state));
    if(id<0||usedE.has(id))return fail('棱块颜色组合不正确或重复，请检查相邻两面的涂色。');
    usedE.add(id);ep.push(id);
    if(n===3) {
      const ordered=q=>[...q].sort((a,b)=>{
        const rank=i=>(g[i].f===0||g[i].f===3)?0:(g[i].f===2||g[i].f===5)?1:2;
        return rank(a)-rank(b);
      });
      if(state[ordered(p)[0]]!==home[ordered(edges[id])[0]])flip++;
    }
    for(const i of p)identities[i]=edges[id].find(j=>home[j]===state[i]);
  }
  if(n===3 && flip%2)return fail('棱块翻转总量不正确：单独翻转一条棱无法通过正常转动还原。');
  if(n===3 && parity(cp)!==parity(ep))return fail('角块与棱块的交换奇偶不一致：可能有两块被单独交换，或录入有误。');
  const unused=new Set(centers.flat());
  for(const [i] of centers) {
    if(n===3 && state[i]!==home[i])return fail('请按白上、绿前、红右的方向录入；三阶中心块颜色固定。');
    const id=[...unused].find(j=>home[j]===state[i]);
    if(id===undefined)return fail('四阶每种颜色必须恰好有四个中心块。');
    identities[i]=id;unused.delete(id);
  }
  return {ok:true,identities,corners,edges,centers};
}
export const isSolved=(s,n)=>s.every((c,i)=>c===Math.floor(i/(n*n)));
export function scramble(n,length=24,random=Math.random) {
  const out=[];let prev='';
  while(out.length<length){const f=FACES[Math.floor(random()*6)];if(f===prev)continue;prev=f;
    out.push((n===4&&random()<.35?'2':'')+f+['',"'",'2'][Math.floor(random()*3)]);}
  return out.join(' ');
}
