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
