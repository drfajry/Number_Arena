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

  /* ═══════════════════════════════════════════════════
   *  TahadiAuth — طبقة المصادقة الآمنة (Firebase Auth)
   *  بريد + كلمة مرور، تحقق مرة واحدة، حفظ الجلسة
   * ═══════════════════════════════════════════════════ */
  var ADMIN_EMAIL = "dr.fajry@gmail.com";
  var _auth = (typeof firebase.auth === "function") ? firebase.auth() : null;

  // احفظ الجلسة محلياً (يبقى مسجّلاً حتى بعد إغلاق التطبيق)
  if(_auth){
    try{ _auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){}
  }

  window.TahadiAuth = {
    admin_email: ADMIN_EMAIL,

    // هل المصادقة متاحة؟
    ready: function(){ return !!_auth; },

    // تسجيل جديد: ينشئ الحساب، يرسل بريد تحقق مرة واحدة، يحفظ الملف
    signUp: function(email, password, name, phone){
      if(!_auth) return Promise.reject(new Error("المصادقة غير متاحة"));
      return _auth.createUserWithEmailAndPassword(email, password)
        .then(function(cred){
          var user = cred.user;
          var uid = user.uid;
          console.log("[Auth] تم إنشاء الحساب، uid:", uid);
          var profile = {
            email: email,
            name: name || "",
            phone: phone || "",
            uid: uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          return rtdb.ref("users/"+uid+"/profile").set(profile)
            .then(function(){
              console.log("[Auth] ✅ حُفظ الملف في users/"+uid+"/profile");
              return user.sendEmailVerification()
                .then(function(){ console.log("[Auth] ✅ أُرسل بريد التحقق إلى", email); })
                .catch(function(e){ console.warn("[Auth] ⚠️ فشل إرسال بريد التحقق:", e&&e.message); });
            })
            .catch(function(e){
              console.error("[Auth] ❌ فشل حفظ الملف (قواعد Firebase؟):", e&&e.message);
              // لا نُفشل التسجيل — الحساب أُنشئ في Auth، لكن الملف لم يُحفظ
              return user.sendEmailVerification().catch(function(){});
            })
            .then(function(){ return user; });
        });
    },

    // دخول: بريد + كلمة مرور
    signIn: function(email, password){
      if(!_auth) return Promise.reject(new Error("المصادقة غير متاحة"));
      return _auth.signInWithEmailAndPassword(email, password)
        .then(function(cred){ return cred.user; });
    },

    // خروج
    signOut: function(){
      if(!_auth) return Promise.resolve();
      return _auth.signOut();
    },

    // نسيت كلمة المرور: يرسل رابط إعادة تعيين آمن
    resetPassword: function(email){
      if(!_auth) return Promise.reject(new Error("المصادقة غير متاحة"));
      return _auth.sendPasswordResetEmail(email);
    },

    // إعادة إرسال بريد التحقق
    resendVerification: function(){
      var u = _auth && _auth.currentUser;
      if(!u) return Promise.reject(new Error("لا يوجد مستخدم"));
      return u.sendEmailVerification();
    },

    // المستخدم الحالي (أو null)
    currentUser: function(){ return _auth ? _auth.currentUser : null; },

    // هل البريد محقّق؟
    isVerified: function(){
      var u = _auth && _auth.currentUser;
      return !!(u && u.emailVerified);
    },

    // هل المستخدم الحالي هو الأدمن؟
    isAdmin: function(){
      var u = _auth && _auth.currentUser;
      return !!(u && u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    },

    // راقب حالة الدخول (تُستدعى عند كل تغيّر)
    onChange: function(cb){
      if(!_auth){ cb(null); return function(){}; }
      return _auth.onAuthStateChanged(cb);
    },

    // معرّف المستخدم الحالي
    uid: function(){
      var u = _auth && _auth.currentUser;
      return u ? u.uid : null;
    }
  };

  window.TahadiDB = {
    /* معرّف موحّد من الإيميل */
    emailToUid: function(email){
      return "u_"+btoa(email).replace(/[^a-zA-Z0-9]/g,"").slice(0,16);
    },

    /* تعيين خطة المستخدم — يستبدل أي خطة سابقة (مصدر واحد للحقيقة) */
    setUserPlan: function(email, plan, expiresAt){
      var uid=this.emailToUid(email);
      return rtdb.ref("users/"+uid+"/currentPlan").set({
        plan: plan,
        email: email,
        expiresAt: expiresAt,
        updatedAt: new Date().toISOString()
      });
    },

    /* ── جسر البريد↔المعرّف (لعمل لوحة التحكم بالبريد مع Firebase Auth) ── */
    // يسجّل ربط البريد بمعرّف Auth عند التسجيل/الدخول
    indexEmail: function(email, authUid){
      var key = btoa(email.toLowerCase()).replace(/[^a-zA-Z0-9]/g,"");
      return rtdb.ref("emailIndex/"+key).set({ email: email.toLowerCase(), uid: authUid });
    },
    // يجلب معرّف Auth من البريد (للوحة التحكم)
    uidByEmail: function(email){
      var key = btoa(email.toLowerCase()).replace(/[^a-zA-Z0-9]/g,"");
      return rtdb.ref("emailIndex/"+key).once("value").then(function(s){
        var v = s.val();
        return v ? v.uid : null;
      });
    },

    /* تفعيل خطة بمعرّف Auth مباشرة (النظام الجديد) */
    setPlanByUid: function(uid, email, plan, expiresAt){
      return rtdb.ref("users/"+uid+"/currentPlan").set({
        plan: plan,
        email: email,
        expiresAt: expiresAt,
        updatedAt: new Date().toISOString()
      });
    },
    getPlanByUid: function(uid){
      return rtdb.ref("users/"+uid+"/currentPlan").once("value").then(function(s){
        var plan=s.val();
        if(!plan)return null;
        if(new Date(plan.expiresAt)<new Date())return null;
        return plan;
      });
    },

    /* إلغاء خطة المستخدم */
    clearUserPlan: function(email){
      var uid=this.emailToUid(email);
      return rtdb.ref("users/"+uid+"/currentPlan").remove();
    },

    /* قراءة خطة بالإيميل */
    getPlanByEmail: function(email){
      var uid=this.emailToUid(email);
      return rtdb.ref("users/"+uid+"/currentPlan").once("value").then(function(s){
        var plan=s.val();
        if(!plan)return null;
        if(new Date(plan.expiresAt)<new Date())return null;
        return plan;
      });
    },


    /* ── مصادقة سحابية: بصمة كلمة المرور ──
       الكود يُرسل مرة واحدة فقط عند إنشاء الحساب.
       بعدها الدخول يتم بمطابقة البصمة من Firebase (يعمل عبر الأجهزة). */
    savePassHash: function(email, hash){
      var uid=this.emailToUid(email);
      return rtdb.ref("users/"+uid+"/auth").update({
        passHash: hash,
        email: email,
        updatedAt: new Date().toISOString()
      });
    },
    getPassHash: function(email){
      var uid=this.emailToUid(email);
      return rtdb.ref("users/"+uid+"/auth/passHash").once("value")
        .then(function(s){ return s.val(); });
    },

    /* ── مستخدمون ── */
    saveUser: function(user){
      var uid = user.uid || ("u_"+(user.email||"").replace(/[^a-zA-Z0-9]/g,"").slice(0,16));
      user.uid = uid;
      localStorage.setItem("tahadi_user", JSON.stringify(user));
      var ref=rtdb.ref("users/"+uid+"/profile");
      return ref.once("value").then(function(s){
        var existing=s.val();
        var updates={
          name:  user.name  || "",
          email: user.email || "",
          phone: user.phone || "",
          uid:   uid,
          updatedAt: new Date().toISOString()
        };
        // تاريخ التسجيل يُكتب مرة واحدة فقط ولا يُستبدل أبداً بعد ذلك
        if(!existing||!existing.createdAt) updates.createdAt=new Date().toISOString();
        return ref.update(updates);
      }).then(function(){ return uid; });
    },

    getUser: function(uid){
      return rtdb.ref("users/"+uid+"/profile").once("value")
        .then(function(s){ return s.val(); });
    },

    /* ── تعديل بيانات مستخدم من لوحة التحكم ── */
    adminUpdateUser: function(uid, fields){
      var updates={updatedAt:new Date().toISOString()};
      if(fields.name!==undefined)  updates.name=fields.name;
      if(fields.email!==undefined) updates.email=fields.email;
      if(fields.phone!==undefined) updates.phone=fields.phone;
      return rtdb.ref("users/"+uid+"/profile").update(updates);
    },
    // إعادة تعيين كلمة المرور: يحفظ بصمتها (نفس آلية تسجيل الدخول)
    adminResetPassword: function(uid, hash){
      return rtdb.ref("users/"+uid+"/auth").update({
        passHash: hash, updatedAt:new Date().toISOString()
      });
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
