/* ══════════════════════════════════════
   sounds.js — محرك الأصوات
   Web Audio API — بدون ملفات خارجية
   كل الأصوات مولّدة برمجياً
══════════════════════════════════════ */

const SFX = {

  _ctx: null,
  _enabled: localStorage.getItem("tahadi_sound") !== "0",

  /* ── تهيئة Audio Context (يحتاج تفاعل المستخدم) ── */
  _init(){
    if(this._ctx) return this._ctx;
    try{
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }catch(e){ this._ctx = null; }
    return this._ctx;
  },

  /* ── دالة مساعدة لتشغيل نغمة ── */
  _beep(cfg){
    if(!this._enabled) return;
    const ctx = this._init();
    if(!ctx) return;

    // Resume if suspended (browser autoplay policy)
    if(ctx.state === "suspended") ctx.resume();

    const {
      type  = "sine",
      freq  = 440,
      freq2 = null,     // sweep to freq2
      dur   = 0.15,
      vol   = 0.4,
      delay = 0,
      attack= 0.005,
      decay = 0.05,
      notes = null      // array of {freq, time, dur}
    } = cfg;

    const play = (f1, f2, start, d, v) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(f1, ctx.currentTime + start);
      if(f2) osc.frequency.linearRampToValueAtTime(f2, ctx.currentTime + start + d * 0.7);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(v, ctx.currentTime + start + attack);
      gain.gain.setValueAtTime(v, ctx.currentTime + start + d - decay);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + d);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + d + 0.01);
    };

    if(notes){
      notes.forEach(n => play(n.freq, n.freq2||null, n.time, n.dur, n.vol||vol));
    } else {
      play(freq, freq2, delay, dur, vol);
    }
  },

  /* ══════════════════════════
     الأصوات الرئيسية
  ══════════════════════════ */

  /* ✅ إجابة صحيحة — نغمتان تصاعديتان */
  correct(){
    this._beep({ notes:[
      {freq:600, dur:0.1, time:0,    vol:0.35},
      {freq:900, dur:0.15,time:0.1,  vol:0.4},
    ]});
  },

  /* ❌ إجابة خاطئة — نغمة هابطة */
  wrong(){
    this._beep({
      type:"sawtooth",
      freq:300, freq2:150, dur:0.25,
      vol:0.25, attack:0.01, decay:0.1
    });
  },

  /* ⏱ انتهاء الوقت — 3 نبضات سريعة */
  timeout(){
    this._beep({ type:"square", notes:[
      {freq:400, dur:0.07, time:0,    vol:0.3},
      {freq:400, dur:0.07, time:0.1,  vol:0.3},
      {freq:300, dur:0.15, time:0.2,  vol:0.35},
    ]});
  },

  /* ★ خلية مميزة (ذهبي/فضي/مبروك) — نغمة احتفالية */
  bonus(){
    this._beep({ notes:[
      {freq:523, dur:0.08, time:0,    vol:0.3},
      {freq:659, dur:0.08, time:0.08, vol:0.3},
      {freq:784, dur:0.12, time:0.16, vol:0.35},
    ]});
  },

  /* ⚡ يحق لك — نغمة تحذيرية */
  yehaq(){
    this._beep({ type:"square", notes:[
      {freq:880, dur:0.06, time:0,    vol:0.25},
      {freq:660, dur:0.06, time:0.07, vol:0.25},
      {freq:880, dur:0.1,  time:0.14, vol:0.3},
    ]});
  },

  /* 🔲 اختيار خلية — نقرة خفيفة */
  click(){
    this._beep({
      type:"sine", freq:800, freq2:400,
      dur:0.06, vol:0.2, attack:0.002, decay:0.02
    });
  },

  /* ⏳ تحذير الوقت (أقل من 10 ثواني) — نبضة متكررة */
  tick(){
    this._beep({
      type:"square", freq:440, dur:0.05,
      vol:0.15, attack:0.002, decay:0.02
    });
  },

  /* 🚀 بداية اللعبة — نغمة ترحيبية */
  start(){
    this._beep({ notes:[
      {freq:400, dur:0.08, time:0,    vol:0.28},
      {freq:500, dur:0.08, time:0.1,  vol:0.28},
      {freq:600, dur:0.08, time:0.2,  vol:0.28},
      {freq:800, dur:0.15, time:0.3,  vol:0.35},
    ]});
  },

  /* 🏆 انتهاء اللعبة — نغمة إنجاز */
  end(){
    this._beep({ notes:[
      {freq:523, dur:0.1,  time:0,    vol:0.3},
      {freq:659, dur:0.1,  time:0.12, vol:0.3},
      {freq:784, dur:0.1,  time:0.24, vol:0.3},
      {freq:1047,dur:0.25, time:0.36, vol:0.38},
    ]});
  },

  /* 🆘 استخدام وسيلة مساعدة — نغمة خفيفة */
  lifeline(){
    this._beep({
      type:"triangle", freq:600, freq2:800,
      dur:0.12, vol:0.22, attack:0.01, decay:0.04
    });
  },

  /* 👥 انضمام لاعب — نقرتان */
  join(){
    this._beep({ notes:[
      {freq:500, dur:0.08, time:0,   vol:0.25},
      {freq:700, dur:0.1,  time:0.1, vol:0.28},
    ]});
  },

  /* ── تبديل الصوت ON/OFF ── */
  toggle(){
    this._enabled = !this._enabled;
    localStorage.setItem("tahadi_sound", this._enabled ? "1" : "0");
    if(this._enabled) this.click();
    return this._enabled;
  },

  isEnabled(){ return this._enabled; }
};

window.SFX = SFX;

/* ── تفعيل AudioContext عند أول تفاعل ── */
document.addEventListener("click",  () => SFX._init(), {once:true, passive:true});
document.addEventListener("touchstart", () => SFX._init(), {once:true, passive:true});
