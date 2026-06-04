/* ============================================================================
 *  نظام التسويق بالعمولة — تحدي الأرقام (Number Arena)
 *  affiliate.js — وحدة واحدة كاملة جاهزة للدمج
 * ----------------------------------------------------------------------------
 *  المتطلبات: Firebase Realtime Database (نسخة compat / v8)
 *    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
 *    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>
 *    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
 *    <script src="affiliate.js"></script>
 *
 *  لو مشروعك يستخدم Firebase v9 (modular) راجع ملاحظة التحويل في نهاية الملف.
 *
 *  القواعد الثابتة (مطابقة لنموذج «دوري القدرات»):
 *    - نسبة العمولة:            15%
 *    - الحد الأدنى للسحب:        100 ريال
 *    - العمولة تُحتسب مرة واحدة عند أول اشتراك مدفوع لكل مُحال
 *
 *  أسعار الاشتراكات المرجعية (من ثوابت تحدي الأرقام):
 *    Pro:   9 ريال/شهر   | 69 ريال/سنة
 *    Elite: 19 ريال/شهر  | 149 ريال/سنة
 * ========================================================================== */

(function (global) {
  'use strict';

  // ------------------------------- الإعدادات -------------------------------
  const CONFIG = {
    COMMISSION_RATE: 0.15,        // نسبة العمولة 15%
    MIN_WITHDRAWAL: 100,          // أقل مبلغ سحب (ريال)
    REFERRAL_PARAM: 'ref',        // اسم الباراميتر في الرابط: ?ref=CODE
    PENDING_KEY: 'na_pending_ref',// مفتاح localStorage لحفظ كود الإحالة قبل التسجيل
    CODE_PREFIX: 'NA',            // بادئة كود الإحالة
    ONE_TIME_COMMISSION: true,    // عمولة لمرة واحدة لكل مُحال (لا تتكرر مع التجديد)
  };

  // الأسعار المرجعية (تُستخدم عند عدم تمرير المبلغ صراحةً) — مصدرها constants
  const PLAN_PRICES = {
    pro_month: 9, pro_year: 69,
    elite_month: 19, elite_year: 149,
  };

  // ------------------------------- أدوات عامة ------------------------------
  function db() {
    if (!global.firebase || !firebase.database) {
      throw new Error('Firebase Realtime Database غير مُهيّأ. تأكد من تحميل firebase-database.');
    }
    return firebase.database();
  }

  function nowISO() { return new Date().toISOString(); }

  function genCode(uid) {
    // كود قصير مقروء مشتق من الـ uid + عشوائي، يبدأ بالبادئة
    const base = (uid || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${CONFIG.CODE_PREFIX}${base}${rnd}`;
  }

  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  // =========================================================================
  //  1) تهيئة المسوّق: ضمان وجود كود إحالة فريد للمستخدم
  // =========================================================================
  async function initAffiliate(uid) {
    if (!uid) throw new Error('uid مطلوب');
    const ref = db().ref(`users/${uid}/affiliate`);
    const snap = await ref.once('value');
    let data = snap.val();

    if (!data || !data.code) {
      // توليد كود فريد (مع إعادة المحاولة عند التصادم النادر)
      let code, taken = true, tries = 0;
      while (taken && tries < 5) {
        code = genCode(uid);
        const exists = await db().ref(`referralCodes/${code}`).once('value');
        taken = exists.exists();
        tries++;
      }
      data = Object.assign({
        code: code,
        referredBy: null,
        balance: 0,
        totalEarned: 0,
        referralsCount: 0,
        paidReferralsCount: 0,
        createdAt: nowISO(),
      }, data || {});
      await ref.update({ code: data.code, balance: data.balance || 0,
        totalEarned: data.totalEarned || 0, referralsCount: data.referralsCount || 0,
        paidReferralsCount: data.paidReferralsCount || 0, createdAt: data.createdAt });
      await db().ref(`referralCodes/${data.code}`).set(uid); // فهرس كود -> uid
    }
    return data;
  }

  // =========================================================================
  //  2) التقاط كود الإحالة من الرابط (?ref=CODE) وحفظه حتى التسجيل
  //     استدعِها مرة عند تحميل الصفحة قبل تسجيل الدخول.
  // =========================================================================
  function captureReferralFromURL() {
    try {
      const params = new URLSearchParams(global.location.search);
      const code = params.get(CONFIG.REFERRAL_PARAM);
      if (code) {
        localStorage.setItem(CONFIG.PENDING_KEY, code.trim().toUpperCase());
        return code;
      }
    } catch (e) { /* تجاهل */ }
    return localStorage.getItem(CONFIG.PENDING_KEY) || null;
  }

  // =========================================================================
  //  3) ربط الإحالة عند تسجيل مستخدم جديد
  //     استدعِها بعد نجاح تسجيل/إنشاء حساب المستخدم.
  // =========================================================================
  async function attachReferralOnSignup(newUid) {
    if (!newUid) return { linked: false, reason: 'no-uid' };
    await initAffiliate(newUid); // تأكد أن للمستخدم الجديد كوده الخاص

    const pending = localStorage.getItem(CONFIG.PENDING_KEY);
    if (!pending) return { linked: false, reason: 'no-pending' };

    // امنع الإحالة الذاتية
    const myCode = (await db().ref(`users/${newUid}/affiliate/code`).once('value')).val();
    if (myCode && myCode === pending) {
      localStorage.removeItem(CONFIG.PENDING_KEY);
      return { linked: false, reason: 'self-referral' };
    }

    const refUidSnap = await db().ref(`referralCodes/${pending}`).once('value');
    const referrerUid = refUidSnap.val();
    if (!referrerUid) {
      localStorage.removeItem(CONFIG.PENDING_KEY);
      return { linked: false, reason: 'invalid-code' };
    }

    // لا تربط مرتين
    const already = (await db().ref(`users/${newUid}/affiliate/referredBy`).once('value')).val();
    if (already) { localStorage.removeItem(CONFIG.PENDING_KEY); return { linked: false, reason: 'already-linked' }; }

    await db().ref(`users/${newUid}/affiliate/referredBy`).set(referrerUid);
    // زِد عدّاد إحالات المُحيل (تسجيل، ليس بالضرورة مدفوعًا)
    await db().ref(`users/${referrerUid}/affiliate/referralsCount`)
      .transaction(c => (c || 0) + 1);

    localStorage.removeItem(CONFIG.PENDING_KEY);
    return { linked: true, referrerUid };
  }

  // =========================================================================
  //  4) تسجيل العمولة عند نجاح الدفع (Moyasar)
  //     استدعِها داخل callback نجاح الدفع، ومرّر uid الدافع وخطته/مبلغه.
  //     planKey أحد: pro_month | pro_year | elite_month | elite_year
  //     amountSAR اختياري (لو لم يُمرّر يُؤخذ من PLAN_PRICES).
  // =========================================================================
  async function recordSubscriptionCommission(payerUid, planKey, amountSAR) {
    if (!payerUid) return { credited: false, reason: 'no-uid' };
    const amount = Number(amountSAR != null ? amountSAR : PLAN_PRICES[planKey]);
    if (!amount || amount <= 0) return { credited: false, reason: 'bad-amount' };

    const payerAff = (await db().ref(`users/${payerUid}/affiliate`).once('value')).val() || {};
    const referrerUid = payerAff.referredBy;
    if (!referrerUid) return { credited: false, reason: 'no-referrer' };

    // عمولة لمرة واحدة: تحقّق أنه لم تُسجّل عمولة سابقة لهذا الدافع
    if (CONFIG.ONE_TIME_COMMISSION) {
      const prev = await db().ref(`affiliateCommissions/${referrerUid}`)
        .orderByChild('fromUid').equalTo(payerUid).once('value');
      if (prev.exists()) return { credited: false, reason: 'already-commissioned' };
    }

    const commission = round2(amount * CONFIG.COMMISSION_RATE);

    // سجّل العمولة
    const recRef = db().ref(`affiliateCommissions/${referrerUid}`).push();
    await recRef.set({
      amount: commission, baseAmount: amount, plan: planKey || 'unknown',
      fromUid: payerUid, status: 'earned', date: nowISO(),
    });

    // حدّث رصيد المُحيل وإجماليه وعدّاد المدفوعين (ذرّيًا)
    const affRef = db().ref(`users/${referrerUid}/affiliate`);
    await affRef.child('balance').transaction(b => round2((b || 0) + commission));
    await affRef.child('totalEarned').transaction(t => round2((t || 0) + commission));
    await affRef.child('paidReferralsCount').transaction(c => (c || 0) + 1);

    return { credited: true, referrerUid, commission };
  }

  // =========================================================================
  //  5) جلب إحصاءات المسوّق
  // =========================================================================
  async function getStats(uid) {
    const aff = (await db().ref(`users/${uid}/affiliate`).once('value')).val() || {};
    const link = buildReferralLink(aff.code);
    return {
      code: aff.code || null,
      link,
      balance: round2(aff.balance || 0),
      totalEarned: round2(aff.totalEarned || 0),
      referralsCount: aff.referralsCount || 0,
      paidReferralsCount: aff.paidReferralsCount || 0,
      canWithdraw: round2(aff.balance || 0) >= CONFIG.MIN_WITHDRAWAL,
      minWithdrawal: CONFIG.MIN_WITHDRAWAL,
    };
  }

  function buildReferralLink(code) {
    if (!code) return '';
    const origin = (global.location && global.location.origin) ? global.location.origin : 'https://drfajry2.netlify.app';
    return `${origin}/?${CONFIG.REFERRAL_PARAM}=${encodeURIComponent(code)}`;
  }

  async function listCommissions(uid, limit) {
    const snap = await db().ref(`affiliateCommissions/${uid}`).limitToLast(limit || 50).once('value');
    const out = [];
    snap.forEach(ch => { out.push(Object.assign({ id: ch.key }, ch.val())); });
    return out.reverse();
  }

  // =========================================================================
  //  6) طلب سحب
  //     method: { type:'bank'|'stcpay', ... تفاصيل الحساب }
  // =========================================================================
  async function requestWithdrawal(uid, amount, method) {
    amount = round2(amount);
    const aff = (await db().ref(`users/${uid}/affiliate`).once('value')).val() || {};
    const balance = round2(aff.balance || 0);

    if (amount < CONFIG.MIN_WITHDRAWAL)
      return { ok: false, reason: 'below-min', message: `الحد الأدنى للسحب ${CONFIG.MIN_WITHDRAWAL} ريال.` };
    if (amount > balance)
      return { ok: false, reason: 'insufficient', message: 'المبلغ المطلوب أكبر من رصيدك.' };

    // احجز المبلغ فورًا (اخصمه من الرصيد ريثما يُعتمد)
    const res = await db().ref(`users/${uid}/affiliate/balance`).transaction(b => {
      const cur = round2(b || 0);
      if (cur < amount) return; // ألغِ المعاملة
      return round2(cur - amount);
    });
    if (!res.committed) return { ok: false, reason: 'race', message: 'تعذّر حجز المبلغ، حاول مجددًا.' };

    const wRef = db().ref('withdrawals').push();
    await wRef.set({
      uid, code: aff.code || null, amount,
      method: method || null, status: 'pending', date: nowISO(),
    });
    return { ok: true, id: wRef.key, amount };
  }

  async function listMyWithdrawals(uid, limit) {
    const snap = await db().ref('withdrawals').orderByChild('uid').equalTo(uid).limitToLast(limit || 50).once('value');
    const out = []; snap.forEach(ch => out.push(Object.assign({ id: ch.key }, ch.val())));
    return out.reverse();
  }

  // =========================================================================
  //  7) دوال الإدارة (للوحة الأدمن)
  // =========================================================================
  const Admin = {
    async listWithdrawals(status) {
      const snap = await db().ref('withdrawals').once('value');
      const out = []; snap.forEach(ch => { const v = ch.val(); if (!status || v.status === status) out.push(Object.assign({ id: ch.key }, v)); });
      return out.sort((a, b) => (a.date < b.date ? 1 : -1));
    },
    async approveWithdrawal(id, adminNote) {
      await db().ref(`withdrawals/${id}`).update({ status: 'approved', approvedAt: nowISO(), adminNote: adminNote || null });
      return { ok: true };
    },
    async rejectWithdrawal(id, reason) {
      const wSnap = await db().ref(`withdrawals/${id}`).once('value');
      const w = wSnap.val();
      if (!w) return { ok: false, reason: 'not-found' };
      if (w.status === 'pending') {
        // أعِد المبلغ المحجوز لرصيد المستخدم
        await db().ref(`users/${w.uid}/affiliate/balance`).transaction(b => round2((b || 0) + (w.amount || 0)));
      }
      await db().ref(`withdrawals/${id}`).update({ status: 'rejected', rejectedAt: nowISO(), rejectReason: reason || null });
      return { ok: true };
    },
  };

  // =========================================================================
  //  8) لوحة المسوّق (واجهة عربية RTL) — تُحقن داخل عنصر بالـ id المعطى
  // =========================================================================
  function injectStyles() {
    if (document.getElementById('na-aff-styles')) return;
    const css = `
    :root{--aff-bg:#0C1130;--aff-card:rgba(255,255,255,.05);--aff-border:rgba(0,229,255,.15);
      --aff-cyan:#00E5FF;--aff-gold:#FFD046;--aff-green:#00E676;--aff-red:#FF3D5A;
      --aff-text:#D8EEFF;--aff-dim:rgba(160,210,255,.45);}
    .na-aff{direction:rtl;font-family:"Tajawal",inherit;color:var(--aff-text);
      max-width:700px;margin:0 auto;background:var(--aff-bg);border-radius:18px;padding:1.5rem}
    .na-aff *{box-sizing:border-box}
    .na-aff h3{margin:0 0 1.1rem;font-size:1.2rem;font-weight:900;
      background:linear-gradient(135deg,var(--aff-cyan),var(--aff-gold));
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    .na-aff .na-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem;margin-bottom:1.1rem}
    .na-aff .na-card{background:var(--aff-card);border:1px solid var(--aff-border);
      border-radius:13px;padding:1rem;text-align:center}
    .na-aff .na-card b{display:block;font-size:1.55rem;font-weight:900;
      color:var(--aff-cyan);font-family:"Cairo",sans-serif}
    .na-aff .na-card span{font-size:.72rem;color:var(--aff-dim)}
    .na-aff .na-section-lbl{font-size:.78rem;color:var(--aff-dim);margin-bottom:.4rem}
    .na-aff .na-link{display:flex;gap:.5rem;margin:.5rem 0 1.1rem}
    .na-aff .na-link input{flex:1;padding:.65rem .9rem;
      border:1px solid var(--aff-border);border-radius:9px;
      background:rgba(0,229,255,.04);color:var(--aff-text);font-size:.82rem;
      text-align:left;direction:ltr}
    .na-aff .na-btn{background:linear-gradient(135deg,var(--aff-cyan),#00B8CC);
      color:#000;border:0;border-radius:9px;padding:.65rem 1.1rem;
      font-weight:900;cursor:pointer;font-size:.85rem;font-family:"Cairo",sans-serif}
    .na-aff .na-btn.alt{background:linear-gradient(135deg,var(--aff-gold),#E69500);color:#000}
    .na-aff .na-btn:disabled{opacity:.35;cursor:not-allowed}
    .na-aff .na-wd{background:var(--aff-card);border:1px solid var(--aff-border);
      border-radius:13px;padding:1.1rem;margin-top:.75rem}
    .na-aff .na-wd b{font-size:.88rem;color:var(--aff-text)}
    .na-aff .na-wd input,.na-aff .na-wd select{width:100%;padding:.62rem .88rem;
      border:1px solid var(--aff-border);border-radius:9px;margin:.4rem 0;font-size:.85rem;
      background:rgba(0,229,255,.04);color:var(--aff-text)}
    .na-aff .na-wd select option{background:#0C1130;color:var(--aff-text)}
    .na-aff .na-note{font-size:.72rem;color:var(--aff-dim);margin-top:.4rem}
    .na-aff .na-hist{margin-top:1.2rem}
    .na-aff .na-hist b{font-size:.85rem;color:var(--aff-text)}
    .na-aff .na-row{display:flex;justify-content:space-between;align-items:center;
      padding:.55rem .25rem;border-bottom:1px solid rgba(255,255,255,.05);font-size:.78rem}
    .na-aff .na-badge{font-size:.65rem;padding:.15rem .52rem;border-radius:20px;font-weight:700}
    .na-aff .b-pending{background:rgba(255,208,70,.15);color:var(--aff-gold);
      border:1px solid rgba(255,208,70,.3)}
    .na-aff .b-approved{background:rgba(0,230,118,.12);color:var(--aff-green);
      border:1px solid rgba(0,230,118,.3)}
    .na-aff .b-rejected{background:rgba(255,61,90,.1);color:var(--aff-red);
      border:1px solid rgba(255,61,90,.25)}
    `;
    const el = document.createElement('style'); el.id = 'na-aff-styles'; el.textContent = css;
    document.head.appendChild(el);
  }

  function badge(status) {
    const map = { pending: ['b-pending', 'قيد المراجعة'], approved: ['b-approved', 'مقبول'], rejected: ['b-rejected', 'مرفوض'] };
    const [cls, txt] = map[status] || ['', status];
    return `<span class="na-badge ${cls}">${txt}</span>`;
  }

  async function renderAffiliateDashboard(containerId, uid) {
    injectStyles();
    const root = document.getElementById(containerId);
    if (!root) return;
    root.innerHTML = '<div class="na-aff">جارٍ التحميل…</div>';

    await initAffiliate(uid);
    const s = await getStats(uid);
    const hist = await listMyWithdrawals(uid, 20);

    root.innerHTML = `
    <div class="na-aff">
      <h3>برنامج التسويق بالعمولة 💸</h3>
      <div class="na-grid">
        <div class="na-card"><b>${s.balance.toFixed(2)}</b><span>الرصيد القابل للسحب (ريال)</span></div>
        <div class="na-card"><b>${s.totalEarned.toFixed(2)}</b><span>إجمالي الأرباح (ريال)</span></div>
        <div class="na-card"><b>${s.referralsCount}</b><span>عدد المسجّلين عبرك</span></div>
        <div class="na-card"><b>${s.paidReferralsCount}</b><span>المشتركون المدفوعون</span></div>
      </div>

      <div>رابط الإحالة الخاص بك (عمولتك 15% على كل اشتراك مدفوع):</div>
      <div class="na-link">
        <input id="na-aff-link" readonly value="${s.link}">
        <button class="na-btn alt" id="na-aff-copy">نسخ</button>
      </div>

      <div class="na-wd">
        <div><b>طلب سحب</b> — الحد الأدنى ${s.minWithdrawal} ريال</div>
        <input id="na-aff-amount" type="number" min="${s.minWithdrawal}" placeholder="المبلغ بالريال">
        <select id="na-aff-method">
          <option value="stcpay">STC Pay</option>
          <option value="bank">تحويل بنكي (IBAN)</option>
        </select>
        <input id="na-aff-account" placeholder="رقم STC Pay أو الـ IBAN">
        <button class="na-btn" id="na-aff-withdraw" ${s.canWithdraw ? '' : 'disabled'}>طلب السحب</button>
        <div class="na-note" id="na-aff-msg">${s.canWithdraw ? '' : `تحتاج رصيدًا لا يقل عن ${s.minWithdrawal} ريال للسحب.`}</div>
      </div>

      <div class="na-hist">
        <b>سجل عمليات السحب</b>
        ${hist.length ? hist.map(w => `
          <div class="na-row"><span>${(w.date || '').slice(0, 10)}</span>
          <span>${Number(w.amount).toFixed(2)} ر.س</span>${badge(w.status)}</div>`).join('') :
          '<div class="na-note">لا توجد عمليات سحب بعد.</div>'}
      </div>
    </div>`;

    // نسخ الرابط
    root.querySelector('#na-aff-copy').onclick = () => {
      const inp = root.querySelector('#na-aff-link');
      inp.select(); document.execCommand('copy');
      root.querySelector('#na-aff-copy').textContent = 'تم النسخ ✓';
      setTimeout(() => { root.querySelector('#na-aff-copy').textContent = 'نسخ'; }, 1500);
    };

    // طلب السحب
    const wbtn = root.querySelector('#na-aff-withdraw');
    if (wbtn) wbtn.onclick = async () => {
      const amount = parseFloat(root.querySelector('#na-aff-amount').value);
      const type = root.querySelector('#na-aff-method').value;
      const account = root.querySelector('#na-aff-account').value.trim();
      const msg = root.querySelector('#na-aff-msg');
      if (!account) { msg.textContent = 'أدخل بيانات الحساب.'; return; }
      wbtn.disabled = true; msg.textContent = 'جارٍ المعالجة…';
      const r = await requestWithdrawal(uid, amount, { type, account });
      if (r.ok) { msg.textContent = 'تم إرسال طلب السحب بنجاح ✓'; setTimeout(() => renderAffiliateDashboard(containerId, uid), 1200); }
      else { msg.textContent = r.message || 'تعذّر إرسال الطلب.'; wbtn.disabled = false; }
    };
  }

  // ----------------------------- التصدير العام -----------------------------
  global.Affiliate = {
    CONFIG, PLAN_PRICES,
    initAffiliate, captureReferralFromURL, attachReferralOnSignup,
    recordSubscriptionCommission, getStats, listCommissions,
    requestWithdrawal, listMyWithdrawals, buildReferralLink,
    renderAffiliateDashboard, Admin,
  };

})(typeof window !== 'undefined' ? window : this);

/* ============================================================================
 *  ملاحظات الدمج السريع (تحدي الأرقام)
 * ----------------------------------------------------------------------------
 *  1) عند تحميل الصفحة (قبل تسجيل الدخول):
 *       Affiliate.captureReferralFromURL();
 *
 *  2) بعد نجاح تسجيل/إنشاء حساب المستخدم (لديك OTP):
 *       await Affiliate.attachReferralOnSignup(user.uid);
 *
 *  3) عند دخول مستخدم حالي (لضمان امتلاكه كودًا):
 *       await Affiliate.initAffiliate(user.uid);
 *
 *  4) داخل callback نجاح دفع Moyasar (بعد تأكيد الدفع):
 *       // planKey: pro_month | pro_year | elite_month | elite_year
 *       await Affiliate.recordSubscriptionCommission(user.uid, 'elite_year');
 *       // أو بمبلغ صريح:
 *       // await Affiliate.recordSubscriptionCommission(user.uid, 'custom', 149);
 *
 *  5) عرض لوحة المسوّق في صفحة الحساب:
 *       <div id="affiliate-box"></div>
 *       Affiliate.renderAffiliateDashboard('affiliate-box', user.uid);
 *
 *  6) لوحة الأدمن (نفس نمط admin panel لديك):
 *       const pend = await Affiliate.Admin.listWithdrawals('pending');
 *       await Affiliate.Admin.approveWithdrawal(id, 'حُوّل عبر STC Pay');
 *       await Affiliate.Admin.rejectWithdrawal(id, 'بيانات حساب غير صحيحة'); // يعيد المبلغ للرصيد
 *
 *  بنية البيانات في RTDB:
 *    users/{uid}/affiliate : {code, referredBy, balance, totalEarned,
 *                             referralsCount, paidReferralsCount, createdAt}
 *    referralCodes/{CODE}  : uid                     (فهرس عكسي)
 *    affiliateCommissions/{referrerUid}/{pushId} : {amount, baseAmount, plan, fromUid, status, date}
 *    withdrawals/{pushId}  : {uid, code, amount, method, status, date, ...}
 *
 *  قواعد أمان RTDB المقترحة (تُضاف لقواعدك):
 *    "referralCodes":          { ".read": true, "$code": { ".write": "auth != null" } },
 *    "users": { "$uid": { "affiliate": {
 *        ".read": "auth != null",
 *        ".write": "auth != null"        // شدِّدها حسب نموذج صلاحياتك (الأدمن/الدوال الخلفية)
 *    } } },
 *    "withdrawals":            { ".read": "auth != null", ".write": "auth != null" }
 *    // ملاحظة أمنية: لمنع التلاعب بالرصيد من العميل، يُفضّل لاحقًا نقل
 *    // recordSubscriptionCommission إلى Cloud Function تُستدعى من webhook Moyasar.
 *
 *  للتحويل إلى Firebase v9 (modular): استبدل firebase.database() و .ref()/.once()/
 *  .transaction() بدوال getDatabase, ref, get, runTransaction, push, set, update,
 *  query, orderByChild, equalTo من 'firebase/database'. المنطق نفسه دون تغيير.
 * ========================================================================== */
