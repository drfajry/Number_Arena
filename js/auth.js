/* ══════════════════════════════════════
   auth.js — نظام المصادقة (جوال + OTP)
   يُستخدم في جميع الصفحات
══════════════════════════════════════ */

const Auth = {

  /* ── State ── */
  sentPhone: '',
  demoOTP:   '',

  /* ── Init: أضف المودال للصفحة ── */
  init(){
    if(document.getElementById('authModal')) return; // already added

    document.body.insertAdjacentHTML('beforeend', `
    <!-- ══ AUTH MODAL ══ -->
    <div class="modal-overlay" id="authModal">
      <div class="modal-box" style="max-width:380px">

        <!-- Step 1: رقم الجوال -->
        <div id="authStep1">
          <div class="steps">
            <div class="step-dot active" id="authDot1"></div>
            <div class="step-dot" id="authDot2"></div>
            <div class="step-dot" id="authDot3"></div>
          </div>
          <div class="modal-title">👤 تسجيل الدخول</div>

          <div class="form-group">
            <label>رقم الجوال *</label>
            <div class="phone-wrap">
              <div class="phone-prefix">🇸🇦 +966</div>
              <input type="tel" id="authPhoneInput" class="inp inp-ltr"
                placeholder="5XXXXXXXX" maxlength="9"
                oninput="this.value=this.value.replace(/[^0-9]/g,'')">
            </div>
          </div>

          <div class="form-group">
            <label>البريد الإلكتروني
              <span style="color:var(--dim);font-size:.65rem">(اختياري)</span>
            </label>
            <input type="email" id="authEmailInput" class="inp" placeholder="name@example.com">
          </div>

          <div id="authStep1Alert" class="alert alert-error" style="display:none"></div>

          <button class="btn btn-cyan full" id="authSendBtn" onclick="Auth.sendOTP()">
            إرسال رمز التحقق
          </button>

          <p style="font-size:.62rem;color:var(--dim);text-align:center;margin-top:.6rem">
            سيُرسَل رمز SMS إلى رقمك
          </p>
          <button class="btn btn-ghost sm full" onclick="TAHADI.closeModal('authModal')"
            style="margin-top:.5rem">إلغاء</button>
        </div>

        <!-- Step 2: رمز OTP -->
        <div id="authStep2" style="display:none">
          <div class="steps">
            <div class="step-dot done" id="authDot1b"></div>
            <div class="step-dot active" id="authDot2b"></div>
            <div class="step-dot" id="authDot3b"></div>
          </div>
          <div class="modal-title">🔐 رمز التحقق</div>

          <p style="text-align:center;font-size:.8rem;color:var(--dim);margin-bottom:1rem">
            أُرسل رمز مكون من 6 أرقام إلى<br>
            <strong style="color:var(--text)" id="authPhoneShow"></strong>
          </p>

          <div class="otp-grid">
            <input class="otp-cell" type="tel" maxlength="1" id="otp0">
            <input class="otp-cell" type="tel" maxlength="1" id="otp1">
            <input class="otp-cell" type="tel" maxlength="1" id="otp2">
            <input class="otp-cell" type="tel" maxlength="1" id="otp3">
            <input class="otp-cell" type="tel" maxlength="1" id="otp4">
            <input class="otp-cell" type="tel" maxlength="1" id="otp5">
          </div>

          <div class="otp-timer" id="otpTimerWrap">
            انتهاء الرمز خلال <b id="otpSeconds">120</b> ثانية
          </div>

          <div style="text-align:center;margin-top:.3rem">
            <button id="resendOTPBtn" class="btn btn-ghost sm"
              onclick="Auth.resend()" disabled
              style="width:auto;font-size:.75rem;padding:.28rem .7rem">
              إعادة إرسال الرمز
            </button>
          </div>

          <div id="demoHint" class="alert alert-warn" style="display:none;margin-top:.5rem">
            💡 وضع تجريبي — استخدم الرمز: <strong>123456</strong>
          </div>

          <div id="authStep2Alert" class="alert alert-error" style="display:none;margin-top:.5rem"></div>

          <button class="btn btn-cyan full" id="authVerifyBtn"
            onclick="Auth.verify()" style="margin-top:.85rem">
            تحقق وتسجيل الدخول
          </button>
          <button class="btn btn-ghost sm full" onclick="Auth.showStep(1)"
            style="margin-top:.5rem">← تغيير الرقم</button>
        </div>

        <!-- Step 3: نجاح -->
        <div id="authStep3" style="display:none;text-align:center;padding:1rem 0">
          <div style="font-size:3rem;margin-bottom:.6rem;animation:popIn .4s ease-out">✅</div>
          <div style="font-family:'Cairo',sans-serif;font-size:1.2rem;font-weight:900;color:var(--green)">
            تم تسجيل الدخول!
          </div>
          <div style="font-size:.8rem;color:var(--dim);margin:.4rem 0 1rem" id="authWelcomeMsg"></div>
          <button class="btn btn-cyan" onclick="TAHADI.closeModal('authModal')"
            style="max-width:200px;margin:0 auto">
            ابدأ ⚡
          </button>
        </div>

      </div>
    </div>
    `);

    // Wire OTP inputs
    TAHADI.wireOTP('otp', (val) => {
      if(val.length === 6) Auth.verify();
    });

    // Close on backdrop click
    document.getElementById('authModal').addEventListener('click', e=>{
      if(e.target.id === 'authModal') TAHADI.closeModal('authModal');
    });
  },

  /* ── Open modal ── */
  open(onSuccess){
    this._onSuccess = onSuccess || null;
    this.showStep(1);
    TAHADI.openModal('authModal');
    setTimeout(()=> document.getElementById('authPhoneInput')?.focus(), 300);
  },

  /* ── Show step ── */
  showStep(n){
    [1,2,3].forEach(i=>{
      const el = document.getElementById('authStep'+i);
      if(el) el.style.display = i===n ? 'block' : 'none';
    });
  },

  /* ── Send OTP ── */
  async sendOTP(){
    const phone = document.getElementById('authPhoneInput').value.trim();
    const email = document.getElementById('authEmailInput').value.trim();
    const errEl = document.getElementById('authStep1Alert');
    const btn   = document.getElementById('authSendBtn');
    errEl.style.display = 'none';

    if(!TAHADI.validatePhone(phone)){
      errEl.textContent = '❗ أدخل رقم الجوال صحيحاً (مثال: 5XXXXXXXX)';
      errEl.style.display = 'block'; return;
    }
    if(email && (!email.includes('@') || !email.includes('.'))){
      errEl.textContent = '❗ البريد الإلكتروني غير صحيح';
      errEl.style.display = 'block'; return;
    }

    this.sentPhone = '+966' + phone;
    TAHADI.setLoading(btn, true, 'جارٍ الإرسال...');

    // Try backend
    const d = await TAHADI.api('/auth/send-otp', {
      method:'POST',
      body: JSON.stringify({ phone: this.sentPhone, email: email||null })
    });

    TAHADI.setLoading(btn, false);

    if(d.ok){
      // Backend sent real SMS
      document.getElementById('demoHint').style.display = 'none';
    } else {
      // Demo mode — no backend or SMS gateway
      this.demoOTP = '123456';
      document.getElementById('demoHint').style.display = 'block';
    }

    document.getElementById('authPhoneShow').textContent = this.sentPhone;
    this.showStep(2);
    TAHADI.clearOTP('otp');
    TAHADI.startOTPTimer(
      document.getElementById('otpSeconds'),
      document.getElementById('resendOTPBtn'),
      120
    );
    document.getElementById('otpTimerWrap').style.display = 'block';
    setTimeout(()=> document.getElementById('otp0')?.focus(), 300);
  },

  /* ── Resend ── */
  async resend(){
    this.demoOTP = '123456';
    TAHADI.clearOTP('otp');
    document.getElementById('authStep2Alert').style.display = 'none';
    document.getElementById('otpTimerWrap').style.display = 'block';
    TAHADI.startOTPTimer(
      document.getElementById('otpSeconds'),
      document.getElementById('resendOTPBtn'),
      120
    );
    document.getElementById('otp0')?.focus();
    TAHADI.toastSuccess('✅ تم إعادة إرسال الرمز');

    // Also call backend
    await TAHADI.api('/auth/send-otp', {
      method:'POST',
      body: JSON.stringify({ phone: this.sentPhone })
    });
  },

  /* ── Verify OTP ── */
  async verify(){
    const otp   = TAHADI.getOTPValue('otp');
    const errEl = document.getElementById('authStep2Alert');
    const btn   = document.getElementById('authVerifyBtn');
    errEl.style.display = 'none';

    if(otp.length !== 6){
      errEl.textContent = '❗ أدخل الرمز المكون من 6 أرقام';
      errEl.style.display = 'block'; return;
    }

    TAHADI.setLoading(btn, true, 'جارٍ التحقق...');

    // Try backend first
    const d = await TAHADI.api('/auth/verify-otp', {
      method:'POST',
      body: JSON.stringify({ phone: this.sentPhone, otp })
    });

    if(d.ok && d.token){
      TAHADI.setLoading(btn, false);
      TAHADI.setSession(d.token, d.user, d.isPro);
      this._finishLogin(d.user);
      return;
    }

    // Demo mode fallback
    if(otp === this.demoOTP || otp === '123456'){
      TAHADI.setLoading(btn, false);
      const user = {
        id: 'demo_'+Date.now(),
        name: 'مستخدم '+this.sentPhone.slice(-4),
        phone: this.sentPhone
      };
      TAHADI.setSession('demo_'+Date.now(), user, false);
      this._finishLogin(user);
      return;
    }

    TAHADI.setLoading(btn, false);
    errEl.textContent = d.error || '❌ رمز التحقق غير صحيح' + (this.demoOTP ? ' — جرّب: 123456' : '');
    errEl.style.display = 'block';
  },

  /* ── Finish login ── */
  _finishLogin(user){
    clearInterval(TAHADI._otpTimer);
    document.getElementById('authWelcomeMsg').textContent =
      'أهلاً ' + (user.name || 'بك') + '! 🎉';
    this.showStep(3);

    // Callback
    if(this._onSuccess) this._onSuccess(user);

    // Update UI on page
    if(typeof window.onAuthSuccess === 'function') window.onAuthSuccess(user);

    // Auto close after 1.5s
    setTimeout(()=> TAHADI.closeModal('authModal'), 1500);
  },

  /* ── Logout ── */
  logout(){
    TAHADI.clearSession();
    if(typeof window.onAuthLogout === 'function') window.onAuthLogout();
    else window.location.reload();
  },

  /* ── Render user bar (for home page) ── */
  renderUserBar(containerId){
    const el = document.getElementById(containerId);
    if(!el) return;
    const user  = TAHADI.getUser();
    const pro   = TAHADI.isPro();
    const token = TAHADI.getToken();

    if(!token || !user){
      el.innerHTML = `
        <button class="btn btn-ghost sm" onclick="Auth.open()" style="width:auto;font-size:.78rem">
          👤 تسجيل الدخول
        </button>`;
      return;
    }

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;
        background:var(--card);border:1px solid var(--bd);border-radius:11px;padding:.55rem .85rem;width:100%">
        <div style="display:flex;align-items:center;gap:.55rem">
          <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--cyan),var(--gold));
            display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.8rem;color:#000;flex-shrink:0">
            ${(user.name||'م').charAt(0)}
          </div>
          <div>
            <div style="font-size:.8rem;font-weight:700">${user.name||user.phone||'مستخدم'}</div>
            <div style="font-size:.62rem;color:var(--dim)">
              ${pro ? 'اشتراك Pro نشط ✅' : 'الخطة المجانية'}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.4rem">
          ${pro ? '<span class="badge badge-pro">PRO ⭐</span>' : ''}
          <button class="btn btn-ghost sm" onclick="Auth.logout()"
            style="width:auto;padding:.3rem .65rem;font-size:.68rem">خروج</button>
        </div>
      </div>`;
  }
};

window.Auth = Auth;
