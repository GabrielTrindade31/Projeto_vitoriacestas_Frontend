const API_BASE =
  window.APP_API_BASE ||
  (window.location.hostname.includes('vercel.app')
    ? '/api'
    : 'https://projeto-vitoriacestas-backend.vercel.app/api');
const DOCS_URL = `${API_BASE.replace(/\/api$/, '')}/docs`;
const storageKey = 'vitoriacestas_token';

const state = {
  token: localStorage.getItem(storageKey),
};

const elements = {
  loginForm: document.getElementById('loginForm'),
  loginCard: document.getElementById('loginCard'),
  primaryLoginBtn: document.getElementById('primaryLoginBtn'),
  docsBtn: document.getElementById('docsBtn'),
  authStatus: document.getElementById('authStatus'),
  dashboard: document.getElementById('dashboard'),
  itemsList: document.getElementById('itemsList'),
  suppliersList: document.getElementById('suppliersList'),
  refreshItems: document.getElementById('refreshItems'),
  refreshSuppliers: document.getElementById('refreshSuppliers'),
  openItemForm: document.getElementById('openItemForm'),
  openSupplierForm: document.getElementById('openSupplierForm'),
  itemDialog: document.getElementById('itemDialog'),
  supplierDialog: document.getElementById('supplierDialog'),
  itemForm: document.getElementById('itemForm'),
  supplierForm: document.getElementById('supplierForm'),
  toast: document.getElementById('toast'),
};

function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.style.borderColor = type === 'error' ? '#ef4444' : '#1f2937';
  elements.toast.classList.add('toast--visible');
  setTimeout(() => elements.toast.classList.remove('toast--visible'), 2200);
}

function setToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem(storageKey, token);
  } else {
    localStorage.removeItem(storageKey);
  }
  syncAuthState();
}

function syncAuthState() {
  const authenticated = Boolean(state.token);
  elements.authStatus.textContent = authenticated ? 'Autenticado' : 'Não autenticado';
  elements.authStatus.style.background = authenticated
    ? 'rgba(15, 157, 88, 0.16)'
    : 'rgba(15, 23, 42, 0.06)';
  elements.dashboard.hidden = !authenticated;
  if (!authenticated) {
    elements.itemsList.textContent = 'Faça login para carregar os itens.';
    elements.suppliersList.textContent = 'Faça login para carregar os fornecedores.';
  }
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    throw new Error('Resposta inesperada do servidor. Tente novamente.');
  }
  if (!res.ok) {
    throw new Error(data.message || 'Erro ao processar requisição');
  }
  return data;
}

function renderList(container, items, type) {
  if (!items || items.length === 0) {
    container.textContent = 'Nenhum registro encontrado.';
    return;
  }

  container.innerHTML = '';
  items.slice(-5).reverse().forEach((item) => {
    const div = document.createElement('div');
    div.className = 'list__item';
    if (type === 'item') {
      div.innerHTML = `<strong>${item.nome}</strong><small>${item.codigo}</small><span class="muted">Qtd: ${item.quantidade} • Preço: R$ ${Number(item.preco || 0).toFixed(2)}</span>`;
    } else {
      div.innerHTML = `<strong>${item.razaoSocial || item.nome}</strong><span class="muted">Contato: ${item.contato || 'N/D'} • Email: ${item.email || 'N/D'}</span>`;
    }
    container.appendChild(div);
  });
}

async function loadItems() {
  try {
    const { data } = await request('/items');
    renderList(elements.itemsList, data, 'item');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadSuppliers() {
  try {
    const { data } = await request('/suppliers');
    renderList(elements.suppliersList, data, 'supplier');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function openDialog(dialog) {
  dialog.showModal();
}

function closeDialog(dialog) {
  dialog.close();
}

function serializeForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function handleLogin(event) {
  event.preventDefault();
  const payload = serializeForm(elements.loginForm);
  try {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const token = data.accessToken || data.token;
    if (token) {
      setToken(token);
      showToast('Login realizado com sucesso!');
      await Promise.all([loadItems(), loadSuppliers()]);
    } else {
      showToast('Token não retornado pela API.', 'error');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleItemSubmit(event) {
  event.preventDefault();
  const form = elements.itemForm;
  const payload = serializeForm(form);
  if (payload.quantidade < 0 || payload.preco < 0) {
    showToast('Quantidade e preço devem ser positivos.', 'error');
    return;
  }
  payload.quantidade = Number(payload.quantidade);
  payload.preco = Number(payload.preco);

  try {
    await request('/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast('Item cadastrado com sucesso!');
    form.reset();
    closeDialog(elements.itemDialog);
    loadItems();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleSupplierSubmit(event) {
  event.preventDefault();
  const form = elements.supplierForm;
  const payload = serializeForm(form);
  try {
    await request('/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast('Fornecedor cadastrado com sucesso!');
    form.reset();
    closeDialog(elements.supplierDialog);
    loadSuppliers();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function addEventListeners() {
  elements.primaryLoginBtn.addEventListener('click', () => {
    elements.loginCard.scrollIntoView({ behavior: 'smooth' });
  });

  elements.docsBtn.addEventListener('click', () => {
    window.open(DOCS_URL, '_blank');
  });

  elements.loginForm.addEventListener('submit', handleLogin);
  elements.refreshItems.addEventListener('click', loadItems);
  elements.refreshSuppliers.addEventListener('click', loadSuppliers);
  elements.openItemForm.addEventListener('click', () => openDialog(elements.itemDialog));
  elements.openSupplierForm.addEventListener('click', () => openDialog(elements.supplierDialog));

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeDialog(document.getElementById(btn.dataset.close)));
  });

  elements.itemForm.addEventListener('submit', handleItemSubmit);
  elements.supplierForm.addEventListener('submit', handleSupplierSubmit);
}

function init() {
  addEventListeners();
  syncAuthState();
  if (state.token) {
    loadItems();
    loadSuppliers();
  }
}

init();
