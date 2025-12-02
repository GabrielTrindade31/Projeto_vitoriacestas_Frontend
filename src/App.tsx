import React, { useEffect, useMemo, useState } from 'react';

const API_BASE =
  (window as any).APP_API_BASE ||
  import.meta.env.VITE_API_BASE ||
  (window.location.hostname.includes('vercel.app')
    ? '/api'
    : 'https://projeto-vitoriacestas-backend.vercel.app/api');

const STORAGE_TOKEN_KEY = 'vitoriacestas_token';

// Tipagens básicas
interface LoginPayload {
  email: string;
  password: string;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

interface Item {
  id?: number;
  nome: string;
  codigo: string;
  quantidade: number;
  preco: number;
  categoria?: string;
  descricao?: string;
}

interface Supplier {
  id?: number;
  nome: string;
  razaoSocial?: string;
  contato?: string;
  email?: string;
}

interface Customer {
  id?: number;
  nome: string;
  email?: string;
}

interface Address {
  id?: number;
  logradouro?: string;
  numero?: string;
  cidade?: string;
}

interface Phone {
  id?: number;
  numero?: string;
  contato?: string;
}

type Page =
  | 'dashboard'
  | 'items'
  | 'suppliers'
  | 'customers'
  | 'addresses'
  | 'phones';

function useAuth() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_TOKEN_KEY)
  );

  const authenticated = Boolean(token);

  const saveToken = (value: string | null) => {
    setToken(value);
    if (value) {
      localStorage.setItem(STORAGE_TOKEN_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
    }
  };

  return { token, authenticated, saveToken };
}

function useApi(token: string | null) {
  const request = async <T,>(path: string, options: RequestInit = {}) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    let data: any = {};
    if (text) {
      if (contentType.includes('application/json')) {
        data = JSON.parse(text);
      } else {
        try {
          data = JSON.parse(text);
        } catch (err) {
          data = { message: text };
        }
      }
    }
    if (!res.ok) {
      throw new Error(data?.message || 'Erro ao processar requisição');
    }
    return data as ApiResponse<T>;
  };

  return { request };
}

function LoginModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
}) {
  const [form, setForm] = useState<LoginPayload>({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm({ email: '', password: '' });
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Não foi possível autenticar');
      }
      const token = data.accessToken || data.token;
      if (!token) throw new Error('Token não retornado pela API');
      onSuccess(token);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal__backdrop">
      <div className="modal">
        <div className="modal__header">
          <h2>Entrar</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Fechar modal">
            ✕
          </button>
        </div>
        <form className="form" onSubmit={handleSubmit}>
          <label className="form__group">
            <span>Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="usuario@exemplo.com"
            />
          </label>
          <label className="form__group">
            <span>Senha</span>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
          </label>
          {error && <p className="form__error">{error}</p>}
          <div className="form__actions">
            <button className="btn btn--ghost" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Sidebar({
  page,
  setPage,
  authenticated,
  onLogin,
  onLogout,
}: {
  page: Page;
  setPage: (page: Page) => void;
  authenticated: boolean;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const links: { key: Page; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'items', label: 'Itens' },
    { key: 'suppliers', label: 'Fornecedores' },
    { key: 'customers', label: 'Clientes' },
    { key: 'addresses', label: 'Endereços' },
    { key: 'phones', label: 'Telefones' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <strong>Vitória Cestas</strong>
        <small>Console React</small>
      </div>
      <nav>
        {links.map((link) => (
          <button
            key={link.key}
            className={`sidebar__link ${page === link.key ? 'is-active' : ''}`}
            onClick={() => setPage(link.key)}
          >
            {link.label}
          </button>
        ))}
      </nav>
      <div className="sidebar__footer">
        <small className="muted">Status: {authenticated ? 'Autenticado' : 'Visitante'}</small>
        {authenticated ? (
          <button className="btn btn--ghost" onClick={onLogout}>
            Logout
          </button>
        ) : (
          <button className="btn" onClick={onLogin}>
            Login
          </button>
        )}
      </div>
    </aside>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="muted">{message}</p>;
}

function Dashboard({
  items,
  suppliers,
}: {
  items: Item[];
  suppliers: Supplier[];
}) {
  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <h1>Resumo</h1>
          <p className="muted">Métricas rápidas carregadas em React + TypeScript.</p>
        </div>
      </header>
      <div className="grid grid--3">
        <div className="kpi">
          <span className="muted">Itens cadastrados</span>
          <strong>{items.length}</strong>
        </div>
        <div className="kpi">
          <span className="muted">Fornecedores</span>
          <strong>{suppliers.length}</strong>
        </div>
        <div className="kpi">
          <span className="muted">Itens recentes</span>
          <strong>{items.slice(-3).map((i) => i.codigo).join(', ') || '–'}</strong>
        </div>
      </div>
      <section className="panel__section">
        <h3>Movimentações</h3>
        {items.length ? (
          <ul className="list">
            {items.slice(-5).reverse().map((item) => (
              <li key={item.codigo} className="list__item">
                <div>
                  <strong>{item.nome}</strong>
                  <span className="muted">{item.codigo}</span>
                </div>
                <span className="badge">Qtd: {item.quantidade}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Nenhum item carregado." />
        )}
      </section>
    </div>
  );
}

const ITEM_CATEGORIES = [
  { value: 'materia-prima', label: 'Matéria-prima' },
  { value: 'produto', label: 'Produto' },
];

function ItemForm({
  onSubmit,
  presetCategory,
}: {
  onSubmit: (item: Item) => Promise<void>;
  presetCategory?: string;
}) {
  const [form, setForm] = useState<Item>({
    nome: '',
    codigo: '',
    quantidade: 0,
    preco: 0,
    categoria: presetCategory || ITEM_CATEGORIES[0].value,
    descricao: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ ...form, quantidade: Number(form.quantidade), preco: Number(form.preco) });
      setForm({
        nome: '',
        codigo: '',
        quantidade: 0,
        preco: 0,
        categoria: presetCategory || ITEM_CATEGORIES[0].value,
        descricao: '',
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--2">
        <label className="form__group">
          <span>Nome</span>
          <input value={form.nome} required onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Código</span>
          <input value={form.codigo} required onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
        </label>
      </div>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Quantidade</span>
          <input
            type="number"
            min={0}
            value={form.quantidade}
            onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })}
          />
        </label>
        <label className="form__group">
          <span>Preço</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.preco}
            onChange={(e) => setForm({ ...form, preco: Number(e.target.value) })}
          />
        </label>
        <label className="form__group">
          <span>Categoria</span>
          {presetCategory ? (
            <input value={form.categoria} readOnly />
          ) : (
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              {ITEM_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>
      <label className="form__group">
        <span>Descrição</span>
        <textarea
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          placeholder="Breve descrição"
        />
      </label>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Cadastrar item'}
        </button>
      </div>
    </form>
  );
}

function SupplierForm({ onSubmit }: { onSubmit: (supplier: Supplier) => Promise<void> }) {
  const [form, setForm] = useState<Supplier>({ nome: '', contato: '', email: '', razaoSocial: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      setForm({ nome: '', contato: '', email: '', razaoSocial: '' });
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar fornecedor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--2">
        <label className="form__group">
          <span>Nome</span>
          <input value={form.nome} required onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Razão social</span>
          <input value={form.razaoSocial || ''} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} />
        </label>
      </div>
      <div className="grid grid--2">
        <label className="form__group">
          <span>Contato</span>
          <input value={form.contato || ''} onChange={(e) => setForm({ ...form, contato: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Email</span>
          <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Cadastrar fornecedor'}
        </button>
      </div>
    </form>
  );
}

function CustomerForm({ onSubmit }: { onSubmit: (customer: Customer) => Promise<void> }) {
  const [form, setForm] = useState<Customer>({ nome: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      setForm({ nome: '', email: '' });
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--2">
        <label className="form__group">
          <span>Nome</span>
          <input value={form.nome} required onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Email</span>
          <input
            type="email"
            value={form.email || ''}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="cliente@exemplo.com"
          />
        </label>
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Cadastrar cliente'}
        </button>
      </div>
    </form>
  );
}

function AddressForm({ onSubmit }: { onSubmit: (address: Address) => Promise<void> }) {
  const [form, setForm] = useState<Address>({ logradouro: '', numero: '', cidade: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      setForm({ logradouro: '', numero: '', cidade: '' });
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar endereço');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Logradouro</span>
          <input
            value={form.logradouro || ''}
            required
            onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
          />
        </label>
        <label className="form__group">
          <span>Número</span>
          <input value={form.numero || ''} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Cidade</span>
          <input value={form.cidade || ''} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
        </label>
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Cadastrar endereço'}
        </button>
      </div>
    </form>
  );
}

function PhoneForm({ onSubmit }: { onSubmit: (phone: Phone) => Promise<void> }) {
  const [form, setForm] = useState<Phone>({ numero: '', contato: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      setForm({ numero: '', contato: '' });
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar telefone');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--2">
        <label className="form__group">
          <span>Número</span>
          <input
            value={form.numero || ''}
            required
            onChange={(e) => setForm({ ...form, numero: e.target.value })}
            placeholder="(00) 00000-0000"
          />
        </label>
        <label className="form__group">
          <span>Contato</span>
          <input
            value={form.contato || ''}
            onChange={(e) => setForm({ ...form, contato: e.target.value })}
            placeholder="Nome do responsável"
          />
        </label>
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Cadastrar telefone'}
        </button>
      </div>
    </form>
  );
}

function ItemCategorySection({
  title,
  category,
  items,
  onCreate,
}: {
  title: string;
  category: string;
  items: Item[];
  onCreate: (item: Item) => Promise<void>;
}) {
  const filtered = items.filter((item) => (item.categoria || '').toLowerCase() === category);

  return (
    <section className="panel__section">
      <div className="panel__section-header">
        <div>
          <h3>{title}</h3>
          <p className="muted">Cadastre e consulte somente {title.toLowerCase()}.</p>
        </div>
        <span className="badge">{filtered.length} cadastros</span>
      </div>
      <ItemForm onSubmit={onCreate} presetCategory={category} />
      {filtered.length ? (
        <ul className="list">
          {filtered.map((item) => (
            <li key={`${item.codigo}-${category}`} className="list__item">
              <div>
                <strong>{item.nome}</strong>
                <span className="muted">{item.codigo}</span>
              </div>
              <div className="list__actions">
                <span className="badge">Qtd: {item.quantidade}</span>
                <span className="badge badge--soft">R$ {Number(item.preco || 0).toFixed(2)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message={`Nenhum item de ${title.toLowerCase()} cadastrado.`} />
      )}
    </section>
  );
}

function ItemsPage({
  items,
  onCreate,
}: {
  items: Item[];
  onCreate: (item: Item) => Promise<void>;
}) {
  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <h1>Itens</h1>
          <p className="muted">Cadastre matérias-primas e produtos separadamente.</p>
        </div>
      </header>
      <ItemCategorySection
        title="Matéria-prima"
        category="materia-prima"
        items={items}
        onCreate={onCreate}
      />
      <ItemCategorySection title="Produto" category="produto" items={items} onCreate={onCreate} />
    </div>
  );
}

function SuppliersPage({
  suppliers,
  onCreate,
}: {
  suppliers: Supplier[];
  onCreate: (supplier: Supplier) => Promise<void>;
}) {
  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <h1>Fornecedores</h1>
          <p className="muted">Registro simples de parceiros.</p>
        </div>
      </header>
      <SupplierForm onSubmit={onCreate} />
      <section className="panel__section">
        <h3>Últimos fornecedores</h3>
        {suppliers.length ? (
          <ul className="list">
            {suppliers.map((supplier) => (
              <li key={`${supplier.id}-${supplier.nome}`} className="list__item">
                <div>
                  <strong>{supplier.razaoSocial || supplier.nome}</strong>
                  <span className="muted">{supplier.email || 'Sem e-mail'}</span>
                </div>
                <span className="badge">{supplier.contato || 'Contato N/D'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Nenhum fornecedor cadastrado." />
        )}
      </section>
    </div>
  );
}

function SimpleList<T extends { id?: number; nome?: string }>({
  title,
  items,
  emptyMessage,
  descriptor,
}: {
  title: string;
  items: T[];
  emptyMessage: string;
  descriptor?: (item: T) => string;
}) {
  return (
    <section className="panel__section">
      <h3>{title}</h3>
      {items.length ? (
        <ul className="list">
          {items.map((item) => (
            <li key={`${item.id}-${item.nome}`} className="list__item">
              <div>
                <strong>{item.nome || 'Registro'}</strong>
                <span className="muted">{descriptor ? descriptor(item) : 'Carregado do backend'}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </section>
  );
}

function useAutoRefresh(callback: () => void, enabled: boolean, delay = 9000) {
  useEffect(() => {
    if (!enabled) return;
    callback();
    const id = window.setInterval(callback, delay);
    return () => window.clearInterval(id);
  }, [enabled, delay, callback]);
}

function App() {
  const { token, authenticated, saveToken } = useAuth();
  const { request } = useApi(token);
  const [page, setPage] = useState<Page>('dashboard');
  const [loginOpen, setLoginOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const guardedFetch = async <T,>(path: string): Promise<T> => {
    if (!authenticated) throw new Error('Faça login para carregar dados.');
    const res = await request<T>(path);
    return res.data;
  };

  const loadItems = async () => {
    try {
      const data = await guardedFetch<Item[]>('/items');
      setItems(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await guardedFetch<Supplier[]>('/suppliers');
      setSuppliers(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await guardedFetch<Customer[]>('/customers');
      setCustomers(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  };

  const loadAddresses = async () => {
    try {
      const data = await guardedFetch<Address[]>('/addresses');
      setAddresses(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  };

  const loadPhones = async () => {
    try {
      const data = await guardedFetch<Phone[]>('/phones');
      setPhones(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  };

  useEffect(() => {
    if (!authenticated) {
      setItems([]);
      setSuppliers([]);
      setCustomers([]);
      setAddresses([]);
      setPhones([]);
      return;
    }
    loadItems();
    loadSuppliers();
    loadCustomers();
    loadAddresses();
    loadPhones();
  }, [authenticated]);

  useAutoRefresh(loadItems, authenticated);
  useAutoRefresh(loadSuppliers, authenticated, 12000);

  const handleCreateItem = async (payload: Item) => {
    const res = await request<Item>('/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Item salvo com sucesso.');
    setItems((prev) => [...prev, res.data]);
  };

  const handleCreateSupplier = async (payload: Supplier) => {
    const res = await request<Supplier>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Fornecedor salvo com sucesso.');
    setSuppliers((prev) => [...prev, res.data]);
  };

  const handleCreateCustomer = async (payload: Customer) => {
    const res = await request<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Cliente salvo com sucesso.');
    setCustomers((prev) => [...prev, res.data]);
  };

  const handleCreateAddress = async (payload: Address) => {
    const res = await request<Address>('/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Endereço salvo com sucesso.');
    setAddresses((prev) => [...prev, res.data]);
  };

  const handleCreatePhone = async (payload: Phone) => {
    const res = await request<Phone>('/phones', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Telefone salvo com sucesso.');
    setPhones((prev) => [...prev, res.data]);
  };

  const content = useMemo(() => {
    if (!authenticated) {
      return (
        <div className="panel">
          <header className="panel__header">
            <div>
              <h1>Bem-vindo</h1>
              <p className="muted">Entre para acessar cadastros, listas e testes de integração.</p>
            </div>
            <button className="btn" onClick={() => setLoginOpen(true)}>
              Abrir login
            </button>
          </header>
          <p className="muted">A navegação lateral permanece ativa, mas os dados requerem autenticação.</p>
        </div>
      );
    }

    switch (page) {
      case 'items':
        return <ItemsPage items={items} onCreate={handleCreateItem} />;
      case 'suppliers':
        return <SuppliersPage suppliers={suppliers} onCreate={handleCreateSupplier} />;
      case 'customers':
        return (
          <div className="panel">
            <header className="panel__header">
              <div>
                <h1>Clientes</h1>
                <p className="muted">Listagem e cadastro carregados direto do backend.</p>
              </div>
            </header>
            <CustomerForm onSubmit={handleCreateCustomer} />
            <SimpleList
              title="Clientes"
              items={customers}
              emptyMessage="Nenhum cliente encontrado."
              descriptor={(item) => item.email || 'Sem e-mail informado'}
            />
          </div>
        );
      case 'addresses':
        return (
          <div className="panel">
            <header className="panel__header">
              <div>
                <h1>Endereços</h1>
                <p className="muted">Verifique e cadastre rapidamente novos endereços.</p>
              </div>
            </header>
            <AddressForm onSubmit={handleCreateAddress} />
            <SimpleList
              title="Endereços"
              items={addresses}
              emptyMessage="Nenhum endereço encontrado."
              descriptor={(addr) => `${addr.logradouro || 'Logradouro'}, ${addr.cidade || 'Cidade'}`}
            />
          </div>
        );
      case 'phones':
        return (
          <div className="panel">
            <header className="panel__header">
              <div>
                <h1>Telefones</h1>
                <p className="muted">Checagens rápidas para suporte com cadastro.</p>
              </div>
            </header>
            <PhoneForm onSubmit={handleCreatePhone} />
            <SimpleList
              title="Telefones"
              items={phones}
              emptyMessage="Nenhum telefone encontrado."
              descriptor={(phone) => phone.numero || 'Sem número'}
            />
          </div>
        );
      default:
        return <Dashboard items={items} suppliers={suppliers} />;
    }
  }, [authenticated, page, items, suppliers, customers, addresses, phones]);

  return (
    <div className="layout">
      <Sidebar
        page={page}
        setPage={setPage}
        authenticated={authenticated}
        onLogin={() => setLoginOpen(true)}
        onLogout={() => saveToken(null)}
      />
      <main className="content">
        {feedback && <div className="toast toast--inline">{feedback}</div>}
        {content}
      </main>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={(token) => saveToken(token)} />
    </div>
  );
}

export default App;
