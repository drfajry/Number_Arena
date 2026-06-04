/* ══════════════════════════════════════
   utils.js — دوال مشتركة لجميع الصفحات
   تحدي الأرقام
══════════════════════════════════════ */

const TAHADI = {

  /* ── Config ── */
  API: (function(){
    // If window.__API_URL__ is set in HTML, use it
    if(window.__API_URL__) return window.__API_URL__;
    // If same domain (backend + frontend on same server)
    return window.location.origin + '/api';
  })(),

  MOYASAR_PK: window.__MOYASAR_PK__ || 'pk_test_vcSGSKSY6wMnFGadbvBbsgLi3fCkSR9nGaAezMXJNaHJ',

  PLANS: {
    monthly: { price:19, amount:1900, label:'شهري',  days:30  },
    yearly:  { price:59, amount:5900, label:'سنوي',  days:365 }
  },

  /* ── Auth helpers ── */
  getToken()  { return window.DB ? DB.getToken() : (localStorage.getItem('tahadi_token')||''); },
  getUser()   { return window.DB ? DB.getUser() : (()=>{try{return JSON.parse(localStorage.getItem('tahadi_user')||'null');}catch(e){return null;}})(); },
  isPro()     { return window.DB ? DB.isPro() : localStorage.getItem('tahadi_pro')==='1'; },
  isLoggedIn(){ return !!this.getToken(); },

  setSession(token, user, isPro){
    if(window.DB) DB.saveUser(user, token, isPro);
    else {
      localStorage.setItem('tahadi_token', token);
      localStorage.setItem('tahadi_user', JSON.stringify(user));
      if(isPro) localStorage.setItem('tahadi_pro','1');
      else localStorage.removeItem('tahadi_pro');
    }
  },

  clearSession(){
    if(window.DB) DB.clearUser();
    else {
      localStorage.removeItem('tahadi_token');
      localStorage.removeItem('tahadi_user');
      localStorage.removeItem('tahadi_pro');
    }
  },

  /* ── API call ── */
  async api(path, opts = {}){
    const token = this.getToken();
    const headers = { 'Content-Type':'application/json' };
    if(token) headers['Authorization'] = 'Bearer ' + token;

    try {
      const r = await fetch(this.API + path, {
        ...opts,
        headers: { ...headers, ...(opts.headers||{}) }
      });
      const data = await r.json();
      if(r.status === 401){ this.clearSession(); return { error:'session_expired', status:401 }; }
      return { ...data, status: r.status, ok: r.ok };
    } catch(e) {
      return { error:'network_error', message: 'تعذّر الاتصال بالخادم' };
    }
  },

  /* ── Toast notify ── */
  _ntout: null,
  toast(msg, color='#00E5FF', duration=3000){
    let el = document.getElementById('_toast');
    if(!el){
      el = document.createElement('div');
      el.id = '_toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.color = color;
    el.style.borderColor = color + '44';
    el.classList.add('show');
    clearTimeout(this._ntout);
    this._ntout = setTimeout(()=> el.classList.remove('show'), duration);
  },

  toastSuccess(msg){ this.toast(msg, '#00E676'); },
  toastError(msg)  { this.toast(msg, '#FF3D5A'); },
  toastWarn(msg)   { this.toast(msg, '#FFD046'); },

  /* ── Loading state ── */
  setLoading(btn, loading, text=''){
    if(!btn) return;
    btn.disabled = loading;
    if(loading) { btn._orig = btn.textContent; btn.textContent = text || 'جارٍ...'; }
    else        { btn.textContent = btn._orig || btn.textContent; }
  },

  /* ── Modals ── */
  openModal(id)  { document.getElementById(id)?.classList.add('open'); },
  closeModal(id) { document.getElementById(id)?.classList.remove('open'); },

  /* ── Color picker ── */
  COLORS: {
    cyan:  { label:'سماوي', hex:'#00E5FF', bg:'rgba(0,229,255,.1)' },
    red:   { label:'أحمر',  hex:'#FF3D5A', bg:'rgba(255,61,90,.1)'  },
    green: { label:'أخضر',  hex:'#00E676', bg:'rgba(0,230,118,.1)'  },
    yellow:{ label:'ذهبي',  hex:'#FFD046', bg:'rgba(255,208,70,.1)' }
  },

  buildColorPicker(containerId, selectedColor, onChange){
    const el = document.getElementById(containerId);
    if(!el) return;
    el.innerHTML = '';
    el.className = 'color-picker';
    Object.entries(this.COLORS).forEach(([k,v])=>{
      const d = document.createElement('div');
      d.className = 'color-dot' + (k===selectedColor?' active':'');
      d.style.background = v.hex;
      d.title = v.label;
      d.onclick = ()=>{
        el.querySelectorAll('.color-dot').forEach(e=>e.classList.remove('active'));
        d.classList.add('active');
        onChange(k, v);
      };
      el.appendChild(d);
    });
  },

  /* ── OTP input wiring ── */
  wireOTP(prefix, onComplete){
    for(let i=0;i<6;i++){
      const inp = document.getElementById(prefix+i);
      if(!inp) continue;
      inp.addEventListener('input', ()=>{
        inp.value = inp.value.replace(/[^0-9]/g,'').slice(0,1);
        if(inp.value && i<5) document.getElementById(prefix+(i+1))?.focus();
        const val = Array.from({length:6},(_,j)=>document.getElementById(prefix+j)?.value||'').join('');
        if(val.length===6 && onComplete) onComplete(val);
      });
      inp.addEventListener('keydown', e=>{
        if(e.key==='Backspace' && !inp.value && i>0)
          document.getElementById(prefix+(i-1))?.focus();
      });
    }
  },

  getOTPValue(prefix){
    return Array.from({length:6},(_,i)=>document.getElementById(prefix+i)?.value||'').join('');
  },

  clearOTP(prefix){
    for(let i=0;i<6;i++){
      const inp=document.getElementById(prefix+i);
      if(inp) inp.value='';
    }
    document.getElementById(prefix+'0')?.focus();
  },

  /* ── OTP Timer ── */
  _otpTimer: null,
  startOTPTimer(secEl, btnEl, seconds=120){
    clearInterval(this._otpTimer);
    let s = seconds;
    if(secEl) secEl.textContent = s;
    if(btnEl) btnEl.disabled = true;
    this._otpTimer = setInterval(()=>{
      s--;
      if(secEl) secEl.textContent = s;
      if(s<=0){
        clearInterval(this._otpTimer);
        if(btnEl) btnEl.disabled = false;
        if(secEl && secEl.closest) {
          const wrap = secEl.closest('.otp-timer');
          if(wrap) wrap.style.display='none';
        }
      }
    }, 1000);
  },

  /* ── Format date ── */
  formatDate(d){
    if(!d) return '—';
    return new Date(d).toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'});
  },

  /* ── Validate Saudi phone ── */
  validatePhone(phone){
    const clean = phone.replace(/\s/g,'');
    return /^5\d{8}$/.test(clean);
  },

  /* ── Load Moyasar.js ── */
  loadMoyasar(){
    return new Promise(resolve=>{
      if(window.Moyasar){ resolve(); return; }
      if(!document.getElementById('moyasar-css')){
        const l=document.createElement('link');
        l.id='moyasar-css';l.rel='stylesheet';
        l.href='https://cdn.moyasar.com/mpf/1.14.0/moyasar.css';
        document.head.appendChild(l);
      }
      const s=document.createElement('script');
      s.src='https://cdn.moyasar.com/mpf/1.14.0/moyasar.js';
      s.onload=resolve; s.onerror=resolve;
      document.head.appendChild(s);
    });
  },

  /* ── Check pro status from backend ── */
  async syncPro(){
    if(!this.isLoggedIn()) return false;
    const d = await this.api('/auth/me');
    if(d.ok){
      if(d.isPro){ localStorage.setItem('tahadi_pro','1'); return true; }
      else{ localStorage.removeItem('tahadi_pro'); return false; }
    }
    return this.isPro(); // fallback to local
  },

  /* ── Require auth redirect ── */
  requireAuth(redirectTo='index.html'){
    if(!this.isLoggedIn()){
      localStorage.setItem('tahadi_redirect', window.location.href);
      window.location.href = redirectTo;
      return false;
    }
    return true;
  },

  /* ── Shuffle array ── */
  shuffle(arr){
    const r=[...arr];
    for(let i=r.length-1;i>0;i--){
      const j=0|Math.random()*(i+1);
      [r[i],r[j]]=[r[j],r[i]];
    }
    return r;
  }
};

/* Make it global */
window.TAHADI = TAHADI;
