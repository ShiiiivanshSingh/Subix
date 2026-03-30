const API_KEY = 'c6b726fe9a732169ca92e254b03f98ea';
const IMG_BASE = 'https://image.tmdb.org/t/p/';
const qInput = document.getElementById('query');
const sugBox = document.getElementById('suggestions');
let timer, activeIdx = -1, suggestions = [];
let allImages = [], lbPosters = [], lbIdx = 0, currentFilter = 'all';

const langLabels = {en:'English',ja:'Japanese',ko:'Korean',fr:'French',de:'German',es:'Spanish',pt:'Portuguese',ru:'Russian',zh:'Chinese',it:'Italian',hi:'Hindi',tr:'Turkish',xx:'No Lang',ar:'Arabic',pl:'Polish',nl:'Dutch',sv:'Swedish',da:'Danish',nb:'Norwegian',fi:'Finnish',id:'Indonesian',th:'Thai'};

qInput.addEventListener('input', () => {
  clearTimeout(timer);
  const q = qInput.value.trim();
  if (q.length < 2) { hideSug(); return; }
  timer = setTimeout(() => fetchSug(q), 260);
});

qInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
  else if (e.key === 'Enter') { e.preventDefault(); if (activeIdx >= 0 && suggestions[activeIdx]) pick(suggestions[activeIdx]); else searchTop(); }
  else if (e.key === 'Escape') hideSug();
});

document.addEventListener('click', e => { if (!e.target.closest('.search-outer')) hideSug(); });

function moveActive(dir) {
  const items = sugBox.querySelectorAll('.sug-item');
  if (!items.length) return;
  items[activeIdx]?.classList.remove('active');
  activeIdx = (activeIdx + dir + items.length) % items.length;
  items[activeIdx].classList.add('active');
  qInput.value = suggestions[activeIdx].title;
}

async function fetchSug(q) {
  try {
    const r = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(q)}&language=en-US`);
    const d = await r.json();
    suggestions = (d.results || []).slice(0, 7);
    renderSug();
  } catch {}
}

function renderSug() {
  if (!suggestions.length) { hideSug(); return; }
  activeIdx = -1;
  sugBox.innerHTML = suggestions.map((m, i) => {
    const thumb = m.poster_path ? `<img class="sug-thumb" src="${IMG_BASE}w92${m.poster_path}" alt="">` : `<div class="sug-no-thumb">🎬</div>`;
    const year = m.release_date ? m.release_date.slice(0, 4) : '';
    return `<div class="sug-item" data-i="${i}">${thumb}<div class="sug-info"><div class="sug-title">${m.title}</div><div class="sug-year">${year}</div></div></div>`;
  }).join('');
  sugBox.style.display = 'block';
  sugBox.querySelectorAll('.sug-item').forEach(el => {
    el.addEventListener('mousedown', e => { e.preventDefault(); pick(suggestions[+el.dataset.i]); });
  });
}

function hideSug() { sugBox.style.display = 'none'; activeIdx = -1; }
function pick(m) { qInput.value = m.title; hideSug(); renderMovie(m); fetchPosters(m.id); fetchSimilar(m.id); }

async function searchTop() {
  const q = qInput.value.trim();
  hideSug();
  if (!q) return;
  setLoading(true); setError('');
  document.getElementById('result').style.display = 'none';
  try {
    const r = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(q)}&language=en-US`);
    const d = await r.json();
    if (!d.results?.length) { setError('No movies found. Try a different title.'); return; }
    const m = d.results[0];
    renderMovie(m); fetchPosters(m.id); fetchSimilar(m.id);
  } catch { setError('Something went wrong. Check your connection.'); }
  finally { setLoading(false); }
}

function renderMovie(m) {
  const poster = m.poster_path
    ? `<img src="${IMG_BASE}w342${m.poster_path}" alt="${m.title} poster" onload="this.closest('.poster-wrap').classList.add('loaded')">`
    : `<div class="no-poster">No Poster</div>`;
  const year = m.release_date ? m.release_date.slice(0, 4) : '—';
  const rating = m.vote_average ? m.vote_average.toFixed(1) : '—';
  const subUrl = `https://subdl.com/search/${encodeURIComponent(m.title)}`;
  const downloadUrl = `https://cinesrc.st/download/movie/${m.id}`;
  const res = document.getElementById('result');
  res.innerHTML = `
    <div class="card">
      <div class="poster-wrap">${poster}</div>
      <div class="info">
        <div class="movie-title">${m.title}</div>
        <div class="year">${year}</div>
        <div class="overview">${m.overview || 'No description available.'}</div>
        <div class="meta-row">
          <div class="meta-item"><span class="meta-label">TMDB ID</span><span class="meta-value">${m.id}</span></div>
          <div class="meta-item"><span class="meta-label">Rating</span><span class="meta-value">⭐ ${rating}/10</span></div>
          <div class="meta-item"><span class="meta-label">Votes</span><span class="meta-value">${m.vote_count?.toLocaleString() ?? '—'}</span></div>
        </div>
        <div class="actions">
          <a class="btn-subtitle" href="${subUrl}" target="_blank">🎬 Subtitles</a>
          <a class="btn-download" href="${downloadUrl}" target="_blank">⬇ Download</a>
          <a class="btn-tmdb" href="https://www.themoviedb.org/movie/${m.id}" target="_blank">TMDB ↗</a>
        </div>
      </div>
    </div>
    <div class="section-box">
      <div class="section-header" onclick="toggleSection('similar-body','similar-toggle')">
        <h3>🎞 Similar Movies <span class="badge" id="similar-count">Loading…</span></h3>
        <span class="section-toggle" id="similar-toggle">▼</span>
      </div>
      <div class="section-body" id="similar-body" style="display:none">
        <div class="section-loading"><span class="spinner"></span>Finding similar movies…</div>
      </div>
    </div>
    <div class="section-box">
      <div class="section-header" onclick="toggleSection('gallery-body','gallery-toggle')">
        <h3>🖼 All Posters &amp; Images <span class="badge" id="poster-count">Loading…</span></h3>
        <span class="section-toggle open" id="gallery-toggle">▼</span>
      </div>
      <div class="section-body" id="gallery-body">
        <div class="skeleton-grid">${Array.from({length:9},(_,i)=>`<div class="skeleton-item${i%4===0?' is-bd':''}"><div class="skel skel-img"></div></div>`).join('')}</div>
      </div>
    </div>`;
  res.style.display = 'flex';
}

async function fetchSimilar(movieId) {
  try {
    const r = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/similar?api_key=${API_KEY}&language=en-US&page=1`);
    const d = await r.json();
    const movies = (d.results || []).slice(0, 18);
    const countEl = document.getElementById('similar-count');
    if (countEl) countEl.textContent = `${movies.length} movies`;
    renderSimilar(movies);
  } catch {
    const b = document.getElementById('similar-body');
    if (b) b.innerHTML = '<div class="section-loading">Failed to load similar movies.</div>';
  }
}

function renderSimilar(movies) {
  const body = document.getElementById('similar-body');
  if (!body) return;
  if (!movies.length) { body.innerHTML = '<div class="section-loading">No similar movies found.</div>'; return; }
  body.innerHTML = `<div class="similar-grid">${movies.map(m => {
    const year = m.release_date ? m.release_date.slice(0,4) : '';
    const rating = m.vote_average ? m.vote_average.toFixed(1) : '';
    const img = m.poster_path ? `<img src="${IMG_BASE}w185${m.poster_path}" alt="${m.title}" loading="lazy">` : `<div class="similar-no-img">🎬</div>`;
    return `<div class="similar-item" onclick="loadMovie(${m.id})" title="${m.title}">${img}${rating?`<div class="similar-rating">⭐ ${rating}</div>`:''}<div class="similar-info"><div class="similar-title">${m.title}</div><div class="similar-year">${year}</div></div></div>`;
  }).join('')}</div>`;
}

async function loadMovie(id) {
  setLoading(true);
  window.scrollTo({top:0,behavior:'smooth'});
  try {
    const r = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEY}&language=en-US`);
    const m = await r.json();
    qInput.value = m.title;
    renderMovie(m); fetchPosters(m.id); fetchSimilar(m.id);
  } catch { setError('Could not load movie.'); }
  finally { setLoading(false); }
}

async function fetchPosters(movieId) {
  try {
    const r = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/images?api_key=${API_KEY}`);
    const d = await r.json();
    const posters = (d.posters || []).map(p => ({...p, type:'poster'}));
    const backdrops = (d.backdrops || []).map(p => ({...p, type:'backdrop'}));
    allImages = [...posters, ...backdrops];
    const countEl = document.getElementById('poster-count');
    if (countEl) countEl.textContent = `${allImages.length} images`;
    currentFilter = 'all';
    renderGallery('all');
  } catch {
    const b = document.getElementById('gallery-body');
    if (b) b.innerHTML = '<div class="section-loading">Failed to load images.</div>';
  }
}

function getFiltered(filter) {
  if (filter === 'all') return allImages;
  if (filter === 'poster') return allImages.filter(p => p.type === 'poster');
  if (filter === 'backdrop') return allImages.filter(p => p.type === 'backdrop');
  return allImages.filter(p => (p.iso_639_1 || 'xx') === filter);
}

function renderGallery(filter) {
  currentFilter = filter;
  const body = document.getElementById('gallery-body');
  if (!body || !allImages.length) { if(body) body.innerHTML = '<div class="section-loading">No images available.</div>'; return; }
  const filtered = getFiltered(filter);
  const langs = [...new Set(allImages.map(p => p.iso_639_1 || 'xx'))].sort();
  const filterHTML = `<div class="gallery-filters">
    <button class="filter-btn ${filter==='all'?'active':''}" onclick="renderGallery('all')">All (${allImages.length})</button>
    <button class="filter-btn ${filter==='poster'?'active':''}" onclick="renderGallery('poster')">Posters (${allImages.filter(p=>p.type==='poster').length})</button>
    <button class="filter-btn ${filter==='backdrop'?'active':''}" onclick="renderGallery('backdrop')">Backdrops (${allImages.filter(p=>p.type==='backdrop').length})</button>
    ${langs.map(l=>`<button class="filter-btn ${filter===l?'active':''}" onclick="renderGallery('${l}')">${langLabels[l]||l.toUpperCase()} (${allImages.filter(p=>(p.iso_639_1||'xx')===l).length})</button>`).join('')}
  </div>`;
  const gridHTML = `<div class="masonry-grid">${filtered.map((p,i)=>{
    const isBackdrop = p.type==='backdrop';
    const thumb = isBackdrop ? `${IMG_BASE}w780${p.file_path}` : `${IMG_BASE}w500${p.file_path}`;
    const orig = `${IMG_BASE}original${p.file_path}`;
    const res = p.width&&p.height ? `${p.width}×${p.height}` : '';
    const lang = p.iso_639_1 ? (langLabels[p.iso_639_1]||p.iso_639_1.toUpperCase()) : '';
    const meta = [lang,res].filter(Boolean).join(' · ');
    return `<div class="masonry-item ${isBackdrop ? 'is-backdrop' : ''}" onclick="openLightbox(${i},'${filter}')"><img src="${thumb}" alt="image" loading="lazy"/><div class="poster-overlay"><div class="overlay-meta">${meta}</div><div class="overlay-btns"><a class="btn-dl" href="${orig}" download="${p.file_path.replace(/\//g,'')}" target="_blank" onclick="event.stopPropagation()">⬇ Download 4K</a></div></div></div>`;
  }).join('')}</div>`;
  body.innerHTML = filterHTML + gridHTML;
}

function openLightbox(idx, filter) {
  lbPosters = getFiltered(filter);
  lbIdx = idx;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
  updateLightbox();
}

function updateLightbox() {
  const p = lbPosters[lbIdx];
  const preview = p.type==='poster' ? `${IMG_BASE}w780${p.file_path}` : `${IMG_BASE}w1280${p.file_path}`;
  const orig = `${IMG_BASE}original${p.file_path}`;
  const res = p.width&&p.height ? `${p.width} × ${p.height} px` : '';
  const lang = p.iso_639_1 ? (langLabels[p.iso_639_1]||p.iso_639_1.toUpperCase()) : '';
  const lbImg = document.getElementById('lb-img');
  const lbSpinner = document.getElementById('lb-spinner');
  lbImg.style.opacity = '0';
  lbSpinner.style.display = 'flex';
  const img = new Image();
  img.onload = () => {
    lbImg.src = preview;
    lbImg.style.opacity = '1';
    lbSpinner.style.display = 'none';
  };
  img.src = preview;
  document.getElementById('lb-dl').href = orig;
  document.getElementById('lb-dl').setAttribute('download', p.file_path.replace(/\//g,''));
  document.getElementById('lb-meta').textContent = [lang,res,`${lbIdx+1} / ${lbPosters.length}`].filter(Boolean).join('  ·  ');
}

function lbNav(dir) { lbIdx=(lbIdx+dir+lbPosters.length)%lbPosters.length; updateLightbox(); }
function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); document.body.style.overflow=''; }
function closeLightboxBg(e) { if(e.target===document.getElementById('lightbox')) closeLightbox(); }

document.addEventListener('keydown', e => {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  if (e.key==='ArrowRight') lbNav(1);
  else if (e.key==='ArrowLeft') lbNav(-1);
  else if (e.key==='Escape') closeLightbox();
});

function toggleSection(bodyId, toggleId) {
  const body=document.getElementById(bodyId), toggle=document.getElementById(toggleId);
  if(!body||!toggle) return;
  const open=body.style.display==='none';
  body.style.display=open?'block':'none';
  toggle.classList.toggle('open',open);
}

function setLoading(v) { document.getElementById('loading').style.display=v?'block':'none'; }
function setError(msg) { const e=document.getElementById('error'); e.textContent=msg; e.style.display=msg?'block':'none'; }

function toggleDrawer() {
  const drawer=document.getElementById('drawer');
  const overlay=document.getElementById('drawer-overlay');
  const hamburger=document.getElementById('hamburger');
  const open=drawer.classList.contains('open');
  drawer.classList.toggle('open',!open);
  overlay.classList.toggle('open',!open);
  hamburger.classList.toggle('open',!open);
  document.body.style.overflow=open?'':'hidden';
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
  document.body.style.overflow='';
}

document.addEventListener('keydown', e => { if(e.key==='Escape') closeDrawer(); }, true);

const SUGGESTED = [
  "Sleepless in Seattle",
  "A Girl Walks Home Alone at Night", "Magnolia",
  "Portrait of a Lady on Fire", "My Night at Maud's", "Petite Maman", "The Apartment",
  "Adventures in Babysitting", "Y Tu Mamá También",
  "When Harry Met Sally", "Mulholland Drive",
  "Groundhog Day", "Amélie", "One Battle After Another",
  "Tees Maar Khan", "The Moment"
];

const CHIP_COLORS = ['var(--yellow)','var(--accent)','var(--accent2)','var(--green)','var(--orange)','var(--pink)'];

async function loadSuggestedShelf() {
  const track = document.getElementById('shelf-track');
  if (!track) return;
  track.innerHTML = SUGGESTED.map((title, i) => {
    const color = CHIP_COLORS[i % CHIP_COLORS.length];
    const textColor = (color === 'var(--yellow)' || color === 'var(--green)') ? 'var(--text)' : 'var(--white)';
    return `<div class="shelf-chip" data-title="${title}" onclick="pickSuggested('${title.replace(/'/g,"\\'")}',this)" style="--chip-bg:${color};--chip-color:${textColor}">
      <div class="chip-poster chip-poster-loading"></div>
      <div class="chip-title">${title}</div>
    </div>`;
  }).join('');

  SUGGESTED.forEach(async (title, i) => {
    try {
      const r = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(title)}&language=en-US`);
      const d = await r.json();
      const movie = d.results?.[0];
      if (!movie?.poster_path) return;
      const chip = track.querySelectorAll('.shelf-chip')[i];
      if (!chip) return;
      const posterEl = chip.querySelector('.chip-poster');
      posterEl.classList.remove('chip-poster-loading');
      posterEl.style.backgroundImage = `url(${IMG_BASE}w185${movie.poster_path})`;
      chip.dataset.id = movie.id;
    } catch {}
  });
}

function pickSuggested(title) {
  qInput.value = title;
  hideSuggested();
  searchTop();
}

function hideSuggested() {
  const shelf = document.getElementById('suggested-shelf');
  if (shelf) shelf.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => { loadSuggestedShelf(); });

const __renderMovie = window.renderMovie;
window.renderMovie = function(m) {
  hideSuggested();
  __renderMovie(m);
};

const titleColors = [
  { text: '#0a0a0a' },
  { text: '#ff3f3f' },
  { text: '#3d5aff' },
  { text: '#00c27a' },
  { text: '#ff7a1a' },
  { text: '#ff5edb' },
  { text: '#ffe135' },
];
let titleColorIdx = 0;
document.querySelector('header h1').addEventListener('click', function() {
  titleColorIdx = (titleColorIdx + 1) % titleColors.length;
  this.style.color = titleColors[titleColorIdx].text;
  this.style.textShadow = 'none';
});