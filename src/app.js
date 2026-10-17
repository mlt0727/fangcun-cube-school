import {FACES,NAMES,COLORS,geometry,pieces,solved,validate,isSolved,applyMoves,scramble,moveInfo} from './cube.js';
import {STAGES,stageChecks} from './solver.js';
import {REDUCTION_STAGES,reducedState} from './reduction.js';
import {createTimeline,describeMove} from './timeline.js';

const $=id=>document.getElementById(id), faceNames=['上','右','前','下','左','后'];
const storageKey='fangcun-colors-v1';
let n=3,paint=applyMoves(solved(3),3,"R U2 F' L D B2 R2 F2 U' L2 D' R B' U2 F D2 L' B R' U F' D L2 U2"),color=0,lesson=null,timeline=null,index=0;
let playing=false,animation=null,epoch=0,pumpRunning=false,playLimit=Infinity,worker=null,openStage=null,angleX=-24,angleY=-34;
try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&[3,4].includes(saved.n)&&Array.isArray(saved.paint)&&saved.paint.length===6*saved.n**2&&saved.paint.every(c=>Number.isInteger(c)&&c>=-1&&c<6)){n=saved.n;paint=saved.paint;}}catch{}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){try{localStorage.setItem(storageKey,JSON.stringify({n,paint}));}catch{}}
function cancelMotion(){playing=false;epoch++;if(animation){animation.cancel();animation=null;}pumpRunning=false;}
function discardLesson(){cancelMotion();worker?.terminate();worker=null;lesson=null;timeline=null;index=0;openStage=null;document.body.classList.remove('busy');$('solve').disabled=false;$('solve').innerHTML='开始学习 <span aria-hidden="true">→</span>';$('scene-status').textContent='先观察，再动手';}

function renderPalette(){
  $('palette').innerHTML=NAMES.map((name,c)=>{const count=paint.filter(v=>v===c).length;return `<button class="swatch" data-color="${c}" aria-label="${name}色" aria-pressed="${color===c}"><span class="swatch-dot" style="background:${COLORS[c]}">${color===c?'✓':''}</span><span>${name}</span><span class="swatch-count ${count>n*n?'over':''}">${count}/${n*n}</span></button>`;}).join('');
}
function renderNet(){
  $('net').style.setProperty('--n',n);
  $('net').innerHTML=[0,4,2,1,5,3].map(f=>{
    const label=`<p class="face-label">${faceNames[f]} ${FACES[f]}</p>`;
    const cells=Array.from({length:n*n},(_,j)=>{const i=f*n*n+j,locked=n===3&&j===4;return `<button class="paint-cell ${paint[i]<0?'empty-cell':''}" data-cell="${i}" ${paint[i]>=0?`style="background:${COLORS[paint[i]]}"`:''} ${locked?'disabled':''} aria-label="${faceNames[f]}面第${Math.floor(j/n)+1}行第${j%n+1}列：${paint[i]<0?'未上色':NAMES[paint[i]]+'色'}${locked?'，固定中心':''}"></button>`;}).join('');
    return `<div class="net-face face-${FACES[f]}">${f===3?'':label}<div class="stickers">${cells}</div>${f===3?label:''}</div>`;
  }).join('');
}
function renderValidation(){
  const checked=validate(paint,n),count=paint.filter(c=>c>=0).length;
  $('validation').classList.toggle('error',!checked.ok);
  $('validation').innerHTML=`<strong>已上色 ${count} / ${6*n*n}　${checked.ok?'✓ 状态有效':''}</strong><p>${esc(checked.ok?'可以开始学习。也可以清空后录入你的实物。':checked.error)}</p>`;
}
const tileRotations=['rotateX(90deg)','rotateY(90deg)','','rotateX(-90deg)','rotateY(-90deg)','rotateY(180deg)'];
function drawCube(state=timeline?timeline.states[index]:paint,turn=null){
  const pitch=n===3?71:53.25,g=geometry(n),map=new Map(g.map(s=>[[s.p.join(','),s.f].join(':'),s.i]));
  const focus=new Set(index<(timeline?.steps.length||0)?currentStep()?.focus:[]);
  const size=pitch-1,all=[],active=[];
  for(let x=-(n-1);x<n;x+=2)for(let y=-(n-1);y<n;y+=2)for(let z=-(n-1);z<n;z+=2){
    const p=[x,y,z],faces=FACES.map((_,f)=>{
      const i=map.get(p.join(',')+':'+f),c=i===undefined?null:state[i];
      const background=c===null?'#27332b':c<0?'#bac1b3':COLORS[c];
      return `<div class="tile ${c===null?'inner':''} ${focus.has(i)?'focused':''}" ${i!==undefined?`data-sticker="${i}" data-color="${c}"`:''} style="width:${size}px;height:${size}px;left:${-size/2}px;top:${-size/2}px;background:${background};transform:${tileRotations[f]} translateZ(${pitch/2}px)"></div>`;
    }).join('');
    const cubie=`<div class="cubie" style="transform:translate3d(${x*pitch/2}px,${-y*pitch/2}px,${z*pitch/2}px)">${faces}</div>`;
    (turn?.affected(p)?active:all).push(cubie);
  }
  $('cube').innerHTML=`<div class="slice">${all.join('')}</div><div class="slice ${turn?'active':''}" id="active-slice">${active.join('')}</div>`;
  $('cube').style.transform=`rotateX(${angleX}deg) rotateY(${angleY}deg)`;
}
function currentStep(){return timeline?.steps[Math.min(index,timeline.steps.length-1)];}
function renderStages(){
  const stages=lesson?.stages||(n===3?STAGES:[...REDUCTION_STAGES,...STAGES]);
  const current=currentStep(),active=timeline&&index===timeline.steps.length?stages.length-1:(current?.stage??0),visible=openStage??active;
  const state=timeline?.states[index]||paint;
  let checks=stageChecks(state,n);
  if(n===4){
    const centerOK=pieces(4).filter(p=>p.length===1).every(([i])=>state[i]===Math.floor(i/16));
    let paired=false,reduced=null;try{reduced=reducedState(state);paired=true;}catch{}
    const reductionOK=centerOK&&paired&&validate(reduced,3).ok;
    checks=[centerOK,centerOK&&paired,reductionOK,...(reductionOK?stageChecks(reduced,3):Array(7).fill(false))];
  }
  $('stages').innerHTML=stages.map((stage,i)=>{
    const stageSteps=timeline?.steps.map((s,j)=>s.stage===i?j:-1).filter(j=>j>=0)||[];
    const done=!!lesson&&checks[i];
    const expanded=i===visible,group=current?lesson.groups[current.groupIndex]:null,isCurrent=i===active;
    const body=expanded?`<div class="stage-body"><p>${esc(stage.why)}</p><div class="goal-box"><strong>当前目标</strong>${esc(stage.goal)}</div>${lesson&&stageSteps.length===0?'<p>该阶段无需单独的动作；完成前面的步骤后，请检查上方目标。</p>':''}${group&&isCurrent&&index<timeline.steps.length?`<p>${esc(group.explanation)}</p><div class="current-move"><strong>当前转动${current.role?' · '+current.role:''} · 本组第 ${current.moveIndex+1} / ${group.moves.length} 步</strong><div class="move-detail"><kbd>${esc(current.move.replaceAll("'",'′'))}</kbd><span>${esc(describeMove(current.move,n))}<br><span class="formula-note">正对正在转的那一面看。细框标记本组观察块。</span></span></div></div>`:''}${lesson&&index===timeline.steps.length&&isCurrent?'<div class="current-move"><strong>✓ 还原完成</strong>回看任一阶段，把这次学会的动作再练一遍。</div>':''}</div>`:'';
    return `<div class="stage ${expanded?'active':''} ${done?'done':''}"><button class="stage-heading" data-stage="${i}" aria-expanded="${expanded}"><span class="stage-num">${done?'✓':i+1}</span><span>${esc(stage.title)}</span><span class="stage-arrow">${expanded?'⌃':'⌄'}</span></button>${body}</div>`;
  }).join('');
}
function updateControls(){
  const total=timeline?.steps.length||0,has=!!timeline&&total>0;
  const running=playing||animation?.playState==='running';
  $('first').disabled=!has||index===0;$('prev').disabled=!has||index===0;
  $('play').disabled=!has||index===total;$('next').disabled=!has||index===total;$('replay').disabled=!has;
  $('export').disabled=!lesson;$('progress').disabled=!has;$('progress').max=total;$('progress').value=index;
  $('play').textContent=running?'Ⅱ':'▶';$('play').setAttribute('aria-label',running?'暂停':'播放');
  $('step-count').textContent=`${index} / ${total}`;
  const step=currentStep(),stage=step&&lesson.stages[step.stage];
  $('progress-label').textContent=!lesson?'准备好后，开始你的第一步':index===total?'✓ 已完成全部步骤':`${stage.title} · 第 ${index+1} 次转动`;
  if(lesson)$('scene-status').textContent=index===total?'完整还原 · 每一步都值得回看':running?'跟着动画，慢慢来':animation?.playState==='paused'?'已暂停 · 可继续或回退':'已暂停 · 按下一步跟练';
  const group=step&&lesson.groups[step.groupIndex];
  $('move-strip').innerHTML=group?group.moves.map((m,k)=>`<button class="move-chip ${k===step.moveIndex&&index<total?'current':''} ${k<step.moveIndex?'done':''}" data-group-step="${timeline.ranges[step.groupIndex].start+k}" title="回到本组第 ${k+1} 步">${esc(m.replaceAll("'",'′'))}</button>`).join(''):'';
  $('play-note').textContent=!lesson?'可以暂停、回退，也可以只重播一组动作。':index===total?'完成了！你可以回到第一步，再跟着练一次。':'正对该面判断顺逆时针 · 拖动视角不改变公式方向';
  renderStages();
}
function renderAll(){
  $('cube-title').textContent=n===3?'三阶魔方':'四阶魔方';
  $('method-label').textContent=n===3?'初学者逐层法 · 黄底起步':'基础三循环降阶 → 三阶逐层法';
  document.querySelectorAll('[data-size]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.size)===n));
  $('input-orientation').textContent=n===3?'固定白面朝上，绿面朝前，红面在右。':'固定一个拿法，按上、前、右方向录入。中心颜色不决定当前面的名称。';
  $('lesson-intro').textContent=n===3?'从底层开始，逐步完成，理解每一步。':'先拼中心，再配棱，然后像三阶一样解。';
  renderPalette();renderNet();renderValidation();drawCube();updateControls();
  if(!lesson){$('lesson-summary').textContent='生成解法后可展开';$('lesson-list').innerHTML='<p class="muted">先录入你的魔方，再点击“开始学习”。</p>';}
}
function renderLessonList(){
  const total=timeline.steps.length;
  $('lesson-summary').textContent=`${lesson.stages.length} 个阶段 · ${lesson.groups.length} 组动作 · ${total} 次转动`;
  $('lesson-list').innerHTML=lesson.stages.map((s,i)=>{
    let count=0;
    const content=lesson.groups.map((group,gi)=>{if(group.stage!==i)return '';count++;const start=timeline.ranges[gi].start;
      return `<div class="lesson-group"><p><b>第 ${count} 组</b> · ${esc(group.explanation)}</p><code>${esc(group.formula.replaceAll("'",'′'))}</code><details><summary>展开本组的每一次转动</summary><ol start="${start+1}">${group.moves.map(m=>`<li><b>${esc(m.replaceAll("'",'′'))}</b> — ${esc(describeMove(m,n))}</li>`).join('')}</ol></details></div>`;
    }).join('');
    return `<section class="lesson-stage"><h3>${i+1}. ${esc(s.title)}</h3>${content||'<p class="muted">完成前面步骤后，本阶段将自然满足，无需单独转动。</p>'}</section>`;
  }).join('');
}
function jump(value){cancelMotion();index=Math.max(0,Math.min(Number(value)||0,timeline?.steps.length||0));openStage=null;drawCube();updateControls();}
async function forward(){
  if(!timeline||index>=timeline.steps.length||animation)return false;
  const turn=moveInfo(timeline.steps[index].move,n),ticket=epoch;
  drawCube(timeline.states[index],turn);
  const cssAxis=['X','Y','Z'][turn.axis],degrees=turn.angle*90*(turn.axis===1?1:-1);
  const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?120:800;
  const motion=$('active-slice').animate([{transform:`rotate${cssAxis}(0deg)`},{transform:`rotate${cssAxis}(${degrees}deg)`}],{duration,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
  motion.playbackRate=Number($('speed').value);animation=motion;updateControls();
  try{await motion.finished;}catch{return false;}
  if(ticket!==epoch)return false;
  animation=null;index++;openStage=null;drawCube();updateControls();return true;
}
async function pump(){
  if(pumpRunning)return;pumpRunning=true;const ticket=epoch;
  // A manually requested turn may already be paused or in motion. Its forward()
  // call owns committing the snapshot; wait for it before autoplay continues.
  if(animation){try{await animation.finished;}catch{}}
  while(playing&&ticket===epoch&&index<timeline.steps.length&&index<playLimit){const ok=await forward();if(!ok)break;await new Promise(r=>setTimeout(r,140/Number($('speed').value)));}
  if(ticket===epoch){pumpRunning=false;playing=false;updateControls();}
}
function togglePlay(){
  if(!timeline||index===timeline.steps.length)return;
  const running=playing||animation?.playState==='running';
  playing=!running;
  if(running)animation?.pause();
  else{playLimit=Infinity;if(animation?.playState==='paused')animation.play();pump();}
  updateControls();
}
function startLesson(){
  const checked=validate(paint,n);
  if(!checked.ok){renderValidation();$('validation').scrollIntoView({block:'nearest',behavior:'smooth'});return;}
  discardLesson();document.body.classList.add('busy');$('solve').disabled=true;$('solve').textContent='正在生成教学步骤';
  const activeWorker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});worker=activeWorker;
  const fail=message=>{activeWorker.terminate();if(worker!==activeWorker)return;worker=null;document.body.classList.remove('busy');$('solve').disabled=false;$('solve').textContent='重新生成教学 →';$('validation').classList.add('error');$('validation').textContent=message;};
  activeWorker.onerror=()=>fail('教学计算未能启动，请刷新重试；请通过本地预览地址或 GitHub Pages 打开页面。');
  activeWorker.onmessage=({data})=>{
    if(worker!==activeWorker)return;
    if(data.type==='progress'){$('scene-status').textContent='正在生成：'+data.message;return;}
    if(data.type==='error'){fail(data.message);return;}
    try{
      lesson=data.result;timeline=createTimeline(paint,n,lesson);index=0;
      if(!isSolved(timeline.states.at(-1),n))throw Error('回放校验未通过，没有展示未验证的解法。');
      activeWorker.terminate();worker=null;document.body.classList.remove('busy');$('solve').disabled=false;$('solve').textContent='重新生成教学 →';
      drawCube();updateControls();renderLessonList();
      if(!timeline.steps.length){$('validation').classList.remove('error');$('validation').innerHTML='<strong>✓ 这个魔方已经还原了</strong><p>涂入实物颜色，或者点击“换个示例”开始练习。</p>';}
    }catch(error){lesson=null;timeline=null;fail(error.message);updateControls();}
  };
  activeWorker.postMessage({state:paint,n});
}

$('palette').addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(b){color=Number(b.dataset.color);renderPalette();}});
$('net').addEventListener('click',e=>{const b=e.target.closest('[data-cell]');if(!b||b.disabled)return;discardLesson();paint[Number(b.dataset.cell)]=color;save();renderAll();});
document.querySelectorAll('[data-size]').forEach(b=>b.addEventListener('click',()=>{if(n===Number(b.dataset.size))return;discardLesson();n=Number(b.dataset.size);paint=applyMoves(solved(n),n,scramble(n,n===3?20:30));angleX=-24;angleY=-34;save();renderAll();}));
$('example').onclick=()=>{discardLesson();paint=applyMoves(solved(n),n,scramble(n,n===3?22:34));save();renderAll();};
$('clear').onclick=()=>{discardLesson();paint=Array(6*n*n).fill(-1);if(n===3)for(let f=0;f<6;f++)paint[f*9+4]=f;save();renderAll();};
$('reset').onclick=()=>{discardLesson();paint=solved(n);save();renderAll();};
$('solve').onclick=startLesson;$('play').onclick=togglePlay;
$('next').onclick=()=>{if(!timeline)return;cancelMotion();drawCube();forward();};
$('prev').onclick=()=>{if(timeline)jump(index-1);};$('first').onclick=()=>jump(0);
$('replay').onclick=()=>{if(!timeline?.steps.length)return;const gi=currentStep().groupIndex,range=timeline.ranges[gi];jump(range.start);playing=true;playLimit=range.end;pump();updateControls();};
$('progress').oninput=e=>{if(timeline)jump(e.target.value);};
$('speed').oninput=e=>{$('speed-output').textContent=e.target.value+'×';if(animation)animation.updatePlaybackRate(Number(e.target.value));};
$('move-strip').onclick=e=>{const b=e.target.closest('[data-group-step]');if(b)jump(b.dataset.groupStep);};
$('stages').onclick=e=>{const b=e.target.closest('[data-stage]');if(b){const s=Number(b.dataset.stage);openStage=openStage===s?null:s;renderStages();}};
$('view-reset').onclick=()=>{angleX=-24;angleY=-34;$('cube').style.transform=`rotateX(${angleX}deg) rotateY(${angleY}deg)`;};
let drag=null;
$('scene').onpointerdown=e=>{
  if(e.button!==0)return;
  e.preventDefault();
  window.getSelection()?.removeAllRanges();
  drag={x:e.clientX,y:e.clientY,ax:angleX,ay:angleY};$('scene').setPointerCapture(e.pointerId);
};
$('scene').onselectstart=$('scene').ondragstart=e=>e.preventDefault();
$('scene').onpointermove=e=>{if(!drag)return;angleX=Math.max(-85,Math.min(85,drag.ax-(e.clientY-drag.y)*.4));angleY=drag.ay+(e.clientX-drag.x)*.4;$('cube').style.transform=`rotateX(${angleX}deg) rotateY(${angleY}deg)`;};
$('scene').onpointerup=$('scene').onpointercancel=$('scene').onlostpointercapture=()=>drag=null;
$('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();
$('help-dialog').onclick=e=>{if(e.target===$('help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
document.addEventListener('keydown',e=>{
  if($('help-dialog').open||e.target.closest('input,textarea,select'))return;
  if(e.code==='Space'&&!e.target.closest('button,a,summary')){e.preventDefault();togglePlay();}
  if(e.key==='ArrowLeft'&&timeline){e.preventDefault();jump(index-1);}
  if(e.key==='ArrowRight'&&timeline){e.preventDefault();cancelMotion();drawCube();forward();}
});
$('export').onclick=()=>{
  if(!lesson)return;let step=0;const lines=[`方寸 · ${n}阶魔方完整教学`,'参照方向：白上、绿前、红右。从黄色底层开始。','顺逆时针以正对正在转动的那一面看为准。',''];
  lesson.stages.forEach((s,i)=>{lines.push(`${i+1}. ${s.title}`,s.goal,s.why,'');const groups=lesson.groups.filter(g=>g.stage===i);
    if(!groups.length)lines.push('此阶段已满足，无需转动。','');
    for(const g of groups){lines.push(g.explanation,`完整公式：${g.formula}`);for(const move of g.moves)lines.push(`${++step}. ${move}：${describeMove(move,n)}`);lines.push('');}
  });
  const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\n')],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`方寸-${n}阶-完整中文教学.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
renderAll();
