/* =========================================================================
   DROPGENIUS AI — renderer.js
   Vanilla JS. No Node/Electron APIs. Compatible with contextIsolation: true,
   nodeIntegration: false, sandbox: true. All user content inserted via
   textContent / DOM creation, never via innerHTML of user-supplied strings.
   ========================================================================= */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     CONSTANTS
     ---------------------------------------------------------------------- */
  const STORAGE_KEYS = {
    products: 'dropgenius.products.v1',
    research: 'dropgenius.research.v1',
    notifications: 'dropgenius.notifications.v1',
    settings: 'dropgenius.settings.v1',
    priceAnalyses: 'dropgenius.priceAnalyses.v1',
    finderFavorites: 'dropgenius.finderFavorites.v1'
  };

  const SECTION_TITLES = {
    overview: 'Overview',
    research: 'Product Research',
    finder: 'Product Finder',
    products: 'My Products',
    calculator: 'Profit Calculator',
    priceadvisor: 'Price Advisor',
    studio: 'AI Product Studio',
    marketing: 'Marketing Ideas',
    about: 'About',
    help: 'Help Center',
    settings: 'Settings'
  };

  const PRODUCT_STATUSES = ['idea', 'researching', 'active', 'paused'];
  const CATEGORIES = [
    'Home & Kitchen', 'Beauty & Personal Care', 'Fitness & Outdoors',
    'Pet Supplies', 'Tech & Gadgets', 'Fashion & Accessories',
    'Baby & Kids', 'Other'
  ];
  const TONES = ['Confident', 'Friendly', 'Luxury', 'Playful', 'Minimal'];
  const CHANNELS = ['TikTok', 'Instagram Reels', 'Facebook Ads', 'YouTube Shorts', 'Email', 'Pinterest'];
  const GOALS = ['Awareness', 'First sale', 'Repeat purchase', 'Retargeting'];

  const CURRENCY_SYMBOLS = { USD: '$', INR: '₹', EUR: '€', GBP: '£' };

  const MAX_NOTIFICATIONS = 40;

  /* Documented default target margin (%) when the field is blank.
     Matches the input's HTML default so the recommendation stays stable
     while a user is temporarily typing/clearing the field. */
  const DEFAULT_TARGET_MARGIN = 30;

  /* Known shopping platforms (hostname match). This build has no live data
     source — 'supportsAuto' stays false so we never pretend to fetch prices. */
  const PLATFORM_REGISTRY = [
    { id: 'amazon_in', name: 'Amazon India', match: [/(^|\.)amazon\.in$/i], supportsAuto: false,
      note: 'Automatic retrieval requires an approved Amazon Creators API integration.' },
    { id: 'amazon_com', name: 'Amazon (US)', match: [/(^|\.)amazon\.com$/i], supportsAuto: false,
      note: 'Automatic retrieval requires an approved Amazon Creators API integration.' },
    { id: 'amazon_uk', name: 'Amazon UK', match: [/(^|\.)amazon\.co\.uk$/i], supportsAuto: false,
      note: 'Automatic retrieval requires an approved Amazon Creators API integration.' },
    { id: 'flipkart', name: 'Flipkart', match: [/(^|\.)flipkart\.com$/i], supportsAuto: false,
      note: 'Automatic retrieval requires an approved Flipkart affiliate API integration.' },
    { id: 'ebay', name: 'eBay', match: [/(^|\.)ebay\.(com|co\.uk|in|de|com\.au)$/i], supportsAuto: false,
      note: 'No live integration connected in this build.' },
    { id: 'etsy', name: 'Etsy', match: [/(^|\.)etsy\.com$/i], supportsAuto: false,
      note: 'No live integration connected in this build.' },
    { id: 'aliexpress', name: 'AliExpress', match: [/(^|\.)aliexpress\.(com|us|ru)$/i], supportsAuto: false,
      note: 'No live integration connected in this build.' },
    { id: 'walmart', name: 'Walmart', match: [/(^|\.)walmart\.com$/i], supportsAuto: false,
      note: 'No live integration connected in this build.' },
    { id: 'bestbuy', name: 'Best Buy', match: [/(^|\.)bestbuy\.com$/i], supportsAuto: false,
      note: 'No live integration connected in this build.' }
  ];

  /* Integration placeholders shown in the Price Advisor section. */
  const INTEGRATION_LIST = [
    {
      id: 'amazon_in', name: 'Amazon India',
      description: 'Planned integration with the official Amazon Creators API. Requires approval, active affiliate status, and server-side credential storage.'
    },
    {
      id: 'flipkart', name: 'Flipkart',
      description: 'Planned integration with the official Flipkart affiliate APIs. Requires registration and access approval before any live data can be shown.'
    },
    {
      id: 'generic', name: 'Additional stores',
      description: 'Future adapters can be added under the same structure. Until then, use the manual price inputs above for any store.'
    }
  ];

  /* ----------------------------------------------------------------------
     STATE
     ---------------------------------------------------------------------- */
  const state = {
    products: [],
    research: [],
    notifications: [],
    priceAnalyses: [],
    settings: { reduceMotion: false, compact: false },
    filters: { search: '', status: 'all', category: 'all' },
    editingProductId: null,
    confirmAction: null,
    submitting: false,
    lastAnalysis: null,
    helpOpen: {}
  };

  /* ----------------------------------------------------------------------
     DOM UTILITIES
     ---------------------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        const v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'dataset') {
          Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        } else if (k === 'attrs') {
          Object.keys(v).forEach(function (a) {
            if (v[a] !== null && v[a] !== undefined && v[a] !== false) {
              node.setAttribute(a, v[a]);
            }
          });
        } else if (k === 'on') {
          Object.keys(v).forEach(function (evt) {
            node.addEventListener(evt, v[evt]);
          });
        } else {
          node[k] = v;
        }
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number'
          ? document.createTextNode(String(c))
          : c);
      });
    }
    return node;
  }

  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function safeText(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  /* ----------------------------------------------------------------------
     FORMATTING
     ---------------------------------------------------------------------- */
  function toNumber(value) {
    if (value === '' || value === null || value === undefined) return 0;
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : 0;
  }

  function formatCurrency(value) {
    const n = toNumber(value);
    const sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toFixed(2);
  }

  function formatMoney(value, currency) {
    const sym = CURRENCY_SYMBOLS[currency] || '$';
    const n = toNumber(value);
    const sign = n < 0 ? '-' : '';
    return sign + sym + Math.abs(n).toFixed(2);
  }

  function formatPercent(value) {
    const n = toNumber(value);
    return n.toFixed(2) + '%';
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (_) { return ''; }
  }

  function formatDateTime(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return ''; }
  }

  function makeId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* ----------------------------------------------------------------------
     STORAGE (safe JSON)
     ---------------------------------------------------------------------- */
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (err) {
      console.warn('[DropGenius] Failed to read', key, err);
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (err) { console.warn('[DropGenius] Failed to write', key, err); }
  }

  function isValidProduct(p) { return p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string'; }
  function isValidResearch(r) { return r && typeof r === 'object' && typeof r.id === 'string' && typeof r.name === 'string'; }
  function isValidAnalysis(a) { return a && typeof a === 'object' && typeof a.id === 'string' && typeof a.productName === 'string'; }

  function loadState() {
    const products = readJSON(STORAGE_KEYS.products, []);
    state.products = Array.isArray(products) ? products.filter(isValidProduct) : [];

    const research = readJSON(STORAGE_KEYS.research, []);
    state.research = Array.isArray(research) ? research.filter(isValidResearch) : [];

    const notifs = readJSON(STORAGE_KEYS.notifications, []);
    state.notifications = Array.isArray(notifs) ? notifs.slice(0, MAX_NOTIFICATIONS) : [];

    const analyses = readJSON(STORAGE_KEYS.priceAnalyses, []);
    state.priceAnalyses = Array.isArray(analyses) ? analyses.filter(isValidAnalysis) : [];

    const settings = readJSON(STORAGE_KEYS.settings, {});
    state.settings = {
      reduceMotion: !!(settings && settings.reduceMotion),
      compact: !!(settings && settings.compact)
    };
  }

  const saveProducts = () => writeJSON(STORAGE_KEYS.products, state.products);
  const saveResearch = () => writeJSON(STORAGE_KEYS.research, state.research);
  const saveNotifications = () => writeJSON(STORAGE_KEYS.notifications, state.notifications.slice(0, MAX_NOTIFICATIONS));
  const saveSettings = () => writeJSON(STORAGE_KEYS.settings, state.settings);
  const saveAnalyses = () => writeJSON(STORAGE_KEYS.priceAnalyses, state.priceAnalyses);

  /* ----------------------------------------------------------------------
     TOASTS
     ---------------------------------------------------------------------- */
  const TOAST_ICONS = {
    success: 'M20 6 9 17l-5-5',
    error: 'M18 6 6 18M6 6l12 12',
    info: 'M12 8v.01M12 12v4',
    warn: 'M12 9v4M12 17h.01'
  };

  function toast(title, message, type, duration) {
    const wrap = $('toastWrap');
    if (!wrap) return;

    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.setAttribute('stroke', 'currentColor');
    iconSvg.setAttribute('stroke-width', '3');
    iconSvg.setAttribute('stroke-linecap', 'round');
    iconSvg.setAttribute('stroke-linejoin', 'round');
    const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPath.setAttribute('d', TOAST_ICONS[type] || TOAST_ICONS.info);
    iconSvg.appendChild(iconPath);

    const iconBox = el('span', { class: 'toast-icon' }, [iconSvg]);
    const body = el('div', { class: 'toast-body' }, [
      el('div', { class: 'toast-title', text: safeText(title) }),
      message ? el('div', { class: 'toast-msg', text: safeText(message) }) : null
    ]);
    const node = el('div', { class: 'toast', dataset: { type: type || 'info' } }, [iconBox, body]);
    wrap.appendChild(node);

    const ms = typeof duration === 'number' ? duration : 3600;
    setTimeout(function () {
      node.classList.add('hide');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 320);
    }, ms);
  }

  /* ----------------------------------------------------------------------
     NOTIFICATIONS
     ---------------------------------------------------------------------- */
  function addNotification(title, sub, type) {
    const n = { id: makeId(), title: safeText(title), sub: safeText(sub || ''), type: type || 'info', at: new Date().toISOString() };
    state.notifications.unshift(n);
    if (state.notifications.length > MAX_NOTIFICATIONS) state.notifications = state.notifications.slice(0, MAX_NOTIFICATIONS);
    saveNotifications();
    renderNotifications();
  }

  function renderNotifications() {
    const body = $('notifBody');
    const badge = $('notifBadge');
    if (!body) return;
    clearNode(body);

    if (!state.notifications.length) {
      body.appendChild(el('div', { class: 'notif-empty', text: "You're all caught up." }));
      if (badge) badge.hidden = true;
      return;
    }
    if (badge) {
      badge.hidden = false;
      badge.textContent = String(Math.min(state.notifications.length, 99));
    }
    state.notifications.forEach(function (n) {
      const dot = el('span', { class: 'notif-dot' });
      const children = [el('div', { class: 'notif-title', text: n.title })];
      if (n.sub) children.push(el('div', { class: 'notif-sub', text: n.sub + (n.at ? ' · ' + formatDate(n.at) : '') }));
      const content = el('div', null, children);
      body.appendChild(el('div', { class: 'notif-item', dataset: { type: n.type || 'info' } }, [dot, content]));
    });
  }

  function openNotifPanel() {
    const p = $('notifPanel'); const b = $('notifBtn');
    if (!p) return; p.hidden = false; if (b) b.setAttribute('aria-expanded', 'true');
  }
  function closeNotifPanel() {
    const p = $('notifPanel'); const b = $('notifBtn');
    if (!p) return; p.hidden = true; if (b) b.setAttribute('aria-expanded', 'false');
  }

  function initNotifications() {
    const btn = $('notifBtn');
    const panel = $('notifPanel');
    const clear = $('clearNotifs');

    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!panel) return;
        if (panel.hidden) openNotifPanel(); else closeNotifPanel();
      });
    }
    document.addEventListener('click', function (e) {
      if (!panel || panel.hidden) return;
      if (panel.contains(e.target)) return;
      if (btn && (btn === e.target || btn.contains(e.target))) return;
      closeNotifPanel();
    });
    if (clear) {
      clear.addEventListener('click', function () {
        state.notifications = [];
        saveNotifications();
        renderNotifications();
        toast('Notifications cleared', '', 'info', 2200);
      });
    }
  }

  /* ----------------------------------------------------------------------
     NAVIGATION
     ---------------------------------------------------------------------- */
  function navigate(sectionId) {
    if (!SECTION_TITLES[sectionId]) sectionId = 'overview';

    $$('.section').forEach(function (sec) {
      sec.classList.toggle('is-active', sec.id === 'section-' + sectionId);
    });
    $$('.nav-item').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.section === sectionId);
    });

    const title = $('pageTitle');
    const crumb = $('crumbCurrent');
    if (title) title.textContent = SECTION_TITLES[sectionId];
    if (crumb) crumb.textContent = SECTION_TITLES[sectionId];

    const content = $('content');
    if (content) content.scrollTop = 0;

    const app = $('app');
    if (app) app.classList.remove('mobile-open');
  }

  function initNav() {
    $$('.nav-item[data-section]').forEach(function (b) {
      b.addEventListener('click', function () { navigate(b.dataset.section); });
    });
    $$('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () { navigate(b.dataset.goto); });
    });

    const collapse = $('collapseBtn');
    if (collapse) {
      collapse.addEventListener('click', function () {
        const app = $('app');
        if (!app) return;
        app.classList.toggle('is-collapsed');
        state.settings.compact = app.classList.contains('is-collapsed');
        saveSettings();
        const toggle = $('settingCompact');
        if (toggle) toggle.checked = state.settings.compact;
      });
    }

    const mobileMenu = $('mobileMenuBtn');
    if (mobileMenu) {
      mobileMenu.addEventListener('click', function () {
        const app = $('app');
        if (app) app.classList.toggle('mobile-open');
      });
    }
  }

  /* ----------------------------------------------------------------------
     GLOBAL SEARCH
     ---------------------------------------------------------------------- */
  function runGlobalSearch(rawQuery) {
    const q = safeText(rawQuery).trim();
    if (!q) return;
    const lower = q.toLowerCase();

    const productMatch = state.products.find(function (p) { return p.name.toLowerCase().indexOf(lower) !== -1; });
    const researchMatch = state.research.find(function (r) { return r.name.toLowerCase().indexOf(lower) !== -1; });
    const analysisMatch = state.priceAnalyses.find(function (a) { return a.productName.toLowerCase().indexOf(lower) !== -1; });

    if (productMatch) {
      state.filters.search = q;
      const input = $('productSearch');
      if (input) input.value = q;
      renderProducts();
      navigate('products');
      toast('Match found', productMatch.name, 'success', 2400);
      return;
    }
    if (researchMatch) {
      navigate('research');
      toast('Match found in research', researchMatch.name, 'success', 2400);
      return;
    }
    if (analysisMatch) {
      navigate('priceadvisor');
      toast('Match found in saved analyses', analysisMatch.productName, 'success', 2400);
      return;
    }
    toast('No matches', 'No products, research or saved analyses match "' + q + '".', 'warn', 2800);
  }

  function initGlobalSearch() {
    const input = $('globalSearch');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); runGlobalSearch(input.value); }
        if (e.key === 'Escape') { input.value = ''; input.blur(); }
      });
    }
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (input) { input.focus(); input.select(); }
      }
    });
  }

  /* ----------------------------------------------------------------------
     MODAL HELPERS
     ---------------------------------------------------------------------- */
  function openModal(id) {
    const m = $(id);
    if (!m) return;
    m.hidden = false;
    const focusable = m.querySelector('input, select, textarea, button:not([data-close-modal])');
    if (focusable) setTimeout(function () { focusable.focus(); }, 40);
  }
  function closeModal(id) {
    const m = $(id);
    if (!m) return;
    m.hidden = true;
  }

  function initModals() {
    document.addEventListener('click', function (e) {
      const closer = e.target.closest ? e.target.closest('[data-close-modal]') : null;
      if (closer) {
        const modal = closer.closest('.modal-backdrop');
        if (modal) closeModal(modal.id);
        return;
      }
      if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
        closeModal(e.target.id);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      let anyOpen = false;
      $$('.modal-backdrop').forEach(function (m) { if (!m.hidden) { closeModal(m.id); anyOpen = true; } });
      if (!anyOpen) closeNotifPanel();
    });

    const ok = $('confirmOk');
    if (ok) {
      ok.addEventListener('click', function () {
        const action = state.confirmAction;
        state.confirmAction = null;
        closeModal('confirmModal');
        if (typeof action === 'function') { try { action(); } catch (err) { console.error(err); } }
      });
    }
  }

  function confirmDialog(title, message, onConfirm) {
    const t = $('confirmTitle'); const m = $('confirmMessage');
    if (t) t.textContent = title;
    if (m) m.textContent = message;
    state.confirmAction = onConfirm || null;
    openModal('confirmModal');
  }

  /* ----------------------------------------------------------------------
     PRODUCTS
     ---------------------------------------------------------------------- */
  function computeProfit(p) { return toNumber(p.price) - toNumber(p.cost); }
  function computeMargin(p) {
    const price = toNumber(p.price);
    if (price <= 0) return 0;
    return ((price - toNumber(p.cost)) / price) * 100;
  }

  function getFilteredProducts() {
    const q = state.filters.search.trim().toLowerCase();
    return state.products.filter(function (p) {
      if (q && p.name.toLowerCase().indexOf(q) === -1 && (p.category || '').toLowerCase().indexOf(q) === -1) return false;
      if (state.filters.status !== 'all' && p.status !== state.filters.status) return false;
      if (state.filters.category !== 'all' && p.category !== state.filters.category) return false;
      return true;
    });
  }

  function renderProducts() {
    const tbody = $('productsBody');
    const empty = $('productsEmpty');
    const table = $('productsTable');
    if (!tbody) return;
    clearNode(tbody);

    const filtered = getFilteredProducts();
    if (!filtered.length) {
      if (table) table.style.display = 'none';
      if (empty) empty.hidden = false;
      return;
    }
    if (table) table.style.display = '';
    if (empty) empty.hidden = true;

    filtered.forEach(function (p) {
      const profit = computeProfit(p);
      const margin = computeMargin(p);
      const profitClass = profit >= 0 ? 'profit-pos' : 'profit-neg';
      const status = PRODUCT_STATUSES.indexOf(p.status) !== -1 ? p.status : 'idea';

      const editBtn = el('button', {
        class: 'row-btn',
        attrs: { title: 'Edit', 'aria-label': 'Edit ' + p.name },
        dataset: { edit: p.id }
      });
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>';

      const delBtn = el('button', {
        class: 'row-btn danger',
        attrs: { title: 'Delete', 'aria-label': 'Delete ' + p.name },
        dataset: { delete: p.id }
      });
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6"/></svg>';

      const tr = el('tr', null, [
        el('td', { class: 'cell-name', text: safeText(p.name) }),
        el('td', { text: safeText(p.category || '—') }),
        el('td', { class: 'num', text: formatCurrency(p.cost) }),
        el('td', { class: 'num', text: formatCurrency(p.price) }),
        el('td', { class: 'num ' + profitClass, text: formatCurrency(profit) }),
        el('td', { class: 'num', text: margin.toFixed(1) + '%' }),
        el('td', null, [el('span', { class: 'status-pill status-' + status, text: status })]),
        el('td', { class: 'right' }, [el('span', { class: 'row-actions' }, [editBtn, delBtn])])
      ]);
      tbody.appendChild(tr);
    });

    $$('[data-edit]', tbody).forEach(function (b) {
      b.addEventListener('click', function () { openProductModal(b.dataset.edit); });
    });
    $$('[data-delete]', tbody).forEach(function (b) {
      b.addEventListener('click', function () { requestDeleteProduct(b.dataset.delete); });
    });
  }

  function renderRecentProducts() {
    const list = $('recentProducts');
    if (!list) return;
    clearNode(list);

    if (!state.products.length) {
      list.appendChild(el('div', { class: 'recent-empty', text: 'No products yet. Add your first product to see it here.' }));
      return;
    }
    state.products.slice(0, 4).forEach(function (p) {
      const initial = (p.name || '?').charAt(0).toUpperCase();
      const profit = computeProfit(p);
      list.appendChild(el('div', { class: 'mini-card' }, [
        el('div', { class: 'mini-avatar', text: initial }),
        el('div', { class: 'mini-body' }, [
          el('div', { class: 'mini-name', text: safeText(p.name) }),
          el('div', { class: 'mini-cat', text: safeText(p.category || 'Uncategorized') })
        ]),
        el('div', { class: 'mini-profit', text: formatCurrency(profit) })
      ]));
    });
  }

  function updateStats() {
    const tracked = $('statTracked');
    const saved = $('statSaved');
    const research = $('statResearch');
    const profit = $('statProfit');

    if (tracked) tracked.textContent = String(state.products.length);
    if (saved) saved.textContent = String(state.products.filter(function (p) { return p.status === 'active'; }).length);
    if (research) research.textContent = String(state.research.length);

    const total = state.products.reduce(function (sum, p) { return sum + computeProfit(p); }, 0);
    if (profit) profit.textContent = formatCurrency(total);
  }

  function clearProductFormErrors() {
    const form = $('productForm');
    if (!form) return;
    $$('.field', form).forEach(function (f) { f.classList.remove('has-error'); });
    $$('.field-error', form).forEach(function (e) { e.textContent = ''; });
  }

  function validateProductForm() {
    let valid = true;
    function check(id, message, test) {
      const input = $(id);
      if (!input) return;
      const field = input.closest('.field');
      const err = document.querySelector('.field-error[data-for="' + id + '"]');
      const ok = test(input.value);
      if (field) field.classList.toggle('has-error', !ok);
      if (err) err.textContent = ok ? '' : message;
      if (!ok) valid = false;
    }
    check('pName', 'Product name is required.', function (v) { return safeText(v).trim().length > 0; });
    check('pCost', 'Enter a valid cost (0 or greater).', function (v) { return v !== '' && !isNaN(Number(v)) && Number(v) >= 0; });
    check('pPrice', 'Enter a valid price (0 or greater).', function (v) { return v !== '' && !isNaN(Number(v)) && Number(v) >= 0; });
    return valid;
  }

  function openProductModal(id) {
    const form = $('productForm');
    if (form) form.reset();
    clearProductFormErrors();
    state.editingProductId = id || null;

    const title = $('productModalTitle');
    const submit = $('productSubmitBtn');
    if (title) title.textContent = id ? 'Edit Product' : 'Add Product';
    if (submit) submit.textContent = id ? 'Save Changes' : 'Save Product';
    if ($('pId')) $('pId').value = id || '';

    if (id) {
      const p = state.products.find(function (x) { return x.id === id; });
      if (p) {
        if ($('pName')) $('pName').value = safeText(p.name);
        if ($('pCategory')) $('pCategory').value = p.category || CATEGORIES[0];
        if ($('pStatus')) $('pStatus').value = PRODUCT_STATUSES.indexOf(p.status) !== -1 ? p.status : 'idea';
        if ($('pCost')) $('pCost').value = (p.cost === 0 || p.cost) ? String(p.cost) : '';
        if ($('pPrice')) $('pPrice').value = (p.price === 0 || p.price) ? String(p.price) : '';
        if ($('pNotes')) $('pNotes').value = safeText(p.notes || '');
      }
    }
    openModal('productModal');
  }

  function submitProduct(e) {
    e.preventDefault();
    if (state.submitting) return;
    if (!validateProductForm()) {
      toast('Check the highlighted fields', 'Some inputs need attention.', 'warn', 3000);
      return;
    }
    const data = {
      name: safeText($('pName') ? $('pName').value : '').trim(),
      category: $('pCategory') ? $('pCategory').value : 'Other',
      status: $('pStatus') && PRODUCT_STATUSES.indexOf($('pStatus').value) !== -1 ? $('pStatus').value : 'idea',
      cost: toNumber($('pCost') ? $('pCost').value : 0),
      price: toNumber($('pPrice') ? $('pPrice').value : 0),
      notes: safeText($('pNotes') ? $('pNotes').value : '').trim()
    };

    state.submitting = true;
    const submitBtn = $('productSubmitBtn');
    const original = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

    try {
      if (state.editingProductId) {
        const idx = state.products.findIndex(function (p) { return p.id === state.editingProductId; });
        if (idx > -1) {
          state.products[idx] = Object.assign({}, state.products[idx], data, { updatedAt: new Date().toISOString() });
          addNotification('Product updated', data.name, 'success');
          toast('Product updated', data.name, 'success');
        }
      } else {
        state.products.unshift(Object.assign({ id: makeId(), createdAt: new Date().toISOString() }, data));
        addNotification('Product added', data.name, 'success');
        toast('Product added', data.name, 'success');
      }
      saveProducts();
      closeModal('productModal');
      renderProducts();
      renderRecentProducts();
      updateStats();
    } finally {
      state.submitting = false;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = original; }
    }
  }

  function requestDeleteProduct(id) {
    const p = state.products.find(function (x) { return x.id === id; });
    if (!p) return;
    confirmDialog('Delete product?', 'Delete "' + p.name + '"? This cannot be undone.', function () {
      state.products = state.products.filter(function (x) { return x.id !== id; });
      saveProducts();
      renderProducts();
      renderRecentProducts();
      updateStats();
      addNotification('Product deleted', p.name, 'warn');
      toast('Product deleted', p.name, 'info');
    });
  }

  function initProducts() {
    const addBtn = $('addProductBtn');
    const emptyBtn = $('emptyAddBtn');
    const form = $('productForm');
    const search = $('productSearch');
    const filterStatus = $('filterStatus');
    const filterCategory = $('filterCategory');

    if (addBtn) addBtn.addEventListener('click', function () { openProductModal(null); });
    if (emptyBtn) emptyBtn.addEventListener('click', function () { openProductModal(null); });
    if (form) form.addEventListener('submit', submitProduct);

    if (search) search.addEventListener('input', function () { state.filters.search = search.value || ''; renderProducts(); });
    if (filterStatus) filterStatus.addEventListener('change', function () { state.filters.status = filterStatus.value || 'all'; renderProducts(); });
    if (filterCategory) filterCategory.addEventListener('change', function () { state.filters.category = filterCategory.value || 'all'; renderProducts(); });
  }

  /* ----------------------------------------------------------------------
     PROFIT CALCULATOR
     ---------------------------------------------------------------------- */
  function calculateProfit() {
    // ---- Currency -------------------------------------------------------
    // The change listener is attached only once, guarded by a dataset flag,
    // so no duplicate listeners are ever registered.
    const currencySelect = $('cCurrency');
    const currency = currencySelect ? currencySelect.value : 'USD';
    if (currencySelect && !currencySelect.dataset.currencyBound) {
      currencySelect.addEventListener('change', calculateProfit);
      currencySelect.dataset.currencyBound = 'true';
    }

    // ---- Inputs to read and validate ------------------------------------
    // Blank optional cost / fee fields count as zero.
    // A blank target margin falls back to DEFAULT_TARGET_MARGIN (30%), which
    // matches the input's HTML default and is documented here.
    // Any value outside its allowed range, or a non-numeric value, is treated
    // as an error: results are not computed from bad data, and a message is
    // shown so the user never sees a misleading figure.
    const fields = [
      { id: 'cPrice',        label: 'Selling price',          min: 0, max: null,  blankValue: 0 },
      { id: 'cCost',         label: 'Product cost',           min: 0, max: null,  blankValue: 0 },
      { id: 'cShip',         label: 'Shipping cost',          min: 0, max: null,  blankValue: 0 },
      { id: 'cPack',         label: 'Packaging cost',         min: 0, max: null,  blankValue: 0 },
      { id: 'cAds',          label: 'Ad cost per sale',       min: 0, max: null,  blankValue: 0 },
      { id: 'cOther',        label: 'Other expenses',         min: 0, max: null,  blankValue: 0 },
      { id: 'cFeeRate',      label: 'Payment processing fee', min: 0, max: 99.99, blankValue: 0 },
      { id: 'cTargetMargin', label: 'Target profit margin',   min: 0, max: 99.99, blankValue: DEFAULT_TARGET_MARGIN }
    ];

    const values = {};
    const messages = [];
    let hasError = false;

    fields.forEach(function (f) {
      const input = $(f.id);
      const fieldWrap = input ? input.closest('.field') : null;
      let value = f.blankValue;
      let valid = true;
      let message = '';

      if (input) {
        const raw = String(input.value).trim();
        if (raw === '') {
          // Blank → documented default for this field.
          value = f.blankValue;
        } else {
          const n = Number(raw);
          if (!Number.isFinite(n)) {
            valid = false;
            message = f.label + ' must be a valid number.';
          } else if (n < f.min) {
            valid = false;
            message = f.label + ' must be at least ' + f.min + '.';
          } else if (f.max !== null && n > f.max) {
            valid = false;
            message = f.label + ' must be at most ' + f.max + '.';
          } else {
            value = n;
          }
        }
      }

      if (fieldWrap) fieldWrap.classList.toggle('has-error', !valid);
      if (!valid) { hasError = true; messages.push(message); }
      values[f.id] = value;
    });

    // ---- Read out the validated values ---------------------------------
    const price  = values.cPrice;
    const cost   = values.cCost;
    const ship   = values.cShip;
    const pack   = values.cPack;
    const ads    = values.cAds;
    const other  = values.cOther;
    const feeRate = values.cFeeRate;
    const targetMarginPct = values.cTargetMargin;

    // ---- Formulas (preserved exactly) ----------------------------------
    const fixedCosts    = cost + ship + pack + ads + other;
    const processingFee = price * (feeRate / 100);
    const totalCost     = fixedCosts + processingFee;
    const profit        = price - totalCost;
    const margin        = price > 0 ? (profit / price) * 100 : 0;

    const breakEvenDenom = 1 - (feeRate / 100);
    const breakEven = breakEvenDenom > 0 ? (fixedCosts / breakEvenDenom) : 0;

    // ---- DOM refs ------------------------------------------------------
    const resTotal      = $('resTotal');
    const resFee        = $('resFee');
    const resProfit     = $('resProfit');
    const resMargin     = $('resMargin');
    const resBreak      = $('resBreak');
    const meter         = $('marginMeter');
    const hint          = $('calcHint');
    const resSuggested  = $('resSuggestedPrice');
    const suggestedHint = $('suggestedHint');

    function setSuggested(text, tone, hintText) {
      if (resSuggested) {
        resSuggested.textContent = text;
        resSuggested.classList.remove('accent-green', 'accent-red');
        if (tone === 'green') resSuggested.classList.add('accent-green');
        if (tone === 'red')   resSuggested.classList.add('accent-red');
      }
      if (suggestedHint && typeof hintText === 'string') suggestedHint.textContent = hintText;
    }

    // ---- If any input failed validation, blank every result ------------
    // This prevents misleading numbers being derived from bad data.
    if (hasError) {
      if (resTotal)  resTotal.textContent  = '—';
      if (resFee)    resFee.textContent    = '—';
      if (resProfit) {
        resProfit.textContent = '—';
        resProfit.classList.remove('accent-green');
        resProfit.classList.add('accent-red');
      }
      if (resMargin) resMargin.textContent = '—';
      if (resBreak)  resBreak.textContent  = '—';
      if (meter) { meter.style.width = '0%'; }
      if (hint) hint.textContent = messages.join(' ');
      setSuggested('—', 'red', 'Fix the highlighted inputs above to see a recommended price.');
      return;
    }

    // ---- Normal rendering ---------------------------------------------
    if (resTotal) resTotal.textContent = formatMoney(totalCost, currency);
    if (resFee)   resFee.textContent   = formatMoney(processingFee, currency);

    if (resProfit) {
      resProfit.textContent = formatMoney(profit, currency);
      resProfit.classList.toggle('accent-green', profit >= 0);
      resProfit.classList.toggle('accent-red', profit < 0);
    }
    if (resMargin) resMargin.textContent = price > 0 ? formatPercent(margin) : '0.00%';
    if (resBreak)  resBreak.textContent  = formatMoney(breakEven, currency);

    if (meter) {
      const pct = Math.max(0, Math.min(100, margin));
      meter.style.width = pct + '%';

      if (margin < 0) {
        meter.style.background = 'linear-gradient(90deg, #f87171, #ef4444)';
      } else if (margin < 20) {
        meter.style.background = 'linear-gradient(90deg, #fbbf24, #f59e0b)';
      } else {
        meter.style.background = 'linear-gradient(90deg, var(--violet), var(--cyan))';
      }
    }

    if (hint) {
      if (price <= 0) {
        hint.textContent = 'Enter a selling price to calculate your estimate.';
      } else if (fixedCosts === 0 && processingFee === 0) {
        hint.textContent = 'Add at least one cost to see your true margin.';
      } else if (profit < 0) {
        hint.textContent = 'You are currently selling below cost. Consider raising the price.';
      } else {
        hint.textContent = 'All values are estimates. Taxes and refunds are not included. The processing fee is calculated from the percentage you enter.';
      }
    }

    // ---- Recommended selling price ------------------------------------
    // Order matters: check the impossible combined-rate case BEFORE the
    // zero-fixed-cost case, so the user always sees the most relevant
    // explanation for why no recommendation is available.
    //
    // recommendedPrice = fixedCosts / (1 - feeRate/100 - targetMargin/100)
    const combinedRate = (feeRate / 100) + (targetMarginPct / 100);

    if (combinedRate >= 1) {
      setSuggested(
        '—',
        'red',
        'Payment processing fee plus target margin must be less than 100%. Lower one of them to see a recommendation.'
      );
    } else if (fixedCosts <= 0) {
      setSuggested(
        formatMoney(0, currency),
        'green',
        'Enter at least one cost to see a recommended price for your target margin.'
      );
    } else {
      const recommended = fixedCosts / (1 - combinedRate);
      if (Number.isFinite(recommended)) {
        setSuggested(
          formatMoney(recommended, currency),
          'green',
          'The recommended price is an estimate based on the entered costs, payment fee and target margin.'
        );
      } else {
        setSuggested(
          '—',
          'red',
          'Could not calculate a recommended price from these values.'
        );
      }
    }
  }

  function initCalculator() {
    ['cPrice', 'cCost', 'cShip', 'cPack', 'cAds', 'cOther', 'cFeeRate', 'cTargetMargin'].forEach(function (id) {
      const input = $(id);
      if (input) input.addEventListener('input', calculateProfit);
    });
    calculateProfit();
  }

  /* ----------------------------------------------------------------------
     PRODUCT FINDER
     ---------------------------------------------------------------------- */

  /* Static demo dataset. No live API is integrated.
     Figures are illustrative sample data — NOT live market research,
     verified supplier prices, or real sales figures. A real product
     research API can be plugged in later by replacing this array. */
  const FINDER_DEMO_PRODUCTS = [
    { id: 'demo-01', name: 'Portable Blender Bottle', category: 'Home & Kitchen', cost: 12.50, price: 34.99,
      description: 'USB-rechargeable personal blender for smoothies on the go. Stainless-steel blades and a leak-proof lid.' },
    { id: 'demo-02', name: 'LED Ring Light with Tripod', category: 'Tech & Gadgets', cost: 8.90, price: 27.50,
      description: '10-inch dimmable ring light with adjustable tripod and phone holder — a common starter pick for content creators.' },
    { id: 'demo-03', name: 'Posture Corrector Brace', category: 'Fitness & Outdoors', cost: 5.20, price: 19.99,
      description: 'Adjustable back brace to encourage upright posture. Breathable mesh, one-size-fits-most.' },
    { id: 'demo-04', name: 'Silicone Pet Grooming Glove', category: 'Pet Supplies', cost: 2.10, price: 9.99,
      description: 'Five-finger grooming glove that removes loose hair while petting. Works on cats and dogs.' },
    { id: 'demo-05', name: 'Vitamin C Facial Serum', category: 'Beauty & Personal Care', cost: 6.40, price: 22.00,
      description: '30 ml brightening serum with vitamin C and hyaluronic acid. Suitable for most skin types.' },
    { id: 'demo-06', name: 'Magnetic Phone Mount for Car', category: 'Tech & Gadgets', cost: 3.30, price: 14.99,
      description: 'Dashboard or vent magnetic phone mount with a 360° rotating head.' },
    { id: 'demo-07', name: 'Stainless Steel Water Bottle 750 ml', category: 'Fitness & Outdoors', cost: 4.80, price: 17.50,
      description: 'Double-walled vacuum-insulated bottle keeps drinks cold for 24 h or hot for 12 h.' },
    { id: 'demo-08', name: 'Resistance Bands Set', category: 'Fitness & Outdoors', cost: 5.60, price: 21.99,
      description: 'Set of five latex resistance bands with handles, ankle straps and a door anchor.' },
    { id: 'demo-09', name: 'Baby Silicone Feeding Set', category: 'Baby & Kids', cost: 6.90, price: 24.50,
      description: 'BPA-free silicone suction plate, bowl, spoon and bib for toddlers.' },
    { id: 'demo-10', name: 'Minimalist Leather Wallet', category: 'Fashion & Accessories', cost: 7.80, price: 29.00,
      description: 'Slim RFID-blocking wallet with card slots and a cash strap.' },
    { id: 'demo-11', name: 'Blue-Light Blocking Glasses', category: 'Fashion & Accessories', cost: 4.10, price: 18.00,
      description: 'Lightweight frame with anti-blue-light lenses for screen-heavy days.' },
    { id: 'demo-12', name: 'Ceramic Pour-Over Coffee Set', category: 'Home & Kitchen', cost: 9.40, price: 32.00,
      description: 'Pour-over dripper, carafe and reusable stainless-steel filter.' },
    { id: 'demo-13', name: 'Collapsible Dog Travel Bowl', category: 'Pet Supplies', cost: 1.80, price: 8.50,
      description: 'Silicone bowl with carabiner clip — folds flat for walks and travel.' },
    { id: 'demo-14', name: 'Smart Fitness Tracker Band', category: 'Tech & Gadgets', cost: 11.20, price: 39.99,
      description: 'Step, heart-rate and sleep tracking with a colour touchscreen and 7-day battery.' },
    { id: 'demo-15', name: 'Aromatherapy Essential Oil Diffuser', category: 'Home & Kitchen', cost: 10.50, price: 34.00,
      description: '300 ml ultrasonic diffuser with 7-colour ambient light and auto shut-off.' },
    { id: 'demo-16', name: 'Heated Eye Mask for Relaxation', category: 'Beauty & Personal Care', cost: 7.30, price: 26.50,
      description: 'USB-powered warm compress mask with adjustable heat and timer settings.' },
    { id: 'demo-17', name: 'Reusable Beeswax Food Wraps', category: 'Home & Kitchen', cost: 3.20, price: 13.50,
      description: 'Set of six reusable wraps in assorted sizes — a plastic-free alternative to cling film.' },
    { id: 'demo-18', name: 'Adjustable Laptop Stand', category: 'Tech & Gadgets', cost: 8.60, price: 27.90,
      description: 'Aluminium laptop riser with six height levels and ventilation cut-outs.' }
  ];

  const finderState = {
    search: '',
    category: 'all',
    maxCost: '',
    minMargin: '',
    sort: 'name-asc',
    favoritesOnly: false
  };

  let finderFavorites = [];

  function loadFinderFavorites() {
    const raw = readJSON(STORAGE_KEYS.finderFavorites, []);
    finderFavorites = Array.isArray(raw) ? raw.filter(function (x) { return typeof x === 'string'; }) : [];
  }

  function saveFinderFavorites() {
    writeJSON(STORAGE_KEYS.finderFavorites, finderFavorites);
  }

  function isFinderFavorite(id) {
    return finderFavorites.indexOf(id) !== -1;
  }

  function toggleFinderFavorite(id) {
    const idx = finderFavorites.indexOf(id);
    if (idx === -1) finderFavorites.push(id);
    else finderFavorites.splice(idx, 1);
    saveFinderFavorites();
    renderFinder();
    const modal = $('finderDetailModal');
    if (modal && !modal.hidden && modal.dataset.productId === id) {
      updateFinderDetailFavBtn(id);
    }
  }

  /* Estimated profit = price - cost.
     Estimated margin = (price - cost) / price * 100 (0 when price is 0).
     These are estimates only and do NOT include tax, refunds, shipping,
     advertising or payment processing fees. */
  function computeFinderProfit(p) {
    return toNumber(p.price) - toNumber(p.cost);
  }

  function computeFinderMargin(p) {
    const price = toNumber(p.price);
    if (price <= 0) return 0;
    return ((price - toNumber(p.cost)) / price) * 100;
  }

  function getFilteredFinderProducts() {
    const q = finderState.search.trim().toLowerCase();
    const maxCostRaw = finderState.maxCost;
    const minMarginRaw = finderState.minMargin;
    const maxCost = maxCostRaw === '' ? null : Number(maxCostRaw);
    const minMargin = minMarginRaw === '' ? null : Number(minMarginRaw);

    const list = FINDER_DEMO_PRODUCTS.filter(function (p) {
      if (q && p.name.toLowerCase().indexOf(q) === -1 && p.category.toLowerCase().indexOf(q) === -1) return false;
      if (finderState.category !== 'all' && p.category !== finderState.category) return false;
      if (maxCost !== null && Number.isFinite(maxCost) && maxCost >= 0 && p.cost > maxCost) return false;
      if (minMargin !== null && Number.isFinite(minMargin) && minMargin >= 0 && computeFinderMargin(p) < minMargin) return false;
      if (finderState.favoritesOnly && !isFinderFavorite(p.id)) return false;
      return true;
    });

    const sortKey = finderState.sort;
    list.sort(function (a, b) {
      switch (sortKey) {
        case 'name-asc':    return a.name.localeCompare(b.name);
        case 'name-desc':   return b.name.localeCompare(a.name);
        case 'price-asc':   return a.price - b.price;
        case 'price-desc':  return b.price - a.price;
        case 'profit-desc': return computeFinderProfit(b) - computeFinderProfit(a);
        case 'margin-desc': return computeFinderMargin(b) - computeFinderMargin(a);
        default:            return 0;
      }
    });
    return list;
  }

  function renderFinder() {
    const grid = $('finderGrid');
    const empty = $('finderEmpty');
    const count = $('finderCount');
    if (!grid) return;

    clearNode(grid);

    const list = getFilteredFinderProducts();
    if (count) count.textContent = list.length + (list.length === 1 ? ' product' : ' products');

    if (!list.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    list.forEach(function (p) {
      const profit = computeFinderProfit(p);
      const margin = computeFinderMargin(p);
      const fav = isFinderFavorite(p.id);

      const favBtn = el('button', {
        class: 'finder-fav-btn' + (fav ? ' is-fav' : ''),
        attrs: {
          type: 'button',
          title: fav ? 'Remove from favorites' : 'Add to favorites',
          'aria-label': (fav ? 'Remove ' + p.name + ' from favorites' : 'Add ' + p.name + ' to favorites')
        },
        dataset: { favId: p.id }
      });
      favBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="' + (fav ? 'currentColor' : 'none') +
        '" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="m12 17.3-6.2 3.3 1.2-6.9-5-4.9 6.9-1L12 1.4l3.1 6.4 6.9 1-5 4.9 1.2 6.9z"/></svg>';

      const viewBtn = el('button', {
        class: 'btn btn-ghost btn-sm finder-view-btn',
        attrs: { type: 'button' },
        text: 'View details',
        dataset: { viewId: p.id }
      });

      const card = el('div', { class: 'finder-card' }, [
        el('div', { class: 'finder-card-head' }, [
          el('div', null, [
            el('h4', { text: safeText(p.name) }),
            el('div', { class: 'finder-card-cat', text: safeText(p.category) })
          ]),
          favBtn
        ]),
        el('div', { class: 'finder-meta' }, [
          el('span', null, [document.createTextNode('Cost: '), el('b', { text: formatMoney(p.cost, 'USD') })]),
          el('span', null, [document.createTextNode('Price: '), el('b', { text: formatMoney(p.price, 'USD') })]),
          el('span', null, [document.createTextNode('Est. profit: '), el('b', { class: profit >= 0 ? 'profit-pos' : 'profit-neg', text: formatMoney(profit, 'USD') })]),
          el('span', null, [document.createTextNode('Est. margin: '), el('b', { text: margin.toFixed(1) + '%' })])
        ]),
        viewBtn
      ]);

      grid.appendChild(card);
    });

    $$('[data-fav-id]', grid).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleFinderFavorite(b.dataset.favId);
      });
    });
    $$('[data-view-id]', grid).forEach(function (b) {
      b.addEventListener('click', function () {
        openFinderDetail(b.dataset.viewId);
      });
    });
  }

  function updateFinderDetailFavBtn(id) {
    const btn = $('finderDetailFavBtn');
    if (!btn) return;
    const fav = isFinderFavorite(id);
    btn.textContent = fav ? 'Remove from favorites' : 'Add to favorites';
    btn.dataset.favId = id;
  }

  function openFinderDetail(id) {
    const p = FINDER_DEMO_PRODUCTS.find(function (x) { return x.id === id; });
    if (!p) return;

    const modal = $('finderDetailModal');
    const title = $('finderDetailTitle');
    const body = $('finderDetailBody');
    if (!modal || !body) return;

    if (title) title.textContent = safeText(p.name);

    clearNode(body);

    const profit = computeFinderProfit(p);
    const margin = computeFinderMargin(p);

    body.appendChild(el('div', { class: 'finder-detail-cat', text: safeText(p.category) }));
    body.appendChild(el('p', { class: 'finder-detail-desc', text: safeText(p.description) }));

    body.appendChild(el('div', { class: 'pa-meta-grid' }, [
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Estimated cost' }),
        el('strong', { text: formatMoney(p.cost, 'USD') })
      ]),
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Estimated selling price' }),
        el('strong', { text: formatMoney(p.price, 'USD') })
      ]),
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Estimated profit' }),
        el('strong', { class: profit >= 0 ? 'accent-green' : 'accent-red', text: formatMoney(profit, 'USD') })
      ]),
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Estimated margin' }),
        el('strong', { text: margin.toFixed(2) + '%' })
      ])
    ]));

    body.appendChild(el('p', { class: 'hint', text: 'Demo data — figures are illustrative and do not include taxes, refunds, shipping, advertising or payment processing fees. Estimated profit is not guaranteed profit.' }));

    modal.dataset.productId = id;
    updateFinderDetailFavBtn(id);
    openModal('finderDetailModal');
  }

  function resetFinderFilters() {
    finderState.search = '';
    finderState.category = 'all';
    finderState.maxCost = '';
    finderState.minMargin = '';
    finderState.sort = 'name-asc';
    finderState.favoritesOnly = false;

    const search = $('finderSearch');       if (search) search.value = '';
    const category = $('finderCategory');   if (category) category.value = 'all';
    const maxCost = $('finderMaxCost');     if (maxCost) maxCost.value = '';
    const minMargin = $('finderMinMargin'); if (minMargin) minMargin.value = '';
    const sort = $('finderSort');           if (sort) sort.value = 'name-asc';
    const favOnly = $('finderFavOnly');     if (favOnly) favOnly.checked = false;

    renderFinder();
  }

  function initFinder() {
    loadFinderFavorites();

    const search = $('finderSearch');
    const category = $('finderCategory');
    const maxCost = $('finderMaxCost');
    const minMargin = $('finderMinMargin');
    const sort = $('finderSort');
    const favOnly = $('finderFavOnly');
    const resetBtn = $('finderResetBtn');
    const emptyResetBtn = $('finderEmptyResetBtn');
    const detailFavBtn = $('finderDetailFavBtn');

    if (search) search.addEventListener('input', function () {
      finderState.search = search.value || '';
      renderFinder();
    });
    if (category) category.addEventListener('change', function () {
      finderState.category = category.value || 'all';
      renderFinder();
    });
    if (maxCost) maxCost.addEventListener('input', function () {
      finderState.maxCost = maxCost.value || '';
      renderFinder();
    });
    if (minMargin) minMargin.addEventListener('input', function () {
      finderState.minMargin = minMargin.value || '';
      renderFinder();
    });
    if (sort) sort.addEventListener('change', function () {
      finderState.sort = sort.value || 'name-asc';
      renderFinder();
    });
    if (favOnly) favOnly.addEventListener('change', function () {
      finderState.favoritesOnly = !!favOnly.checked;
      renderFinder();
    });
    if (resetBtn) resetBtn.addEventListener('click', resetFinderFilters);
    if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetFinderFilters);
    if (detailFavBtn) detailFavBtn.addEventListener('click', function () {
      const id = detailFavBtn.dataset.favId;
      if (id) toggleFinderFavorite(id);
    });

    renderFinder();
  }

  /* ----------------------------------------------------------------------
     RESEARCH
     ---------------------------------------------------------------------- */
  function validateResearchForm() {
    const name = $('rName');
    if (!name) return false;
    const field = name.closest('.field');
    const err = document.querySelector('.field-error[data-for="rName"]');
    const ok = safeText(name.value).trim().length > 0;
    if (field) field.classList.toggle('has-error', !ok);
    if (err) err.textContent = ok ? '' : 'Product name or keyword is required.';
    return ok;
  }

  function submitResearch(e) {
    e.preventDefault();
    if (!validateResearchForm()) {
      toast('Missing product name', 'Enter a product name or keyword.', 'warn');
      return;
    }
    const item = {
      id: makeId(),
      name: safeText($('rName').value).trim(),
      category: $('rCategory') ? $('rCategory').value : '',
      cost: toNumber($('rCost') ? $('rCost').value : 0),
      price: toNumber($('rPrice') ? $('rPrice').value : 0),
      audience: safeText($('rAudience') ? $('rAudience').value : '').trim(),
      problem: safeText($('rProblem') ? $('rProblem').value : '').trim(),
      notes: safeText($('rNotes') ? $('rNotes').value : '').trim(),
      createdAt: new Date().toISOString()
    };
    state.research.unshift(item);
    saveResearch();
    renderResearch();
    updateStats();
    addNotification('Research saved', item.name, 'success');
    toast('Research saved', item.name, 'success');

    const form = $('researchForm');
    if (form) form.reset();
  }

  function renderResearch() {
    const list = $('researchList');
    const count = $('researchCount');
    if (count) count.textContent = state.research.length + (state.research.length === 1 ? ' report' : ' reports');
    if (!list) return;
    clearNode(list);

    if (!state.research.length) {
      list.appendChild(el('div', { class: 'recent-empty', text: 'No research reports yet. Fill the form above to save one.' }));
      return;
    }
    state.research.forEach(function (r) {
      const margin = r.price > 0 ? ((r.price - r.cost) / r.price) * 100 : 0;
      const children = [el('h4', { text: safeText(r.name) })];
      if (r.category) children.push(el('div', { class: 'rc-cat', text: safeText(r.category) }));
      if (r.problem) children.push(el('p', { text: safeText(r.problem) }));
      children.push(el('div', { class: 'research-meta' }, [
        el('span', null, [document.createTextNode('Cost: '), el('b', { text: formatCurrency(r.cost) })]),
        el('span', null, [document.createTextNode('Price: '), el('b', { text: formatCurrency(r.price) })]),
        el('span', null, [document.createTextNode('Margin: '), el('b', { text: margin.toFixed(1) + '%' })])
      ]));
      const del = el('button', {
        class: 'link-btn',
        attrs: { 'aria-label': 'Delete research ' + r.name },
        dataset: { deleteResearch: r.id },
        text: 'Delete',
        style: 'margin-top:10px;'
      });
      children.push(del);
      list.appendChild(el('div', { class: 'research-card' }, children));
    });
    $$('[data-delete-research]', list).forEach(function (b) {
      b.addEventListener('click', function () { requestDeleteResearch(b.dataset.deleteResearch); });
    });
  }

  function requestDeleteResearch(id) {
    const r = state.research.find(function (x) { return x.id === id; });
    if (!r) return;
    confirmDialog('Delete research report?', 'Delete "' + r.name + '"? This cannot be undone.', function () {
      state.research = state.research.filter(function (x) { return x.id !== id; });
      saveResearch();
      renderResearch();
      updateStats();
      toast('Research deleted', r.name, 'info');
    });
  }

  function initResearch() {
    const form = $('researchForm');
    if (form) form.addEventListener('submit', submitResearch);
  }

  /* ----------------------------------------------------------------------
     AI PRODUCT STUDIO (local template generator)
     ---------------------------------------------------------------------- */
  const TONE_ADJECTIVES = {
    Confident: ['Premium', 'Expert', 'Proven', 'Definitive'],
    Friendly: ['Everyday', 'Easy', 'Simple', 'Approachable'],
    Luxury: ['Signature', 'Refined', 'Elevated', 'Exclusive'],
    Playful: ['Fun', 'Fresh', 'Bright', 'Energetic'],
    Minimal: ['Essential', 'Clean', 'Pure', 'Focused']
  };
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function capitalize(s) { s = safeText(s); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function validateStudio() {
    const nameEl = $('sName');
    if (!nameEl) return false;
    const field = nameEl.closest('.field');
    const err = document.querySelector('.field-error[data-for="sName"]');
    const ok = safeText(nameEl.value).trim().length > 0;
    if (field) field.classList.toggle('has-error', !ok);
    if (err) err.textContent = ok ? '' : 'Product name is required.';
    return ok;
  }

  function generateStudio() {
    if (!validateStudio()) { toast('Missing product name', 'Enter a name to generate copy.', 'warn'); return; }

    const name = safeText($('sName').value).trim();
    const category = $('sCategory') ? $('sCategory').value : 'Other';
    const audience = safeText($('sAudience') ? $('sAudience').value : '').trim() || 'modern shoppers';
    const tone = $('sTone') && TONES.indexOf($('sTone').value) !== -1 ? $('sTone').value : 'Confident';
    const benefit = safeText($('sBenefit') ? $('sBenefit').value : '').trim() || 'makes everyday life easier';
    const adj = pick(TONE_ADJECTIVES[tone] || TONE_ADJECTIVES.Confident);

    const title = adj + ' ' + name + ' — ' + capitalize(benefit);
    const headline =
      (tone === 'Luxury' ? 'Elevate your day with ' :
       tone === 'Playful' ? 'Meet your new favorite: ' :
       'Introducing ') + name + '.';

    const description =
      name + ' is designed for ' + audience + ' who want a simpler, more reliable way to ' + benefit + '.\n\n' +
      'Built for daily use, it combines thoughtful design with dependable performance — ' +
      'so you can focus on what matters instead of fighting your gear.\n\n' +
      'Ideal for anyone looking for a ' + tone.toLowerCase() + ' upgrade in the ' + category + ' space.';

    const ad =
      '🎯 ' + headline + '\n\n' +
      'Perfect for ' + audience + '.\n' +
      '✔ ' + capitalize(benefit) + '\n' +
      '✔ ' + adj + ' build quality\n' +
      '✔ Ready to ship\n\n' +
      'Tap to learn more →';

    const points = [
      adj + ' design that fits ' + audience.toLowerCase(),
      'Solves: ' + benefit,
      'Category: ' + category,
      'Built for daily, repeat use',
      'Backed by clear, honest product information'
    ];

    if ($('outTitle')) $('outTitle').textContent = title;
    if ($('outHeadline')) $('outHeadline').textContent = headline;
    if ($('outDescription')) $('outDescription').textContent = description;
    if ($('outAd')) $('outAd').textContent = ad;

    const ul = $('outPoints');
    if (ul) { clearNode(ul); points.forEach(function (p) { ul.appendChild(el('li', { text: p })); }); }

    const output = $('studioOutput');
    if (output) output.hidden = false;
    requestStudioDemoReply(
  `Create a product description for ${name}. Category: ${category}. Target audience: ${audience}. Main benefit: ${benefit}.`
);

    addNotification('Studio draft generated', name, 'info');
    toast('Draft generated', 'Basic local generator — not a live AI model.', 'info', 4200);
  }
async function requestStudioDemoReply(prompt) {
  const output = $('studioOutput');
  if (!output) return;

  let panel = $('studioBackendReply');

  if (!panel) {
    panel = el('div', {
      id: 'studioBackendReply',
      class: 'hint',
      style: 'white-space: pre-wrap; margin-top: 16px;'
    });

    output.appendChild(panel);
  }

  panel.textContent = 'Connecting to the local demo backend...';

  const bridge = window.dropGeniusAI;

  if (!bridge || typeof bridge.generate !== 'function') {
    panel.textContent = 'The secure Electron bridge is unavailable.';
    return;
  }

  try {
    const result = await bridge.generate(prompt);

    if (
      !result ||
      result.success !== true ||
      typeof result.reply !== 'string'
    ) {
      panel.textContent =
        'Backend error: ' +
        (result && result.error
          ? result.error
          : 'No usable response received.');
      return;
    }

    panel.textContent =
      'LOCAL DEMO BACKEND RESPONSE\n\n' +
      result.reply +
      '\n\nNote: These are predefined demo responses, not live AI output.';
  } catch (error) {
    console.error('[DropGenius AI] Demo request failed:', error);

    panel.textContent =
  'Connection failed: ' +
  (error && error.message
    ? error.message
    : 'Unknown error. Check the Electron terminal.');
  }
}
  function copyText(text, btn) {
    async function requestStudioBackend(name, category, audience, benefit) {
  const grid = document.querySelector('#studioOutput .output-grid');
  if (!grid) return;

  let card = $('studioBackendCard');
  let modeEl;
  let replyEl;

  if (!card) {
    card = document.createElement('div');
    card.id = 'studioBackendCard';
    card.className = 'output-card span-2';

    const header = document.createElement('div');
    header.className = 'output-head';

    const title = document.createElement('span');
    title.textContent = 'Backend Response';

    modeEl = document.createElement('span');
    modeEl.id = 'studioBackendMode';
    modeEl.className = 'muted';
    modeEl.textContent = 'CONNECTING...';

    header.append(title, modeEl);

    replyEl = document.createElement('p');
    replyEl.id = 'studioBackendReply';
    replyEl.className = 'output-body';

    card.append(header, replyEl);
    grid.appendChild(card);
  } else {
    modeEl = $('studioBackendMode');
    replyEl = $('studioBackendReply');
  }

  modeEl.textContent = 'CONNECTING...';
  replyEl.textContent = 'Contacting the local backend...';

  const message =
    `product description for ${name}; ` +
    `category: ${category}; ` +
    `target audience: ${audience}; ` +
    `main benefit: ${benefit}`;

  try {
    const response = await fetch(
      'http://127.0.0.1:3000/api/ai/generate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      }
    );

    const data = await response.json();

    if (!response.ok || data.success !== true ||
        typeof data.reply !== 'string') {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    modeEl.textContent =
      (data.mode || 'unknown').toUpperCase() + ' MODE';

    replyEl.textContent = data.reply;
  } catch (error) {
    console.error('[DropGenius AI] Backend request failed:', error);

    modeEl.textContent = 'CONNECTION ERROR';
    replyEl.textContent =
      'Could not connect to the backend. ' +
      'Check the backend terminal. Details: ' +
      error.message;
  }
}
    const done = function () {
      if (btn) {
        const original = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = original; }, 1400);
      }
      toast('Copied to clipboard', '', 'success', 1800);
    };
    const fail = function () { toast('Copy failed', 'Your system blocked clipboard access.', 'error', 2800); };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text) ? done() : fail(); });
    } else {
      fallbackCopy(text) ? done() : fail();
    }
  }
  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (_) { return false; }
  }

  function initStudio() {
    const btn = $('generateStudioBtn');
    if (btn) btn.addEventListener('click', generateStudio);

    $$('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        const target = $(b.dataset.copy);
        if (!target) return;
        let text = '';
        if (target.tagName === 'UL') text = $$('li', target).map(function (li) { return '• ' + li.textContent; }).join('\n');
        else text = target.textContent || '';
        copyText(text, b);
      });
    });
  }

  /* ----------------------------------------------------------------------
     MARKETING IDEAS
     ---------------------------------------------------------------------- */
  const CHANNEL_TIPS = {
    'TikTok': 'Short hook (0–2s), problem/solution, trending audio, on-screen text overlay.',
    'Instagram Reels': 'Aesthetic unboxing → before/after → CTA sticker. Keep it under 15 seconds.',
    'Facebook Ads': 'Problem-first copy, UGC video, single clear CTA, retarget viewers within 7 days.',
    'YouTube Shorts': 'Curiosity hook, quick demonstration, captions for sound-off viewing.',
    'Email': 'Subject line with the outcome, 3 short value bullets, one CTA above the fold.',
    'Pinterest': 'Vertical pin, clean text overlay, benefit-driven title, link to product page.'
  };

  function validateMarketing() {
    const elm = $('mProduct');
    if (!elm) return false;
    const field = elm.closest('.field');
    const err = document.querySelector('.field-error[data-for="mProduct"]');
    const ok = safeText(elm.value).trim().length > 0;
    if (field) field.classList.toggle('has-error', !ok);
    if (err) err.textContent = ok ? '' : 'Product name is required.';
    return ok;
  }

  function generateMarketing() {
    if (!validateMarketing()) { toast('Missing product name', 'Enter a product to generate ideas.', 'warn'); return; }
    const name = safeText($('mProduct').value).trim();
    const audience = safeText($('mAudience') ? $('mAudience').value : '').trim() || 'your ideal customer';
    const channel = $('mChannel') && CHANNELS.indexOf($('mChannel').value) !== -1 ? $('mChannel').value : 'TikTok';
    const goal = $('mGoal') && GOALS.indexOf($('mGoal').value) !== -1 ? $('mGoal').value : 'Awareness';

    const goalBody =
      goal === 'Awareness' ? 'Optimize for reach — fast hook, low friction, memorable brand moment.' :
      goal === 'First sale' ? 'Optimize for conversion — clear offer, urgency, single CTA.' :
      goal === 'Repeat purchase' ? 'Optimize for loyalty — post-purchase email plus a bundle offer.' :
      'Optimize for retargeting — social proof, reviews, limited-time offer.';

    const ideas = [
      { tag: 'Hook', title: 'Before / After', body: 'Show life before ' + name + ' and after. Highlight the outcome for ' + audience + '.' },
      { tag: 'Angle', title: 'Problem → Solution', body: 'Lead with the exact frustration ' + audience + ' feels, then reveal ' + name + ' as the fix.' },
      { tag: channel, title: 'Channel play', body: CHANNEL_TIPS[channel] || 'Adapt the creative to the platform\'s native format.' },
      { tag: 'Goal: ' + goal, title: 'Primary objective', body: goalBody },
      { tag: 'UGC', title: 'Creator brief', body: 'Ask 3 creators in the ' + audience + ' niche to demo ' + name + ' in under 30 seconds.' },
      { tag: 'Retarget', title: 'Warm audience offer', body: 'Bundle ' + name + ' with a complementary accessory and offer free shipping this week.' }
    ];

    const grid = $('ideaGrid');
    if (!grid) return;
    clearNode(grid);
    ideas.forEach(function (i) {
      grid.appendChild(el('div', { class: 'idea-card' }, [
        el('span', { class: 'idea-tag', text: safeText(i.tag) }),
        el('h4', { text: safeText(i.title) }),
        el('p', { text: safeText(i.body) })
      ]));
    });
    addNotification('Marketing ideas generated', name, 'info');
    toast('Ideas generated', 'Local templates — not live market data.', 'info', 3800);
  }

  function initMarketing() {
    const btn = $('generateMarketingBtn');
    if (btn) btn.addEventListener('click', generateMarketing);
  }

  /* ----------------------------------------------------------------------
     PRICE ADVISOR
     ---------------------------------------------------------------------- */
  function detectPlatform(rawUrl) {
    const url = safeText(rawUrl).trim();
    if (!url) return { platform: null, supported: false, valid: false };
    let host = '';
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) return { platform: null, supported: false, valid: false };
      host = u.hostname.toLowerCase();
    } catch (_) {
      return { platform: null, supported: false, valid: false };
    }
    const found = PLATFORM_REGISTRY.find(function (p) {
      return p.match.some(function (re) { return re.test(host); });
    });
    if (!found) return { platform: null, supported: false, valid: true, host: host };
    return { platform: found, supported: false, valid: true, host: host };
  }

  function updatePlatformHint() {
    const urlEl = $('paUrl');
    const hint = $('paPlatformHint');
    if (!hint) return;
    const result = detectPlatform(urlEl ? urlEl.value : '');
    if (!urlEl || !urlEl.value.trim()) {
      hint.textContent = 'Paste a supported link to auto-detect the platform.';
      hint.style.color = '';
      return;
    }
    if (!result.valid) {
      hint.textContent = 'That does not look like a valid http(s) URL.';
      hint.style.color = 'var(--red)';
      return;
    }
    if (result.platform) {
      hint.textContent = 'Detected: ' + result.platform.name + ' — automatic retrieval is not connected in this build. Enter prices manually below.';
      hint.style.color = 'var(--violet-2)';
    } else {
      hint.textContent = 'Platform not recognised (' + (result.host || 'unknown host') + '). Automatic retrieval is not available — enter prices manually below.';
      hint.style.color = 'var(--text-3)';
    }
  }

  function clearPAErrors() {
    ['paName', 'paCurrent', 'paTarget'].forEach(function (id) {
      const input = $(id);
      if (input && input.closest('.field')) input.closest('.field').classList.remove('has-error');
      const err = document.querySelector('.field-error[data-for="' + id + '"]');
      if (err) err.textContent = '';
    });
  }

  function validatePAForm() {
    let valid = true;
    function check(id, message, test) {
      const input = $(id);
      if (!input) return;
      const field = input.closest('.field');
      const err = document.querySelector('.field-error[data-for="' + id + '"]');
      const ok = test(input.value);
      if (field) field.classList.toggle('has-error', !ok);
      if (err) err.textContent = ok ? '' : message;
      if (!ok) valid = false;
    }
    check('paName', 'Product name is required.', function (v) { return safeText(v).trim().length > 0; });
    check('paCurrent', 'Enter a valid current price (greater than 0).', function (v) { return v !== '' && !isNaN(Number(v)) && Number(v) > 0; });
    check('paTarget', 'Enter a valid target price (greater than 0).', function (v) { return v !== '' && !isNaN(Number(v)) && Number(v) > 0; });
    return valid;
  }

  function computeRecommendation(current, target, avg, low) {
    if (!current || !target) {
      return {
        verdict: 'unknown',
        label: 'Not enough reliable data to recommend.',
        confidence: 'low',
        reason: 'Both a current price and a target price are required for any meaningful recommendation.'
      };
    }
    const hasAvg = avg > 0;
    const hasLow = low > 0;
    let confidence = 'Low';
    if (hasAvg && hasLow) confidence = 'High';
    else if (hasAvg || hasLow) confidence = 'Medium';

    if (current <= target) {
      return {
        verdict: 'buy',
        label: 'Buying now looks reasonable.',
        confidence: confidence,
        reason: 'The current price is at or below your target price.'
      };
    }
    if (hasLow && current <= low * 1.05) {
      return {
        verdict: 'buy',
        label: 'Buying now looks reasonable.',
        confidence: confidence,
        reason: 'The current price is within 5% of the historical low you provided.'
      };
    }
    if (hasAvg && current <= avg) {
      return {
        verdict: 'buy',
        label: 'Buying now looks reasonable.',
        confidence: confidence,
        reason: 'The current price is at or below the historical average you provided.'
      };
    }
    return {
      verdict: 'wait',
      label: 'Consider waiting for a possible price drop.',
      confidence: confidence,
      reason: hasAvg || hasLow
        ? 'The current price is above your target and above the historical data you supplied.'
        : 'The current price is above your target. Without history, this is a low-confidence signal.'
    };
  }

  function analyzePrice() {
    if (!validatePAForm()) {
      toast('Check the highlighted fields', 'Some inputs need attention.', 'warn', 2800);
      return;
    }
    const urlInfo = detectPlatform($('paUrl') ? $('paUrl').value : '');
    const data = {
      id: makeId(),
      productName: safeText($('paName').value).trim(),
      url: safeText($('paUrl') ? $('paUrl').value : '').trim(),
      platform: urlInfo.platform ? urlInfo.platform.name : (urlInfo.valid && urlInfo.host ? urlInfo.host : 'Manual entry'),
      currency: $('paCurrency') ? $('paCurrency').value : 'USD',
      currentPrice: toNumber($('paCurrent').value),
      targetPrice: toNumber($('paTarget').value),
      historicalAvg: toNumber($('paAvg') ? $('paAvg').value : 0),
      historicalLow: toNumber($('paLow') ? $('paLow').value : 0),
      purchaseDate: $('paDate') ? $('paDate').value : '',
      source: 'Manual entry',
      createdAt: new Date().toISOString()
    };
    const rec = computeRecommendation(data.currentPrice, data.targetPrice, data.historicalAvg, data.historicalLow);
    data.verdict = rec.verdict;
    data.verdictLabel = rec.label;
    data.confidence = rec.confidence;
    data.reason = rec.reason;

    state.lastAnalysis = data;
    renderPAResult(data);
    toast('Analysis complete', rec.label, rec.verdict === 'buy' ? 'success' : 'info', 3400);
  }

  function renderPAResult(d) {
    const wrap = $('paResult');
    if (!wrap) return;
    clearNode(wrap);

    const verdictClass = d.verdict === 'buy' ? 'buy' : d.verdict === 'wait' ? 'wait' : 'unknown';
    const header = el('div', { class: 'pa-verdict ' + verdictClass, text: safeText(d.verdictLabel) });
    const summary = el('p', { class: 'pa-summary', text: safeText(d.reason) });

    const meta = el('div', { class: 'pa-meta-grid' }, [
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Product' }),
        el('strong', { text: safeText(d.productName) })
      ]),
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Platform' }),
        el('strong', { text: safeText(d.platform) })
      ]),
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Current price' }),
        el('strong', { text: formatMoney(d.currentPrice, d.currency) })
      ]),
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Target price' }),
        el('strong', { text: formatMoney(d.targetPrice, d.currency) })
      ]),
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Historical average' }),
        el('strong', { text: d.historicalAvg > 0 ? formatMoney(d.historicalAvg, d.currency) : '—' })
      ]),
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Historical low' }),
        el('strong', { text: d.historicalLow > 0 ? formatMoney(d.historicalLow, d.currency) : '—' })
      ]),
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Confidence' }),
        el('strong', { text: safeText(d.confidence) })
      ]),
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Intended purchase' }),
        el('strong', { text: d.purchaseDate ? formatDate(d.purchaseDate) : 'Not set' })
      ]),
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Data source' }),
        el('strong', { text: safeText(d.source) })
      ]),
      el('div', { class: 'pa-meta-item' }, [
        el('span', { text: 'Analyzed' }),
        el('strong', { text: formatDateTime(d.createdAt) })
      ])
    ]);

    const actions = el('div', { class: 'pa-actions' });
    const saveBtn = el('button', { class: 'btn btn-primary', text: 'Save analysis' });
    saveBtn.addEventListener('click', function () {
      state.priceAnalyses.unshift(Object.assign({}, d, { id: makeId(), savedAt: new Date().toISOString() }));
      saveAnalyses();
      renderSavedAnalyses();
      addNotification('Price analysis saved', d.productName, 'success');
      toast('Analysis saved', d.productName, 'success');
    });
    actions.appendChild(saveBtn);

    if (d.url) {
      const openBtn = el('button', { class: 'btn btn-ghost', text: 'Open product page' });
      openBtn.addEventListener('click', function () {
        try {
          const u = new URL(d.url);
          if (u.protocol === 'http:' || u.protocol === 'https:') {
            window.open(u.toString(), '_blank', 'noopener,noreferrer');
          } else {
            toast('Cannot open link', 'Only http(s) URLs are allowed.', 'warn', 2400);
          }
        } catch (_) { toast('Cannot open link', 'The URL is not valid.', 'warn', 2400); }
      });
      actions.appendChild(openBtn);
    }

    const disclaimer = el('p', {
      class: 'pa-disclaimer',
      text: 'This recommendation is an estimate based only on the values you entered. It is not a guarantee of future prices and does not include taxes, fees or availability. Always verify the price on the original store page before purchasing.'
    });

    wrap.appendChild(header);
    wrap.appendChild(summary);
    wrap.appendChild(meta);
    wrap.appendChild(actions);
    wrap.appendChild(disclaimer);
    wrap.hidden = false;
  }

  function renderSavedAnalyses() {
    const list = $('paSavedList');
    const count = $('paSavedCount');
    if (count) count.textContent = state.priceAnalyses.length + (state.priceAnalyses.length === 1 ? ' analysis' : ' analyses');
    if (!list) return;
    clearNode(list);

    if (!state.priceAnalyses.length) {
      list.appendChild(el('div', { class: 'recent-empty', text: 'No saved analyses yet. Run an analysis above and click "Save analysis".' }));
      return;
    }

    state.priceAnalyses.forEach(function (a) {
      const verdictClass = a.verdict === 'buy' ? 'buy' : a.verdict === 'wait' ? 'wait' : 'unknown';
      const head = el('div', null, [
        el('h4', { text: safeText(a.productName) }),
        el('div', { class: 'pa-saved-platform', text: safeText(a.platform || 'Manual entry') })
      ]);
      const verdict = el('span', { class: 'pa-verdict ' + verdictClass, text: safeText(a.verdictLabel || 'Not enough reliable data to recommend.') });

      const meta = el('div', { class: 'pa-saved-meta' }, [
        el('span', null, [document.createTextNode('Recorded: '), el('b', { text: formatMoney(a.currentPrice, a.currency) })]),
        el('span', null, [document.createTextNode('Target: '), el('b', { text: formatMoney(a.targetPrice, a.currency) })]),
        el('span', null, [document.createTextNode('Saved: '), el('b', { text: formatDate(a.savedAt || a.createdAt) })])
      ]);

      const actions = el('div', { class: 'pa-saved-actions' });
      const loadBtn = el('button', { class: 'btn btn-ghost btn-sm', text: 'Load into form' });
      loadBtn.addEventListener('click', function () { loadAnalysisIntoForm(a.id); });
      const delBtn = el('button', { class: 'btn btn-ghost btn-sm', text: 'Delete' });
      delBtn.addEventListener('click', function () { requestDeleteAnalysis(a.id); });
      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);

      list.appendChild(el('div', { class: 'pa-saved-card' }, [head, verdict, meta, actions]));
    });
  }

  function loadAnalysisIntoForm(id) {
    const a = state.priceAnalyses.find(function (x) { return x.id === id; });
    if (!a) return;
    if ($('paUrl')) $('paUrl').value = safeText(a.url || '');
    if ($('paName')) $('paName').value = safeText(a.productName);
    if ($('paCurrency')) $('paCurrency').value = a.currency || 'USD';
    if ($('paCurrent')) $('paCurrent').value = a.currentPrice != null ? String(a.currentPrice) : '';
    if ($('paTarget')) $('paTarget').value = a.targetPrice != null ? String(a.targetPrice) : '';
    if ($('paAvg')) $('paAvg').value = a.historicalAvg ? String(a.historicalAvg) : '';
    if ($('paLow')) $('paLow').value = a.historicalLow ? String(a.historicalLow) : '';
    if ($('paDate')) $('paDate').value = safeText(a.purchaseDate || '');
    updatePlatformHint();
    toast('Loaded into form', a.productName, 'info', 2200);
  }

  function requestDeleteAnalysis(id) {
    const a = state.priceAnalyses.find(function (x) { return x.id === id; });
    if (!a) return;
    confirmDialog('Delete saved analysis?', 'Delete the saved analysis for "' + a.productName + '"? This cannot be undone.', function () {
      state.priceAnalyses = state.priceAnalyses.filter(function (x) { return x.id !== id; });
      saveAnalyses();
      renderSavedAnalyses();
      toast('Analysis deleted', a.productName, 'info');
    });
  }

  function renderIntegrations() {
    const grid = $('integrationGrid');
    if (!grid) return;
    clearNode(grid);
    INTEGRATION_LIST.forEach(function (item) {
      const status = el('span', { class: 'integration-status off', text: 'Not connected' });
      const head = el('div', { class: 'integration-head' }, [
        el('h4', { text: item.name }),
        status
      ]);
      const body = el('p', { text: item.description });
      grid.appendChild(el('div', { class: 'integration-card' }, [head, body]));
    });
  }

  function clearPAForm() {
    ['paUrl', 'paName', 'paCurrent', 'paTarget', 'paAvg', 'paLow', 'paDate'].forEach(function (id) {
      const input = $(id); if (input) input.value = '';
    });
    if ($('paCurrency')) $('paCurrency').value = 'USD';
    clearPAErrors();
    updatePlatformHint();
    const wrap = $('paResult'); if (wrap) { wrap.hidden = true; clearNode(wrap); }
    state.lastAnalysis = null;
  }

  function initPriceAdvisor() {
    const urlEl = $('paUrl');
    if (urlEl) urlEl.addEventListener('input', updatePlatformHint);

    const analyzeBtn = $('paAnalyzeBtn');
    if (analyzeBtn) analyzeBtn.addEventListener('click', analyzePrice);

    const clearBtn = $('paClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', function () { clearPAForm(); toast('Form cleared', '', 'info', 1800); });

    renderIntegrations();
    renderSavedAnalyses();
  }

  /* ----------------------------------------------------------------------
     HELP CENTER
     ---------------------------------------------------------------------- */
  const HELP_TOPICS = [
    {
      id: 'dashboard',
      title: 'Navigating the dashboard',
      body: [
        'Use the sidebar on the left to switch between sections. Your current section is highlighted, and the page title at the top always matches.',
        'The top bar contains a global search field (press Ctrl+K to focus it) and a notifications bell. On smaller windows, the sidebar collapses into a menu button.'
      ]
    },
    {
      id: 'research',
      title: 'Researching a product',
      body: [
        'Open Product Research, enter at least a product name or keyword, and fill in as much detail as you have — category, estimated cost, estimated selling price, target audience, problem solved and any notes.',
        'Click Save Research. Your report is stored locally on this device and appears under "Saved Research". Nothing is uploaded anywhere.'
      ]
    },
    {
      id: 'products',
      title: 'Adding, editing and deleting products',
      body: [
        'Open My Products and click Add Product. Fill in the name, category, status, supplier cost and selling price, then save.',
        'Use the pencil icon in the Actions column to edit a product, or the trash icon to delete it. Deletions always ask for confirmation.',
        'Use the search box and the status / category filters to narrow the list. Estimated profit and margin are calculated from the cost and price you entered.'
      ]
    },
    {
      id: 'calculator',
      title: 'Using the profit calculator',
      body: [
        'Enter your selling price and any per-sale costs (product, shipping, packaging, ads, other). The results update as you type.',
        'Optionally enter your payment processor\'s percentage fee (for example 2.9% for many card processors). The fee is calculated as a percentage of the selling price and is included in the total cost, profit, margin and break-even price.',
        'Set a Target Profit Margin (default 30%) to see a Recommended Selling Price. The recommendation uses the formula: recommendedPrice = fixedCosts / (1 − feeRate − targetMargin). It is an estimate only — it assumes the payment fee is a percentage of the selling price and that no fixed per-transaction fee applies.',
        'Costs must be zero or greater. Percentages must be between 0 and 99.99. Blank cost fields count as zero, and a blank target margin uses the 30% default. Invalid entries are highlighted and the results are hidden until they are corrected, so no misleading figures are shown.',
        'If the payment fee plus target margin reaches or exceeds 100%, no recommended price is shown and an explanation appears instead.',
        'Total cost, payment processing fee, estimated profit, margin % and break-even price are shown on the right. The coloured bar visualises your margin at a glance.',
        'All results are estimates only. Taxes, refunds and any fixed per-transaction fees charged by your processor are not included.'
      ]
    },
    {
      id: 'finder',
      title: 'Browsing the Product Finder',
      body: [
        'The Product Finder shows a small set of demo products so you can explore search, filtering and sorting. Figures are illustrative sample data, not live market research.',
        'Use the search box to match name or category. Use the category dropdown to narrow by category. Enter a maximum cost or minimum margin to filter by financial thresholds.',
        'Choose a sort order from the dropdown: name, price, profit or margin. Tick Favorites only to see just the products you have starred.',
        'Click the star icon on any card to save that product to your favorites. Favorites are stored locally on this device and persist across restarts.',
        'Click View details on a card to open a dialog with the product description and estimated profit and margin.',
        'Click Reset filters (in the toolbar or the empty state) to clear every filter and return to the complete list.',
        'Estimated profit and margin are estimates only and do not include taxes, refunds, shipping, advertising or payment processing fees.'
      ]
    },
    {
      id: 'studio',
      title: 'Generating listings and marketing drafts',
      body: [
        'AI Product Studio generates titles, headlines, descriptions, ad copy and selling points from local templates. It is not a live AI model and does not call any external API.',
        'Enter a product name, pick a tone, and click Generate. Use the Copy buttons to copy any section to your clipboard.'
      ]
    },
    {
      id: 'priceadvisor',
      title: 'Using the Price Advisor',
      body: [
        'Paste a product URL (optional) to auto-detect the shopping platform, then enter the current price, your target price and — if you have them — a historical average and historical low.',
        'Click Analyze Price. You will receive one of three verdicts: "Buying now looks reasonable", "Consider waiting for a possible price drop", or "Not enough reliable data to recommend".',
        'Automatic price retrieval is not connected in this build. Enter the values manually. Recommendations are estimates, not guarantees, and are based only on the numbers you supply.'
      ]
    },
    {
      id: 'estimates',
      title: 'Understanding estimates and missing data',
      body: [
        'Every number in DropGenius AI comes from what you type — the app never fetches live market data, supplier prices or sales figures.',
        'Confidence levels reflect how much information you supplied. "Low" means only current and target prices; "Medium" means some historical context; "High" means both a historical average and a historical low were provided.',
        'Missing data does not mean zero. Leave optional fields blank rather than inventing values.'
      ]
    },
    {
      id: 'storage',
      title: 'Managing local data and resetting',
      body: [
        'All data — products, research reports, saved price analyses, favorites, notifications and preferences — lives in your browser-style local storage on this device. Nothing leaves your machine.',
        'To wipe everything, open Settings and click Reset. You will be asked to confirm. This only clears DropGenius AI data, never unrelated browser data.',
        'Because everything is local, clearing your OS-level app data or uninstalling will also remove it. There is no cloud backup.'
      ]
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting common problems',
      body: [
        'Nothing happens when I click a button — make sure you are on the correct section and the form fields required for that action are filled in. Validation errors appear under each field.',
        'My data disappeared — check that you are using the same Windows user account and have not cleared app data. Storage is per user and per device.',
        'The window looks cramped — resize the Electron window, or use the compact sidebar toggle in Settings.',
        'Copy buttons do not work — some environments block clipboard access. The app falls back to a legacy copy method, but if that also fails you can select and copy the text manually.'
      ]
    }
  ];

  function renderHelp() {
    const list = $('helpList');
    const emptyEl = $('helpEmpty');
    const searchEl = $('helpSearch');
    if (!list) return;

    const q = searchEl ? safeText(searchEl.value).trim().toLowerCase() : '';
    clearNode(list);

    const topics = HELP_TOPICS.filter(function (t) {
      if (!q) return true;
      if (t.title.toLowerCase().indexOf(q) !== -1) return true;
      return t.body.some(function (p) { return p.toLowerCase().indexOf(q) !== -1; });
    });

    if (!topics.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    topics.forEach(function (t) {
      const isOpen = !!state.helpOpen[t.id] || !!q;
      const item = el('div', { class: 'help-item' + (isOpen ? ' open' : ''), dataset: { helpId: t.id } });

      const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chevron.setAttribute('viewBox', '0 0 24 24');
      chevron.setAttribute('fill', 'none');
      chevron.setAttribute('stroke', 'currentColor');
      chevron.setAttribute('stroke-width', '2');
      chevron.setAttribute('stroke-linecap', 'round');
      chevron.setAttribute('stroke-linejoin', 'round');
      const chevPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      chevPath.setAttribute('d', 'm6 9 6 6 6-6');
      chevron.appendChild(chevPath);

      const toggle = el('button', {
        class: 'help-toggle',
        attrs: { type: 'button', 'aria-expanded': String(isOpen) }
      }, [
        el('span', { text: t.title }),
        chevron
      ]);

      const bodyEl = el('div', { class: 'help-body' }, t.body.map(function (p) { return el('p', { text: p }); }));

      toggle.addEventListener('click', function () {
        const open = item.classList.toggle('open');
        state.helpOpen[t.id] = open;
        toggle.setAttribute('aria-expanded', String(open));
      });

      item.appendChild(toggle);
      item.appendChild(bodyEl);
      list.appendChild(item);
    });
  }

  function initHelp() {
    const search = $('helpSearch');
    if (search) {
      search.addEventListener('input', function () { renderHelp(); });
    }
    renderHelp();
  }

  /* ----------------------------------------------------------------------
     SETTINGS
     ---------------------------------------------------------------------- */
  function applySettings() {
    document.body.classList.toggle('reduce-motion', state.settings.reduceMotion);
    const app = $('app');
    if (app) app.classList.toggle('is-collapsed', state.settings.compact);
    const rm = $('settingReduceMotion');
    const cp = $('settingCompact');
    if (rm) rm.checked = state.settings.reduceMotion;
    if (cp) cp.checked = state.settings.compact;
  }

  function resetAllData() {
    state.products = [];
    state.research = [];
    state.notifications = [];
    state.priceAnalyses = [];
    finderFavorites = [];
    saveProducts();
    saveResearch();
    saveNotifications();
    saveAnalyses();
    saveFinderFavorites();

    renderProducts();
    renderRecentProducts();
    renderResearch();
    renderNotifications();
    renderSavedAnalyses();
    renderFinder();
    updateStats();

    const wrap = $('paResult'); if (wrap) { wrap.hidden = true; clearNode(wrap); }
    clearPAForm();

    toast('All data reset', 'Your workspace is now empty.', 'info');
    addNotification('Workspace reset', 'All local data cleared.', 'warn');
  }

  function initSettings() {
    const rm = $('settingReduceMotion');
    const cp = $('settingCompact');
    const reset = $('resetDataBtn');

    if (rm) rm.addEventListener('change', function () {
      state.settings.reduceMotion = !!rm.checked;
      saveSettings();
      applySettings();
    });
    if (cp) cp.addEventListener('change', function () {
      state.settings.compact = !!cp.checked;
      saveSettings();
      applySettings();
    });
    if (reset) reset.addEventListener('click', function () {
      confirmDialog(
        'Reset all data?',
        'This will permanently remove all locally stored products, research reports, saved price analyses and notifications.',
        resetAllData
      );
    });
  }

  /* ----------------------------------------------------------------------
     QUICK CARD GLOW
     ---------------------------------------------------------------------- */
  function initQuickCardGlow() {
    $$('.quick-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mx', x + '%');
        card.style.setProperty('--my', y + '%');
      });
    });
  }

  /* ----------------------------------------------------------------------
     BOOT
     ---------------------------------------------------------------------- */
  function init() {
    loadState();
    applySettings();

    initNav();
    initGlobalSearch();
    initNotifications();
    initModals();
    initProducts();
    initCalculator();
    initFinder();
    initResearch();
    initStudio();
    initMarketing();
    initPriceAdvisor();
    initHelp();
    initSettings();
    initQuickCardGlow();

    renderProducts();
    renderRecentProducts();
    renderResearch();
    renderNotifications();
    renderSavedAnalyses();
    updateStats();

    if (!state.notifications.length) {
      addNotification('Welcome to DropGenius AI', 'Your workspace is ready.', 'info');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();