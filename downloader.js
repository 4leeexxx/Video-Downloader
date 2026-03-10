'use strict';

const RateLimit = (() => {
  const MAX=5,WIN=30000,ts=[];
  return { allow(){ const n=Date.now(); while(ts.length&&n-ts[0]>WIN)ts.shift(); if(ts.length>=MAX)return false; ts.push(n);return true; } };
})();

// Trusted third-party download services per platform
const SERVICES = {
  youtube: [
    { name:'yt1s.io',       url:'https://yt1s.io/',                    note:'MP4 & MP3, fast' },
    { name:'y2mate.com',    url:'https://www.y2mate.com/',             note:'Multiple qualities' },
    { name:'ssyoutube.com', url:'https://ssyoutube.com/',              note:'Replace "www" with "ss" in URL' },
  ],
  tiktok: [
    { name:'ssstik.io',     url:'https://ssstik.io/',                  note:'No watermark' },
    { name:'tikmate.online',url:'https://tikmate.online/',             note:'HD quality' },
    { name:'snaptik.app',   url:'https://snaptik.app/',                note:'Fast & reliable' },
  ],
  instagram: [
    { name:'snapinsta.app', url:'https://snapinsta.app/',              note:'Reels, posts & stories' },
    { name:'igram.world',   url:'https://igram.world/',                note:'HD photos & videos' },
    { name:'instafinsta.com',url:'https://instafinsta.com/',           note:'Carousels supported' },
  ],
  twitter: [
    { name:'twittervideodownloader.com', url:'https://twittervideodownloader.com/', note:'All tweet videos' },
    { name:'ssstwitter.com', url:'https://ssstwitter.com/',            note:'HD & SD options' },
  ],
  facebook: [
    { name:'fdown.net',     url:'https://fdown.net/',                  note:'Public FB videos' },
    { name:'getfvid.com',   url:'https://www.getfvid.com/',            note:'HD quality' },
  ],
  pinterest: [
    { name:'pinterestdownloader.com', url:'https://pinterestdownloader.com/', note:'Video pins' },
    { name:'pinsave.net',   url:'https://pinsave.net/',                note:'Fast download' },
  ],
  generic: [
    { name:'9xbuddy.org',   url:'https://9xbuddy.org/',               note:'Works on 100+ sites' },
    { name:'savefrom.net',  url:'https://en.savefrom.net/',            note:'Universal downloader' },
  ],
};

const PLATFORM_INFO = {
  youtube:   { name:'YouTube',   emoji:'▶️', color:'#ff4444' },
  tiktok:    { name:'TikTok',    emoji:'🎵', color:'#000' },
  instagram: { name:'Instagram', emoji:'📸', color:'#c13584' },
  twitter:   { name:'Twitter/X', emoji:'🐦', color:'#1da1f2' },
  facebook:  { name:'Facebook',  emoji:'👤', color:'#1877f2' },
  pinterest: { name:'Pinterest', emoji:'📌', color:'#e60023' },
  generic:   { name:'Video',     emoji:'🎬', color:'#f5a623' },
};

function detectPlatform(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/tiktok\.com/i.test(url))           return 'tiktok';
  if (/instagram\.com/i.test(url))        return 'instagram';
  if (/twitter\.com|x\.com/i.test(url))  return 'twitter';
  if (/facebook\.com|fb\.watch/i.test(url)) return 'facebook';
  if (/pinterest\.com|pin\.it/i.test(url)) return 'pinterest';
  return 'generic';
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch { return false; }
}

function safeText(id,v){const e=document.getElementById(id);if(e)e.textContent=String(v);}
function getEl(id){return document.getElementById(id);}

function getLinks() {
  if (!RateLimit.allow()) return showError('Too many requests — please wait a moment. 😊');

  const rawUrl = String(getEl('videoUrl').value).trim().substring(0, 500);
  if (!rawUrl) return showError('Please paste a video URL first. 🔗');
  if (!isValidUrl(rawUrl)) return showError('That doesn\'t look like a valid URL. Make sure it starts with https://');

  const platform = detectPlatform(rawUrl);
  const info     = PLATFORM_INFO[platform];
  const services = SERVICES[platform];

  safeText('verdict-emoji', info.emoji);
  safeText('verdict-title', info.name + ' video detected!');
  safeText('verdict-sub',   'Choose a trusted downloader below — your URL is ready to paste');

  const banner = getEl('verdict-banner');
  if (banner) banner.className = 'verdict-banner info';

  // Build service cards safely
  const container = getEl('service-links');
  container.innerHTML = '';

  services.forEach((svc, i) => {
    const card = document.createElement('a');
    card.className = 'service-card' + (i === 0 ? ' service-recommended' : '');
    card.href = svc.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    const badge = document.createElement('div');
    badge.className = 'service-badge';
    badge.textContent = i === 0 ? '⭐ Recommended' : `Option ${i + 1}`;

    const name = document.createElement('div');
    name.className = 'service-name';
    name.textContent = svc.name;

    const note = document.createElement('div');
    note.className = 'service-note';
    note.textContent = '✓ ' + svc.note;

    const arrow = document.createElement('div');
    arrow.className = 'service-arrow';
    arrow.textContent = 'Open & paste URL →';

    card.appendChild(badge);
    card.appendChild(name);
    card.appendChild(note);
    card.appendChild(arrow);
    container.appendChild(card);
  });

  // Copy-ready URL display
  const urlBox = document.createElement('div');
  urlBox.className = 'url-copy-box';
  const urlLabel = document.createElement('p');
  urlLabel.textContent = '📋 Your URL (tap to copy):';
  urlLabel.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-soft);margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em;';
  const urlText = document.createElement('div');
  urlText.className = 'url-text';
  urlText.textContent = rawUrl;
  urlText.title = 'Click to copy';
  urlText.addEventListener('click', () => {
    navigator.clipboard.writeText(rawUrl).then(() => {
      urlText.textContent = '✅ Copied!';
      setTimeout(() => { urlText.textContent = rawUrl; }, 2000);
    }).catch(() => {});
  });
  urlBox.appendChild(urlLabel);
  urlBox.appendChild(urlText);
  container.appendChild(urlBox);

  const panel = getEl('results');
  if (panel) {
    panel.style.display = 'block';
    panel.style.animation = 'none';
    void panel.offsetWidth;
    panel.style.animation = 'pop-in .45s cubic-bezier(.22,1,.36,1)';
  }
  const rb = getEl('resetBtn');
  if (rb) rb.style.display = 'block';
  if (panel) panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function showError(msg) {
  safeText('verdict-emoji','⚠️'); safeText('verdict-title','Oops!'); safeText('verdict-sub', msg);
  const b=getEl('verdict-banner'); if(b) b.className='verdict-banner loss';
  getEl('service-links').innerHTML = '';
  const p=getEl('results');if(p){p.style.display='block';p.style.animation='none';void p.offsetWidth;p.style.animation='pop-in .35s cubic-bezier(.22,1,.36,1)';}
  const rb=getEl('resetBtn');if(rb)rb.style.display='block';
  const card=document.querySelector('.calc-card');if(card){card.style.animation='none';void card.offsetWidth;card.style.animation='shake .4s ease';}
}

function resetDownloader() {
  getEl('videoUrl').value = '';
  const p=getEl('results');if(p)p.style.display='none';
  const rb=getEl('resetBtn');if(rb)rb.style.display='none';
  getEl('videoUrl').focus();
}

const st = document.createElement('style');
st.textContent = `
.platform-pills{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px;}
.plat-pill{background:white;border:1.5px solid var(--border);border-radius:999px;padding:5px 12px;font-size:11px;font-weight:800;color:var(--text-mid);}
.service-card{display:block;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:16px 18px;margin-bottom:10px;text-decoration:none;color:var(--text);transition:all .2s;}
.service-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(245,166,35,.18);border-color:var(--gold);}
.service-card.service-recommended{background:var(--gold-light);border-color:var(--gold);}
.service-badge{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--text-soft);margin-bottom:4px;}
.service-recommended .service-badge{color:var(--gold-dark);}
.service-name{font-size:17px;font-weight:900;color:var(--text);margin-bottom:3px;}
.service-note{font-size:12px;color:var(--text-soft);font-family:var(--font-serif);font-style:italic;margin-bottom:8px;}
.service-arrow{font-size:12px;font-weight:800;color:var(--gold-dark);}
.url-copy-box{background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:14px;margin-top:12px;}
.url-text{font-size:12px;color:var(--text-mid);word-break:break-all;cursor:pointer;padding:8px;background:white;border-radius:var(--radius-xs);border:1.5px solid var(--border);transition:all .2s;}
.url-text:hover{border-color:var(--gold);background:var(--gold-light);}
@keyframes shake{0%{transform:translateX(0)}18%{transform:translateX(-7px)}36%{transform:translateX(7px)}54%{transform:translateX(-4px)}72%{transform:translateX(4px)}100%{transform:translateX(0)}}
@keyframes pop-in{from{opacity:0;transform:scale(.96)translateY(10px)}to{opacity:1;transform:scale(1)translateY(0)}}
`;
document.head.appendChild(st);

document.addEventListener('DOMContentLoaded', () => {
  const p=getEl('results');if(p)p.style.display='none';
  const r=getEl('resetBtn');if(r)r.style.display='none';
  getEl('videoUrl').addEventListener('keydown', e => { if(e.key==='Enter') getLinks(); });
});
