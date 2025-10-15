
const state = {
  adult: false,
  q: ""
};

const recipes = window.__RECIPES__;

const elGrid = document.getElementById('recipes');
const adultToggle = document.getElementById('adultToggle');
const searchInput = document.getElementById('searchInput');
const themeToggle = document.getElementById('themeToggle');
const metaTheme = document.querySelector('meta[name="theme-color"]');

function setTheme(isDark) {
  document.body.classList.toggle('theme-dark', isDark);
  if (themeToggle) {
    themeToggle.checked = isDark;
  }
  if (metaTheme) {
    metaTheme.setAttribute('content', isDark ? '#0e0e0f' : '#ffffff');
  }
  try {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  } catch (err) {
    // ignore storage issues
  }
}

function initTheme() {
  let useDark = false;
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') useDark = true;
  } catch (err) {
    // storage unavailable, leave default light
  }
  setTheme(useDark);
}

function render() {
  const q = state.q.trim().toLowerCase();
  const filtered = recipes.filter(r => {
    const hay = (r.name + ' ' + (r.notes||'') + ' ' + r.ingredients.join(' ')).toLowerCase();
    return !q || hay.includes(q);
  });

  elGrid.innerHTML = '';
  filtered.forEach(r => {
    const card = document.createElement('article');
    card.className = 'card';

    const title = document.createElement('h3');
    title.textContent = r.name;
    card.appendChild(title);

    // Badges
    const badges = document.createElement('div');
    badges.className = 'badges';
    r.tags?.forEach(t => {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = t;
      badges.appendChild(b);
    });
    if (badges.children.length) card.appendChild(badges);

    // Ingredients
    const ingTitle = document.createElement('div');
    ingTitle.className = 'section-title';
    ingTitle.textContent = 'Ingredients';
    card.appendChild(ingTitle);
    const ulIng = document.createElement('ul');
    r.ingredients.forEach(i => {
      const li = document.createElement('li');
      li.textContent = i;
      ulIng.appendChild(li);
    });
    card.appendChild(ulIng);

    // Method
    const mTitle = document.createElement('div');
    mTitle.className = 'section-title';
    mTitle.textContent = 'Method';
    card.appendChild(mTitle);
    const ulM = document.createElement('ul');
    r.method.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step;
      ulM.appendChild(li);
    });
    card.appendChild(ulM);

    // Notes
    if (r.notes) {
      const note = document.createElement('div');
      note.className = 'note';
      note.textContent = r.notes;
      card.appendChild(note);
    }

    // Adult Variant
    if (state.adult && r.adult_variant) {
      const aTitle = document.createElement('div');
      aTitle.className = 'section-title';
      aTitle.textContent = 'Adult Variant';
      card.appendChild(aTitle);

      const av = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = r.adult_variant.name + ': ';
      av.appendChild(name);

      const extra = document.createElement('span');
      extra.textContent = (r.adult_variant.extra || []).join(', ');
      av.appendChild(extra);

      const note = document.createElement('div');
      note.className = 'note';
      note.textContent = r.adult_variant.note || '';
      card.appendChild(av);
      card.appendChild(note);
    }

    elGrid.appendChild(card);
  });

  if (!filtered.length) {
    elGrid.innerHTML = '<p class="note">No matches. Try a different search.</p>';
  }
}

adultToggle?.addEventListener('change', (e) => {
  state.adult = !!e.target.checked;
  render();
});
searchInput?.addEventListener('input', (e) => {
  state.q = e.target.value;
  render();
});
themeToggle?.addEventListener('change', (e) => {
  setTheme(!!e.target.checked);
});

// PWA install
let deferredPrompt;
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}

// Initial render
initTheme();
render();
