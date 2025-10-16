
const state = {
  adult: false,
  q: ""
};

const baseRecipes = Array.isArray(window.__RECIPES__) ? window.__RECIPES__ : [];
let customRecipes = [];
let baseEdits = {};
let baseDeletedIds = new Set();
let recipes = [];
const CUSTOM_KEY = 'customRecipes';
const BASE_EDIT_KEY = 'baseRecipeEdits';
const BASE_DELETE_KEY = 'baseRecipeDeleted';
const ING_PLACEHOLDER = 'e.g. 12 oz Diet Coke';
const METHOD_PLACEHOLDER = 'e.g. Pour over pebble ice';

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
const updateAppBtn = document.getElementById('updateAppBtn');

let htmlToImageLoader = null;

let lastFocus = null;
let editingRecipeId = null;
let editingRecipeSource = null;
let editingRecipeData = null;

function normalizeRecipeData(data, source) {
  if (!data || typeof data !== 'object') return null;
  const recipe = { ...data };
  recipe.id = data.id;
  if (!recipe.id) return null;
  recipe.name = typeof data.name === 'string' ? data.name : '';
  recipe.tags = Array.isArray(data.tags) ? data.tags.map(t => String(t)) : [];
  recipe.ingredients = Array.isArray(data.ingredients) ? data.ingredients.map(i => String(i)) : [];
  recipe.method = Array.isArray(data.method) ? data.method.map(m => String(m)) : [];
  recipe.notes = typeof data.notes === 'string' ? data.notes : (data.notes ? String(data.notes) : '');
  if (data.adult_variant && typeof data.adult_variant === 'object') {
    recipe.adult_variant = {
      ...data.adult_variant,
      name: typeof data.adult_variant.name === 'string' ? data.adult_variant.name : '',
      extra: Array.isArray(data.adult_variant.extra) ? data.adult_variant.extra.map(e => String(e)) : [],
      note: typeof data.adult_variant.note === 'string' ? data.adult_variant.note : (data.adult_variant.note ? String(data.adult_variant.note) : ''),
    };
  } else {
    delete recipe.adult_variant;
  }
  if (source) {
    recipe.source = source;
  } else {
    delete recipe.source;
  }
  return recipe;
}

function rebuildRecipes() {
  const baseList = [];
  baseRecipes.forEach((r) => {
    if (!r || typeof r !== 'object') return;
    if (baseDeletedIds.has(r.id)) return;
    const override = baseEdits[r.id];
    const data = override ? { ...override } : { ...r };
    data.id = r.id;
    const normalized = normalizeRecipeData(data, 'base');
    if (normalized) {
      normalized.tags = normalized.tags.length ? normalized.tags : [];
      baseList.push(normalized);
    }
  });

  const customList = customRecipes
    .map(r => (r && typeof r === 'object' ? normalizeRecipeData({ ...r }, 'custom') : null))
    .filter(Boolean);

  recipes = [...baseList, ...customList];
}

function loadCustomRecipes() {
  try {
    const stored = localStorage.getItem(CUSTOM_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        customRecipes = parsed
          .filter(r => r && typeof r === 'object')
          .map(r => normalizeRecipeData(r))
          .filter(Boolean);
      }
    }
  } catch (err) {
    // ignore storage errors
  }
}

function persistCustomRecipes() {
  try {
    const toStore = customRecipes.map(r => {
      const copy = { ...r };
      delete copy.source;
      return copy;
    });
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(toStore));
  } catch (err) {
    // ignore storage issues
  }
}

function loadBaseOverrides() {
  baseEdits = {};
  baseDeletedIds = new Set();
  try {
    const storedEdits = localStorage.getItem(BASE_EDIT_KEY);
    if (storedEdits) {
      const parsed = JSON.parse(storedEdits);
      if (parsed && typeof parsed === 'object') {
        Object.keys(parsed).forEach((id) => {
          const value = normalizeRecipeData({ ...parsed[id], id });
          if (value) {
            delete value.source;
            baseEdits[id] = value;
          }
        });
      }
    }
    const storedDeletes = localStorage.getItem(BASE_DELETE_KEY);
    if (storedDeletes) {
      const parsedDeletes = JSON.parse(storedDeletes);
      if (Array.isArray(parsedDeletes)) {
        baseDeletedIds = new Set(parsedDeletes.filter(Boolean));
      }
    }
  } catch (err) {
    baseEdits = {};
    baseDeletedIds = new Set();
  }
}

function persistBaseOverrides() {
  try {
    const editsToStore = {};
    Object.keys(baseEdits).forEach((id) => {
      const edit = baseEdits[id];
      if (edit && typeof edit === 'object') {
        const copy = { ...edit };
        delete copy.source;
        editsToStore[id] = copy;
      }
    });
    localStorage.setItem(BASE_EDIT_KEY, JSON.stringify(editsToStore));
    localStorage.setItem(BASE_DELETE_KEY, JSON.stringify(Array.from(baseDeletedIds)));
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

function populateList(listEl, placeholder, values = []) {
  if (!listEl) return;
  listEl.innerHTML = '';
  const items = Array.isArray(values) && values.length ? values : [''];
  items.forEach((value) => {
    const li = document.createElement('li');
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    input.value = value || '';
    li.appendChild(input);
    listEl.appendChild(li);
  });
}

function seedList(listEl, placeholder) {
  populateList(listEl, placeholder, []);
}

function getListValues(listEl) {
  if (!listEl) return [];
  return Array.from(listEl.querySelectorAll('input'))
    .map(input => input.value.trim())
    .filter(Boolean);
}

function setFormValues(recipe) {
  if (!customRecipeForm) return;
  customRecipeForm.reset();
  const formElements = customRecipeForm.elements;
  const nameInput = formElements.namedItem('name');
  const tagsField = formElements.namedItem('tags');
  const notesField = formElements.namedItem('notes');
  const spicedField = formElements.namedItem('spiced');

  if (recipe) {
    customRecipeForm.dataset.mode = 'edit';
    if (nameInput) nameInput.value = recipe.name || '';
    if (tagsField) tagsField.value = Array.isArray(recipe.tags) ? recipe.tags.join(', ') : '';
    populateList(ingredientList, ING_PLACEHOLDER, recipe.ingredients);
    populateList(methodList, METHOD_PLACEHOLDER, recipe.method);
    if (notesField) notesField.value = recipe.notes || '';
    if (spicedField) spicedField.value = Array.isArray(recipe.adult_variant?.extra) ? recipe.adult_variant.extra.join(', ') : '';
  } else {
    customRecipeForm.dataset.mode = 'create';
    if (nameInput) nameInput.value = '';
    if (tagsField) tagsField.value = '';
    populateList(ingredientList, ING_PLACEHOLDER, []);
    populateList(methodList, METHOD_PLACEHOLDER, []);
    if (notesField) notesField.value = '';
    if (spicedField) spicedField.value = '';
  }
}

function openModal(recipe = null) {
  if (!recipeModal) return;
  editingRecipeId = recipe?.id || null;
  editingRecipeSource = recipe?.source || null;
  editingRecipeData = recipe ? JSON.parse(JSON.stringify(recipe)) : null;
  setFormValues(recipe);
  lastFocus = document.activeElement;
  recipeModal.hidden = false;
  document.body.classList.add('modal-open');
  const title = document.getElementById('recipeModalTitle');
  const submitBtn = customRecipeForm?.querySelector('button[type="submit"]');
  if (title) {
    title.textContent = recipe ? 'Edit Recipe' : 'Save Custom Recipe';
  }
  if (submitBtn) {
    submitBtn.textContent = recipe ? 'Update recipe' : 'Save recipe';
  }
  const nameInput = customRecipeForm?.querySelector('input[name="name"]');
  nameInput?.focus();
}

function closeModal() {
  if (!recipeModal) return;
  recipeModal.hidden = true;
  document.body.classList.remove('modal-open');
  customRecipeForm?.reset();
  seedList(ingredientList, ING_PLACEHOLDER);
  seedList(methodList, METHOD_PLACEHOLDER);
  customRecipeForm?.removeAttribute('data-mode');
  const title = document.getElementById('recipeModalTitle');
  if (title) {
    title.textContent = 'Save Custom Recipe';
  }
  const submitBtn = customRecipeForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = 'Save recipe';
  }
  editingRecipeId = null;
  editingRecipeSource = null;
  editingRecipeData = null;
  if (lastFocus) {
    lastFocus.focus();
  }
}

function loadHtmlToImage() {
  if (!htmlToImageLoader) {
    htmlToImageLoader = new Promise((resolve, reject) => {
      if (window.htmlToImage) {
        resolve(window.htmlToImage);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js';
      script.async = true;
      script.onload = () => {
        if (window.htmlToImage) {
          resolve(window.htmlToImage);
        } else {
          htmlToImageLoader = null;
          reject(new Error('Share helper unavailable'));
        }
      };
      script.onerror = () => {
        htmlToImageLoader = null;
        reject(new Error('Failed to load share helper'));
      };
      document.head.appendChild(script);
    });
  }
  return htmlToImageLoader;
}

async function shareRecipe(recipe, cardEl) {
  if (!navigator.share) {
    alert('Sharing is not supported on this device.');
    return;
  }
  let stagingArea;
  try {
    const htmlToImage = await loadHtmlToImage();
    const shareCard = cardEl.cloneNode(true);
    shareCard.style.margin = '0';
    const actions = shareCard.querySelector('.card-actions');
    actions?.remove();

    stagingArea = document.createElement('div');
    stagingArea.style.position = 'fixed';
    stagingArea.style.top = '-10000px';
    stagingArea.style.left = '-10000px';
    stagingArea.style.width = `${cardEl.offsetWidth || cardEl.getBoundingClientRect().width || 320}px`;
    stagingArea.style.zIndex = '-1';
    stagingArea.appendChild(shareCard);
    document.body.appendChild(stagingArea);

    const backgroundColor = getComputedStyle(document.body).backgroundColor || '#ffffff';
    const dataUrl = await htmlToImage.toPng(shareCard, {
      pixelRatio: Math.max(2, window.devicePixelRatio || 1),
      backgroundColor,
    });

    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const safeName = (recipe.name || 'recipe')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'recipe';
    const file = new File([blob], `${safeName}.png`, { type: 'image/png' });

    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      alert('Sharing is not supported on this device.');
      return;
    }

    await navigator.share({
      title: recipe.name || 'Soda Bar Recipe',
      text: recipe.notes ? `${recipe.name}\n${recipe.notes}` : recipe.name || '',
      files: [file],
    });
  } catch (err) {
    console.error('Share failed', err);
    alert('Sharing failed. Please try again later.');
  } finally {
    stagingArea?.remove();
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

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'card-action';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openModal(r));
    actions.appendChild(editBtn);

    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'card-action';
    shareBtn.textContent = 'Share';
    shareBtn.addEventListener('click', () => shareRecipe(r, card));
    actions.appendChild(shareBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'card-action danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => handleDelete(r));
    actions.appendChild(deleteBtn);

    card.appendChild(actions);

    elGrid.appendChild(card);
  });

  if (!filtered.length) {
    elGrid.innerHTML = '<p class="note">No matches. Try a different search.</p>';
  }
}

function handleDelete(recipe) {
  if (!recipe || !recipe.id) return;
  const isBase = recipe.source === 'base';
  const confirmMsg = isBase
    ? 'Delete this built-in recipe? Use Update Soda Bar later to restore the defaults.'
    : 'Delete this custom recipe?';
  if (!window.confirm(confirmMsg)) return;

  if (isBase) {
    baseDeletedIds.add(recipe.id);
    delete baseEdits[recipe.id];
    persistBaseOverrides();
  } else {
    const idx = customRecipes.findIndex(r => r.id === recipe.id);
    if (idx !== -1) {
      customRecipes.splice(idx, 1);
      persistCustomRecipes();
    }
  }

  rebuildRecipes();
  render();
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
  const spicedExtras = spiced ? spiced.split(',').map(s => s.trim()).filter(Boolean) : [];
  const isEditing = !!editingRecipeId;
  const recipeId = isEditing ? editingRecipeId : `custom-${Date.now()}`;
  const baseRecipe = {
    id: recipeId,
    name,
    tags,
    ingredients,
    method,
    notes,
  };

  if (spicedExtras.length) {
    const existingVariant = editingRecipeData?.adult_variant;
    baseRecipe.adult_variant = {
      name: `${name} — Spiced`,
      extra: spicedExtras,
      note: existingVariant?.note || '',
    };
  }

  if (isEditing && editingRecipeSource === 'base') {
    const stored = normalizeRecipeData(baseRecipe);
    if (stored) {
      delete stored.source;
      baseEdits[recipeId] = stored;
      persistBaseOverrides();
    }
  } else if (isEditing && editingRecipeSource === 'custom') {
    const stored = normalizeRecipeData(baseRecipe);
    if (stored) {
      delete stored.source;
      const idx = customRecipes.findIndex(r => r.id === recipeId);
      if (idx !== -1) {
        customRecipes[idx] = stored;
      }
      persistCustomRecipes();
    }
  } else {
    const stored = normalizeRecipeData(baseRecipe);
    if (stored) {
      delete stored.source;
      customRecipes.push(stored);
      persistCustomRecipes();
    }
  }

  rebuildRecipes();
  render();
  closeModal();
});

updateAppBtn?.addEventListener('click', async () => {
  if (updateAppBtn.disabled) return;
  const originalText = updateAppBtn.textContent;
  updateAppBtn.disabled = true;
  updateAppBtn.setAttribute('aria-busy', 'true');
  updateAppBtn.textContent = 'Updating…';
  try {
    try {
      localStorage.removeItem(BASE_EDIT_KEY);
      localStorage.removeItem(BASE_DELETE_KEY);
    } catch (storageErr) {
      console.warn('Unable to clear stored base recipes', storageErr);
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.update()));
    }
    window.location.reload();
  } catch (err) {
    console.error(err);
    alert('Unable to update right now. Please refresh manually.');
    updateAppBtn.disabled = false;
    updateAppBtn.textContent = originalText;
    updateAppBtn.removeAttribute('aria-busy');
  }
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
seedList(ingredientList, ING_PLACEHOLDER);
seedList(methodList, METHOD_PLACEHOLDER);
loadBaseOverrides();
loadCustomRecipes();
rebuildRecipes();
render();
