// ==UserScript==
// @name         Pick.io Ultimate Stealth v19.3 - Universal Cross-Browser
// @namespace    http://tampermonkey.net/
// @version      19.3
// @description  Universal: Windows/Linux, Chrome/Firefox/Brave/Opera/Chromium - auto captcha, toast detection, triple-fallback navigation
// @author       PsYh0.INC (universal rewrite)
// @match        https://dogepick.io/*
// @match        https://tronpick.io/*
// @match        https://bnbpick.io/*
// @match        https://solpick.io/*
// @match        https://tonpick.game/*
// @match        https://polpick.io/*
// @match        https://suipick.io/*
// @match        https://litepick.io/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      discord.com
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    /* ═══════════════════════════════════════════════════════
       BROWSER / OS DETECTION
       Wykrywa środowisko i dostosowuje zachowanie
    ═══════════════════════════════════════════════════════ */

    const ENV = (() => {
        const ua  = navigator.userAgent || '';
        const nav = navigator;
        return {
            isFirefox:  /Firefox\//.test(ua),
            isBrave:    !!(nav.brave && nav.brave.isBrave),
            isOpera:    /OPR\/|Opera\//.test(ua),
            isChrome:   /Chrome\//.test(ua) && !/OPR\/|Edg\//.test(ua),
            isChromium: /Chromium\//.test(ua),
            isEdge:     /Edg\//.test(ua),
            isLinux:    /Linux/.test(ua) && !/Android/.test(ua),
            isWindows:  /Windows/.test(ua),
            hasMV3:     typeof chrome !== 'undefined' && !!chrome?.runtime?.getManifest,
            hasGM:      typeof GM_xmlhttpRequest !== 'undefined',
        };
    })();

    console.log('[STEALTH v19.3] ENV:', JSON.stringify(ENV));

    /* ═══════════════════════════════════════════════════════
       SAFE STORAGE – GM_setValue/GM_getValue jako fallback
       dla przeglądarek które blokują localStorage
    ═══════════════════════════════════════════════════════ */

    const Store = {
        set(key, val) {
            const str = JSON.stringify(val);
            try { localStorage.setItem(key, str); } catch (_) {}
            try { if (typeof GM_setValue !== 'undefined') GM_setValue(key, str); } catch (_) {}
        },
        get(key) {
            try {
                const v = localStorage.getItem(key);
                if (v) return JSON.parse(v);
            } catch (_) {}
            try {
                if (typeof GM_getValue !== 'undefined') {
                    const v = GM_getValue(key, null);
                    if (v) return JSON.parse(v);
                }
            } catch (_) {}
            return null;
        },
        remove(key) {
            try { localStorage.removeItem(key); } catch (_) {}
            try { if (typeof GM_setValue !== 'undefined') GM_setValue(key, null); } catch (_) {}
        }
    };

    /* ═══════════════════════════════════════════════════════
       ANTI-DETECTION / FINGERPRINT SPOOFING
    ═══════════════════════════════════════════════════════ */

    // Webdriver
    try {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
        delete navigator.__proto__.webdriver;
    } catch (_) {}

    // Permissions query (nie działa na Firefox – ignoruj błąd)
    try {
        const _origQ = window.navigator.permissions.query;
        window.navigator.permissions.query = (p) =>
            p.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : _origQ(p);
    } catch (_) {}

    // Hardware / memory
    try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 + Math.floor(Math.random() * 4) }); } catch (_) {}
    try { Object.defineProperty(navigator, 'deviceMemory',         { get: () => 8 }); } catch (_) {}
    try { Object.defineProperty(navigator, 'languages',            { get: () => ['en-US', 'en', 'pl-PL', 'pl'] }); } catch (_) {}
    try { Object.defineProperty(navigator, 'platform',             { get: () => ENV.isLinux ? 'Linux x86_64' : 'Win32' }); } catch (_) {}

    // Plugins (Firefox ma inne – nie nadpisuj na FF)
    if (!ENV.isFirefox) {
        try {
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const p = [
                        { name: 'Chrome PDF Plugin',  filename: 'internal-pdf-viewer',              description: 'Portable Document Format', length: 1 },
                        { name: 'Chrome PDF Viewer',  filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '',                         length: 1 },
                        { name: 'Native Client',      filename: 'internal-nacl-plugin',             description: '',                         length: 2 }
                    ];
                    p.item = p.namedItem = () => null;
                    p.refresh = () => {};
                    return p;
                }
            });
        } catch (_) {}
    }

    // Chrome runtime (potrzebne dla wykrywania botów na Chromium-based)
    if (!ENV.isFirefox) {
        try {
            if (!window.chrome) window.chrome = {};
            if (!window.chrome.runtime) {
                window.chrome.runtime = { connect: () => ({}), sendMessage: () => {}, onMessage: { addListener: () => {} } };
            }
        } catch (_) {}
    }

    // Canvas noise
    try {
        const _origDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function () {
            const ctx = this.getContext('2d');
            if (ctx) {
                const img = ctx.getImageData(0, 0, this.width, this.height);
                for (let i = 0; i < img.data.length; i += 4)
                    if (Math.random() < 0.0015) img.data[i + ~~(Math.random() * 3)] += ~~(Math.random() * 3) - 1;
                ctx.putImageData(img, 0, 0);
            }
            return _origDataURL.apply(this, arguments);
        };
    } catch (_) {}

    // WebGL spoof
    try {
        const _origGP = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (p) {
            if (p === 37445) return 'Google Inc. (Intel)';
            if (p === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11-31.0.101.XXXX)';
            return _origGP.call(this, p);
        };
    } catch (_) {}

    // AudioContext noise
    try {
        const _AC = window.AudioContext || window.webkitAudioContext;
        if (_AC) {
            const _origOsc = _AC.prototype.createOscillator;
            _AC.prototype.createOscillator = function () {
                const o = _origOsc.call(this);
                const _os = o.start;
                o.start = function (...a) {
                    o.frequency.value += (Math.random() - 0.5) * 0.00012;
                    return _os.apply(this, a);
                };
                return o;
            };
        }
    } catch (_) {}

    // Battery spoof
    try {
        if (navigator.getBattery)
            navigator.getBattery = () => Promise.resolve({
                charging: true, chargingTime: 0, dischargingTime: Infinity,
                level: 0.92 + Math.random() * 0.08
            });
    } catch (_) {}

    // Timing jitter – zachowaj oryginalne timery PRZED nadpisaniem
    const origST = window.setTimeout;
    const origSI = window.setInterval;
    const origCI = window.clearInterval;

    function gauss(mu, sigma) {
        const u = 1 - Math.random(), v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma + mu;
    }

    try {
        window.setTimeout  = (f, d, ...a) => d < 120 ? origST(f, d, ...a) : origST(f, d + gauss(0, d * 0.06), ...a);
        window.setInterval = (f, d, ...a) => d < 120 ? origSI(f, d, ...a) : origSI(f, d + gauss(0, d * 0.06), ...a);
    } catch (_) {}

    // Mouse filter
    let mx = 0, my = 0;
    try {
        document.addEventListener('mousemove', e => {
            if (Math.hypot(e.clientX - mx, e.clientY - my) < 1.2) e.stopImmediatePropagation();
            mx = e.clientX; my = e.clientY;
        }, true);
    } catch (_) {}

    /* ═══════════════════════════════════════════════════════
       CONFIG
    ═══════════════════════════════════════════════════════ */

    const CONFIG = {
        DISCORD_WEBHOOK:   'https://discord.com/api/webhooks/1504883631494004789/pJfb4YXXnzs1IFYr2F9lc5BTh_NNZUwGW0eNWTO3bYV3zodiDWl3pXuVoq8fAeNXpYLd',
        CLAIM_INTERVAL:    60 * 60 * 1000,
        ACTIVITY_TIME:     [30000, 30000],
        PRE_CLICK_DELAY:   [30000, 60000],
        ROTATION_DELAY:    [10000, 15000],
        BAN_DELAYS:        [10 * 60 * 1000, 22 * 60 * 1000, 31 * 60 * 1000],
        CLOUDFLARE_WAIT:   15000,
        TOAST_WAIT:        7000,
        CAPTCHA_LOAD_WAIT: [3000, 5000],
        SITES: {
            'tronpick.io':  { min: 15,     fee: 0.2,    coin: 'TRX'  },
            'solpick.io':   { min: 0.0025, fee: 0.0001, coin: 'SOL'  },
            'dogepick.io':  { min: 10,     fee: 0.5,    coin: 'DOGE' },
            'bnbpick.io':   { min: 0.002,  fee: 0.0001, coin: 'BNB'  },
            'polpick.io':   { min: 1.5,    fee: 0.02,   coin: 'POL'  },
            'tonpick.game': { min: 0.1,    fee: 0.0005, coin: 'TON'  },
            'suipick.io':   { min: 0.1,    fee: 0.0005, coin: 'SUI'  },
            'litepick.io':  { min: 0.005,  fee: 0.0001, coin: 'LTC'  }
        }
    };

    const SITE_LIST = Object.keys(CONFIG.SITES);
    const SITE_KEY  = location.hostname.replace('www.', '');

    /* ═══════════════════════════════════════════════════════
       STATE
    ═══════════════════════════════════════════════════════ */

    const STATE_KEY = 'pickio_stealth_193_state';
    let STATE = {
        balances:    {},
        lastClaims:  {},
        banCount:    0,
        lastBanTime: 0,
        pageArrival: Date.now(),
        failedSites: {},
        sessionStart: Date.now()
    };

    SITE_LIST.forEach(s => {
        STATE.balances[s]    = 0;
        STATE.lastClaims[s]  = 0;
        STATE.failedSites[s] = { count: 0, last: 0 };
    });

    function saveState() {
        Store.set(STATE_KEY, STATE);
    }

    function loadState() {
        try {
            const d = Store.get(STATE_KEY);
            if (d) {
                Object.assign(STATE, d);
                STATE.pageArrival = Date.now();
                SITE_LIST.forEach(s => {
                    if (!STATE.failedSites[s]) STATE.failedSites[s] = { count: 0, last: 0 };
                    if (Date.now() - (STATE.failedSites[s].last || 0) > 3600e3)
                        STATE.failedSites[s] = { count: 0, last: 0 };
                });
            }
        } catch (e) {}
    }

    loadState();

    /* ═══════════════════════════════════════════════════════
       HELPERS
    ═══════════════════════════════════════════════════════ */

    function rndDelay(min, max) {
        const mean = (min + max) / 2, stdev = (max - min) / 6;
        let v;
        do {
            const u = 1 - Math.random(), vv = Math.random();
            v = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * vv) * stdev + mean;
        } while (v < min || v > max);
        return v;
    }

    // sleep zawsze używa origST (przed jitterem)
    function sleep(ms) { return new Promise(r => origST(r, Math.max(ms, 0))); }

    /* ═══════════════════════════════════════════════════════
       UNIVERSAL NAVIGATION
       Obsługuje Brave (blokuje replace), Firefox (blokuje assign),
       Opera, Chrome – próbuje wszystkich metod
    ═══════════════════════════════════════════════════════ */

    function navigateTo(url) {
        const methods = [
            () => window.location.replace(url),
            () => window.location.assign(url),
            () => { window.location.href = url; },
            () => { const a = document.createElement('a'); a.href = url; a.click(); },
            () => window.open(url, '_self')
        ];

        for (const method of methods) {
            try {
                method();
                return true;
            } catch (e) {
                console.warn('[NAV] method failed, trying next:', e.message);
            }
        }
        console.error('[NAV] All navigation methods failed');
        return false;
    }

    /* ═══════════════════════════════════════════════════════
       DISCORD WEBHOOK
       GM_xmlhttpRequest (Tampermonkey) – omija CORS na wszystkich
       przeglądarkach. Fallback: fetch (może być blokowany na Brave)
    ═══════════════════════════════════════════════════════ */

    function sendWebhook(message, type = 'info') {
        if (!CONFIG.DISCORD_WEBHOOK || CONFIG.DISCORD_WEBHOOK.includes('YOUR')) return;

        const colors = { claim: 3066993, ban: 15158332, error: 10038562, rotate: 3447003, wait: 16776960, info: 9807270 };
        const coin   = CONFIG.SITES[SITE_KEY]?.coin || '?';
        const now    = new Date().toLocaleString('pl-PL');

        const payload = JSON.stringify({
            username: 'Pick.io Stealth v19.3',
            embeds: [{
                title:
                    type === 'claim'  ? '💰 Successful Claim!' :
                    type === 'ban'    ? '🚨 Soft-Ban!'          :
                    type === 'error'  ? '❌ Error'              :
                    type === 'wait'   ? '⏳ Too Early'          : 'ℹ️ Info',
                description: message,
                color: colors[type] || colors.info,
                fields: [
                    { name: '🌐 Site',    value: SITE_KEY,    inline: true },
                    { name: '💎 Coin',    value: coin,        inline: true },
                    { name: '🕒 Time',    value: now,         inline: false },
                    { name: '🖥️ Browser', value:
                        ENV.isBrave    ? 'Brave'    :
                        ENV.isFirefox  ? 'Firefox'  :
                        ENV.isOpera    ? 'Opera GX' :
                        ENV.isEdge     ? 'Edge'     : 'Chrome/Chromium',
                        inline: true },
                    { name: '💻 OS', value: ENV.isLinux ? 'Linux' : 'Windows', inline: true }
                ],
                footer: { text: 'Pick.io Stealth Bot v19.3 Universal' }
            }]
        });

        // GM_xmlhttpRequest – najlepszy, omija CORS na każdej przeglądarce
        if (ENV.hasGM) {
            GM_xmlhttpRequest({
                method:  'POST',
                url:     CONFIG.DISCORD_WEBHOOK,
                headers: { 'Content-Type': 'application/json' },
                data:    payload,
                onload:  r  => console.log('[WEBHOOK] OK', r.status),
                onerror: e  => console.warn('[WEBHOOK] GM error', e)
            });
            return;
        }

        // Fallback: fetch z no-cors (Firefox bez GM, nie zwraca statusu ale wysyła)
        fetch(CONFIG.DISCORD_WEBHOOK, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    payload,
            mode:    'no-cors'
        }).catch(e => console.warn('[WEBHOOK] fetch error', e));
    }

    /* ═══════════════════════════════════════════════════════
       CAPTCHA – wybór Cloudflare Turnstile
    ═══════════════════════════════════════════════════════ */

    async function selectTurnstileCaptcha() {
        const select = document.querySelector('#select_captcha');
        if (!select) return; // Strona nie ma selecta – pomiń

        if (select.value === '3') {
            addLog('Captcha: Turnstile already set', 'info');
            return;
        }

        // Symuluj ludzki wybór
        select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await sleep(rndDelay(300, 700));

        select.value = '3'; // Cloudflare Turnstile

        // Wywołaj wszystkie możliwe eventy żeby strona wykryła zmianę
        ['change', 'input', 'blur'].forEach(ev =>
            select.dispatchEvent(new Event(ev, { bubbles: true }))
        );
        select.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

        addLog('Captcha: Cloudflare Turnstile selected ✅', 'success');
        updatePanel('🔒 Turnstile selected – loading...');

        // Czekaj aż captcha się załaduje
        await sleep(rndDelay(CONFIG.CAPTCHA_LOAD_WAIT[0], CONFIG.CAPTCHA_LOAD_WAIT[1]));
    }

    /* ═══════════════════════════════════════════════════════
       TOAST DETECTION
    ═══════════════════════════════════════════════════════ */

    function checkWaitToast() {
        const selectors = [
            '.jq-toast-single', '.jq-toast-single.jq-has-icon', '.jq-icon-error',
            '.toast', '.toast-error', '.toast-message', '[class*="toast"]',
            '[class*="alert"]', '.notification', '.faucet-message',
            '.error-message', '[class*="error"]'
        ];

        for (const sel of selectors) {
            for (const el of document.querySelectorAll(sel)) {
                const text = (el.innerText || el.textContent || '').trim();
                const mFull = text.match(/please wait for\s+(\d+)\s+minutes?,\s*(\d+)\s+seconds?/i);
                const mAny  = text.match(/(\d+)\s+minutes?,\s*(\d+)\s+seconds?/i);
                const mMin  = text.match(/please wait for\s+(\d+)\s+minutes?/i);
                const mSec  = text.match(/please wait for\s+(\d+)\s+seconds?/i);

                if (mFull) return { found: true, waitMs: (parseInt(mFull[1]) * 60 + parseInt(mFull[2])) * 1000, text };
                if (mAny  && text.toLowerCase().includes('wait')) return { found: true, waitMs: (parseInt(mAny[1]) * 60 + parseInt(mAny[2])) * 1000, text };
                if (mMin  && text.toLowerCase().includes('wait')) return { found: true, waitMs: parseInt(mMin[1]) * 60 * 1000, text };
                if (mSec  && text.toLowerCase().includes('wait')) return { found: true, waitMs: parseInt(mSec[1]) * 1000, text };
            }
        }

        const gm = (document.body?.innerText || '').match(/please wait for\s+(\d+)\s+minutes?,\s*(\d+)\s+seconds?/i);
        if (gm) return { found: true, waitMs: (parseInt(gm[1]) * 60 + parseInt(gm[2])) * 1000, text: gm[0] };

        return { found: false, waitMs: 0, text: '' };
    }

    function waitForToast(maxWaitMs = CONFIG.TOAST_WAIT) {
        return new Promise(resolve => {
            const start = Date.now();
            const iv = origSI(() => {
                const r = checkWaitToast();
                if (r.found) { origCI(iv); resolve(r); return; }
                if (Date.now() - start >= maxWaitMs) { origCI(iv); resolve(null); }
            }, 300);
        });
    }

    /* ═══════════════════════════════════════════════════════
       DETECTION
    ═══════════════════════════════════════════════════════ */

    function checkCloudflare() {
        try {
            const t = document.title.toLowerCase();
            if (t.includes('just a moment') || t.includes('checking your browser')) return true;
            const txt = (document.body?.innerText || '').toLowerCase();
            return txt.includes('checking your browser') && txt.includes('cloudflare') &&
                   (!document.querySelector('main,.container,[role="main"]') || txt.length < 2500);
        } catch (_) { return false; }
    }

    function checkSoftBan() {
        try {
            const txt = (document.body?.innerText || '').toLowerCase();
            return ['banned', 'temporarily banned', 'too many requests', 'rate limit',
                    'slow down', 'cooldown', 'try again later', 'blocked']
                   .some(p => txt.includes(p));
        } catch (_) { return false; }
    }

    /* ═══════════════════════════════════════════════════════
       PANEL UI
    ═══════════════════════════════════════════════════════ */

    let activityLog = [];

    function addLog(message, type = 'info') {
        const icons  = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', claim: '💰', rotate: '🔄', ban: '🚨', wait: '⏳' };
        const colors = { info: '#00bfff', success: '#00ff9f', warning: '#ffa500', error: '#ff4444', claim: '#ffd700', rotate: '#00ffff', ban: '#ff0000', wait: '#ffff00' };
        activityLog.unshift({
            time:  new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            message, type,
            icon:  icons[type]  || 'ℹ️',
            color: colors[type] || '#00bfff'
        });
        if (activityLog.length > 20) activityLog.pop();
        _renderLog();
    }

    function _renderLog() {
        const el = document.getElementById('activity-log');
        if (!el) return;
        el.innerHTML = activityLog.map(e =>
            `<div style="margin:3px 0;padding:5px 8px;background:rgba(0,0,0,0.3);border-radius:4px;border-left:3px solid ${e.color};font-size:11px;display:flex;align-items:center;gap:8px;">
                <span style="color:#888;font-size:10px;min-width:60px;">${e.time}</span>
                <span>${e.icon}</span>
                <span style="flex:1;color:${e.color};">${e.message}</span>
            </div>`
        ).join('') || '<div style="text-align:center;color:#666;padding:20px;">No activity yet...</div>';
    }

    function createPanel() {
        if (document.getElementById('pickio-panel')) return;

        const browserLabel =
            ENV.isBrave   ? '🦁 Brave'    :
            ENV.isFirefox ? '🦊 Firefox'  :
            ENV.isOpera   ? '🎭 Opera GX' :
            ENV.isEdge    ? '🌀 Edge'     : '⚡ Chrome';

        const osLabel = ENV.isLinux ? '🐧 Linux' : '🪟 Windows';

        const panel = document.createElement('div');
        panel.id = 'pickio-panel';
        panel.style.cssText = 'position:fixed;top:10px;right:10px;width:440px;z-index:999999;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);color:#00ff9f;font-family:\'Courier New\',monospace;font-size:13px;padding:16px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.8);border:1px solid rgba(0,255,159,0.3);max-height:90vh;overflow-y:auto;';
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-weight:bold;font-size:14px;">🛡️ Pick.io Stealth v19.3</div>
                <button id="pp-toggle" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);color:#00ff9f;padding:3px 7px;border-radius:4px;cursor:pointer;font-size:11px;">▼</button>
            </div>
            <div style="font-size:10px;color:#888;margin-bottom:10px;">${browserLabel} &nbsp;|&nbsp; ${osLabel} &nbsp;|&nbsp; GM: ${ENV.hasGM ? '✅' : '❌'}</div>
            <div id="pp-body">
                <div id="status" style="margin:8px 0;padding:10px;background:rgba(0,255,159,0.1);border-radius:6px;font-size:12px;border-left:3px solid #00ff9f;min-height:40px;word-break:break-word;"></div>
                <div style="margin:8px 0;padding:8px;background:rgba(0,0,0,0.3);border-radius:6px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;font-size:10px;">
                    <div style="padding:5px;background:rgba(0,191,255,0.1);border-radius:4px;text-align:center;">
                        <div style="color:#888;">Session</div>
                        <div id="pp-session" style="font-size:13px;font-weight:bold;color:#00bfff;">0m</div>
                    </div>
                    <div style="padding:5px;background:rgba(0,255,159,0.1);border-radius:4px;text-align:center;">
                        <div style="color:#888;">Claims</div>
                        <div id="pp-claims" style="font-size:13px;font-weight:bold;color:#00ff9f;">0</div>
                    </div>
                    <div style="padding:5px;background:rgba(255,165,0,0.1);border-radius:4px;text-align:center;">
                        <div style="color:#888;">Bans</div>
                        <div id="pp-bans" style="font-size:13px;font-weight:bold;color:#ffa500;">0</div>
                    </div>
                    <div style="padding:5px;background:rgba(255,68,68,0.1);border-radius:4px;text-align:center;">
                        <div style="color:#888;">Errors</div>
                        <div id="pp-errors" style="font-size:13px;font-weight:bold;color:#ff4444;">0</div>
                    </div>
                </div>
                <div style="margin:10px 0;">
                    <div style="font-size:11px;font-weight:bold;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">📊 Sites</div>
                    <div id="pp-sites"></div>
                </div>
                <div style="margin:10px 0;">
                    <div style="font-size:11px;font-weight:bold;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">📝 Activity Log</div>
                    <div id="activity-log" style="max-height:200px;overflow-y:auto;padding:2px;"></div>
                </div>
                <button id="pp-reset" style="margin-top:8px;width:100%;padding:9px;background:linear-gradient(135deg,#ff4444,#cc0000);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">🔄 Reset All</button>
            </div>
        `;
        document.body.appendChild(panel);

        let collapsed = false;
        document.getElementById('pp-toggle').onclick = () => {
            collapsed = !collapsed;
            document.getElementById('pp-body').style.display = collapsed ? 'none' : 'block';
            document.getElementById('pp-toggle').innerText   = collapsed ? '▶' : '▼';
            panel.style.width = collapsed ? '200px' : '440px';
        };
        document.getElementById('pp-reset').onclick = () => {
            if (confirm('Reset all data?')) {
                Store.remove(STATE_KEY);
                activityLog = [];
                location.reload();
            }
        };
        addLog(`Started | ${browserLabel} | ${osLabel}`, 'success');
    }

    function updatePanel(status = '') {
        try {
            const el = document.getElementById('status');
            if (el && status) el.innerText = status;

            const sm = document.getElementById('pp-session');
            const cm = document.getElementById('pp-claims');
            const bm = document.getElementById('pp-bans');
            const em = document.getElementById('pp-errors');
            if (sm) sm.innerText = Math.floor((Date.now() - STATE.sessionStart) / 60000) + 'm';
            if (cm) cm.innerText = Object.values(STATE.lastClaims).filter(t => t > 0).length;
            if (bm) bm.innerText = STATE.banCount;
            if (em) em.innerText = Object.values(STATE.failedSites).reduce((s, x) => s + (x.count || 0), 0);

            const sitesEl = document.getElementById('pp-sites');
            if (sitesEl) {
                sitesEl.innerHTML = SITE_LIST.map(site => {
                    const last   = STATE.lastClaims[site] || 0;
                    const remain = Math.max(0, CONFIG.CLAIM_INTERVAL - (Date.now() - last));
                    const m = Math.floor(remain / 60000), s = Math.floor((remain % 60000) / 1000);
                    const bal    = STATE.balances[site] || 0;
                    const cur    = site === SITE_KEY;
                    const failed = STATE.failedSites[site]?.count || 0;
                    const icon   = remain === 0 ? '🟢' : failed > 2 ? '🔴' : '🟡';
                    const border = cur ? '#00ff9f' : failed > 2 ? '#ff4444' : '#555';
                    return `<div style="margin:4px 0;padding:6px;background:${cur ? 'rgba(0,255,159,0.15)' : 'rgba(0,0,0,0.3)'};border-radius:6px;font-size:10px;border-left:3px solid ${border};">
                        <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">${icon} ${cur ? `<b style="color:#00ff9f;">▶ ${site}</b>` : site}</div>
                        <div style="display:flex;justify-content:space-between;color:#999;"><span>⏱️ ${m}m ${s}s</span><span>💰 ${bal.toFixed(6)}</span></div>
                        ${failed > 0 ? `<div style="color:#ff4444;font-size:9px;margin-top:2px;">⚠️ Errors: ${failed}</div>` : ''}
                    </div>`;
                }).join('');
            }
        } catch (_) {}
    }

    /* ═══════════════════════════════════════════════════════
       HUMAN SIMULATION
    ═══════════════════════════════════════════════════════ */

    async function simulateHuman() {
        const duration = rndDelay(CONFIG.ACTIVITY_TIME[0], CONFIG.ACTIVITY_TIME[1]);
        const end = Date.now() + duration;
        updatePanel(`🎭 Human sim (${Math.floor(duration / 1000)}s)...`);

        while (Date.now() < end) {
            try {
                window.scrollBy(0, (Math.random() > 0.5 ? 1 : -1) * rndDelay(150, 450));
                await sleep(rndDelay(800, 2200));
                for (let i = 0; i < Math.floor(rndDelay(3, 7)); i++) {
                    document.dispatchEvent(new MouseEvent('mousemove', {
                        clientX: Math.random() * window.innerWidth,
                        clientY: Math.random() * window.innerHeight,
                        bubbles: true
                    }));
                    await sleep(rndDelay(40, 120));
                }
                await sleep(rndDelay(1500, 4000));
            } catch (_) { break; }
        }
        updatePanel('✅ Simulation done');
    }

    /* ═══════════════════════════════════════════════════════
       PRECISE CLAIM BUTTON
    ═══════════════════════════════════════════════════════ */

    function getClaimButton() {
        // 1. Dokładne ID – tylko hourly faucet
        const byId = document.querySelector('#process_claim_hourly_faucet');
        if (byId && !byId.disabled) return byId;

        // 2. onclick zawierający "process_claim_hourly_faucet"
        const byOnclick = document.querySelector('button[onclick*="process_claim_hourly_faucet"]');
        if (byOnclick && !byOnclick.disabled) return byOnclick;

        // 3. process_btn ale NIE commission
        for (const btn of document.querySelectorAll('button.process_btn')) {
            if (!btn.disabled &&
                !btn.classList.contains('claim_commission_btn') &&
                !btn.classList.contains('process_claim_commissions')) return btn;
        }

        return null;
    }

    /* ═══════════════════════════════════════════════════════
       CLICK HANDLER
    ═══════════════════════════════════════════════════════ */

    async function clickButton(btn) {
        updatePanel('🎯 Preparing click...');
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(rndDelay(1200, 2800));

        const r = btn.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

        for (let i = 0; i < 8; i++) {
            document.dispatchEvent(new MouseEvent('mousemove', {
                clientX: cx + (Math.random() - 0.5) * 120,
                clientY: cy + (Math.random() - 0.5) * 80,
                bubbles: true
            }));
            await sleep(rndDelay(30, 90));
        }

        btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await sleep(rndDelay(1400, 3000));

        updatePanel('💥 Clicking...');
        const ox = (Math.random() - 0.5) * 14, oy = (Math.random() - 0.5) * 14;

        ['mousedown', 'mouseup', 'click'].forEach(type => {
            try {
                btn.dispatchEvent(new MouseEvent(type, { clientX: cx + ox, clientY: cy + oy, bubbles: true, cancelable: true, button: 0 }));
            } catch (_) {}
        });

        try { btn.click(); } catch (_) {}
    }

    /* ═══════════════════════════════════════════════════════
       BALANCE
    ═══════════════════════════════════════════════════════ */

    function getBalance() {
        for (const s of ['.balance', '.user_balance', '#balance', '[class*="balance"]', '.faucet-balance']) {
            try {
                const el = document.querySelector(s);
                if (el) { const n = parseFloat(el.innerText.replace(/[^0-9.]/g, '')); if (!isNaN(n)) return n; }
            } catch (_) {}
        }
        return 0;
    }

    /* ═══════════════════════════════════════════════════════
       ROTATION
    ═══════════════════════════════════════════════════════ */

    function nextSite() {
        let pool = SITE_LIST.filter(s => (STATE.failedSites[s]?.count || 0) < 4);
        if (!pool.length) pool = [...SITE_LIST];
        let idx = pool.indexOf(SITE_KEY);
        if (idx < 0) idx = 0;
        const next  = pool[(idx + 1) % pool.length];
        const delay = rndDelay(CONFIG.ROTATION_DELAY[0], CONFIG.ROTATION_DELAY[1]);

        addLog(`Rotate → ${next}`, 'rotate');
        updatePanel(`🔄 → ${next} in ${Math.round(delay / 1000)}s`);

        let url = `https://${next}/`;
        if (!['litepick.io', 'tonpick.game'].includes(next)) url += 'faucet.php';

        origST(() => navigateTo(url), delay);
    }

    /* ═══════════════════════════════════════════════════════
       MAIN CLAIM LOGIC
    ═══════════════════════════════════════════════════════ */

    let isClaiming = false;

    async function tryClaim() {
        if (isClaiming) return;
        isClaiming = true;

        try {
            // Cloudflare
            if (checkCloudflare()) {
                updatePanel('☁️ Cloudflare – waiting 15s...');
                addLog('Cloudflare detected', 'warning');
                await sleep(CONFIG.CLOUDFLARE_WAIT);
                location.reload();
                return;
            }

            // Soft-ban
            if (checkSoftBan()) {
                STATE.banCount = Math.min(STATE.banCount + 1, CONFIG.BAN_DELAYS.length - 1);
                const banDelay = CONFIG.BAN_DELAYS[STATE.banCount];
                STATE.lastBanTime = Date.now();
                saveState();
                addLog(`Soft-ban – wait ${Math.floor(banDelay / 60000)}m`, 'ban');
                updatePanel(`🚨 Soft-ban – ${Math.floor(banDelay / 60000)}m...`);
                sendWebhook(`Soft-ban on **${SITE_KEY}**`, 'ban');
                await sleep(banDelay);
                STATE.banCount = Math.max(0, STATE.banCount - 1);
                saveState();
                location.reload();
                return;
            }

            // Claim interval
            const last = STATE.lastClaims[SITE_KEY] || 0;
            if (Date.now() - last < CONFIG.CLAIM_INTERVAL) {
                nextSite();
                return;
            }

            // Minimum page stay
            if (Date.now() - STATE.pageArrival < CONFIG.ACTIVITY_TIME[0]) {
                const left = Math.ceil((CONFIG.ACTIVITY_TIME[0] - (Date.now() - STATE.pageArrival)) / 1000);
                updatePanel(`⏳ Min stay: ${left}s...`);
                return;
            }

            // Claim button
            const btn = getClaimButton();
            if (!btn) {
                updatePanel('❌ Claim button not found');
                return;
            }

            // Human simulation
            await simulateHuman();

            // Wybór captcha PRZED kliknięciem
            await selectTurnstileCaptcha();

            // Pre-click delay
            const preDelay = rndDelay(CONFIG.PRE_CLICK_DELAY[0], CONFIG.PRE_CLICK_DELAY[1]);
            updatePanel(`⏱️ Pre-click: ${Math.round(preDelay / 1000)}s...`);
            await sleep(preDelay);

            const balBefore = getBalance();
            let attempt = 0, success = false, tooEarly = false;

            while (attempt < 3 && !success && !tooEarly) {
                attempt++;
                addLog(`Attempt ${attempt}/3`, 'info');
                updatePanel(`🖱️ Attempt ${attempt}/3...`);

                // Upewnij captcha przed każdą próbą
                await selectTurnstileCaptcha();

                await clickButton(btn);

                // Toast check
                const toast = await waitForToast(CONFIG.TOAST_WAIT);
                if (toast) {
                    const mins = Math.floor(toast.waitMs / 60000);
                    const secs = Math.floor((toast.waitMs % 60000) / 1000);
                    addLog(`Too early! ${mins}m ${secs}s`, 'wait');
                    updatePanel(`⏳ Too early – ${mins}m ${secs}s`);
                    STATE.lastClaims[SITE_KEY] = Date.now() - (CONFIG.CLAIM_INTERVAL - toast.waitMs);
                    saveState();
                    sendWebhook(`Too early on **${SITE_KEY}**! Wait: **${mins}m ${secs}s**`, 'wait');
                    tooEarly = true;
                    break;
                }

                // Balance check
                await sleep(4000 + Math.random() * 3000);
                const delta = getBalance() - balBefore;

                if (delta > 0.0000001) {
                    success = true;
                    STATE.lastClaims[SITE_KEY]  = Date.now();
                    STATE.balances[SITE_KEY]    = getBalance();
                    STATE.failedSites[SITE_KEY] = { count: 0, last: 0 };
                    saveState();
                    addLog(`✅ +${delta.toFixed(8)} ${CONFIG.SITES[SITE_KEY]?.coin || '?'}`, 'claim');
                    updatePanel(`✅ +${delta.toFixed(8)} – rotating...`);
                    sendWebhook(`Claimed **+${delta.toFixed(8)} ${CONFIG.SITES[SITE_KEY]?.coin || '?'}** on **${SITE_KEY}**`, 'claim');
                    await sleep(rndDelay(10000, 15000));
                    nextSite();
                    return;
                } else {
                    addLog(`No reward (attempt ${attempt})`, 'error');
                    if (attempt < 3) await sleep(3000);
                }
            }

            if (tooEarly) { await sleep(rndDelay(2000, 4000)); nextSite(); return; }

            if (!success) {
                addLog('Failed after 3 attempts', 'error');
                updatePanel('❌ Failed – reloading...');
                sendWebhook(`Claim failed (3 attempts) on **${SITE_KEY}**`, 'error');
                await sleep(4000);
                location.reload();
            }

        } catch (e) {
            console.error('[CLAIM ERROR]', e);
            addLog('Error: ' + e.message, 'error');
            try {
                STATE.failedSites[SITE_KEY].count++;
                STATE.failedSites[SITE_KEY].last = Date.now();
                saveState();
            } catch (_) {}
        } finally {
            isClaiming = false;
        }
    }

    /* ═══════════════════════════════════════════════════════
       INIT
    ═══════════════════════════════════════════════════════ */

    function init() {
        window.addEventListener('load', () => {
            origST(() => {
                createPanel();
                updatePanel('🚀 Stealth v19.3 Universal active');
                addLog('Initialized', 'success');
                origSI(tryClaim,    24000);
                origSI(updatePanel,  4000);
                origST(tryClaim,     6000);
                console.log('[STEALTH] v19.3 Universal initialized');
            }, 2500);
        });
    }

    init();

})();
