/* ============================================================ */
/* PPID ALERT — Custom Alert Library                            */
/* Versi  : 1.0.0                                              */
/* Tema   : #0072c6 (Blue PPID) / #003d80                     */
/*                                                             */
/* Cara Pakai:                                                  */
/*   <link rel="stylesheet" href="ppid-alert.css">             */
/*   <script src="ppid-alert.js"></script>                     */
/*                                                             */
/* API:                                                         */
/*   PA.toast({ type, title, message, duration, position })    */
/*   PA.alert({ type, title, message, closable }, target)      */
/*   PA.dialog({ type, title, message, confirm, cancel })      */
/*     .then(result => { if(result) { ... } })                  */
/*   PA.loading({ title, message, dots })                      */
/*   PA.notify({ type, title, message, duration })             */
/*   PA.close()  /  PA.closeAll()                              */
/* ============================================================ */

(function (global) {
  'use strict';

  /* ── Ikon Bootstrap Icons per tipe ── */
  const ICONS = {
    success : '<i class="bi bi-check-circle-fill"></i>',
    danger  : '<i class="bi bi-x-circle-fill"></i>',
    warning : '<i class="bi bi-exclamation-triangle-fill"></i>',
    info    : '<i class="bi bi-info-circle-fill"></i>',
    question: '<i class="bi bi-question-circle-fill"></i>',
  };

  /* ── Label tombol konfirm default per tipe ── */
  const CONFIRM_DEFAULTS = {
    success : { text: 'Ya, Lanjutkan',  cls: 'pa-btn-success'  },
    danger  : { text: 'Ya, Hapus',      cls: 'pa-btn-danger'   },
    warning : { text: 'Saya Mengerti',  cls: 'pa-btn-warning'  },
    info    : { text: 'OK',             cls: 'pa-btn-info'     },
    question: { text: 'Ya',             cls: 'pa-btn-question' },
  };

  /* ── State ── */
  const _tw        = {};   /* toast containers per posisi */
  let   _backdrop  = null; /* backdrop aktif (dialog/loading) */
  let   _notify    = null; /* notify panel aktif */

  /* ════════════════════════════════════════
     HELPER
  ════════════════════════════════════════ */

  /* Buat elemen HTML */
  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls)  e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* Escape HTML sederhana */
  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* Jam sekarang dalam format lokal ID */
  function nowTime() {
    const d = new Date();
    return d.toLocaleTimeString('id-ID',{ hour:'2-digit', minute:'2-digit' }) +
           ' · ' + d.toLocaleDateString('id-ID',{ day:'numeric', month:'short', year:'numeric' });
  }

  /* Buat & tampilkan backdrop (untuk dialog & loading) */
  function mkBackdrop(typeClass) {
    const bd = h('div', `pa-backdrop pa-t-${typeClass}`);
    document.body.appendChild(bd);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => bd.classList.add('pa-show'));
    _backdrop = bd;
    return bd;
  }

  /* Tutup & hapus backdrop */
  function rmBackdrop(bd) {
    if (!bd) return;
    bd.classList.remove('pa-show');
    document.body.style.overflow = '';
    setTimeout(() => bd.parentNode && bd.parentNode.removeChild(bd), 320);
    if (_backdrop === bd) _backdrop = null;
  }

  /* Trap fokus di dalam container (aksesibilitas) */
  function trapFocus(el) {
    const sel = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
    const all = [...el.querySelectorAll(sel)];
    if (!all.length) return;
    all[0].focus();
    el.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const first = all[0], last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ════════════════════════════════════════
     1. PA.dialog()
     Returns: Promise<boolean>
  ════════════════════════════════════════ */
  function dialog(opts) {
    opts = Object.assign({
      type   : 'info',
      title  : 'Konfirmasi',
      message: 'Apakah Anda yakin ingin melanjutkan?',
      confirm: null,
      cancel : 'Batal',
    }, opts);

    const type  = opts.type;
    const def   = CONFIRM_DEFAULTS[type] || CONFIRM_DEFAULTS.info;
    const cfTxt = opts.confirm || def.text;
    const cfCls = def.cls;

    return new Promise(resolve => {
      const bd  = mkBackdrop(type);
      const box = h('div', 'pa-dialog');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', 'pa-dlg-title');

      box.innerHTML = `
        <div class="pa-dialog-bar"></div>
        <div class="pa-dialog-body">
          <div class="pa-icon-ring">${ICONS[type] || ICONS.info}</div>
          <div class="pa-dialog-title" id="pa-dlg-title">${esc(opts.title)}</div>
          <div class="pa-dialog-msg">${opts.message}</div>
        </div>
        <div class="pa-dialog-footer">
          ${opts.cancel !== false
            ? `<button class="pa-btn pa-btn-cancel pa-dlg-cancel">${esc(opts.cancel)}</button>`
            : ''}
          <button class="pa-btn ${cfCls} pa-dlg-ok">${esc(cfTxt)}</button>
        </div>`;

      bd.appendChild(box);
      trapFocus(box);

      function done(result) {
        rmBackdrop(bd);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      }

      box.querySelector('.pa-dlg-ok').addEventListener('click', () => done(true));
      const cancelBtn = box.querySelector('.pa-dlg-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', () => done(false));

      /* Klik luar dialog → batal */
      bd.addEventListener('click', e => { if (e.target === bd) done(false); });

      /* Escape → batal */
      function onKey(e) { if (e.key === 'Escape') done(false); }
      document.addEventListener('keydown', onKey);
    });
  }

  /* ════════════════════════════════════════
     2. PA.toast()
  ════════════════════════════════════════ */
  function toast(opts) {
    opts = Object.assign({
      type    : 'info',
      title   : '',
      message : '',
      duration: 4000,
      position: 'top-right',
    }, opts);

    const pos = opts.position;                        /* e.g. "top-right" */
    const posClass = 'pa-tw-' + pos;

    /* Buat container posisi jika belum ada */
    if (!_tw[pos]) {
      const c = h('div', `pa-toast-wrap ${posClass}`);
      document.body.appendChild(c);
      _tw[pos] = c;
    }

    const t = h('div', `pa-toast pa-toast-${opts.type}`);
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.innerHTML = `
      <div class="pa-toast-ico">${ICONS[opts.type] || ICONS.info}</div>
      <div class="pa-toast-body">
        ${opts.title   ? `<div class="pa-toast-title">${esc(opts.title)}</div>`   : ''}
        ${opts.message ? `<div class="pa-toast-msg">${esc(opts.message)}</div>` : ''}
      </div>
      <button class="pa-toast-x" aria-label="Tutup">&#10005;</button>
      <div class="pa-toast-prog" style="animation-duration:${opts.duration}ms"></div>`;

    _tw[pos].appendChild(t);

    let timer;

    function dismiss() {
      clearTimeout(timer);
      t.classList.add('pa-toast-out');
      setTimeout(() => t.parentNode && t.parentNode.removeChild(t), 350);
    }

    timer = setTimeout(dismiss, opts.duration);

    t.querySelector('.pa-toast-x').addEventListener('click', dismiss);

    /* Pause on hover */
    t.addEventListener('mouseenter', () => {
      clearTimeout(timer);
      const prog = t.querySelector('.pa-toast-prog');
      if (prog) prog.style.animationPlayState = 'paused';
    });
    t.addEventListener('mouseleave', () => {
      const prog = t.querySelector('.pa-toast-prog');
      if (prog) prog.style.animationPlayState = 'running';
      timer = setTimeout(dismiss, Math.max(opts.duration / 4, 1200));
    });

    return { dismiss };
  }

  /* ════════════════════════════════════════
     3. PA.alert()
     Inject inline alert ke dalam target element
  ════════════════════════════════════════ */
  function alert(opts, targetEl) {
    opts = Object.assign({
      type    : 'info',
      title   : '',
      message : '',
      closable: true,
    }, opts);

    const target = typeof targetEl === 'string'
      ? document.querySelector(targetEl)
      : (targetEl || null);

    const a = h('div', `pa-alert pa-alert-${opts.type}`);
    a.setAttribute('role', 'alert');
    a.innerHTML = `
      <div class="pa-alert-ico">${ICONS[opts.type] || ICONS.info}</div>
      <div class="pa-alert-body">
        ${opts.title   ? `<div class="pa-alert-title">${esc(opts.title)}</div>`   : ''}
        ${opts.message ? `<div class="pa-alert-msg">${opts.message}</div>` : ''}
      </div>
      ${opts.closable ? `<button class="pa-alert-x" aria-label="Tutup">&#10005;</button>` : ''}`;

    if (opts.closable) {
      a.querySelector('.pa-alert-x').addEventListener('click', () => {
        a.classList.add('pa-alert-out');
        setTimeout(() => a.parentNode && a.parentNode.removeChild(a), 280);
      });
    }

    const container = target || document.querySelector('main, .content-area, .card-body, body');
    container.insertAdjacentElement('afterbegin', a);

    return {
      el: a,
      dismiss() {
        a.classList.add('pa-alert-out');
        setTimeout(() => a.parentNode && a.parentNode.removeChild(a), 280);
      },
    };
  }

  /* ════════════════════════════════════════
     4. PA.loading()
     Tutup dengan loader.close() atau PA.close()
  ════════════════════════════════════════ */
  function loading(opts) {
    opts = Object.assign({
      title  : 'Memproses...',
      message: 'Mohon tunggu sebentar.',
      dots   : false,
    }, opts);

    const bd  = mkBackdrop('info');
    const box = h('div', 'pa-loading-box');

    const spinnerHTML = opts.dots
      ? `<div class="pa-dots"><div class="pa-dot"></div><div class="pa-dot"></div><div class="pa-dot"></div></div>`
      : `<div class="pa-spinner"></div>`;

    box.innerHTML = `
      ${spinnerHTML}
      <div class="pa-loading-title">${esc(opts.title)}</div>
      <div class="pa-loading-msg" id="pa-load-msg">${esc(opts.message)}</div>
      <div class="pa-loading-brand">
        <div class="pa-loading-brand-dot"></div>
        <div class="pa-loading-brand-text">PPID Kota Pekalongan</div>
        <div class="pa-loading-brand-dot"></div>
      </div>`;

    bd.appendChild(box);

    return {
      close()         { rmBackdrop(bd); },
      update(newMsg)  {
        const el = box.querySelector('#pa-load-msg');
        if (el) el.textContent = newMsg;
      },
    };
  }

  /* ════════════════════════════════════════
     5. PA.notify()
     Panel notifikasi besar dari kanan
  ════════════════════════════════════════ */
  function notify(opts) {
    opts = Object.assign({
      type    : 'info',
      title   : 'Notifikasi',
      message : '',
      duration: 6000,
    }, opts);

    /* Tutup notify lama jika masih ada */
    if (_notify) {
      _notify.classList.add('pa-notify-out');
      const old = _notify;
      setTimeout(() => old.parentNode && old.parentNode.removeChild(old), 460);
      _notify = null;
    }

    const n = h('div', `pa-notify pa-notify-${opts.type}`);
    n.setAttribute('role', 'status');
    n.setAttribute('aria-live', 'polite');
    n.innerHTML = `
      <div class="pa-notify-head">
        <div class="pa-notify-badge">${ICONS[opts.type] || ICONS.info}</div>
        <div class="pa-notify-meta">
          <div class="pa-notify-title">${esc(opts.title)}</div>
          <div class="pa-notify-time">${nowTime()}</div>
        </div>
        <button class="pa-notify-x" aria-label="Tutup">&#10005;</button>
      </div>
      <div class="pa-notify-body">
        <div class="pa-notify-msg">${opts.message}</div>
      </div>
      <div class="pa-notify-prog" style="animation-duration:${opts.duration}ms"></div>`;

    document.body.appendChild(n);
    _notify = n;
    requestAnimationFrame(() => n.classList.add('pa-notify-show'));

    let timer;

    function dismiss() {
      clearTimeout(timer);
      n.classList.remove('pa-notify-show');
      n.classList.add('pa-notify-out');
      setTimeout(() => n.parentNode && n.parentNode.removeChild(n), 460);
      if (_notify === n) _notify = null;
    }

    timer = setTimeout(dismiss, opts.duration);
    n.querySelector('.pa-notify-x').addEventListener('click', dismiss);

    /* Pause on hover */
    n.addEventListener('mouseenter', () => {
      clearTimeout(timer);
      const prog = n.querySelector('.pa-notify-prog');
      if (prog) prog.style.animationPlayState = 'paused';
    });
    n.addEventListener('mouseleave', () => {
      const prog = n.querySelector('.pa-notify-prog');
      if (prog) prog.style.animationPlayState = 'running';
      timer = setTimeout(dismiss, Math.max(opts.duration / 3, 2000));
    });

    return { dismiss };
  }

  /* ════════════════════════════════════════
     6. PA.close() — tutup backdrop aktif
  ════════════════════════════════════════ */
  function close() {
    if (_backdrop) rmBackdrop(_backdrop);
  }

  /* ════════════════════════════════════════
     7. PA.closeAll() — tutup semua
  ════════════════════════════════════════ */
  function closeAll() {
    /* backdrop */
    if (_backdrop) rmBackdrop(_backdrop);

    /* notify */
    if (_notify) {
      _notify.classList.add('pa-notify-out');
      const old = _notify;
      setTimeout(() => old.parentNode && old.parentNode.removeChild(old), 460);
      _notify = null;
    }

    /* semua toast */
    Object.values(_tw).forEach(container => {
      container.querySelectorAll('.pa-toast').forEach(t => {
        t.classList.add('pa-toast-out');
        setTimeout(() => t.parentNode && t.parentNode.removeChild(t), 350);
      });
    });
  }

  /* ── Export Global ── */
  global.PA = { dialog, toast, alert, loading, notify, close, closeAll };

})(window);
