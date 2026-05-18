/* ── Rowan Underground — Frontend App ───────────────────────────────────────── */

// En modo estático (Cloudflare Pages), window.__STATIC_DATA está definido por
// /js/static-data.js generado por build.js. En dev local se usa la API REST.
const STATIC = typeof window !== 'undefined' && !!window.__STATIC_DATA;
const API    = '/api';
let allReleases = [];
let allExtra    = {};

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function cleanTitle(t) {
  return (t || '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
}

function el(id) { return document.getElementById(id); }

// ── Header scroll reveal ───────────────────────────────────────────────────────

(function initScrollHeader() {
  const header = el('site-header');
  const THRESHOLD = 80;

  function update() {
    // If it's a subpage, keep it visible always
    if (header.classList.contains('subpage-header')) return;

    if (window.scrollY > THRESHOLD) {
      header.classList.add('visible');
    } else {
      header.classList.remove('visible');
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  update(); // run once on load
})();

// ── Skeleton loaders ──────────────────────────────────────────────────────────

function showSkeletons(n = 5) {
  el('releases-feed').innerHTML =
    Array.from({ length: n }, () => '<div class="skeleton"></div>').join('');
}

// ── Render releases feed ──────────────────────────────────────────────────────

function renderFeed(releases) {
  const feed  = el('releases-feed');
  const featuredFeed = el('featured-releases');
  const featuredHeader = el('featured-header');
  const catalogHeader = el('catalog-header');
  const empty = el('feed-empty');

  if (!releases.length) {
    feed.innerHTML = '';
    if (featuredFeed) featuredFeed.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  // Split: top 3 are featured, rest are catalog
  const featured = releases.slice(0, 3);
  const catalog = releases.slice(3);

  // Render featured
  if (featuredFeed) {
    featuredFeed.innerHTML = featured.map((r, i) => `
      <article
        class="featured-card"
        role="button"
        tabindex="0"
        aria-label="View details for ${cleanTitle(r.title)} — ${r.artist}"
        data-index="${i}"
      >
        <div class="featured-thumb">
          ${r.coverArt
            ? `<img class="featured-cover" src="${r.coverArt}" alt="${cleanTitle(r.title)}" loading="lazy" />`
            : `<div class="featured-thumb-placeholder">◈</div>`
          }
          <div class="featured-badge">LATEST</div>
        </div>
        <div class="featured-info">
          ${r.catalog ? `<p class="featured-catalog">${r.catalog}</p>` : ''}
          <p class="featured-title">${cleanTitle(r.title)}</p>
          <p class="featured-artist">${r.artist || 'Rowan Underground'}</p>
          <p class="featured-date">${formatDate(r.releaseDate)}</p>
        </div>
      </article>
    `).join('');

    featuredFeed.querySelectorAll('.featured-card').forEach(card => {
      card.addEventListener('click', () => openModal(releases[+card.dataset.index]));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal(releases[+card.dataset.index]);
        }
      });
    });
  }

  // Render catalog
  if (catalog.length) {
    if (catalogHeader) catalogHeader.classList.remove('hidden');
    feed.innerHTML = catalog.map((r, i) => {
      const realIndex = i + 3;
      return `
        <article
          class="release-card"
          role="button"
          tabindex="0"
          aria-label="View details for ${cleanTitle(r.title)} — ${r.artist}"
          data-index="${realIndex}"
        >
          <div class="release-thumb">
            ${r.coverArt
              ? `<img class="release-cover" src="${r.coverArt}" alt="${cleanTitle(r.title)}" loading="lazy" />`
              : `<div class="release-thumb-placeholder">◈</div>`
            }
          </div>
          <div class="release-info">
            ${r.catalog ? `<p class="release-catalog">${r.catalog}</p>` : ''}
            <p class="release-title">${cleanTitle(r.title)}</p>
            <p class="release-artist">${r.artist || 'Rowan Underground'}</p>
            <p class="release-date">${formatDate(r.releaseDate)}</p>
            ${r.tags?.length ? `
              <div class="release-tags">
                ${r.tags.slice(0, 5).map(t => `<span class="release-tag">${t}</span>`).join('')}
              </div>` : ''}
          </div>
        </article>
      `;
    }).join('');

    feed.querySelectorAll('.release-card').forEach(card => {
      card.addEventListener('click', () => openModal(releases[+card.dataset.index]));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal(releases[+card.dataset.index]);
        }
      });
    });
  } else {
    feed.innerHTML = '';
    if (catalogHeader) catalogHeader.classList.add('hidden');
  }
}

// ── Scroll Reveal Animations ──────────────────────────────────────────────────

function initRevealOnScroll() {
  if (typeof IntersectionObserver === 'undefined') return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.04,
    rootMargin: '0px 0px -40px 0px'
  });

  // Target key sections and list elements
  const elements = document.querySelectorAll(
    '.releases-section, .merch-section, .events-section, .demos-section, .about-section, .featured-card, .release-card'
  );
  elements.forEach(el => {
    el.classList.add('reveal');
    observer.observe(el);
  });
}

// ── Sync status ───────────────────────────────────────────────────────────────

function setSyncStatus(state, text) {
  // Status is shown in admin panel only
  const dot = el('sync-dot');
  const txt = el('sync-text');
  if (dot) dot.className = `sync-dot ${state}`;
  if (txt) txt.textContent = text;
}

// ── Load releases + extra data ────────────────────────────────────────────────

async function loadReleases() {
  showSkeletons(6);
  setSyncStatus('syncing', 'Loading...');
  try {
    if (STATIC) {
      // Modo estático: datos embebidos por build.js (Cloudflare Pages)
      allReleases = window.__STATIC_DATA.releases || [];
      allExtra    = {}; // ya mergeado en el build
    } else {
      // Modo local: usa la API REST del servidor
      const [relRes, extRes] = await Promise.all([
        fetch(`${API}/releases`),
        fetch(`${API}/extra`),
      ]);
      allReleases = await relRes.json();
      allExtra    = extRes.ok ? await extRes.json() : {};

      const status = await fetch(`${API}/status`).then(r => r.json()).catch(() => null);
      if (status?.lastSync) {
        const d = new Date(status.lastSync);
        setSyncStatus('ok', `Sync: ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
      } else {
        setSyncStatus('ok', `${allReleases.length} releases`);
      }
    }

    renderFeed(allReleases);
    initRevealOnScroll();
    if (STATIC) setSyncStatus('ok', `${allReleases.length} releases`);
  } catch (err) {
    console.error('[APP] loadReleases error:', err);
    el('releases-feed').innerHTML = '';
    el('feed-empty').classList.remove('hidden');
    setSyncStatus('error', 'Connection error');
  }
}


// ── Modal ─────────────────────────────────────────────────────────────────────

function showLink(elId, url) {
  const a = el(elId);
  if (url) {
    a.href = url;
    a.classList.remove('hidden');
  } else {
    a.href = '#';
    a.classList.add('hidden');
  }
}

function openModal(release) {
  if (!release) return;

  // Cover
  const cover = el('modal-cover');
  if (release.coverArt) {
    cover.src = release.coverArt;
    cover.alt = cleanTitle(release.title);
    cover.style.display = 'block';
  } else {
    cover.style.display = 'none';
  }

  // Store links — robust URL normalizer so the link always opens bandcamp.com
  function toBandcampUrl(url) {
    if (!url) return null;
    if (url.startsWith('https://') || url.startsWith('http://')) return url;
    if (url.startsWith('//'))   return `https:${url}`;
    if (url.includes('bandcamp.com')) return `https://${url}`;
    // Relative path: prepend label domain
    return `https://rowanunderground.bandcamp.com${url.startsWith('/') ? url : '/' + url}`;
  }
  // beatport / instagram come merged into the release object by /api/releases
  // (extra.json is a legacy fallback — keep it as secondary source)
  const extra = allExtra[String(release.id)] || {};
  showLink('modal-bandcamp-link',  toBandcampUrl(release.url));
  showLink('modal-beatport-link',  release.beatport  || extra.beatport  || null);
  showLink('modal-instagram-link', release.instagram || extra.instagram || null);

  // Catalog / title / artist / date
  el('modal-catalog').textContent = release.catalog || '';
  el('modal-title').textContent   = cleanTitle(release.title) || '';
  el('modal-artist').textContent  = release.artist || '';
  el('modal-date').textContent    = formatDate(release.releaseDate);

  // Tags
  el('modal-tags').innerHTML = (release.tags || [])
    .map(t => `<span class="modal-tag">${t}</span>`).join('');

  // Description
  const desc = el('modal-description');
  desc.textContent  = release.description || '';
  desc.style.display = release.description ? 'block' : 'none';

  // Tracks — hidden (shown inside Bandcamp player widget instead)
  el('modal-tracks').innerHTML    = '';
  el('modal-tracks').style.display = 'none';

  // Bandcamp embed — full tracklist player
  const playerEl = el('modal-player');
  if (release.albumId) {
    const isTrack  = release.type === 'track';
    const embedType = isTrack ? 'track' : 'album';
    playerEl.innerHTML = `
      <iframe
        src="https://bandcamp.com/EmbeddedPlayer/${embedType}=${release.albumId}/size=large/bgcol=080a14/linkcol=2060cc/tracklist=true/artwork=none/transparent=true/"
        seamless
        title="Player: ${cleanTitle(release.title)}"
      ></iframe>
    `;
    playerEl.style.display = 'block';
  } else {
    playerEl.innerHTML    = '';
    playerEl.style.display = 'none';
  }

  el('modal-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  el('modal').scrollTop = 0;
  el('modal-close').focus();
}

function closeModal() {
  el('modal-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  // Stop audio by clearing the iframe src
  const playerEl = el('modal-player');
  playerEl.innerHTML = '';
}

// ── Event listeners ───────────────────────────────────────────────────────────

el('modal-close').addEventListener('click', closeModal);
el('modal-overlay').addEventListener('click', e => {
  if (e.target === el('modal-overlay')) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

el('btn-retry').addEventListener('click', loadReleases);

el('nav-toggle').addEventListener('click', () => {
  document.querySelector('.nav').classList.toggle('open');
});

el('footer-year').textContent = new Date().getFullYear();

// ── Merch Rendering ───────────────────────────────────────────────────────────
function renderMerch(items) {
  const grid = el('merch-grid');
  if (!grid) return;
  if (!items.length) {
    grid.innerHTML = '<p class="feed-empty">No merch available right now.</p>';
    return;
  }
  grid.innerHTML = items.map(m => `
    <article class="merch-card">
      <div class="merch-image-wrap">
        ${m.image ? `<img src="${m.image}" class="merch-image" loading="lazy" />` : ''}
      </div>
      <div class="merch-info">
        <p class="merch-type">${m.type || ''}</p>
        <h3 class="merch-title">${m.title}</h3>
        <p class="merch-price">${m.price || ''}</p>
        <div class="merch-tags">
          ${(m.sizes || []).map(s => `<span class="merch-tag">${s}</span>`).join('')}
          ${(m.colors || []).map(c => `<span class="merch-tag">${c}</span>`).join('')}
        </div>
        <a href="${m.link || '#'}" target="_blank" rel="noopener" class="btn-primary" style="margin-top:auto;text-align:center;">BUY NOW</a>
      </div>
    </article>
  `).join('');
}

// ── Events Rendering ──────────────────────────────────────────────────────────
function renderEvents(items) {
  const list = el('events-list');
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<p class="feed-empty">No upcoming events.</p>';
    return;
  }
  
  const sorted = items.sort((a,b) => new Date(a.date) - new Date(b.date));
  
  list.innerHTML = sorted.map(e => {
    const d = new Date(e.date);
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    return `
      <div class="event-card">
        <div class="event-date-box">
          <span class="event-day">${day}</span>
          <span class="event-month">${month}</span>
        </div>
        <div class="event-details">
          <p class="event-location">${e.location || ''}</p>
          <h3 class="event-title">${e.title}</h3>
          <p class="event-lineup">${e.lineup || ''}</p>
        </div>
        <div class="event-actions">
          ${e.link ? `<a href="${e.link}" target="_blank" rel="noopener" class="btn-tickets">GET TICKETS</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ── Router ────────────────────────────────────────────────────────────────────
function handleRoute() {
  const path = window.location.pathname;
  const sections = {
    '/': ['hero', 'releases', 'about'],
    '/releases': ['hero', 'releases', 'about'],
    '/merch': ['merch'],
    '/events': ['events'],
    '/demos': ['demos'],
    '/about': ['about']
  };

  const toShow = sections[path] || sections['/'];

  // Hide all main sections first
  ['hero', 'releases', 'merch', 'events', 'demos', 'about'].forEach(id => {
    const elId = el(id);
    if (elId) {
      // Don't hide if it's supposed to be visible AND enabled in settings
      // We will handle settings visibility in boot()
      elId.classList.add('hidden');
    }
  });

  // Show the ones for this route
  toShow.forEach(id => {
    const elId = el(id);
    if (elId) elId.classList.remove('hidden');
  });

  // Subpage header styling
  const header = el('site-header');
  if (path !== '/' && path !== '/releases') {
    header.classList.add('visible', 'subpage-header');
    document.body.classList.add('subpage-active');
    window.scrollTo(0, 0);
  } else {
    header.classList.remove('subpage-header');
    document.body.classList.remove('subpage-active');
    // Scroll handling is done by initScrollHeader
  }
}

// Intercept link clicks for SPA feel
document.addEventListener('click', e => {
  const link = e.target.closest('a[data-link]');
  if (link) {
    e.preventDefault();
    const href = link.getAttribute('href');
    if (window.location.pathname !== href) {
      window.history.pushState({}, '', href);
      handleRoute();
      // Close mobile menu if open
      document.querySelector('.nav').classList.remove('open');
    }
  }
});

window.addEventListener('popstate', handleRoute);

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  // 1. Settings
  let settings = {};
  try {
    if (STATIC) {
      // Modo estático: settings embebidos
      settings = window.__STATIC_DATA.settings || {};
    } else {
      // Modo local: API REST
      const setRes = await fetch(`${API}/settings`);
      settings = await setRes.json();
    }
    settings.showDemos = true; // Permanent section

    if (settings.showMerch) {
      el('nav-merch').classList.remove('hidden');
      if (STATIC) {
        renderMerch(window.__STATIC_DATA.merch || []);
      } else {
        fetch(`${API}/merch`).then(r => r.json()).then(renderMerch);
      }
    }

    if (settings.showEvents) {
      el('nav-events').classList.remove('hidden');
      if (STATIC) {
        renderEvents(window.__STATIC_DATA.events || []);
      } else {
        fetch(`${API}/events`).then(r => r.json()).then(renderEvents);
      }
    }

    if (settings.showDemos) {
      el('nav-demos').classList.remove('hidden');
      el('btn-demo-mail').href = `mailto:${settings.demoEmail || 'demos@rowanunderground.com'}`;
    }
  } catch (err) { console.error('[APP] Settings error:', err); }

  // 2. Releases
  loadReleases();

  // 3. Routing (Applies visibility based on path, respecting if they are disabled)
  handleRoute();

  // Re-hide sections if they are disabled in settings (to override router defaults)
  if (!settings.showMerch) el('merch').classList.add('hidden');
  if (!settings.showEvents) el('events').classList.add('hidden');
  if (!settings.showDemos) el('demos').classList.add('hidden');
}

boot();
