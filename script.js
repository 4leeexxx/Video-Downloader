// ===========================
//   CRYPTOCALC — script.js
//   - Live prices via CoinGecko (free, no key)
//   - XSS prevention (textContent only)
//   - Input sanitization & validation
//   - CSP enforced in HTML
//   - Rate limiter on calculate
// ===========================

'use strict';

// ── Rate limiter ─────────────────────────────────────────────────────────────
const RateLimit = (() => {
  const MAX = 10, WINDOW = 10_000;
  const ts = [];
  return {
    allow() {
      const now = Date.now();
      while (ts.length && now - ts[0] > WINDOW) ts.shift();
      if (ts.length >= MAX) return false;
      ts.push(now);
      return true;
    }
  };
})();

// ── Coin config ───────────────────────────────────────────────────────────────
const COINS = {
  BTC: { id: 'bitcoin',   emoji: '🟠', name: 'Bitcoin' },
  ETH: { id: 'ethereum',  emoji: '🔵', name: 'Ethereum' },
  SOL: { id: 'solana',    emoji: '🟣', name: 'Solana' },
  XRP: { id: 'ripple',    emoji: '🔷', name: 'XRP' },
  BNB: { id: 'binancecoin', emoji: '🟡', name: 'BNB' },
};
const ALLOWED_COINS = new Set(Object.keys(COINS));

let selectedCoin = null;
let priceCache   = {};   // { symbol: { price, timestamp } }
const CACHE_TTL  = 60_000; // 1 minute

// ── Safe DOM helpers (never innerHTML) ───────────────────────────────────────
function safeText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}
function getEl(id) { return document.getElementById(id); }

// ── Input sanitizer ───────────────────────────────────────────────────────────
function sanitizeNumber(raw) {
  const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
  if ((cleaned.match(/\./g) || []).length > 1) return NaN;
  const n = parseFloat(cleaned);
  if (!isFinite(n) || Math.abs(n) > 999_999_999) return NaN;
  return n;
}

// ── Formatting ────────────────────────────────────────────────────────────────
function formatCurrency(value) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return '$' + (value / 1_000_000).toFixed(2) + 'M';
  return '$' + value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: abs < 0.01 ? 6 : 2
  });
}
function formatROI(v) { return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }
function roiToBarPct(roi) { return ((Math.max(-100, Math.min(200, roi)) + 100) / 300) * 100; }

// ── Live price fetch ──────────────────────────────────────────────────────────
async function fetchLivePrice(symbol) {
  // Return cache if fresh
  const cached = priceCache[symbol];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  const coinId = COINS[symbol].id;
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;

  const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Price fetch failed');

  const data = await res.json();

  // Validate response shape before trusting it
  if (
    typeof data !== 'object' || data === null ||
    typeof data[coinId] !== 'object' ||
    typeof data[coinId].usd !== 'number' ||
    data[coinId].usd <= 0
  ) {
    throw new Error('Unexpected API response');
  }

  const price = data[coinId].usd;
  priceCache[symbol] = { price, timestamp: Date.now() };
  return price;
}

// ── Pill loading state ────────────────────────────────────────────────────────
function setPillLoading(btn, loading) {
  if (loading) {
    btn.classList.add('loading');
    btn.setAttribute('aria-busy', 'true');
  } else {
    btn.classList.remove('loading');
    btn.setAttribute('aria-busy', 'false');
  }
}

// ── Coin selection ────────────────────────────────────────────────────────────
async function selectCoin(btn) {
  const coin = btn.getAttribute('data-coin');
  if (!ALLOWED_COINS.has(coin)) return;  // whitelist check

  const pills = document.querySelectorAll('.pill');

  // Deselect if already selected
  if (selectedCoin === coin) {
    selectedCoin = null;
    btn.classList.remove('selected');
    btn.setAttribute('aria-selected', 'false');
    removeCoinBadge();
    getEl('buyPrice').placeholder = 'e.g. 30000';
    return;
  }

  // Deselect all others
  pills.forEach(p => { p.classList.remove('selected'); p.setAttribute('aria-selected', 'false'); });
  selectedCoin = coin;
  btn.classList.add('selected');
  btn.setAttribute('aria-selected', 'true');
  showCoinBadge(coin, 'Fetching live price…', true);

  // Fetch live price
  setPillLoading(btn, true);
  try {
    const price = await fetchLivePrice(coin);
    const buyInput = getEl('buyPrice');
    if (buyInput) {
      buyInput.value = price;
      buyInput.placeholder = 'e.g. ' + price;
      // Flash the input to draw attention
      buyInput.classList.add('price-filled');
      setTimeout(() => buyInput.classList.remove('price-filled'), 1200);
    }
    showCoinBadge(coin, 'Live price loaded ✓', false);
    // After 3s revert badge to normal label
    setTimeout(() => {
      if (selectedCoin === coin) showCoinBadge(coin, 'Calculating for ' + coin, false);
    }, 3000);
  } catch {
    showCoinBadge(coin, 'Could not fetch price — enter manually', false);
    getEl('buyPrice').placeholder = 'Enter price manually';
    setTimeout(() => {
      if (selectedCoin === coin) showCoinBadge(coin, 'Calculating for ' + coin, false);
    }, 3000);
  } finally {
    setPillLoading(btn, false);
  }
}

// ── Coin badge inside card ────────────────────────────────────────────────────
function showCoinBadge(coin, message, spinning) {
  removeCoinBadge();
  const label = getEl('section-label');
  if (!label) return;

  const badge = document.createElement('div');
  badge.className = 'coin-badge';
  badge.id = 'coin-badge';

  const dot = document.createElement('span');
  dot.className = 'coin-badge-dot' + (spinning ? ' spinning' : '');

  // Use emoji from whitelist map — never from user input
  const emoji = COINS[coin] ? COINS[coin].emoji : '';
  badge.appendChild(dot);
  badge.appendChild(document.createTextNode(emoji + ' ' + message));
  label.after(badge);
}

function removeCoinBadge() {
  const b = getEl('coin-badge');
  if (b) b.remove();
}

// ── Verdict ───────────────────────────────────────────────────────────────────
function getVerdict(isProfit, roi) {
  const coinSuffix = selectedCoin ? ' on ' + selectedCoin : '';
  if (isProfit) {
    if (roi >= 200) return { emoji: '🚀', title: 'To the moon!',       sub: `A ${roi.toFixed(0)}% gain${coinSuffix} — absolutely incredible!` };
    if (roi >= 100) return { emoji: '🎉', title: 'More than doubled!', sub: `${roi.toFixed(0)}% return${coinSuffix} — brilliant trade.` };
    if (roi >= 50)  return { emoji: '😍', title: 'Fantastic profit!',  sub: `+${roi.toFixed(1)}% ROI${coinSuffix} — you're doing great.` };
    if (roi >= 20)  return { emoji: '😊', title: 'Solid gain!',        sub: `+${roi.toFixed(1)}%${coinSuffix} — a healthy return.` };
    return           { emoji: '👍', title: 'In the green!',            sub: `Every bit counts. +${roi.toFixed(1)}%${coinSuffix}.` };
  } else {
    if (roi <= -70) return { emoji: '😬', title: 'Rough one…',       sub: `Down ${Math.abs(roi).toFixed(0)}%${coinSuffix}. Markets can recover!` };
    if (roi <= -30) return { emoji: '😔', title: 'Feeling the dip',  sub: `−${Math.abs(roi).toFixed(1)}%${coinSuffix} — hang tight.` };
    return           { emoji: '😅', title: 'Slightly in the red',    sub: `−${Math.abs(roi).toFixed(1)}%${coinSuffix} — close to break even!` };
  }
}

// ── Calculate ─────────────────────────────────────────────────────────────────
function calculate() {
  if (!RateLimit.allow()) return showError('Slow down a little! Try again in a moment. 😊');

  const buyPrice  = sanitizeNumber(getEl('buyPrice').value);
  const sellPrice = sanitizeNumber(getEl('sellPrice').value);
  const amount    = sanitizeNumber(getEl('amount').value);

  if (isNaN(buyPrice) || isNaN(sellPrice) || isNaN(amount))
    return showError('Please fill in all three fields with valid numbers. 🙏');
  if (buyPrice <= 0)  return showError('Buy price must be greater than zero! 😊');
  if (sellPrice < 0)  return showError('Sell price cannot be negative! 😊');
  if (amount <= 0)    return showError('Amount must be greater than zero! 😊');

  const invested  = buyPrice * amount;
  const returnVal = sellPrice * amount;
  const profit    = returnVal - invested;
  const roi       = ((sellPrice - buyPrice) / buyPrice) * 100;
  const isProfit  = profit >= 0;

  safeText('val-invested', formatCurrency(invested));
  safeText('val-return',   formatCurrency(returnVal));
  safeText('val-profit',   (isProfit ? '+' : '') + formatCurrency(profit));
  safeText('val-roi',      formatROI(roi));

  const profitEl = getEl('val-profit');
  const roiEl    = getEl('val-roi');
  if (profitEl) profitEl.className = 'res-value res-large ' + (isProfit ? 'profit' : 'loss');
  if (roiEl)    roiEl.className    = 'res-value res-large ' + (isProfit ? 'profit' : 'loss');

  const profitCard = getEl('res-profit-card');
  const profitIcon = getEl('profit-icon');
  if (profitCard) profitCard.classList.toggle('loss-card', !isProfit);
  if (profitIcon) profitIcon.textContent = isProfit ? '🏆' : '📉';

  const verdict = getVerdict(isProfit, roi);
  safeText('verdict-emoji', verdict.emoji);
  safeText('verdict-title', verdict.title);
  safeText('verdict-sub',   verdict.sub);
  const banner = getEl('verdict-banner');
  if (banner) banner.className = 'verdict-banner ' + (isProfit ? 'win' : 'loss');

  const pct = roiToBarPct(roi);
  const needle = getEl('roi-needle');
  const fill   = getEl('roi-fill');
  if (needle) { needle.style.left = pct + '%'; needle.style.borderColor = isProfit ? 'var(--green)' : 'var(--red)'; }
  if (fill)   { fill.style.width = pct + '%'; fill.style.background = isProfit
    ? 'linear-gradient(90deg,rgba(39,174,96,.15),rgba(39,174,96,.35))'
    : 'linear-gradient(90deg,rgba(231,76,60,.35),rgba(231,76,60,.15))'; }

  const panel = getEl('results');
  if (panel) { panel.style.display = 'block'; panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = 'pop-in .45s cubic-bezier(.22,1,.36,1)'; }
  const rb = getEl('resetBtn');
  if (rb) rb.style.display = 'block';
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Error ─────────────────────────────────────────────────────────────────────
function showError(msg) {
  safeText('verdict-emoji', '⚠️');
  safeText('verdict-title', 'Oops!');
  safeText('verdict-sub',   msg);  // always a hardcoded string, never user input
  const banner = getEl('verdict-banner');
  if (banner) banner.className = 'verdict-banner loss';
  safeText('val-invested','—'); safeText('val-return','—');
  safeText('val-profit','—');   safeText('val-roi','—');
  const panel = getEl('results');
  if (panel) { panel.style.display='block'; panel.style.animation='none'; void panel.offsetWidth; panel.style.animation='pop-in .35s cubic-bezier(.22,1,.36,1)'; }
  const rb = getEl('resetBtn');
  if (rb) rb.style.display = 'block';
  const card = document.querySelector('.calc-card');
  if (card) { card.style.animation='none'; void card.offsetWidth; card.style.animation='shake .4s ease'; }
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function resetCalc() {
  ['buyPrice','sellPrice','amount'].forEach(id => { const el=getEl(id); if(el) el.value=''; });
  const panel=getEl('results'); if(panel) panel.style.display='none';
  const rb=getEl('resetBtn'); if(rb) rb.style.display='none';
  const needle=getEl('roi-needle'); if(needle) needle.style.left='33%';
  const fill=getEl('roi-fill'); if(fill) fill.style.width='0%';
  getEl('buyPrice').focus();
}

// ── Keyframes ─────────────────────────────────────────────────────────────────
const _ks = document.createElement('style');
_ks.textContent = `
  @keyframes shake {
    0%{transform:translateX(0)} 18%{transform:translateX(-7px)}
    36%{transform:translateX(7px)} 54%{transform:translateX(-4px)}
    72%{transform:translateX(4px)} 100%{transform:translateX(0)}
  }`;
document.head.appendChild(_ks);

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const results = getEl('results'), rb = getEl('resetBtn');
  if (results) results.style.display = 'none';
  if (rb)      rb.style.display      = 'none';

  // Pill clicks via event delegation
  const pillsWrap = document.querySelector('.coin-pills');
  if (pillsWrap) {
    pillsWrap.addEventListener('click', e => {
      const btn = e.target.closest('.pill');
      if (btn && !btn.classList.contains('loading')) selectCoin(btn);
    });
  }

  document.addEventListener('keydown', e => { if (e.key === 'Enter') calculate(); });
});
