/* ══════════════════════════════════════
   game-engine.js — محرك اللعبة
   تحدي الأرقام
══════════════════════════════════════ */

const GameEngine = {

  /* ── Constants ── */
  COLORS: {
    cyan:  {l:"سماوي", h:"#00E5FF", b:"rgba(0,229,255,.1)"},
    red:   {l:"أحمر",  h:"#FF3D5A", b:"rgba(255,61,90,.1)"},
    green: {l:"أخضر",  h:"#00E676", b:"rgba(0,230,118,.1)"},
    yellow:{l:"ذهبي",  h:"#FFD046", b:"rgba(255,208,70,.1)"}
  },
  OFF_COLORS: ["cyan","red","green","yellow"],
  LIFELINES: [
    {id:"audience", ico:"👥", lbl:"الجمهور", cost:5,  pro:false},
    {id:"remove",   ico:"✂️",  lbl:"حذف ×2",  cost:5,  pro:false},
    {id:"change",   ico:"🔄", lbl:"تغيير",   cost:8,  pro:false},
    {id:"freeze",   ico:"❄️",  lbl:"تجميد",   cost:6,  pro:true},
    {id:"yehaq",    ico:"⚡", lbl:"يحق لك",  cost:10, pro:true}
  ],
  // 20 cells: 1 each of Gold/Silver/Mabrook/Yehaq, 16 Normal
  BOARD_TYPES: ["N","N","N","N","N","N","N","N","N","N","N","N","N","N","N","N","G","S","M","Y"],
  CELL_INFO: {
    N:{label:"سؤال عادي",   color:"#8AB8FF", icon:"❓", bonus:0},
    G:{label:"ذهبي ★ +20",  color:"#FFD046", icon:"★",  bonus:20},
    S:{label:"فضي ◆ +15",   color:"#8AB8FF", icon:"◆",  bonus:15},
    M:{label:"مبروك +10",   color:"#00E676", icon:"🎉", bonus:10},
    Y:{label:"يحق لك ⚡",   color:"#FF3D5A", icon:"⚡", bonus:0}
  },
  TOTAL_CELLS: 20,
  TIMER_SEC:   30,
  STORE_KEY:   "tahadi_v7",
  FREE_LIMIT:  200,

  /* ── Game State ── */
  G: null, myId: null, isHost: false, isOffline: false,
  tiv: null, tleft: 30, frozen: false, ftout: null,
  yehaqPending: false,
  ansTO: null, pollIv: null,
  sc: "cyan", sj: "cyan",
  bc: null,

  /* ── Init ── */
  init(){
    try{ this.bc = new BroadcastChannel(this.STORE_KEY); }catch(e){}
    if(this.bc) this.bc.onmessage = e=>{
      if(e.data?.c === this.G?.code) this.syncFromStore();
    };
    window.addEventListener('storage', e=>{
      if(e.key?.startsWith(this.STORE_KEY) && this.G) this.syncFromStore();
    });
  },

  /* ── Helpers ── */
  shuffle(arr){ const r=[...arr]; for(let i=r.length-1;i>0;i--){const j=0|Math.random()*(i+1);[r[i],r[j]]=[r[j],r[i]];} return r; },
  genCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); },
  genBoard(){ return this.shuffle([...this.BOARD_TYPES]).map((t,i)=>({i,n:i+1,t,used:false,by:null})); },
  pickQuestions(){
    const isPro = TAHADI.isPro();
    const pool  = isPro ? window.QB : window.QB.slice(0, this.FREE_LIMIT);
    return this.shuffle(pool).slice(0, this.TOTAL_CELLS);
  },
  curTeam(){ return this.G.teams[this.G.ci]; },
  isMine(){ return this.isOffline || this.curTeam().id===this.myId || this.isHost; },
  calcPts(tl){ return Math.max(1, 10 - Math.floor((this.TIMER_SEC - tl) / 3)); },
  makeTeam(name, color, idx){
    return { id:"t"+Date.now()+idx, name, color, points:0, ca:0, gc:0, svc:0, mbc:0, yqc:0,
      ll:{audience:false, remove:false, change:false, freeze:false, yehaq:false} };
  },

  /* ── State Sync ── */
  saveState(){
    if(!this.G || this.isOffline) return;
    try{ localStorage.setItem(this.STORE_KEY+'_'+this.G.code, JSON.stringify(this.G)); }catch(e){}
    if(this.bc) this.bc.postMessage({c: this.G.code});
  },
  loadState(code){
    try{ const s=localStorage.getItem(this.STORE_KEY+'_'+code); return s?JSON.parse(s):null; }catch(e){ return null; }
  },
  syncFromStore(){
    if(!this.G || this.isOffline) return;
    const fresh = this.loadState(this.G.code);
    if(!fresh) return;
    const prev = {s:this.G.status, qi:this.G.qi, ci:this.G.ci, ph:this.G.phase};
    this.G = fresh;
    if(prev.s!==this.G.status || prev.qi!==this.G.qi || prev.ci!==this.G.ci || prev.ph!==this.G.phase)
      this.onStateChange?.();
    else
      this.onScoreUpdate?.();
  },
  startPoll(){ if(this.pollIv) return; this.pollIv=setInterval(()=>{ if(!this.G||this.isOffline){this.stopPoll();return;} this.syncFromStore(); },600); },
  stopPoll(){ clearInterval(this.pollIv); this.pollIv=null; },

  /* ── Start Offline ── */
  startOffline(teams){
    this.G = {
      code:"OFFLINE", tc:teams.length, status:"playing", teams,
      ci:0, qi:0, qs:this.pickQuestions(), board:this.genBoard(),
      cc:null, cq:null, phase:"sel"
    };
    this.myId="ALL"; this.isHost=true; this.isOffline=true;
  },

  /* ── Create Online Room ── */
  createRoom(name, color, teamCount){
    const host = this.makeTeam(name, color, 0);
    this.G = {
      code: this.genCode(), tc: teamCount, status:"waiting", teams:[host],
      ci:0, qi:0, qs:this.pickQuestions(), board:this.genBoard(),
      cc:null, cq:null, phase:"sel"
    };
    this.myId = host.id; this.isHost=true; this.isOffline=false;
    this.saveState();
    return this.G.code;
  },

  /* ── Join Room ── */
  joinRoom(code, name, color){
    const stored = this.loadState(code);
    if(!stored)            return {error:'الغرفة غير موجودة'};
    if(stored.teams.length >= stored.tc) return {error:'الغرفة ممتلئة'};
    if(stored.status !== 'waiting')      return {error:'اللعبة بدأت بالفعل'};
    if(stored.teams.some(t=>t.color===color)) return {error:'اللون محجوز'};

    const t = this.makeTeam(name, color, stored.teams.length);
    stored.teams.push(t);
    this.G = stored; this.myId = t.id; this.isHost=false; this.isOffline=false;
    this.saveState();
    return {ok:true};
  },

  /* ── Start Game ── */
  startGame(){
    if(!this.G || this.G.teams.length < 2) return false;
    this.G.status = "playing"; this.G.phase = "sel";
    this.saveState();
    return true;
  },

  /* ── Select Cell ── */
  selectCell(idx){
    if(this.G.phase !== 'sel') return {error:'not_sel_phase'};
    if(!this.isMine())         return {error:'not_your_turn'};
    const cell = this.G.board[idx];
    if(!cell || cell.used)     return {error:'used'};
    this.G.cc = cell; this.G.phase = 'ans'; this.G.cq = this.G.qs[this.G.qi];
    this.saveState();
    return {ok:true, cell, question:this.G.cq};
  },

  /* ── Submit Answer ── */
  submitAnswer(letter){
    if(this.G.phase !== 'ans' || !this.isMine()) return {error:'invalid'};
    const snap = this.tleft;
    this.stopTimer();
    this.G.phase = 'res';
    const q  = this.G.cq;
    const ok = letter === q.correct;
    let base=0, bonus=0;
    if(ok){
      base  = this.calcPts(snap);
      bonus = this.CELL_INFO[this.G.cc.t]?.bonus || 0;
      const t = this.curTeam();
      t.points += base + bonus; t.ca++;
      const ct = this.G.cc.t;
      if(ct==='G') t.gc++; if(ct==='S') t.svc++; if(ct==='M') t.mbc++;
      if(ct==='Y') this.yehaqPending = true;
    }
    if(this.G.cc){ this.G.cc.used=true; this.G.cc.by=this.curTeam().color; }
    this.saveState();
    return {ok, letter, correct:q.correct, base, bonus, snap, team:this.curTeam()};
  },

  /* ── Next Turn ── */
  nextTurn(){
    this.G.qi++;
    if(this.G.qi >= this.TOTAL_CELLS){ this.endGame(); return {ended:true}; }
    this.G.ci = (this.G.ci + 1) % this.G.teams.length;
    this.G.phase = 'sel'; this.G.cc=null; this.G.cq=null;
    this.yehaqPending = false; this.frozen = false;
    this.saveState();
    return {team: this.curTeam()};
  },

  /* ── End Game ── */
  endGame(){
    this.G.status = 'finished';
    this.stopTimer(); this.stopPoll();
    this.saveState();
  },

  /* ── Timer ── */
  startTimer(onTick, onEnd){
    this.stopTimer();
    this.tleft = this.TIMER_SEC; this.frozen = false;
    onTick?.(this.tleft);
    if(!this.isMine()) return;
    this.tiv = setInterval(()=>{
      if(this.frozen) return;
      this.tleft--;
      onTick?.(this.tleft);
      if(this.tleft <= 0){ this.stopTimer(); onEnd?.(); }
    }, 1000);
  },
  stopTimer(){ clearInterval(this.tiv); this.tiv=null; },

  /* ── Lifelines ── */
  useLifeline(id){
    if(!this.isMine()) return {error:'not_your_turn'};
    const t  = this.curTeam();
    const ll = this.LIFELINES.find(l=>l.id===id);
    if(!ll) return {error:'invalid'};
    if(t.ll[id]) return {error:'already_used'};
    if(ll.pro && !TAHADI.isPro()) return {error:'pro_required'};
    if(t.points < ll.cost && id!=='yehaq') return {error:'insufficient_points'};
    t.points = Math.max(0, t.points - ll.cost);
    t.ll[id] = true;
    this.saveState();
    return {ok:true, team:t};
  },

  /* ── Audience Vote ── */
  generateAudienceVote(correct){
    const ls  = ['A','B','C','D'];
    const pcts = {};
    const cp  = 43 + Math.floor(Math.random()*17);
    const rem = 100 - cp;
    const oth = ls.filter(l=>l!==correct);
    let used  = 0;
    oth.forEach((l,i)=>{
      const last = i===oth.length-1;
      const max  = rem - used - (oth.length-i-1)*5;
      const p    = last ? rem-used : Math.max(5, Math.min(max, 5+Math.floor(Math.random()*(max-4))));
      pcts[l] = p; if(!last) used += p;
    });
    pcts[correct] = cp;
    return pcts;
  },

  /* ── Get random replacement question ── */
  getReplacementQuestion(){
    const usedIds = new Set(this.G.qs.slice(0, this.G.qi+1).map(q=>q.id));
    const pool    = (TAHADI.isPro() ? window.QB : window.QB.slice(0,this.FREE_LIMIT))
                    .filter(q=>!usedIds.has(q.id));
    if(!pool.length) return null;
    return pool[0|Math.random()*pool.length];
  },

  /* ── Yehaq: deduct from rival ── */
  applyYehaq(targetTeamId){
    const t = this.G.teams.find(t=>t.id===targetTeamId);
    if(!t) return {error:'team_not_found'};
    t.points = Math.max(0, t.points - 10);
    t.yqc++;
    this.saveState();
    return {ok:true, team:t};
  },

  /* ── Results ── */
  getResults(){
    return [...this.G.teams].sort((a,b)=>b.points-a.points);
  },

  /* ── Reset ── */
  reset(){
    this.stopTimer(); this.stopPoll();
    this.G=null; this.myId=null; this.isHost=false; this.isOffline=false;
    this.yehaqPending=false; this.frozen=false;
  }
};

window.GameEngine = GameEngine;
