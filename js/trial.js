/* ═══════════════════════════════════════════════════════════
   TRIAL — تجربة أسطوري مجانية (3 لوحات)
   مربوطة بـ: معرّف الجهاز + حساب المستخدم، ومسجّلة في Firebase
   فلا تتكرر بحساب جديد ولا بإعادة تثبيت التطبيق.
═══════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  var TRIAL_BOARDS = 3;              // عدد اللوحات المجانية
  var LS_LEFT   = "tahadi_trial_left";
  var LS_DEV    = "tahadi_device_id";
  var LS_ACTIVE = "tahadi_trial_active";

  // ── معرّف الجهاز (ثابت قدر الإمكان) ──
  function deviceId(){
    var d = null;
    try{ d = localStorage.getItem(LS_DEV); }catch(e){}
    if(d) return Promise.resolve(d);
    // Capacitor Device plugin إن توفّر (أدق وأثبت)
    try{
      if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Device){
        return Capacitor.Plugins.Device.getId().then(function(r){
          var id = (r && (r.identifier || r.uuid)) || null;
          if(!id) id = _rand();
          try{ localStorage.setItem(LS_DEV, id); }catch(e){}
          return id;
        }).catch(function(){ return _fallback(); });
      }
    }catch(e){}
    return Promise.resolve(_fallback());
  }
  function _rand(){
    return "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function _fallback(){
    var id = _rand();
    try{ localStorage.setItem(LS_DEV, id); }catch(e){}
    return id;
  }

  function _uid(){
    try{
      var u = JSON.parse(localStorage.getItem("tahadi_user") || sessionStorage.getItem("tahadi_user") || "null");
      if(u && u.uid) return u.uid;
    }catch(e){}
    return null;
  }
  function _db(){
    try{
      if(window.firebase && firebase.apps && firebase.apps.length) return firebase.database();
    }catch(e){}
    return null;
  }
  function _safeKey(s){ return String(s||"").replace(/[.#$/\[\]]/g,"_"); }

  var TRIAL = {
    boards: TRIAL_BOARDS,

    // كم لوحة متبقية محلياً
    left: function(){
      var v = parseInt(localStorage.getItem(LS_LEFT) || "-1", 10);
      return isNaN(v) ? -1 : v;
    },

    active: function(){
      return localStorage.getItem(LS_ACTIVE) === "1" && this.left() > 0;
    },

    // هل يستحق التجربة؟ (لم يستخدمها على هذا الجهاز ولا بهذا الحساب)
    eligible: function(){
      var self = this;
      // مشترك فعلاً؟ لا حاجة للتجربة
      if(localStorage.getItem("tahadi_elite") === "1") return Promise.resolve(false);
      if(self.left() === 0) return Promise.resolve(false);   // استُهلكت هنا
      var uid = _uid();
      if(!uid) return Promise.resolve(false);                // التسجيل شرط
      var db = _db();
      if(!db) return Promise.resolve(self.left() !== 0);
      return deviceId().then(function(dev){
        var dk = _safeKey(dev);
        return Promise.all([
          db.ref("trials/devices/" + dk).once("value"),
          db.ref("trials/users/" + uid).once("value")
        ]).then(function(snaps){
          var byDevice = snaps[0].val();
          var byUser   = snaps[1].val();
          if(byDevice || byUser) return false;   // استُخدمت سابقاً
          return true;
        }).catch(function(){ return self.left() !== 0; });
      });
    },

    // ابدأ التجربة (يسجّلها في Firebase فوراً حتى لا تتكرر)
    start: function(){
      var self = this;
      var uid = _uid();
      if(!uid) return Promise.resolve({ok:false, error:"سجّل دخولك أولاً لتفعيل التجربة"});
      return self.eligible().then(function(ok){
        if(!ok) return {ok:false, error:"التجربة المجانية استُخدمت من قبل"};
        return deviceId().then(function(dev){
          var db = _db(), dk = _safeKey(dev), now = new Date().toISOString();
          var writes = [];
          if(db){
            writes.push(db.ref("trials/devices/" + dk).set({uid:uid, startedAt:now, boards:TRIAL_BOARDS}).catch(function(){}));
            writes.push(db.ref("trials/users/" + uid).set({device:dk, startedAt:now, boards:TRIAL_BOARDS}).catch(function(){}));
          }
          return Promise.all(writes).then(function(){
            try{
              localStorage.setItem(LS_LEFT, String(TRIAL_BOARDS));
              localStorage.setItem(LS_ACTIVE, "1");
              localStorage.setItem("tahadi_pro", "1");
              localStorage.setItem("tahadi_elite", "1");
              localStorage.setItem("tahadi_trial_tier", "elite");
            }catch(e){}
            if(typeof window.renderUserBar === "function"){ try{ renderUserBar(); }catch(e){} }
            return {ok:true, left:TRIAL_BOARDS};
          });
        });
      });
    },

    // استهلك لوحة واحدة (تُستدعى عند نهاية كل لعبة)
    consume: function(){
      if(!this.active()) return this.left();
      var left = this.left() - 1;
      if(left < 0) left = 0;
      try{ localStorage.setItem(LS_LEFT, String(left)); }catch(e){}
      var uid = _uid(), db = _db();
      if(db && uid){ try{ db.ref("trials/users/"+uid+"/left").set(left).catch(function(){}); }catch(e){} }
      if(left === 0) this.end();
      return left;
    },

    // انتهت التجربة → أزل مزايا أسطوري (ما لم يكن مشتركاً فعلياً)
    end: function(){
      try{
        localStorage.setItem(LS_ACTIVE, "0");
        localStorage.setItem(LS_LEFT, "0");
        localStorage.removeItem("tahadi_trial_tier");
        // لا تمسح اشتراكاً حقيقياً من IAP
        if(!localStorage.getItem("tahadi_iap_tier")){
          localStorage.removeItem("tahadi_elite");
          localStorage.removeItem("tahadi_pro");
        }
      }catch(e){}
      if(typeof window.renderUserBar === "function"){ try{ renderUserBar(); }catch(e){} }
    }
  };

  window.TRIAL = TRIAL;
})();
