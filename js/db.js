/* ══════════════════════════════════════
   db.js — قاعدة بيانات المتصفح المحلية
   تحفظ بيانات المستخدم دائماً حتى بعد
   إغلاق المتصفح وإعادة الفتح
══════════════════════════════════════ */

const DB = {

  // ── مفاتيح التخزين ──
  KEYS: {
    USER:    'tahadi_user',
    TOKEN:   'tahadi_token',
    PRO:     'tahadi_pro',
    HISTORY: 'tahadi_history',   // سجل الألعاب
    STATS:   'tahadi_stats',     // إحصائيات اللاعب
    PREFS:   'tahadi_prefs',     // تفضيلات (لون، اسم)
    ROOMS:   'tahadi_rooms',     // غرف اللعب الأونلاين
  },

  // ── حفظ ──
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch(e) {
      console.warn('DB.set error:', e);
      return false;
    }
  },

  // ── قراءة ──
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch(e) {
      return fallback;
    }
  },

  // ── حذف ──
  remove(key) {
    localStorage.removeItem(key);
  },

  // ══ USER ══════════════════════════════

  saveUser(user, token, isPro) {
    this.set(this.KEYS.USER,  user);
    this.set(this.KEYS.TOKEN, token);
    this.set(this.KEYS.PRO,   isPro ? '1' : '0');
  },

  getUser()  { return this.get(this.KEYS.USER); },
  getToken() { return localStorage.getItem(this.KEYS.TOKEN) || ''; },
  isPro()    { return localStorage.getItem(this.KEYS.PRO) === '1'; },
  isLoggedIn(){ return !!this.getToken(); },

  clearUser() {
    [this.KEYS.USER, this.KEYS.TOKEN, this.KEYS.PRO].forEach(k => this.remove(k));
  },

  // ══ PREFERENCES ═══════════════════════
  // تُحفظ حتى بدون تسجيل دخول

  getPrefs() {
    return this.get(this.KEYS.PREFS, {
      name:  'لاعب',
      color: 'cyan',
      sound: true,
    });
  },

  savePrefs(prefs) {
    const current = this.getPrefs();
    this.set(this.KEYS.PREFS, { ...current, ...prefs });
  },

  // ══ GAME HISTORY ══════════════════════
  // يحفظ آخر 50 لعبة

  saveGameResult(result) {
    // result = { date, teams, winner, duration, questions }
    let history = this.get(this.KEYS.HISTORY, []);
    history.unshift({
      ...result,
      date: new Date().toISOString(),
      id:   Date.now()
    });
    // Keep last 50
    if (history.length > 50) history = history.slice(0, 50);
    this.set(this.KEYS.HISTORY, history);
    // Update stats
    this.updateStats(result);
  },

  getHistory() {
    return this.get(this.KEYS.HISTORY, []);
  },

  // ══ STATS ═════════════════════════════

  updateStats(result) {
    const stats = this.getStats();
    stats.gamesPlayed++;
    if (result.isWinner) stats.wins++;
    stats.totalPoints  += (result.myPoints || 0);
    stats.totalCorrect += (result.myCorrect || 0);
    stats.lastPlayed    = new Date().toISOString();
    this.set(this.KEYS.STATS, stats);
  },

  getStats() {
    return this.get(this.KEYS.STATS, {
      gamesPlayed:  0,
      wins:         0,
      totalPoints:  0,
      totalCorrect: 0,
      lastPlayed:   null,
    });
  },

  // ══ ONLINE ROOMS ══════════════════════
  // تخزين غرف اللعب بـ BroadcastChannel + localStorage
  // يعمل بين تبويبات نفس المتصفح على نفس الجهاز
  // وبين أجهزة مختلفة عبر نفس الشبكة (عبر Backend)

  ROOM_KEY: 'tahadi_v7',

  saveRoom(code, state) {
    localStorage.setItem(this.ROOM_KEY + '_' + code, JSON.stringify(state));
    // Notify other tabs
    try {
      const bc = new BroadcastChannel(this.ROOM_KEY);
      bc.postMessage({ type: 'room_update', code });
      bc.close();
    } catch(e) {}
  },

  getRoom(code) {
    try {
      const s = localStorage.getItem(this.ROOM_KEY + '_' + code);
      return s ? JSON.parse(s) : null;
    } catch(e) { return null; }
  },

  deleteRoom(code) {
    localStorage.removeItem(this.ROOM_KEY + '_' + code);
  },

  // ── تنظيف الغرف القديمة (أكثر من 24 ساعة)
  cleanOldRooms() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.ROOM_KEY + '_'));
    const now  = Date.now();
    keys.forEach(key => {
      try {
        const room = JSON.parse(localStorage.getItem(key));
        if (room && room.createdAt && (now - room.createdAt) > 24 * 60 * 60 * 1000) {
          localStorage.removeItem(key);
        }
      } catch(e) {}
    });
  },

  // ══ BACKUP & RESTORE ══════════════════
  // تصدير واستيراد بيانات المستخدم

  exportData() {
    const data = {};
    Object.values(this.KEYS).forEach(key => {
      const v = localStorage.getItem(key);
      if (v) data[key] = v;
    });
    return btoa(JSON.stringify(data));
  },

  importData(encoded) {
    try {
      const data = JSON.parse(atob(encoded));
      Object.entries(data).forEach(([key, value]) => {
        // Only restore safe keys
        if (Object.values(this.KEYS).includes(key)) {
          localStorage.setItem(key, value);
        }
      });
      return true;
    } catch(e) {
      return false;
    }
  },

  // ══ INIT ══════════════════════════════

  init() {
    // Clean old rooms on startup
    this.cleanOldRooms();

    // Migrate old keys if needed
    this._migrate();

    return this;
  },

  _migrate() {
    // Migrate from old storage keys
    const oldKeys = ['tahadi_v3_', 'tahadi_v4_', 'tahadi_v5_', 'tahadi_v6_'];
    oldKeys.forEach(prefix => {
      Object.keys(localStorage)
        .filter(k => k.startsWith(prefix))
        .forEach(k => localStorage.removeItem(k));
    });
  }
};

DB.init();
window.DB = DB;
