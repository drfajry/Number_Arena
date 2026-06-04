/* ══════════════════════════════════════
   payment.js — نظام الدفع عبر Moyasar
   يُستخدم في جميع الصفحات
══════════════════════════════════════ */

const Payment = {

  plan: 'monthly',
  method: 'mada',

  /* ── Init: أضف المودال للصفحة ── */
  init(){
    if(document.getElementById('payModal')) return;

    document.body.insertAdjacentHTML('beforeend', `
    <!-- ══ PAYMENT MODAL ══ -->
    <div class="modal-overlay" id="payModal">
      <div class="modal-box" style="max-width:400px">

        <!-- Step 1: تأكيد الخطة + رقم الجوال -->
        <div id="ps1">
          <div class="steps">
            <div class="step-dot active"></div>
            <div class="step-dot"></div>
            <div class="step-dot"></div>
          </div>
          <div class="modal-title">💳 اشتراك تحدي الأرقام</div>

          <div style="background:rgba(255,208,70,.07);border:1.5px solid rgba(255,208,70,.25);
            border-radius:12px;padding:.9rem;margin-bottom:1rem;text-align:center">
            <div style="font-family:'Cairo',sans-serif;font-size:1.5rem;font-weight:900;color:var(--gold)"
              id="payPlanLabel">شهري — 19 ر.س</div>
            <div style="font-size:.68rem;color:var(--dim);margin-top:.3rem">
              4000+ سؤال · أونلاين · 5 وسائل · 4 فرق
            </div>
          </div>

          <div class="form-group">
            <label>رقم الجوال *</label>
            <div class="phone-wrap">
              <div class="phone-prefix">🇸🇦 +966</div>
              <input type="tel" id="payPhone" class="inp inp-ltr"
                placeholder="5XXXXXXXX" maxlength="9"
                oninput="this.value=this.value.replace(/[^0-9]/g,'')">
            </div>
          </div>

          <div id="ps1Alert" class="alert alert-error" style="display:none"></div>

          <div style="display:flex;gap:.5rem;margin-top:.9rem">
            <button class="btn btn-orange full" onclick="Payment.step1Next()">
              اختر طريقة الدفع ←
            </button>
            <button class="btn btn-ghost sm" onclick="TAHADI.closeModal('payModal')"
              style="flex:1;padding:.78rem">إلغاء</button>
          </div>
          <p style="font-size:.6rem;color:var(--dim);text-align:center;margin-top:.5rem">
            🔒 الدفع مشفّر وآمن عبر Moyasar
          </p>
        </div>

        <!-- Step 2: طريقة الدفع -->
        <div id="ps2" style="display:none">
          <div class="steps">
            <div class="step-dot done"></div>
            <div class="step-dot active"></div>
            <div class="step-dot"></div>
          </div>
          <div class="modal-title">اختر طريقة الدفع</div>

          <button class="pay-method active" id="pm-mada" onclick="Payment.selectMethod('mada')">
            <span class="pay-method-ico">🏦</span>
            <div class="pay-method-info">
              <div class="pay-method-title">مدى</div>
              <div class="pay-method-desc">بطاقة مدى السعودية</div>
            </div>
            <div class="pay-check">✓</div>
          </button>

          <button class="pay-method" id="pm-cc" onclick="Payment.selectMethod('creditcard')">
            <span class="pay-method-ico">💳</span>
            <div class="pay-method-info">
              <div class="pay-method-title">VISA / Mastercard</div>
              <div class="pay-method-desc">بطاقة ائتمانية دولية</div>
            </div>
            <div class="pay-check">✓</div>
          </button>

          <button class="pay-method" id="pm-apple" onclick="Payment.selectMethod('applepay')">
            <span class="pay-method-ico"></span>
            <div class="pay-method-info">
              <div class="pay-method-title">Apple Pay</div>
              <div class="pay-method-desc">ادفع بـ Apple Pay</div>
            </div>
            <div class="pay-check">✓</div>
          </button>

          <div id="ps2Alert" class="alert alert-error" style="display:none"></div>

          <div style="display:flex;gap:.5rem;margin-top:.9rem">
            <button class="btn btn-orange full" id="payNowBtn" onclick="Payment.doPayNow()">
              ادفع الآن 🔒
            </button>
            <button class="btn btn-ghost sm" onclick="Payment.showStep(1)"
              style="flex:1;padding:.78rem">رجوع</button>
          </div>

          <div style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap;margin-top:.5rem">
            <span style="font-size:.6rem;color:var(--dim)">🔒 SSL</span>
            <span style="font-size:.6rem;color:var(--dim)">⚡ Moyasar</span>
            <span style="font-size:.6rem;color:var(--dim)">🇸🇦 بوابة سعودية</span>
          </div>
        </div>

        <!-- Step 3: نموذج Moyasar المدمج -->
        <div id="ps3" style="display:none">
          <div class="steps">
            <div class="step-dot done"></div>
            <div class="step-dot done"></div>
            <div class="step-dot active"></div>
          </div>
          <div class="modal-title">إتمام الدفع</div>
          <div id="moyasarFormWrap"></div>
          <button class="btn btn-ghost sm full" onclick="Payment.showStep(2)"
            style="margin-top:.8rem">← رجوع</button>
        </div>

        <!-- Step 4: نجاح -->
        <div id="ps4" style="display:none;text-align:center;padding:1.5rem 0">
          <div style="font-size:3.5rem;margin-bottom:.8rem" class="animate-pop">🎉</div>
          <div style="font-family:'Cairo',sans-serif;font-size:1.3rem;font-weight:900;color:var(--green)">
            تم الاشتراك بنجاح!
          </div>
          <div style="font-size:.82rem;color:var(--dim);margin:.5rem 0 1.2rem">
            اشتراكك مفعّل. استمتع بجميع المميزات!
          </div>
          <button class="btn btn-cyan" onclick="Payment.onSuccess()"
            style="max-width:220px;margin:0 auto">ابدأ اللعب ⚡</button>
        </div>

        <!-- Step 5: فشل -->
        <div id="ps5" style="display:none;text-align:center;padding:1.5rem 0">
          <div style="font-size:3rem;margin-bottom:.8rem">❌</div>
          <div style="font-family:'Cairo',sans-serif;font-size:1.1rem;font-weight:900;color:var(--red)">
            لم يتم الدفع
          </div>
          <div id="ps5Msg" style="font-size:.8rem;color:var(--dim);margin:.4rem 0 1.2rem">
            حاول مرة أخرى.
          </div>
          <button class="btn btn-orange" onclick="Payment.showStep(2)"
            style="max-width:220px;margin:0 auto">حاول مجدداً</button>
        </div>

      </div>
    </div>
    `);

    // Close on backdrop
    document.getElementById('payModal').addEventListener('click', e=>{
      if(e.target.id==='payModal') TAHADI.closeModal('payModal');
    });

    // Handle Moyasar return
    this.handleReturn();
  },

  /* ── Open modal ── */
  open(plan){
    this.plan   = plan || 'monthly';
    this.method = 'mada';
    const info  = TAHADI.PLANS[this.plan];
    document.getElementById('payPlanLabel').textContent =
      info.label + ' — ' + info.price + ' ر.س';

    // Pre-fill phone if logged in
    const user = TAHADI.getUser();
    if(user?.phone){
      document.getElementById('payPhone').value = user.phone.replace('+966','');
    }

    this.showStep(1);
    ['ps1Alert','ps2Alert'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.style.display='none';
    });
    this.selectMethod('mada');
    TAHADI.openModal('payModal');
  },

  /* ── Show step ── */
  showStep(n){
    [1,2,3,4,5].forEach(i=>{
      const el=document.getElementById('ps'+i);
      if(el) el.style.display= i===n ?'block':'none';
    });
  },

  /* ── Select payment method ── */
  selectMethod(m){
    this.method = m;
    ['pm-mada','pm-cc','pm-apple'].forEach(id=>{
      document.getElementById(id)?.classList.remove('active');
    });
    const map = {mada:'pm-mada', creditcard:'pm-cc', applepay:'pm-apple'};
    document.getElementById(map[m])?.classList.add('active');
  },

  /* ── Step 1 next ── */
  step1Next(){
    const phone = document.getElementById('payPhone').value.trim();
    const err   = document.getElementById('ps1Alert');
    if(!TAHADI.validatePhone(phone)){
      err.textContent = '❗ أدخل رقم الجوال صحيحاً (مثال: 5XXXXXXXX)';
      err.style.display = 'block'; return;
    }
    err.style.display = 'none';
    this.showStep(2);
  },

  /* ── Do pay now ── */
  async doPayNow(){
    const phone  = document.getElementById('payPhone').value.trim();
    const btn    = document.getElementById('payNowBtn');
    const err2   = document.getElementById('ps2Alert');
    err2.style.display = 'none';
    TAHADI.setLoading(btn, true, 'جارٍ التحميل...');
    this.showStep(3);

    // Load Moyasar.js
    await TAHADI.loadMoyasar();

    const wrap = document.getElementById('moyasarFormWrap');
    wrap.innerHTML = '';

    // Try backend if logged in
    const token = TAHADI.getToken();
    if(token && TAHADI.API && !token.startsWith('demo_')){
      const d = await TAHADI.api('/subscriptions/checkout', {
        method:'POST',
        body: JSON.stringify({ plan: this.plan })
      });
      if(d.ok && d.checkout_url){
        window.location.href = d.checkout_url;
        return;
      }
    }

    // Direct Moyasar
    if(!window.Moyasar){
      this.showStep(2);
      err2.textContent = '❌ تعذّر تحميل بوابة الدفع. تحقق من اتصالك.';
      err2.style.display = 'block';
      TAHADI.setLoading(btn, false);
      return;
    }

    try {
      const div = document.createElement('div');
      div.className = 'mysr-form';
      wrap.appendChild(div);

      Moyasar.init({
        element:             '.mysr-form',
        amount:              TAHADI.PLANS[this.plan].amount,
        currency:            'SAR',
        description:         'تحدي الأرقام — اشتراك ' + TAHADI.PLANS[this.plan].label,
        publishable_api_key: TAHADI.MOYASAR_PK,
        callback_url:        window.location.href,
        methods:             [this.method],
        metadata:            { plan: this.plan, phone: '+966'+phone },
        on_failure: (err)=>{
          document.getElementById('ps5Msg').textContent =
            (err?.message) || 'فشلت عملية الدفع.';
          this.showStep(5);
        }
      });
      TAHADI.setLoading(btn, false);
    } catch(e){
      console.error('Moyasar:', e);
      this.showStep(2);
      err2.textContent = '❌ خطأ في بوابة الدفع. تحقق من مفتاح Moyasar.';
      err2.style.display = 'block';
      TAHADI.setLoading(btn, false);
    }
  },

  /* ── Handle Moyasar return ── */
  handleReturn(){
    const p      = new URLSearchParams(location.search);
    const status = (p.get('status')||'').toLowerCase();
    const payId  = p.get('id') || p.get('payment_id');
    if(!status && !payId) return;
    history.replaceState({}, '', location.pathname);

    if(status==='paid' || status==='initiated'){
      localStorage.setItem('tahadi_pro','1');
      setTimeout(()=>{
        this.open(this.plan);
        this.showStep(4);
      }, 400);
      // Verify with backend
      const token = TAHADI.getToken();
      if(payId && token && !token.startsWith('demo_')){
        TAHADI.api('/subscriptions/verify/'+payId).catch(()=>{});
      }
    } else if(status==='failed' || status==='canceled'){
      setTimeout(()=>{
        this.open(this.plan);
        document.getElementById('ps5Msg').textContent = 'لم يتم خصم أي مبلغ. حاول مجدداً.';
        this.showStep(5);
      }, 400);
    }
  },

  /* ── On success ── */
  onSuccess(){
    TAHADI.closeModal('payModal');
    if(typeof window.onPaySuccess === 'function') window.onPaySuccess();
    else window.location.reload();
  }
};

window.Payment = Payment;
