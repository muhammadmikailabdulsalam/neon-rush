const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha:false });

const scoreEl=document.getElementById("score"), bestEl=document.getElementById("best");
const coinsEl=document.getElementById("coins"), speedEl=document.getElementById("speed");
const livesEl=document.getElementById("lives"), overlay=document.getElementById("overlay");
const message=document.getElementById("message"), startBtn=document.getElementById("startBtn");
const pauseBtn=document.getElementById("pauseBtn"), fullscreenBtn=document.getElementById("fullscreenBtn");
const toast=document.getElementById("toast");

let W=480,H=800,dpr=1;
let state="menu", last=0, elapsed=0, score=0, coins=0, lives=3, best=Number(localStorage.getItem("neonRushBest")||0);
let roadOffset=0, spawnTimer=0, coinTimer=0, shake=0;
let selectedCar="cyan", steer=0;
const keys={left:false,right:false};

const player={x:.5,y:.82,w:.115,h:.19,vx:0};
const traffic=[];
const pickups=[];
const particles=[];
const stars=[];
for(let i=0;i<90;i++) stars.push({x:Math.random(),y:Math.random(),s:Math.random()*2+.4,a:Math.random()*.8+.2});

const cars={
 cyan:{body:"#18dfff",dark:"#067fbd",glass:"#aef7ff"},
 red:{body:"#ff3d68",dark:"#a8123b",glass:"#ffd1da"},
 gold:{body:"#ffd23f",dark:"#a66a08",glass:"#fff0a7"}
};

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);
  W=innerWidth; H=innerHeight;
  canvas.width=Math.floor(W*dpr); canvas.height=Math.floor(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener("resize",resize); resize();

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function rand(a,b){return a+Math.random()*(b-a)}
function roadAt(y){
  const t=y/H;
  const horizon=H*.31;
  const p=clamp((y-horizon)/(H-horizon),0,1);
  const width=W*(.16+.69*Math.pow(p,.82));
  return {cx:W/2,width};
}
function carColor(type){return cars[type]||cars.cyan}

function roundedRect(x,y,w,h,r){
  r=Math.min(r,w/2,h/2); ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}

function drawBackground(){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"#020516");g.addColorStop(.48,"#071633");g.addColorStop(1,"#050713");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);

  for(const s of stars){
    ctx.globalAlpha=s.a*(.55+.45*Math.sin(elapsed*.001+s.x*20));
    ctx.fillStyle="#d8f7ff";ctx.fillRect(s.x*W,s.y*H*.42,s.s,s.s);
  }
  ctx.globalAlpha=1;

  // Moon/glow
  const mg=ctx.createRadialGradient(W*.78,H*.18,2,W*.78,H*.18,W*.18);
  mg.addColorStop(0,"rgba(180,240,255,.22)");mg.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=mg;ctx.fillRect(0,0,W,H*.45);
  ctx.fillStyle="rgba(210,245,255,.75)";ctx.beginPath();ctx.arc(W*.78,H*.18,Math.min(W,H)*.035,0,Math.PI*2);ctx.fill();

  // City skyline
  const horizon=H*.31;
  ctx.fillStyle="#030817";
  let x=0;
  while(x<W){
    const bw=rand(24,65), bh=rand(18,H*.13);
    ctx.fillRect(x,horizon-bh,bw,bh);
    ctx.fillStyle="rgba(55,180,210,.18)";
    for(let wy=horizon-bh+8;wy<horizon-4;wy+=11){
      for(let wx=x+7;wx<x+bw-5;wx+=13) if(Math.random()>.45) ctx.fillRect(wx,wy,4,3);
    }
    ctx.fillStyle="#030817"; x+=bw+rand(2,8);
  }

  // Horizon glow
  const hg=ctx.createLinearGradient(0,horizon-35,0,horizon+30);
  hg.addColorStop(0,"rgba(30,220,255,.0)");hg.addColorStop(.55,"rgba(30,220,255,.16)");hg.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=hg;ctx.fillRect(0,horizon-40,W,80);
}

function drawRoad(){
  const horizon=H*.31, bottom=H+40;
  const top=roadAt(horizon), bot=roadAt(H);
  ctx.fillStyle="#111827";
  ctx.beginPath();ctx.moveTo(top.cx-top.width/2,horizon);ctx.lineTo(top.cx+top.width/2,horizon);
  ctx.lineTo(bot.cx+bot.width/2,bottom);ctx.lineTo(bot.cx-bot.width/2,bottom);ctx.closePath();ctx.fill();

  // road texture
  ctx.strokeStyle="rgba(255,255,255,.025)";ctx.lineWidth=1;
  for(let i=0;i<18;i++){
    const yy=horizon+(i/18)*(H-horizon);
    ctx.beginPath();ctx.moveTo(roadAt(yy).cx-roadAt(yy).width/2,yy);ctx.lineTo(roadAt(yy).cx+roadAt(yy).width/2,yy);ctx.stroke();
  }

  // Neon road edges
  ctx.strokeStyle="rgba(50,235,255,.85)";ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(top.cx-top.width/2,horizon);ctx.lineTo(bot.cx-bot.width/2,bottom);ctx.stroke();
  ctx.beginPath();ctx.moveTo(top.cx+top.width/2,horizon);ctx.lineTo(bot.cx+bot.width/2,bottom);ctx.stroke();

  // Lane dashes
  const lanes=3;
  for(let lane=1;lane<lanes;lane++){
    const f=(lane/lanes);
    for(let i=0;i<12;i++){
      let p=((i/12 + roadOffset)%1);
      let y=horizon+Math.pow(p,1.75)*(H-horizon);
      let r=roadAt(y);
      let x=r.cx-r.width/2+r.width*f;
      let dash=7+42*p;
      ctx.strokeStyle=`rgba(210,250,255,${.12+.6*p})`;ctx.lineWidth=1+3*p;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+dash);ctx.stroke();
    }
  }

  // roadside lights
  for(let i=0;i<13;i++){
    let p=((i/13+roadOffset*.9)%1);
    let y=horizon+Math.pow(p,1.8)*(H-horizon);
    let r=roadAt(y), h=7+38*p;
    for(const side of [-1,1]){
      const x=r.cx+side*(r.width/2+10+22*p);
      ctx.strokeStyle="rgba(76,240,255,.5)";ctx.lineWidth=1+2*p;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-h);ctx.stroke();
      ctx.fillStyle=`rgba(120,250,255,${.3+.7*p})`;ctx.shadowBlur=10;ctx.shadowColor="#4cf5ff";
      ctx.beginPath();ctx.arc(x,y-h,2+2*p,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
  }
}

function projectX(norm,y){const r=roadAt(y);return r.cx-r.width/2+norm*r.width}
function drawCar(x,y,w,h,type,angle=0,playerCar=false){
  const c=carColor(type);
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  ctx.translate(-w/2,-h/2);

  // shadow
  ctx.fillStyle="rgba(0,0,0,.45)";ctx.beginPath();ctx.ellipse(w/2,h*.9,w*.48,h*.12,0,0,Math.PI*2);ctx.fill();

  // wheels
  ctx.fillStyle="#05070d";
  for(const yy of [h*.25,h*.75]){ctx.beginPath();ctx.roundRect(-w*.07,yy-h*.10,w*.22,h*.20,w*.06);ctx.fill();ctx.beginPath();ctx.roundRect(w*.85,yy-h*.10,w*.22,h*.20,w*.06);ctx.fill()}
  ctx.fillStyle="#8795a8";
  for(const yy of [h*.25,h*.75]){ctx.beginPath();ctx.arc(w*.04,yy,w*.055,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(w*.96,yy,w*.055,0,Math.PI*2);ctx.fill()}

  // body
  ctx.shadowBlur=playerCar?18:7;ctx.shadowColor=c.body;ctx.fillStyle=c.body;
  roundedRect(w*.08,0,w*.84,h,Math.min(w,h)*.16);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle=c.dark;roundedRect(w*.15,h*.17,w*.70,h*.62,Math.min(w,h)*.16);ctx.fill();

  // cabin/glass
  ctx.fillStyle=c.glass;
  ctx.beginPath();ctx.moveTo(w*.25,h*.16);ctx.quadraticCurveTo(w*.5,h*.03,w*.75,h*.16);
  ctx.lineTo(w*.67,h*.43);ctx.lineTo(w*.33,h*.43);ctx.closePath();ctx.fill();
  ctx.fillStyle="rgba(5,15,30,.72)";
  ctx.beginPath();ctx.moveTo(w*.30,h*.17);ctx.quadraticCurveTo(w*.5,h*.08,w*.70,h*.17);ctx.lineTo(w*.62,h*.38);ctx.lineTo(w*.38,h*.38);ctx.closePath();ctx.fill();

  // center stripe + highlights
  if(playerCar){ctx.fillStyle="rgba(255,255,255,.9)";ctx.fillRect(w*.47,0,w*.06,h)}
  ctx.fillStyle="rgba(255,255,255,.38)";roundedRect(w*.16,h*.07,w*.68,h*.035,w*.02);ctx.fill();

  // lights
  ctx.shadowBlur=12;ctx.shadowColor="#eaffff";ctx.fillStyle="#f8ffff";
  for(const xx of [.25,.75]){ctx.beginPath();ctx.ellipse(w*xx,h*.08,w*.08,h*.035,0,0,Math.PI*2);ctx.fill()}
  ctx.shadowBlur=0;
  ctx.fillStyle="#ff244f";ctx.fillRect(w*.19,h*.87,w*.18,h*.045);ctx.fillRect(w*.63,h*.87,w*.18,h*.045);

  // mirrors
  ctx.fillStyle=c.body;ctx.fillRect(w*.02,h*.28,w*.11,h*.08);ctx.fillRect(w*.87,h*.28,w*.11,h*.08);

  ctx.restore();
}

function spawnTraffic(){
  const lane=Math.floor(rand(0,3));
  const y=H*.38;
  traffic.push({lane,n: (lane+.5)/3, y, speed:rand(.55,1.05), type:["red","gold","cyan"][Math.floor(rand(0,3))]});
}
function spawnCoin(){
  const lane=Math.floor(rand(0,3));
  pickups.push({lane,n:(lane+.5)/3,y:H*.34,spin:0});
}
function burst(x,y,base="#58efff",count=18){
  for(let i=0;i<count;i++) particles.push({x,y,vx:rand(-2.5,2.5),vy:rand(-3.5,1),life:rand(.35,.8),max:.8,size:rand(1,4),color:base});
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.life-=dt;p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;p.vy+=4*dt;
    if(p.life<=0)particles.splice(i,1);
  }
}
function drawParticles(){
  for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size)}
  ctx.globalAlpha=1;
}
function hit(a,b){
  const ax=a.x, ay=a.y, aw=a.w, ah=a.h;
  return Math.abs(ax-b.x)<(aw+b.w)/2 && Math.abs(ay-b.y)<(ah+b.h)/2;
}

function update(dt){
  elapsed+=dt*1000;
  const speed=Math.min(1.75, .75+score/9000);
  roadOffset=(roadOffset+dt*speed*.9)%1;

  const target=(keys.left?-1:0)+(keys.right?1:0);
  steer += (target-steer)*Math.min(1,dt*10);
  player.x += steer*dt*.42;
  player.x=clamp(player.x,.19,.81);

  spawnTimer-=dt;coinTimer-=dt;
  if(spawnTimer<=0){spawnTraffic();spawnTimer=rand(.75,1.35)/speed}
  if(coinTimer<=0){spawnCoin();coinTimer=rand(1.0,1.8)}

  for(let i=traffic.length-1;i>=0;i--){
    const t=traffic[i]; t.y += dt*(170+speed*90)*t.speed;
    if(t.y>H+120){traffic.splice(i,1);score+=15;continue}
    t.x=projectX(t.n,t.y);
    t.w=roadAt(t.y).width*.19;t.h=t.w*1.65;
    const px=projectX(player.x,player.y*H);
    if(hit({x:px,y:player.y*H,w:roadAt(player.y*H).width*.22,h:H*.16},{x:t.x,y:t.y,w:t.w,h:t.h})){
      traffic.splice(i,1);lives--;shake=.25;burst(px,player.y*H,"#ff4770",28);
      toastMsg("CRASH!");
      if(lives<=0){gameOver();return}
    }
  }

  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i];p.y+=dt*(170+speed*90)*.8;p.spin+=dt*7;
    p.x=projectX(p.n,p.y);
    if(p.y>H+50){pickups.splice(i,1);continue}
    const px=projectX(player.x,player.y*H);
    if(Math.abs(px-p.x)<roadAt(p.y).width*.12 && Math.abs(player.y*H-p.y)<H*.10){
      pickups.splice(i,1);coins++;score+=75;burst(p.x,p.y,"#ffd94a",14);toastMsg("+ COIN")}
  }

  score+=dt*22*speed;
  best=Math.max(best,Math.floor(score));
  scoreEl.textContent=Math.floor(score);bestEl.textContent=best;
  coinsEl.textContent=coins;speedEl.textContent=Math.floor(90+speed*70);
  livesEl.innerHTML="♥".repeat(lives).split("").map(x=>`<span class="life">${x}</span>`).join("");
  updateParticles(dt);
}

function draw(){
  drawBackground();drawRoad();

  // coins
  for(const p of pickups){
    const r=roadAt(p.y), rad=Math.max(5,r.width*.045);
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(Math.abs(Math.cos(p.spin))*.7+.3,1);
    ctx.shadowBlur=16;ctx.shadowColor="#ffd94a";ctx.fillStyle="#ffd94a";
    ctx.beginPath();ctx.arc(0,0,rad,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle="#fff1a0";ctx.font=`bold ${rad*1.2}px system-ui`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("$",0,1);
    ctx.restore();
  }

  for(const t of traffic) drawCar(t.x,t.y,t.w,t.h,t.type,0,false);

  const py=player.y*H, pw=roadAt(py).width*.22, ph=pw*1.65;
  const px=projectX(player.x,py);
  drawCar(px,py,pw,ph,selectedCar,-steer*.12,true);

  drawParticles();

  if(shake>0){/* shake is visual-only timer retained for crash feedback */}
}

function gameLoop(ts){
  const dt=Math.min(.034,(ts-last)/1000||0);last=ts;
  if(state==="playing")update(dt);
  draw();
  shake=Math.max(0,shake-dt);
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

function startGame(){
  score=0;coins=0;lives=3;spawnTimer=.5;coinTimer=1;traffic.length=0;pickups.length=0;particles.length=0;
  state="playing";overlay.classList.remove("show");pauseBtn.textContent="Ⅱ";fullscreen();
}
function pauseGame(){
  if(state==="playing"){state="paused";overlay.classList.add("show");message.textContent="Race paused. Ready when you are.";startBtn.textContent="RESUME";pauseBtn.textContent="▶"}
  else if(state==="paused"){state="playing";overlay.classList.remove("show");pauseBtn.textContent="Ⅱ"}
}
function gameOver(){
  state="gameover";localStorage.setItem("neonRushBest",best);bestEl.textContent=best;
  message.textContent=`Final score: ${Math.floor(score)} • Coins: ${coins}`;
  startBtn.textContent="RACE AGAIN";overlay.classList.add("show");pauseBtn.textContent="Ⅱ";
}
function toastMsg(t){toast.textContent=t;toast.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>toast.classList.remove("show"),650)}
function fullscreen(){
  const el=document.documentElement;
  if(!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(()=>{});
}
startBtn.onclick=()=>state==="paused"?(state="playing",overlay.classList.remove("show"),pauseBtn.textContent="Ⅱ"):startGame();
pauseBtn.onclick=pauseGame;
fullscreenBtn.onclick=fullscreen;

document.querySelectorAll(".car-choice").forEach(b=>b.onclick=()=>{
  selectedCar=b.dataset.car;
  document.querySelectorAll(".car-choice").forEach(x=>x.classList.remove("active"));b.classList.add("active");
});

function setKey(dir,on){keys[dir]=on}
addEventListener("keydown",e=>{
  if(["ArrowLeft","a","A"].includes(e.key)){setKey("left",true);e.preventDefault()}
  if(["ArrowRight","d","D"].includes(e.key)){setKey("right",true);e.preventDefault()}
  if(e.key===" "||e.key==="p"||e.key==="P")pauseGame();
});
addEventListener("keyup",e=>{
  if(["ArrowLeft","a","A"].includes(e.key))setKey("left",false);
  if(["ArrowRight","d","D"].includes(e.key))setKey("right",false);
});

function bindControl(id,dir){
  const el=document.getElementById(id);
  const on=e=>{e.preventDefault();setKey(dir,true)};
  const off=e=>{e.preventDefault();setKey(dir,false)};
  el.addEventListener("pointerdown",on);
  ["pointerup","pointercancel","pointerleave"].forEach(x=>el.addEventListener(x,off));
}
bindControl("leftBtn","left");bindControl("rightBtn","right");

bestEl.textContent=best;
livesEl.innerHTML="♥♥♥".split("").map(x=>`<span class="life">${x}</span>`).join("");
