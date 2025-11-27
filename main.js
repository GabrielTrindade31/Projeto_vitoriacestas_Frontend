const API_BASE =
  window.APP_API_BASE ||
  (window.location.hostname.includes('vercel.app')
    ? '/api'
    : 'https://projeto-vitoriacestas-backend.vercel.app/api');
const DOCS_URL = `${API_BASE.replace(/\/api$/, '')}/docs`;
const storageKey = 'vitoriacestas_token';

const state = {
  token: localStorage.getItem(storageKey),
  currentPage: 'dashboardPage',
};

const elements = {
  loginForm: document.getElementById('loginForm'),
  loginCard: document.getElementById('loginCard'),
  primaryLoginBtn: document.getElementById('primaryLoginBtn'),
  docsBtn: document.getElementById('docsBtn'),
  authStatus: document.getElementById('authStatus'),
  appShell: document.getElementById('appShell'),
  itemsList: document.getElementById('itemsList'),
  suppliersList: document.getElementById('suppliersList'),
  refreshItems: document.getElementById('refreshItems'),
  refreshSuppliers: document.getElementById('refreshSuppliers'),
  itemForm: document.getElementById('itemForm'),
  supplierForm: document.getElementById('supplierForm'),
  customerForm: document.getElementById('customerForm'),
  addressForm: document.getElementById('addressForm'),
  phoneForm: document.getElementById('phoneForm'),
  logoutBtn: document.getElementById('logoutBtn'),
  pages: document.querySelectorAll('[data-page]'),
  pageTabs: document.querySelectorAll('.tabs__btn[data-page-target]'),
  toast: document.getElementById('toast'),
};

function onlyDigits(value = '') {
  return value.replace(/\D/g, '');
}

function formatCNPJ(value = '') {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatPhone(value = '') {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function attachMask(input, formatter) {
  if (!input) return;
  input.addEventListener('input', () => {
    input.value = formatter(input.value);
  });
}

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
  elements.appShell.hidden = !authenticated;
  elements.pages.forEach((page) => {
    page.hidden = !authenticated || page.id !== state.currentPage;
  });
  if (!authenticated) {
    elements.itemsList.textContent = 'Faça login para carregar os itens.';
    elements.suppliersList.textContent = 'Faça login para carregar os fornecedores.';
    state.currentPage = 'dashboardPage';
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

function setActivePage(targetId) {
  if (!state.token) {
    showToast('Faça login para navegar pelas páginas protegidas.', 'error');
    return;
  }
  state.currentPage = targetId;
  elements.pages.forEach((page) => {
    page.hidden = page.id !== targetId;
  });
  elements.pageTabs.forEach((btn) => {
    const isActive = btn.dataset.pageTarget === targetId;
    btn.classList.toggle('tabs__btn--active', isActive);
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
      elements.appShell.hidden = false;
      await Promise.all([loadItems(), loadSuppliers()]);
      setActivePage('dashboardPage');
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
  payload.fornecedorId = payload.fornecedorId ? Number(payload.fornecedorId) : null;

  try {
    await request('/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast('Item cadastrado com sucesso!');
    form.reset();
    loadItems();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleSupplierSubmit(event) {
  event.preventDefault();
  const form = elements.supplierForm;
  const payload = serializeForm(form);
  const cnpj = onlyDigits(payload.cnpj);
  const telefone = onlyDigits(payload.telefone);

  if (cnpj.length !== 14) {
    showToast('CNPJ deve conter 14 dígitos.', 'error');
    return;
  }
  if (telefone.length < 10) {
    showToast('Telefone deve conter ao menos 10 dígitos.', 'error');
    return;
  }

  payload.cnpj = cnpj;
  payload.telefone = telefone;
  payload.enderecoId = payload.enderecoId ? Number(payload.enderecoId) || 0 : 0;

  try {
    await request('/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast('Fornecedor cadastrado com sucesso!');
    form.reset();
    loadSuppliers();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleCustomerSubmit(event) {
  event.preventDefault();
  const form = elements.customerForm;
  const payload = serializeForm(form);

  if (!payload.dataNascimento || !payload.enderecoId) {
    showToast('Endereço e data de nascimento são obrigatórios.', 'error');
    return;
  }

  const telefoneDigits = onlyDigits(payload.telefone);
  if (telefoneDigits && telefoneDigits.length < 10) {
    showToast('Telefone do cliente precisa ter ao menos 10 dígitos.', 'error');
    return;
  }

  payload.cpf = onlyDigits(payload.cpf);
  payload.cnpj = onlyDigits(payload.cnpj);
  payload.enderecoId = Number(payload.enderecoId) || 0;
  if (payload.enderecoId === 0) {
    showToast('Informe um endereço válido (diferente de 0).', 'error');
    return;
  }

  try {
    const customerResponse = await request('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const clienteId = customerResponse.data?.id;
    if (clienteId && telefoneDigits) {
      try {
        await request('/phones', {
          method: 'POST',
          body: JSON.stringify({ numero: telefoneDigits, clienteId }),
        });
      } catch (phoneError) {
        showToast(`Cliente salvo, mas o telefone não foi cadastrado: ${phoneError.message}`, 'error');
        return;
      }
    }
    showToast('Cliente cadastrado com sucesso!');
    form.reset();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleAddressSubmit(event) {
  event.preventDefault();
  const form = elements.addressForm;
  const payload = serializeForm(form);

  payload.cep = onlyDigits(payload.cep);
  payload.numero = payload.numero ? Number(payload.numero) || 0 : 0;

  try {
    await request('/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast('Endereço cadastrado com sucesso!');
    form.reset();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handlePhoneSubmit(event) {
  event.preventDefault();
  const form = elements.phoneForm;
  const payload = serializeForm(form);
  const numero = onlyDigits(payload.numero);
  const clienteId = Number(payload.clienteId);

  if (numero.length < 10) {
    showToast('Telefone deve ter ao menos 10 dígitos.', 'error');
    return;
  }
  if (!clienteId) {
    showToast('Informe um ID de cliente válido.', 'error');
    return;
  }

  try {
    await request('/phones', {
      method: 'POST',
      body: JSON.stringify({ numero, clienteId }),
    });
    showToast('Telefone cadastrado com sucesso!');
    form.reset();
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

  elements.itemForm.addEventListener('submit', handleItemSubmit);
  elements.supplierForm.addEventListener('submit', handleSupplierSubmit);
  elements.customerForm.addEventListener('submit', handleCustomerSubmit);
  elements.addressForm.addEventListener('submit', handleAddressSubmit);
  elements.phoneForm.addEventListener('submit', handlePhoneSubmit);

  elements.logoutBtn.addEventListener('click', () => {
    setToken(null);
    showToast('Sessão encerrada.');
  });

  document.querySelectorAll('[data-page-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActivePage(btn.dataset.pageTarget);
    });
  });

  attachMask(document.querySelector('#suppliersPage input[name="cnpj"]'), formatCNPJ);
  attachMask(document.querySelector('#suppliersPage input[name="telefone"]'), formatPhone);
  attachMask(document.querySelector('#customersPage input[name="cnpj"]'), formatCNPJ);
  attachMask(document.querySelector('#customersPage input[name="telefone"]'), formatPhone);
  attachMask(document.querySelector('#phonesPage input[name="numero"]'), formatPhone);
}

function init() {
  addEventListeners();
  syncAuthState();
  if (state.token) {
    loadItems();
    loadSuppliers();
    elements.appShell.hidden = false;
    setActivePage(state.currentPage);
  }
}

init();
