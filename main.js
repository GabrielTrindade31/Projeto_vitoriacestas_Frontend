const API_BASE =
  window.APP_API_BASE ||
  (window.location.hostname.includes('vercel.app')
    ? '/api'
    : 'https://projeto-vitoriacestas-backend.vercel.app/api');
const DOCS_URL = `${API_BASE.replace(/\/api$/, '')}/docs`;
const storageKey = 'vitoriacestas_token';
const thresholdStorageKey = 'vitoriacestas_thresholds';

const chartState = {
  charts: {},
};

const state = {
  token: localStorage.getItem(storageKey),
  currentPage: 'dashboardPage',
  latestItems: [],
  alertsPaused: false,
  visualsVisible: false,
  lastAlertHash: '',
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
  dashboardVisuals: document.getElementById('dashboardVisuals'),
  stockByCategory: document.getElementById('stockByCategory'),
  stockTrend: document.getElementById('stockTrend'),
  kpiItemsTotal: document.getElementById('kpiItemsTotal'),
  kpiTotalValue: document.getElementById('kpiTotalValue'),
  kpiAlertsCount: document.getElementById('kpiAlertsCount'),
  alertsList: document.getElementById('alertsList'),
  toggleAlerts: document.getElementById('toggleAlerts'),
  itemForm: document.getElementById('itemForm'),
  supplierForm: document.getElementById('supplierForm'),
  customerForm: document.getElementById('customerForm'),
  addressForm: document.getElementById('addressForm'),
  phoneForm: document.getElementById('phoneForm'),
  thresholdForm: document.getElementById('thresholdForm'),
  logoutBtn: document.getElementById('logoutBtn'),
  pages: document.querySelectorAll('[data-page]'),
  pageTabs: document.querySelectorAll('.tabs__btn[data-page-target]'),
  toast: document.getElementById('toast'),
};

let alertIntervalId;

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

function getThresholds() {
  try {
    return JSON.parse(localStorage.getItem(thresholdStorageKey) || '{}');
  } catch (err) {
    return {};
  }
}

function saveThresholds(thresholds) {
  localStorage.setItem(thresholdStorageKey, JSON.stringify(thresholds));
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
    if (alertIntervalId) clearInterval(alertIntervalId);
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

function createChartOptions(overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    plugins: {
      legend: { display: true },
      decimation: { enabled: true, algorithm: 'lttb', samples: 200 },
      tooltip: { mode: 'index' },
    },
    ...overrides,
  };
}

const chartManager = {
  render(id, type, data, options = {}) {
    const ctx = elements[id];
    if (!ctx || typeof Chart === 'undefined') return;
    if (chartState.charts[id]) {
      chartState.charts[id].data = data;
      chartState.charts[id].options = { ...chartState.charts[id].options, ...options };
      chartState.charts[id].update();
      return;
    }
    chartState.charts[id] = new Chart(ctx, {
      type,
      data,
      options: createChartOptions(options),
    });
  },

  export(id, format = 'png') {
    const chart = chartState.charts[id];
    if (!chart) return;
    if (format === 'png') {
      const link = document.createElement('a');
      link.href = chart.toBase64Image();
      link.download = `${id}.png`;
      link.click();
    }
    if (format === 'csv') {
      const rows = [];
      const labels = chart.data.labels || [];
      (chart.data.datasets || []).forEach((ds) => {
        rows.push(['Label', ds.label || 'Série']);
        labels.forEach((label, idx) => {
          rows.push([label, ds.data?.[idx] ?? '']);
        });
        rows.push([]);
      });
      const csv = rows.map((r) => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${id}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  },
};

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

function buildCategoryDataset(items = []) {
  const buckets = {};
  items.forEach((item) => {
    const categoria = item.categoria || 'Sem categoria';
    const quantidade = Number(item.quantidade) || 0;
    buckets[categoria] = (buckets[categoria] || 0) + quantidade;
  });
  const labels = Object.keys(buckets);
  const data = labels.map((label) => buckets[label]);
  return {
    labels,
    datasets: [
      {
        label: 'Quantidade',
        data,
        backgroundColor: labels.map((_, idx) => `hsl(${(idx * 45) % 360} 65% 48%)`),
      },
    ],
  };
}

function buildTrendDataset(items = []) {
  const base = items.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);
  const points = 24;
  const series = Array.from({ length: points }, (_, idx) => {
    const noise = Math.sin(idx / 3) * 6;
    const variance = (idx * 3) % 10;
    return Math.max(base + noise * variance - idx, 0);
  });
  const labels = Array.from({ length: points }, (_, idx) => `T${idx + 1}`);
  return {
    labels,
    datasets: [
      {
        label: 'Saldo simulado',
        data: series,
        borderColor: '#0f9d58',
        backgroundColor: 'rgba(15, 183, 161, 0.24)',
        fill: true,
        tension: 0.35,
      },
    ],
  };
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

function renderKPIs(items = [], alerts = []) {
  elements.kpiItemsTotal.textContent = items.length;
  const totalValue = items.reduce(
    (acc, item) => acc + (Number(item.quantidade) || 0) * (Number(item.preco) || 0),
    0,
  );
  elements.kpiTotalValue.textContent = `R$ ${totalValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  elements.kpiAlertsCount.textContent = alerts.length;
}

function renderAlerts(alerts = []) {
  if (!alerts.length) {
    elements.alertsList.textContent = 'Nenhum alerta pendente.';
    renderKPIs(state.latestItems, alerts);
    return;
  }
  elements.alertsList.innerHTML = '';
  alerts.forEach((alert) => {
    const row = document.createElement('div');
    row.className = 'alert-item';
    row.innerHTML = `
      <div class="alert-item__meta">
        <strong>${alert.nome || alert.codigo}</strong>
        <span class="muted">Qtd atual: ${alert.quantidade} • Mínimo: ${alert.minimo}</span>
      </div>
      <span class="badge">${alert.codigo}</span>
    `;
    elements.alertsList.appendChild(row);
  });
  renderKPIs(state.latestItems, alerts);
}

function evaluateAlerts(items = []) {
  const thresholds = getThresholds();
  const pending = items
    .filter((item) => thresholds[item.codigo]?.habilitado !== false)
    .map((item) => ({ ...item, minimo: thresholds[item.codigo]?.minimo ?? 0 }))
    .filter((item) => item.minimo > 0 && Number(item.quantidade) <= Number(item.minimo));
  const signature = pending.map((p) => `${p.codigo}:${p.quantidade}/${p.minimo}`).join('|');
  if (signature !== state.lastAlertHash && pending.length && !state.alertsPaused) {
    showToast('Alertas: itens atingiram o estoque mínimo!');
    console.info('Simulando envio de email (nodemailer no backend) para responsáveis.');
  }
  state.lastAlertHash = signature;
  renderAlerts(pending);
}

function renderCharts() {
  if (!state.visualsVisible || !state.latestItems.length) return;
  chartManager.render('stockByCategory', 'bar', buildCategoryDataset(state.latestItems));
  chartManager.render('stockTrend', 'line', buildTrendDataset(state.latestItems));
}

function queueVisualRefresh() {
  renderKPIs(state.latestItems, []);
  evaluateAlerts(state.latestItems);
  renderCharts();
}

function setupVisualizationLazyLoad() {
  if (!elements.dashboardVisuals) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          state.visualsVisible = true;
          queueVisualRefresh();
        }
      });
    },
    { threshold: 0.25 },
  );
  observer.observe(elements.dashboardVisuals);
}

function startAlertCron() {
  if (alertIntervalId) clearInterval(alertIntervalId);
  alertIntervalId = setInterval(() => {
    if (!state.alertsPaused && state.latestItems.length) {
      evaluateAlerts(state.latestItems);
    }
  }, 30000);
}

async function loadItems() {
  try {
    const { data } = await request('/items');
    state.latestItems = data || [];
    renderList(elements.itemsList, state.latestItems, 'item');
    queueVisualRefresh();
    startAlertCron();
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

function handleThresholdSubmit(event) {
  event.preventDefault();
  const payload = serializeForm(elements.thresholdForm);
  const minimo = Number(payload.minimo);
  if (!payload.codigo) {
    showToast('Informe um código para configurar o limite.', 'error');
    return;
  }
  if (minimo < 0) {
    showToast('Limite deve ser zero ou positivo.', 'error');
    return;
  }
  const thresholds = getThresholds();
  thresholds[payload.codigo] = {
    minimo,
    habilitado: payload.habilitado === 'on',
  };
  saveThresholds(thresholds);
  showToast('Configuração de estoque mínimo salva.');
  evaluateAlerts(state.latestItems);
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

function handleExportClick(event) {
  const target = event.currentTarget;
  const id = target.dataset.export;
  const format = target.dataset.format;
  chartManager.export(id, format);
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
  elements.thresholdForm.addEventListener('submit', handleThresholdSubmit);

  elements.logoutBtn.addEventListener('click', () => {
    setToken(null);
    showToast('Sessão encerrada.');
  });

  document.querySelectorAll('[data-page-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActivePage(btn.dataset.pageTarget);
    });
  });

  document.querySelectorAll('[data-export]').forEach((btn) => {
    btn.addEventListener('click', handleExportClick);
  });

  elements.toggleAlerts.addEventListener('click', () => {
    state.alertsPaused = !state.alertsPaused;
    elements.toggleAlerts.textContent = state.alertsPaused ? 'Retomar' : 'Pausar';
  });

  attachMask(document.querySelector('#suppliersPage input[name="cnpj"]'), formatCNPJ);
  attachMask(document.querySelector('#suppliersPage input[name="telefone"]'), formatPhone);
  attachMask(document.querySelector('#customersPage input[name="cnpj"]'), formatCNPJ);
  attachMask(document.querySelector('#customersPage input[name="telefone"]'), formatPhone);
  attachMask(document.querySelector('#phonesPage input[name="numero"]'), formatPhone);
}

function init() {
  addEventListeners();
  setupVisualizationLazyLoad();
  syncAuthState();
  if (state.token) {
    loadItems();
    loadSuppliers();
    elements.appShell.hidden = false;
    setActivePage(state.currentPage);
  }
}

init();
