/* ══════════════════════════════════════
   capacitor-bridge.js
   جسر بين كود الويب وـ Capacitor
   يكتشف بيئة التشغيل ويضبط السلوك
══════════════════════════════════════ */

(function(){
  var isApp = window.Capacitor !== undefined;
  window.IS_APP = isApp;

  if(!isApp){ return; } // موقع ويب عادي — لا شيء إضافي

  /* ── Status Bar ── */
  (function(){
    var s = window.Capacitor.Plugins.StatusBar;
    if(!s) return;
    s.setStyle({style: 'Dark'}).catch(function(){});
    s.setBackgroundColor({color: '#070B1F'}).catch(function(){});
  })();

  /* ── Back button (أندرويد) ── */
  var App = window.Capacitor.Plugins.App;
  if(App){
    App.addListener('backButton', function(e){
      var onGame = document.getElementById('game') &&
                   document.getElementById('game').classList.contains('on');
      var onResults = document.getElementById('results') &&
                      document.getElementById('results').classList.contains('on');
      if(onGame || onResults){
        if(confirm('الخروج من اللعبة؟')) history.back();
      } else {
        // في الصفحة الرئيسية — اسأل قبل الإغلاق
        if(e.canGoBack) history.back();
        else App.exitApp();
      }
    });
  }

  /* ── Deep Links: فتح روابط الغرف داخل التطبيق ──
     عند فتح https://drfajry.github.io/Number_Arena/...?room=CODE من التطبيق
     نوجّه المستخدم لصفحة الانضمام الصحيحة */
  if(App){
    App.addListener('appUrlOpen', function(ev){
      try{
        var u = new URL(ev.url);
        var room = u.searchParams.get('room');
        if(room){
          window.location.href = 'index.html?room=' + encodeURIComponent(room.toUpperCase());
        }
      }catch(e){}
    });
  }

  /* ── درع الجلسة: حماية تسجيل الدخول من مسح تخزين WebView ──
     أندرويد قد يمسح localStorage تحت ضغط الذاكرة (خصوصاً مع امتلاء ذاكرة الجهاز)
     الحل: نسخ بيانات الجلسة للتخزين الأصلي (Preferences) واستعادتها تلقائياً.
     يتطلب: npm install @capacitor/preferences && npx cap sync android
     (يتجاهل نفسه بأمان إن لم تكن الإضافة مثبتة) */
  (function(){
    var Prefs = window.Capacitor.Plugins.Preferences;
    if(!Prefs) return;
    var KEYS = ["tahadi_token","tahadi_user","tahadi_users","tahadi_pro","tahadi_elite"];

    function backup(){
      KEYS.forEach(function(k){
        var v = localStorage.getItem(k);
        if(v) Prefs.set({key:k, value:v}).catch(function(){});
      });
    }
    function restore(){
      var restored = false, pending = KEYS.length;
      KEYS.forEach(function(k){
        if(localStorage.getItem(k)){ if(--pending===0) done(); return; }
        Prefs.get({key:k}).then(function(r){
          if(r && r.value){ localStorage.setItem(k, r.value); restored = true; }
          if(--pending===0) done();
        }).catch(function(){ if(--pending===0) done(); });
      });
      function done(){
        if(restored && typeof window.renderUserBar === "function"){
          try{ renderUserBar(); }catch(e){}
        }
      }
    }

    restore();                       // استعادة عند الإقلاع إن كان التخزين مُسح
    setTimeout(backup, 4000);        // نسخة أولى بعد استقرار الصفحة
    setInterval(backup, 20000);      // نسخ دوري كل 20 ثانية
    document.addEventListener("visibilitychange", function(){
      if(document.visibilityState === "hidden") backup(); // نسخة عند مغادرة التطبيق
    });
  })();

  /* ── Haptics (اهتزازات) ── */
  var Haptics = window.Capacitor.Plugins.Haptics;
  window.haptic = {
    light:  function(){ Haptics && Haptics.impact({style:'LIGHT'}).catch(function(){}); },
    medium: function(){ Haptics && Haptics.impact({style:'MEDIUM'}).catch(function(){}); },
    success:function(){ Haptics && Haptics.notification({type:'SUCCESS'}).catch(function(){}); },
    error:  function(){ Haptics && Haptics.notification({type:'ERROR'}).catch(function(){}); },
  };

  /* ── منع تحديث الصفحة بالسحب لأسفل ── */
  document.addEventListener('touchmove', function(e){
    if(e.touches.length > 1) e.preventDefault();
  }, {passive: false});

  /* ── Share API ── */
  window.appShare = function(title, text, url){
    var Share = window.Capacitor.Plugins.Share;
    if(Share){
      Share.share({title: title, text: text, url: url}).catch(function(){});
    } else if(navigator.share){
      navigator.share({title: title, text: text, url: url}).catch(function(){});
    }
  };

  console.log('✅ Capacitor bridge loaded | platform:', Capacitor.getPlatform());
})();
