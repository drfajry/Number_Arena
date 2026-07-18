/* ══════════════════════════════════════════════════════════
   iap.js — طبقة الشراء داخل التطبيق (In-App Purchase)
   عبر RevenueCat — تعمل على iOS و Android بكود واحد

   المتطلبات (في بيئة التطبيق):
     npm install @revenuecat/purchases-capacitor
     npx cap sync

   المنتجات المعرّفة في App Store Connect / Google Play Console:
     - pro_yearly    (بطل سنوي   — 9 ر.س)
     - elite_yearly  (أسطوري سنوي — 19 ر.س)

   RevenueCat Entitlements (في لوحة RevenueCat):
     - "pro"   → مرتبط بمنتج pro_yearly
     - "elite" → مرتبط بمنتج elite_yearly
══════════════════════════════════════════════════════════ */

(function(){
  "use strict";

  // مفاتيح RevenueCat العامة (Public SDK Keys) — تُملأ من لوحة RevenueCat
  // آمنة للوضع في كود العميل (هي مفاتيح عامة للقراءة فقط)
  var RC_APPLE_KEY   = "appl_XXXXXXXXXXXXXXXXXXXXXXXX";   // ← استبدله بمفتاح Apple من RevenueCat
  var RC_GOOGLE_KEY  = "goog_OTSxRoaUFhrTyjpGidzAScpYFqX";   // ← مفتاح Google من RevenueCat

  // معرّفات المنتجات (يجب أن تطابق ما في المتجرين)
  var PRODUCTS = {
    pro:   "pro_yearly",
    elite: "elite_yearly"
  };
  // معرّفات الصلاحيات (Entitlements) في RevenueCat
  var ENTITLEMENTS = {
    pro:   "pro",
    elite: "elite"
  };

  var _purchases = null;      // مرجع plugin RevenueCat
  var _ready = false;
  var _initPromise = null;

  var IAP = {
    // هل نحن في بيئة تدعم الشراء داخل التطبيق؟
    available: function(){
      return !!(window.IS_APP && window.Capacitor && window.Capacitor.Plugins &&
                window.Capacitor.Plugins.Purchases);
    },

    // تهيئة RevenueCat (مرة واحدة) — تُربط بمعرّف مستخدم Firebase
    init: function(firebaseUid){
      if(_initPromise) return _initPromise;
      if(!this.available()){
        return Promise.resolve(false); // لا تخزّن الفشل — اسمح بإعادة المحاولة عند جهوزية Capacitor
      }
      _purchases = window.Capacitor.Plugins.Purchases;
      var apiKey = (window.Capacitor.getPlatform() === "ios") ? RC_APPLE_KEY : RC_GOOGLE_KEY;

      _initPromise = _purchases.configure({
        apiKey: apiKey,
        appUserID: firebaseUid || null   // ربط الشراء بحساب المستخدم (مهم للتزامن)
      }).then(function(){
        _ready = true;
        console.log("[IAP] RevenueCat مُهيّأ لـ", firebaseUid || "مجهول");
        return true;
      }).catch(function(e){
        console.error("[IAP] فشل التهيئة:", e && e.message);
        return false;
      });
      return _initPromise;
    },

    // اربط المستخدم بعد الدخول (لو تهيّأ قبل معرفة الـuid)
    login: function(firebaseUid){
      if(!_ready || !_purchases || !firebaseUid) return Promise.resolve(null);
      return _purchases.logIn({ appUserID: firebaseUid })
        .then(function(res){ return res; })
        .catch(function(){ return null; });
    },

    logout: function(){
      if(!_ready || !_purchases) return Promise.resolve();
      return _purchases.logOut().catch(function(){});
    },

    // اجلب العروض المتاحة (الأسعار المحلية من المتجر) — بمهلة حتى لا تتعلّق
    getOfferings: function(){
      if(!_ready || !_purchases) return Promise.resolve(null);
      var call = _purchases.getOfferings()
        .then(function(o){ return o && o.current ? o.current : null; })
        .catch(function(){ return null; });
      var timeout = new Promise(function(res){ setTimeout(function(){ res(null); }, 10000); });
      return Promise.race([call, timeout]);
    },

    // نفّذ الشراء لخطة معيّنة (pro أو elite)
    // يرجّع: {success:true, tier:"pro"|"elite"} أو {success:false, cancelled, error}
    purchase: function(planKey){
      var self = this;
      if(!this.available()){
        return Promise.resolve({success:false, error:"الشراء غير متاح على هذا الجهاز"});
      }
      if(!_ready){
        // تهيئة ذاتية: هيّئ الآن (بمعرّف المستخدم إن وُجد) ثم أعد المحاولة مرة واحدة
        var _uid = null;
        try{
          var _u = JSON.parse(localStorage.getItem("tahadi_user") || sessionStorage.getItem("tahadi_user") || "null");
          if(_u && _u.uid) _uid = _u.uid;
        }catch(e){}
        return self.init(_uid).then(function(ok){
          if(!ok || !_ready){
            return {success:false, error:"نظام الشراء لم يجهز بعد، حاول ثانية"};
          }
          return self.purchase(planKey); // أعد المحاولة بعد نجاح التهيئة
        });
      }
      var productId = PRODUCTS[planKey];
      if(!productId){
        return Promise.resolve({success:false, error:"خطة غير معروفة"});
      }

      // اجلب العرض (Offering) ثم اشترِ الحزمة المطابقة
      return self.getOfferings().then(function(offering){
        console.log("[IAP] Offering =", offering);
        if(!offering || !offering.availablePackages || !offering.availablePackages.length){
          return Promise.reject({ _cfg:true, message:"لا توجد عروض (Offerings) في RevenueCat. تأكد من إنشاء Offering افتراضي وإضافة الخطتين، وأن المنتجات مفعّلة في Google Play." });
        }
        // اطبع معرّفات الحزم المتاحة للتشخيص
        try{
          console.log("[IAP] Packages =", offering.availablePackages.map(function(p){
            return { pkg:p.identifier, product:(p.product && p.product.identifier) };
          }));
        }catch(e){}
        // مطابقة مرنة: Google قد يرجع "pro_yearly" أو "pro_yearly:pro-yearly"
        var pkg = offering.availablePackages.filter(function(p){
          var id = (p.product && p.product.identifier) || "";
          var base = id.split(":")[0];               // "pro_yearly:pro-yearly" -> "pro_yearly"
          return id === productId || base === productId || id.indexOf(productId) === 0;
        })[0];
        if(!pkg){
          return Promise.reject({ _cfg:true, message:"المنتج "+productId+" غير موجود في العرض. الحزم المتاحة: "+offering.availablePackages.map(function(p){return (p.product&&p.product.identifier)||p.identifier;}).join(", ") });
        }
        console.log("[IAP] شراء الحزمة:", pkg.identifier, pkg.product && pkg.product.identifier);
        return _purchases.purchasePackage({ aPackage: pkg });
      }).then(function(result){
        // تحقّق من الصلاحيات بعد الشراء
        var info = result && result.customerInfo;
        var tier = self._tierFromCustomerInfo(info);
        if(tier){
          return self.syncToFirebase(tier).then(function(){
            return {success:true, tier:tier, customerInfo:info};
          });
        }
        return {success:false, error:"لم تُفعّل الصلاحية بعد الشراء"};
      }).catch(function(e){
        // المستخدم ألغى؟
        if(e && (e.code === "1" || e.userCancelled || (e.message||"").indexOf("cancel")>-1)){
          return {success:false, cancelled:true};
        }
        return {success:false, error:(e && e.message) || "فشل الشراء"};
      });
    },

    // استعادة المشتريات (Restore) — للمستخدم الذي أعاد تثبيت التطبيق
    restore: function(){
      var self = this;
      if(!this.available() || !_ready){
        return Promise.resolve({success:false, error:"الاستعادة غير متاحة"});
      }
      return _purchases.restorePurchases().then(function(res){
        var info = res && res.customerInfo;
        var tier = self._tierFromCustomerInfo(info);
        return self.syncToFirebase(tier).then(function(){
          return {success:true, tier:tier, customerInfo:info};
        });
      }).catch(function(e){
        return {success:false, error:(e && e.message) || "فشلت الاستعادة"};
      });
    },

    // اقرأ حالة الاشتراك الحالية من RevenueCat
    getStatus: function(){
      var self = this;
      if(!this.available() || !_ready){
        return Promise.resolve({tier:null});
      }
      return _purchases.getCustomerInfo().then(function(res){
        var info = res && res.customerInfo ? res.customerInfo : res;
        return {tier: self._tierFromCustomerInfo(info), customerInfo:info};
      }).catch(function(){
        return {tier:null};
      });
    },

    // استخرج المستوى (elite أفضل من pro) من معلومات العميل
    _tierFromCustomerInfo: function(info){
      if(!info) return null;
      var ent = info.entitlements && (info.entitlements.active || info.entitlements);
      if(!ent) return null;
      // إن كان أسطوري نشطاً
      if(ent[ENTITLEMENTS.elite] && (ent[ENTITLEMENTS.elite].isActive !== false)) return "elite";
      if(ent[ENTITLEMENTS.pro]   && (ent[ENTITLEMENTS.pro].isActive   !== false)) return "pro";
      return null;
    },

    // استمع لتغيّرات حالة الاشتراك (تجديد/إلغاء تلقائي)
    onStatusChange: function(cb){
      if(!_ready || !_purchases || !_purchases.addCustomerInfoUpdateListener) return;
      var self = this;
      try{
        _purchases.addCustomerInfoUpdateListener(function(info){
          var ci = info && info.customerInfo ? info.customerInfo : info;
          var tier = self._tierFromCustomerInfo(ci);
          // زامن مع Firebase عند كل تغيّر (تجديد/إلغاء)
          self.syncToFirebase(tier);
          if(cb) cb(tier);
        });
      }catch(e){}
    },

    /* ── ربط الشراء بـ Firebase ──
       عند نجاح الشراء/الاستعادة، نكتب الخطة في users/{uid}/currentPlan
       فتعمل المزايا عبر الويب والتطبيق معاً (مصدر حقيقة واحد) */
    syncToFirebase: function(tier){
      try{
        var uid = null;
        var u = JSON.parse(localStorage.getItem("tahadi_user")||sessionStorage.getItem("tahadi_user")||"null");
        if(u && u.uid) uid = u.uid;
        if(!uid && window.TahadiAuth && TahadiAuth.uid) uid = TahadiAuth.uid();
        if(!uid || !window.firebase || !firebase.apps || !firebase.apps.length) return Promise.resolve();

        var email = (u && u.email) || (window.TahadiAuth && TahadiAuth.currentUser() ? TahadiAuth.currentUser().email : "");

        if(tier){
          // اشتراك نشط — احسب تاريخ انتهاء سنوي (RevenueCat يدير التجديد فعلياً)
          var expires = new Date();
          expires.setFullYear(expires.getFullYear() + 1);
          // حدّث الحالة المحلية فوراً
          localStorage.setItem("tahadi_pro","1");
          if(tier === "elite") localStorage.setItem("tahadi_elite","1");
          else localStorage.removeItem("tahadi_elite");
          // اكتب في Firebase
          return firebase.database().ref("users/"+uid+"/currentPlan").set({
            plan: tier,
            email: email,
            expiresAt: expires.toISOString(),
            source: "iap",
            updatedAt: new Date().toISOString()
          }).then(function(){
            if(typeof window.renderUserBar === "function"){ try{ renderUserBar(); }catch(e){} }
          }).catch(function(){});
        } else {
          // لا اشتراك نشط (انتهى/أُلغي) — لا نمسح تلقائياً كي لا نُلغي اشتراكاً يدوياً من الأدمن
          // (نترك اشتراكات الأدمن اليدوية كما هي)
          return Promise.resolve();
        }
      }catch(e){ return Promise.resolve(); }
    }
  };

  window.IAP = IAP;
})();
