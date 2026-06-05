/* ============================================================
 *  firebase-config.js — تحدي الأرقام
 *  ↓ أضف بياناتك من Firebase Console مرة واحدة هنا فقط ↓
 * ============================================================ */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBeLF_kjOqZXa7X9E8XQUF1zPDK1IMwyhM",   // ← من Firebase Console
  authDomain:            "numberarena-26cf0.firebaseapp.com",
  databaseURL:            "https://numberarena-26cf0-default-rtdb.firebaseio.com",   // يجب أن يحتوي .firebaseio.com
  projectId:            "numberarena-26cf0",
  storageBucket:            "numberarena-26cf0.firebasestorage.app",
  messagingSenderId:            "406993992036",
  appId:            "1:406993992036:web:f32f8af3b397ea40096271",
  measurementId:     "G-YQTMQZY3FY"
};

/* تهيئة Firebase — لا تعدّل ما بعد هذا السطر */
(function(){
  if(typeof firebase === "undefined"){ return; }
  if(firebase.apps.length === 0){
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  /* ═══════════════════════════════════════════════════
   *  DB — واجهة موحّدة للتخزين
   *  تكتب/تقرأ من Firebase RTDB أولاً
   *  وتحتفظ بنسخة في localStorage كـ fallback
   * ═══════════════════════════════════════════════════ */
  var rtdb = firebase.database();

  window.TahadiDB = {

    /* ── مستخدمون ── */
    saveUser: function(user){
      var uid = user.uid || ("u_"+(user.email||"").replace(/[^a-zA-Z0-9]/g,"").slice(0,16));
      user.uid = uid;
      localStorage.setItem("tahadi_user", JSON.stringify(user));
      return rtdb.ref("users/"+uid+"/profile").update({
        name:  user.name  || "",
        email: user.email || "",
        phone: user.phone || "",
        uid:   uid,
        updatedAt: new Date().toISOString()
      }).then(function(){ return uid; });
    },

    getUser: function(uid){
      return rtdb.ref("users/"+uid+"/profile").once("value")
        .then(function(s){ return s.val(); });
    },

    /* ── اشتراكات ── */
    saveSubscription: function(sub){
      sub.createdAt = sub.createdAt || new Date().toISOString();
      var key = rtdb.ref("subscriptions").push().key;
      sub.id = key;
      // حفظ في RTDB
      var updates = {};
      updates["subscriptions/"+key]          = sub;
      updates["users/"+sub.uid+"/currentPlan"] = {
        plan: sub.plan,
        expiresAt: sub.expiresAt,
        updatedAt: new Date().toISOString()
      };
      return rtdb.ref().update(updates).then(function(){ return key; });
    },

    getActiveSubscription: function(uid){
      return rtdb.ref("users/"+uid+"/currentPlan").once("value")
        .then(function(s){
          var plan = s.val();
          if(!plan) return null;
          if(new Date(plan.expiresAt) < new Date()) return null;
          return plan;
        });
    },

    getAllSubscriptions: function(){
      return rtdb.ref("subscriptions").once("value")
        .then(function(s){
          var out = [];
          s.forEach(function(c){ out.push(Object.assign({id:c.key},c.val())); });
          return out.sort(function(a,b){ return (b.createdAt||"").localeCompare(a.createdAt||""); });
        });
    },

    revokeSubscription: function(subId, uid){
      var now = new Date().toISOString();
      var u = {};
      u["subscriptions/"+subId+"/status"]    = "revoked";
      u["subscriptions/"+subId+"/revokedAt"] = now;
      u["users/"+uid+"/currentPlan/expiresAt"] = now;
      return rtdb.ref().update(u);
    },

    /* ── مستخدمو الأدمن: قراءة الكل ── */
    getAllUsers: function(){
      return rtdb.ref("users").once("value")
        .then(function(s){
          var out = [];
          s.forEach(function(c){
            var v = c.val();
            if(v && v.profile) out.push(Object.assign({uid:c.key},v.profile));
          });
          return out;
        });
    },

    deleteUser: function(uid){
      return rtdb.ref("users/"+uid).remove();
    },

    /* ── إعدادات ── */
    saveSettings: function(settings){
      localStorage.setItem("tahadi_admin_settings", JSON.stringify(settings));
      return rtdb.ref("admin/settings").update(settings);
    },

    getSettings: function(){
      return rtdb.ref("admin/settings").once("value")
        .then(function(s){
          var v = s.val();
          if(v) localStorage.setItem("tahadi_admin_settings", JSON.stringify(v));
          return v || JSON.parse(localStorage.getItem("tahadi_admin_settings")||"{}");
        });
    }
  };

  /* تحقق من الاتصال */
  rtdb.ref(".info/connected").on("value", function(s){
    var on = !!s.val();
    document.querySelectorAll(".fb-status-dot").forEach(function(d){
      d.style.background = on ? "#00E676" : "#FF3D5A";
    });
    document.querySelectorAll(".fb-status-lbl").forEach(function(l){
      l.textContent = on ? "متصل" : "وضع محلي";
    });
  });

  console.log("✅ Firebase + TahadiDB جاهز");
})();

/* ═══════════════════════════════════════════════════
 *  كيفية الإعداد (خطوات سريعة)
 * ═══════════════════════════════════════════════════
 *
 *  1. اذهب إلى https://console.firebase.google.com
 *  2. أنشئ مشروعاً جديداً (مجاني - Spark plan)
 *  3. من الـ Project Settings أضف Web App
 *  4. انسخ الـ Config والصقه أعلى هذا الملف
 *
 *  5. فعّل Realtime Database:
 *     - من القائمة الجانبية: Build → Realtime Database
 *     - Create Database → Start in test mode
 *
 *  قواعد الأمان المقترحة (Realtime Database Rules):
 *  {
 *    "rules": {
 *      "users": {
 *        "$uid": {
 *          ".read":  "auth != null && auth.uid == $uid",
 *          ".write": "auth != null && auth.uid == $uid"
 *        }
 *      },
 *      "subscriptions": { ".read": true, ".write": true },
 *      "admin":         { ".read": true, ".write": true },
 *      "rooms":         { ".read": true, ".write": true },
 *      "referralCodes": { ".read": true, ".write": true },
 *      "affiliateCommissions": { ".read": true, ".write": true },
 *      "withdrawals":   { ".read": true, ".write": true }
 *    }
 *  }
 *
 * ═══════════════════════════════════════════════════ */
