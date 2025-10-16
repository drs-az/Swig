
const state = {
  adult: false,
  q: ""
};

const baseRecipes = Array.isArray(window.__RECIPES__) ? window.__RECIPES__ : [];
let customRecipes = [];
let recipes = [...baseRecipes];
const CUSTOM_KEY = 'customRecipes';

const elGrid = document.getElementById('recipes');
const adultToggle = document.getElementById('adultToggle');
const searchInput = document.getElementById('searchInput');
const themeToggle = document.getElementById('themeToggle');
const metaTheme = document.querySelector('meta[name="theme-color"]');
const recipeModal = document.getElementById('recipeModal');
const openCustomRecipe = document.getElementById('openCustomRecipe');
const customRecipeForm = document.getElementById('customRecipeForm');
const ingredientList = document.getElementById('ingredientList');
const methodList = document.getElementById('methodList');
const addRowButtons = document.querySelectorAll('.add-row');

let lastFocus = null;

function rebuildRecipes() {
  recipes = [...baseRecipes, ...customRecipes];
}

function loadCustomRecipes() {
  try {
    const stored = localStorage.getItem(CUSTOM_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        customRecipes = parsed.filter(r => r && typeof r === 'object');
        rebuildRecipes();
      }
    }
  } catch (err) {
    // ignore storage errors
  }
}

function persistCustomRecipes() {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customRecipes));
  } catch (err) {
    // ignore storage issues
  }
}

function addListRow(listEl, placeholder, shouldFocus = true) {
  if (!listEl) return;
  const li = document.createElement('li');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  li.appendChild(input);
  listEl.appendChild(li);
  if (shouldFocus) {
    input.focus();
  }
}

function seedList(listEl, placeholder) {
  if (!listEl) return;
  listEl.innerHTML = '';
  addListRow(listEl, placeholder, false);
}

function getListValues(listEl) {
  if (!listEl) return [];
  return Array.from(listEl.querySelectorAll('input'))
    .map(input => input.value.trim())
    .filter(Boolean);
}

function openModal() {
  if (!recipeModal) return;
  lastFocus = document.activeElement;
  recipeModal.hidden = false;
  document.body.classList.add('modal-open');
  const nameInput = customRecipeForm?.querySelector('input[name="name"]');
  nameInput?.focus();
}

function closeModal() {
  if (!recipeModal) return;
  recipeModal.hidden = true;
  document.body.classList.remove('modal-open');
  customRecipeForm?.reset();
  seedList(ingredientList, 'e.g. 12 oz Diet Coke');
  seedList(methodList, 'e.g. Pour over pebble ice');
  if (lastFocus) {
    lastFocus.focus();
  }
}

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

openCustomRecipe?.addEventListener('click', (e) => {
  e.preventDefault();
  openModal();
});

recipeModal?.addEventListener('click', (e) => {
  if (e.target?.dataset?.close !== undefined) {
    closeModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !recipeModal?.hidden) {
    closeModal();
  }
});

addRowButtons?.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    if (!target) return;
    if (target === 'ingredientList') {
      addListRow(ingredientList, 'e.g. 1 Tbsp coconut syrup');
    } else if (target === 'methodList') {
      addListRow(methodList, 'e.g. Stir gently to combine');
    }
  });
});

customRecipeForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const nameInput = form.elements.namedItem('name');
  const name = nameInput?.value.trim() || '';
  if (!name) {
    nameInput?.focus();
    return;
  }

  const tagsField = form.elements.namedItem('tags');
  const tagsInput = tagsField?.value.trim() || '';
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];
  const ingredients = getListValues(ingredientList);
  if (!ingredients.length) {
    alert('Please add at least one ingredient.');
    ingredientList?.querySelector('input')?.focus();
    return;
  }
  const method = getListValues(methodList);
  if (!method.length) {
    alert('Please add at least one method step.');
    methodList?.querySelector('input')?.focus();
    return;
  }
  const notesField = form.elements.namedItem('notes');
  const notes = notesField?.value.trim() || '';
  const spicedField = form.elements.namedItem('spiced');
  const spiced = spicedField?.value.trim() || '';

  const recipe = {
    id: `custom-${Date.now()}`,
    name,
    tags,
    ingredients,
    method,
    notes,
  };

  if (spiced) {
    recipe.adult_variant = {
      name: `${name} — Spiced`,
      extra: [spiced],
      note: '',
    };
  }

  customRecipes.push(recipe);
  persistCustomRecipes();
  rebuildRecipes();
  render();
  closeModal();
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
seedList(ingredientList, 'e.g. 12 oz Diet Coke');
seedList(methodList, 'e.g. Pour over pebble ice');
loadCustomRecipes();
render();
