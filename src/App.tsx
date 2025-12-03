import React, { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE =
  (window as any).APP_API_BASE ||
  import.meta.env.VITE_API_BASE ||
  'https://projeto-vitoriacestas-backend.vercel.app/api';

const STORAGE_TOKEN_KEY = 'vitoriacestas_token';

interface LoginPayload {
  email: string;
  password: string;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

interface Address {
  id?: number;
  rua: string;
  cep: string;
  numero: string;
}

interface Customer {
  id?: number;
  nome: string;
  email?: string;
  data_nascimento?: string;
  cnpj?: string;
  cpf?: string;
  endereco_id?: number;
}

interface Supplier {
  id?: number;
  cnpj: string;
  razao_social: string;
  contato: string;
  email?: string | null;
  telefone?: string | null;
  endereco_id?: number | null;
}

interface Product {
  id?: number;
  codigo: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  quantidade: number;
  preco: number;
  fornecedor_id?: number | null;
  imagem_url?: string;
}

interface RawMaterial {
  id?: number;
  nome: string;
  tipo?: string;
  custo?: number;
  datavalidade?: string;
  descricao?: string;
  tamanho?: string;
  material?: string;
  acessorio?: string;
  imagem_url?: string;
}

interface Phone {
  id?: number;
  cliente_id?: number;
  ddd?: string;
  numero?: string;
}

interface Manufacturing {
  id?: number;
  produto_id?: number | null;
  material_id?: number | null;
  quantidade_material?: number;
}

interface MaterialDelivery {
  id?: number;
  material_id?: number | null;
  fornecedor_id?: number | null;
  quantidade?: number;
  data_entrada?: string;
  custo?: number;
}

interface Order {
  id?: number;
  cliente_id?: number | null;
  endereco?: string;
  preco?: number;
  data_pedido?: string;
  cpf_presentado?: string;
  nome_presentado?: string;
  email_presentado?: string;
  endereco_presentado?: string;
}

interface Shipment {
  id?: number;
  pedido_id?: number | null;
  produto_id?: number | null;
  quantidade?: number;
  data_envio?: string;
  preco?: number;
}

interface FeedbackRow {
  id?: number;
  cliente_id?: number | null;
  data?: string;
  nota?: number;
  contato?: string;
  observacao?: string;
}

interface UploadResponse {
  url?: string;
  path?: string;
}

type Page = 'dashboard' | 'items' | 'operations' | 'suppliers' | 'customers' | 'addresses' | 'phones';

const digitsOnly = (value: string) => value.replace(/\D+/g, '');

const normalizePhoneDigits = (value: string) => {
  const digits = digitsOnly(value);
  const withoutCountry = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  return withoutCountry.slice(0, 11);
};

const maskCpf = (value: string) => {
  const digits = digitsOnly(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const maskCnpj = (value: string) => {
  const digits = digitsOnly(value).slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

const maskPhone = (value: string) => {
  const stripped = normalizePhoneDigits(value);
  const digits = stripped;
  if (!digits) return '';
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (!rest) return `+55 (${ddd}`;
  if (rest.length <= 4) return `+55 (${ddd}) ${rest}`;
  const first = rest.slice(0, rest.length - 4);
  const last = rest.slice(-4);
  return `+55 (${ddd}) ${first}-${last}`;
};

const money = (value: number | string) => `R$ ${Number(value || 0).toFixed(2)}`;

function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_TOKEN_KEY));
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
  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      const headers: HeadersInit = options.headers || {};
      const isFormData = options.body instanceof FormData;
      const normalizedBody = isFormData || typeof options.body === 'string' ? options.body : undefined;

      if (!isFormData) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}${path}`, { ...options, headers, body: normalizedBody });
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
        const raw = typeof data === 'string' ? data : data?.message;
        const fallback = `Endpoint ${path} indisponível no momento. Confirme se o backend expõe este recurso.`;
        const sanitized = raw && !raw.startsWith('<!DOCTYPE') ? raw : fallback;
        throw new Error(sanitized || 'Erro ao processar requisição');
      }

      return data as ApiResponse<T>;
    },
    [token]
  );

  return { request };
}

function LoginModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (token: string) => void }) {
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
    if (loading) return;
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
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty">
      <p className="muted">{message}</p>
    </div>
  );
}

function Sidebar({ page, setPage, authenticated, onLogin, onLogout }: { page: Page; setPage: (page: Page) => void; authenticated: boolean; onLogin: () => void; onLogout: () => void }) {
  const links: { id: Page; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'items', label: 'Itens' },
    { id: 'operations', label: 'Operações' },
    { id: 'suppliers', label: 'Fornecedores' },
    { id: 'customers', label: 'Clientes' },
    { id: 'addresses', label: 'Endereços' },
    { id: 'phones', label: 'Telefones' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">VC</div>
      <nav className="sidebar__nav">
        {links.map((link) => (
          <button
            key={link.id}
            className={`sidebar__link ${page === link.id ? 'is-active' : ''}`}
            onClick={() => setPage(link.id)}
          >
            {link.label}
          </button>
        ))}
      </nav>
      <div className="sidebar__footer">
        {authenticated ? (
          <button className="btn btn--ghost" onClick={onLogout}>
            Sair
          </button>
        ) : (
          <button className="btn" onClick={onLogin}>
            Entrar
          </button>
        )}
      </div>
    </aside>
  );
}

function SectionHeader({ title, subtitle, extra }: { title: string; subtitle?: string; extra?: React.ReactNode }) {
  return (
    <div className="panel__section-header">
      <div>
        <h3>{title}</h3>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {extra}
    </div>
  );
}

function AddressForm({ onSubmit }: { onSubmit: (address: Address) => Promise<void> }) {
  const [form, setForm] = useState<Address>({ rua: '', cep: '', numero: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ ...form, cep: digitsOnly(form.cep) });
      setForm({ rua: '', cep: '', numero: '' });
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
          <span>Rua</span>
          <input value={form.rua} required onChange={(e) => setForm({ ...form, rua: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Número</span>
          <input value={form.numero} required onChange={(e) => setForm({ ...form, numero: digitsOnly(e.target.value) })} />
        </label>
        <label className="form__group">
          <span>CEP</span>
          <input
            value={form.cep}
            required
            maxLength={10}
            onChange={(e) => setForm({ ...form, cep: e.target.value.replace(/[^\d-]/g, '') })}
            placeholder="00000-000"
          />
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

function CustomerForm({ addresses, onSubmit }: { addresses: Address[]; onSubmit: (customer: Customer) => Promise<void> }) {
  const [form, setForm] = useState<Customer>({ nome: '', email: '', data_nascimento: '', cpf: '', cnpj: '', endereco_id: undefined });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.cpf && !form.cnpj) {
      setError('Informe CPF ou CNPJ.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        cpf: form.cpf ? digitsOnly(form.cpf) : undefined,
        cnpj: form.cnpj ? digitsOnly(form.cnpj) : undefined,
      });
      setForm({ nome: '', email: '', data_nascimento: '', cpf: '', cnpj: '', endereco_id: undefined });
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Nome</span>
          <input value={form.nome} required onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Email</span>
          <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Data de nascimento</span>
          <input type="date" required value={form.data_nascimento || ''} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
        </label>
      </div>
      <div className="grid grid--3">
        <label className="form__group">
          <span>CPF</span>
          <input value={form.cpf || ''} onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" />
        </label>
        <label className="form__group">
          <span>CNPJ</span>
          <input value={form.cnpj || ''} onChange={(e) => setForm({ ...form, cnpj: maskCnpj(e.target.value) })} placeholder="00.000.000/0000-00" />
        </label>
        <label className="form__group">
          <span>Endereço</span>
          <select
            required
            value={form.endereco_id || ''}
            onChange={(e) => setForm({ ...form, endereco_id: Number(e.target.value) })}
          >
            <option value="" disabled>
              Selecione
            </option>
            {addresses.map((addr) => (
              <option key={addr.id} value={addr.id}>
                {addr.rua} {addr.numero} - CEP {addr.cep}
              </option>
            ))}
          </select>
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

function PhoneForm({ customers, onSubmit }: { customers: Customer[]; onSubmit: (phone: Phone) => Promise<void> }) {
  const [form, setForm] = useState<Phone>({ cliente_id: undefined, ddd: '', numero: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ ...form, ddd: digitsOnly(form.ddd).slice(0, 3), numero: digitsOnly(form.numero).slice(0, 9) });
      setForm({ cliente_id: undefined, ddd: '', numero: '' });
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar telefone');
    } finally {
      setLoading(false);
    }
  };

  const displayValue = maskPhone(`${form.ddd || ''}${form.numero || ''}`);

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--3">
        <label className="form__group">
          <span>DDD</span>
          <input
            type="tel"
            inputMode="numeric"
            value={form.ddd || ''}
            maxLength={3}
            placeholder="11"
            onChange={(e) => setForm({ ...form, ddd: digitsOnly(e.target.value) })}
            required
          />
        </label>
        <label className="form__group">
          <span>Número</span>
          <input
            type="tel"
            inputMode="numeric"
            value={form.numero || ''}
            maxLength={9}
            placeholder="912345678"
            onChange={(e) => setForm({ ...form, numero: digitsOnly(e.target.value) })}
            required
          />
          {displayValue && <small className="muted">{displayValue}</small>}
        </label>
        <label className="form__group">
          <span>Cliente</span>
          <select
            required
            value={form.cliente_id || ''}
            onChange={(e) => setForm({ ...form, cliente_id: Number(e.target.value) })}
          >
            <option value="" disabled>
              Selecione
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.nome}
              </option>
            ))}
          </select>
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

function SupplierForm({ addresses, onSubmit }: { addresses: Address[]; onSubmit: (supplier: Supplier) => Promise<void> }) {
  const [form, setForm] = useState<Supplier>({ cnpj: '', razao_social: '', contato: '', email: '', telefone: '', endereco_id: undefined });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maskedPhone = maskPhone(form.telefone || '');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        razao_social: form.razao_social.trim(),
        cnpj: digitsOnly(form.cnpj),
        email: form.email ? form.email : null,
        telefone: form.telefone ? normalizePhoneDigits(form.telefone) : null,
        endereco_id: form.endereco_id ? Number(form.endereco_id) : null,
      });
      setForm({ cnpj: '', razao_social: '', contato: '', email: '', telefone: '', endereco_id: undefined });
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar fornecedor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Razão social</span>
          <input value={form.razao_social} required onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
        </label>
        <label className="form__group">
          <span>CNPJ</span>
          <input value={form.cnpj} required onChange={(e) => setForm({ ...form, cnpj: maskCnpj(e.target.value) })} placeholder="00.000.000/0000-00" />
        </label>
        <label className="form__group">
          <span>Contato</span>
          <input value={form.contato} required onChange={(e) => setForm({ ...form, contato: e.target.value })} />
        </label>
      </div>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Email</span>
          <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Telefone</span>
          <input
            value={form.telefone || ''}
            onChange={(e) => setForm({ ...form, telefone: normalizePhoneDigits(e.target.value) })}
            placeholder="+55 (11) 99999-0000"
          />
          {form.telefone && <small className="muted">{maskedPhone}</small>}
        </label>
        <label className="form__group">
          <span>Endereço (opcional)</span>
          <select
            value={form.endereco_id || ''}
            onChange={(e) => setForm({ ...form, endereco_id: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">Sem endereço</option>
            {addresses.map((addr) => (
              <option key={addr.id} value={addr.id}>
                {addr.rua} {addr.numero} - CEP {addr.cep}
              </option>
            ))}
          </select>
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

function ImagePicker({ label, onUpload, preview }: { label: string; onUpload: (file: File) => Promise<string>; preview?: string }) {
  const [localPreview, setLocalPreview] = useState<string | undefined>(preview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    setLocalPreview(URL.createObjectURL(file));
    try {
      const url = await onUpload(file);
      setLocalPreview(url);
    } catch (err: any) {
      setError(err.message || 'Erro ao subir imagem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form__group">
      <span>{label}</span>
      <label className="upload">
        <input type="file" accept="image/*" onChange={handleChange} />
        <span>{loading ? 'Enviando...' : 'Selecionar imagem'}</span>
      </label>
      {(preview || localPreview) && <img src={localPreview || preview} className="upload__preview" alt="Pré-visualização" />}
      {error && <p className="form__error">{error}</p>}
    </div>
  );
}

function ProductForm({ suppliers, onSubmit, onUpload }: { suppliers: Supplier[]; onSubmit: (product: Product) => Promise<void>; onUpload: (file: File) => Promise<string> }) {
  const [form, setForm] = useState<Product>({ codigo: '', nome: '', descricao: '', categoria: 'produto', quantidade: 0, preco: 0, fornecedor_id: null });
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ ...form, imagem_url: imageUrl });
      setForm({ codigo: '', nome: '', descricao: '', categoria: 'produto', quantidade: 0, preco: 0, fornecedor_id: null });
      setImageUrl(undefined);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar produto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Nome</span>
          <input value={form.nome} required onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Código</span>
          <input value={form.codigo} required onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Categoria</span>
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            <option value="produto">Produto</option>
            <option value="catalogo">Catálogo</option>
            <option value="combo">Combo</option>
          </select>
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
            required
          />
        </label>
        <label className="form__group">
          <span>Preço</span>
          <input
            type="number"
            step="0.01"
            min={0}
            value={form.preco}
            onChange={(e) => setForm({ ...form, preco: Number(e.target.value) })}
            required
          />
        </label>
        <label className="form__group">
          <span>Fornecedor (opcional)</span>
          <select
            value={form.fornecedor_id ?? ''}
            onChange={(e) => setForm({ ...form, fornecedor_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Sem fornecedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.razao_social}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="form__group">
        <span>Descrição</span>
        <textarea value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
      </label>
      <ImagePicker label="Imagem" onUpload={async (file) => {
        const url = await onUpload(file);
        setImageUrl(url);
        return url;
      }} preview={imageUrl} />
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Cadastrar produto'}
        </button>
      </div>
    </form>
  );
}

function RawMaterialForm({ onSubmit, onUpload }: { onSubmit: (material: RawMaterial) => Promise<void>; onUpload: (file: File) => Promise<string> }) {
  const [form, setForm] = useState<RawMaterial>({ nome: '', tipo: '', custo: 0, datavalidade: '', descricao: '', tamanho: '', material: '', acessorio: '' });
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ ...form, imagem_url: imageUrl });
      setForm({ nome: '', tipo: '', custo: 0, datavalidade: '', descricao: '', tamanho: '', material: '', acessorio: '' });
      setImageUrl(undefined);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar matéria-prima');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Nome</span>
          <input value={form.nome} required onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Tipo</span>
          <select value={form.tipo || ''} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="">Selecione</option>
            <option value="componente">Componente</option>
            <option value="insumo">Insumo</option>
            <option value="embalagem">Embalagem</option>
          </select>
        </label>
        <label className="form__group">
          <span>Custo</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.custo || 0}
            onChange={(e) => setForm({ ...form, custo: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Validade</span>
          <input type="date" value={form.datavalidade || ''} onChange={(e) => setForm({ ...form, datavalidade: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Tamanho</span>
          <input value={form.tamanho || ''} onChange={(e) => setForm({ ...form, tamanho: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Material</span>
          <input value={form.material || ''} onChange={(e) => setForm({ ...form, material: e.target.value })} />
        </label>
      </div>
      <div className="grid grid--2">
        <label className="form__group">
          <span>Acessório</span>
          <input value={form.acessorio || ''} onChange={(e) => setForm({ ...form, acessorio: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Descrição</span>
          <textarea value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        </label>
      </div>
      <ImagePicker label="Imagem" onUpload={async (file) => {
        const url = await onUpload(file);
        setImageUrl(url);
        return url;
      }} preview={imageUrl} />
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Cadastrar matéria-prima'}
        </button>
      </div>
    </form>
  );
}

function ProductsTable({ products }: { products: Product[] }) {
  if (!products.length) return <EmptyState message="Nenhum produto cadastrado." />;
  return (
    <div className="table">
      <div className="table__row table__head">
        <span>Nome</span>
        <span>Código</span>
        <span>Categoria</span>
        <span>Qtd</span>
        <span>Preço</span>
      </div>
      {products.map((product) => (
        <div key={product.id || product.codigo} className="table__row">
          <div className="table__cell">
            <strong>{product.nome}</strong>
            <p className="muted">{product.descricao || 'Sem descrição'}</p>
          </div>
          <span className="table__cell">{product.codigo}</span>
          <span className="table__cell">{product.categoria || 'Produto'}</span>
          <span className="table__cell">{product.quantidade}</span>
          <span className="table__cell">{money(product.preco)}</span>
        </div>
      ))}
    </div>
  );
}

function MaterialsTable({ materials }: { materials: RawMaterial[] }) {
  if (!materials.length) return <EmptyState message="Nenhuma matéria-prima cadastrada." />;
  return (
    <div className="table">
      <div className="table__row table__head">
        <span>Nome</span>
        <span>Tipo</span>
        <span>Custo</span>
        <span>Validade</span>
      </div>
      {materials.map((material) => (
        <div key={material.id || material.nome} className="table__row">
          <div className="table__cell">
            <strong>{material.nome}</strong>
            <p className="muted">{material.descricao || 'Sem descrição'}</p>
          </div>
          <span className="table__cell">{material.tipo || 'N/I'}</span>
          <span className="table__cell">{money(material.custo || 0)}</span>
          <span className="table__cell">{material.datavalidade || '--'}</span>
        </div>
      ))}
    </div>
  );
}

function ManufacturingForm({ products, materials, onSubmit }: { products: Product[]; materials: RawMaterial[]; onSubmit: (payload: Manufacturing) => Promise<void> }) {
  const [form, setForm] = useState<Manufacturing>({ produto_id: null, material_id: null, quantidade_material: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ ...form, quantidade_material: Number(form.quantidade_material || 0) });
      setForm({ produto_id: null, material_id: null, quantidade_material: 0 });
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar manufatura');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Produto</span>
          <select value={form.produto_id ?? ''} onChange={(e) => setForm({ ...form, produto_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Selecione</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="form__group">
          <span>Matéria-prima</span>
          <select value={form.material_id ?? ''} onChange={(e) => setForm({ ...form, material_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Selecione</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="form__group">
          <span>Quantidade usada</span>
          <input
            type="number"
            min={0}
            value={form.quantidade_material || 0}
            onChange={(e) => setForm({ ...form, quantidade_material: Number(e.target.value) })}
            required
          />
        </label>
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Registrando...' : 'Registrar manufatura'}
        </button>
      </div>
    </form>
  );
}

function MaterialDeliveryForm({ materials, suppliers, onSubmit }: { materials: RawMaterial[]; suppliers: Supplier[]; onSubmit: (payload: MaterialDelivery) => Promise<void> }) {
  const [form, setForm] = useState<MaterialDelivery>({ material_id: null, fornecedor_id: null, quantidade: 0, data_entrada: '', custo: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ ...form, quantidade: Number(form.quantidade || 0), custo: Number(form.custo || 0) });
      setForm({ material_id: null, fornecedor_id: null, quantidade: 0, data_entrada: '', custo: 0 });
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar entrega');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Matéria-prima</span>
          <select value={form.material_id ?? ''} onChange={(e) => setForm({ ...form, material_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Selecione</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="form__group">
          <span>Fornecedor (opcional)</span>
          <select value={form.fornecedor_id ?? ''} onChange={(e) => setForm({ ...form, fornecedor_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Sem fornecedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.razao_social}
              </option>
            ))}
          </select>
        </label>
        <label className="form__group">
          <span>Quantidade</span>
          <input type="number" min={0} value={form.quantidade || 0} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} required />
        </label>
      </div>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Data de entrada</span>
          <input type="date" value={form.data_entrada || ''} onChange={(e) => setForm({ ...form, data_entrada: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Custo</span>
          <input type="number" min={0} step="0.01" value={form.custo || 0} onChange={(e) => setForm({ ...form, custo: Number(e.target.value) })} />
        </label>
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Registrando...' : 'Registrar entrega'}
        </button>
      </div>
    </form>
  );
}

function OrdersForm({ customers, onSubmit }: { customers: Customer[]; onSubmit: (payload: Order) => Promise<void> }) {
  const [form, setForm] = useState<Order>({ cliente_id: null, endereco: '', preco: 0, data_pedido: '', cpf_presentado: '', nome_presentado: '', email_presentado: '', endereco_presentado: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        preco: Number(form.preco || 0),
        cpf_presentado: form.cpf_presentado ? digitsOnly(form.cpf_presentado) : undefined,
      });
      setForm({ cliente_id: null, endereco: '', preco: 0, data_pedido: '', cpf_presentado: '', nome_presentado: '', email_presentado: '', endereco_presentado: '' });
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Cliente</span>
          <select value={form.cliente_id ?? ''} onChange={(e) => setForm({ ...form, cliente_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Selecione</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="form__group">
          <span>Preço</span>
          <input type="number" min={0} step="0.01" value={form.preco || 0} onChange={(e) => setForm({ ...form, preco: Number(e.target.value) })} />
        </label>
        <label className="form__group">
          <span>Data do pedido</span>
          <input type="date" value={form.data_pedido || ''} onChange={(e) => setForm({ ...form, data_pedido: e.target.value })} />
        </label>
      </div>
      <label className="form__group">
        <span>Endereço de entrega</span>
        <input value={form.endereco || ''} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, complemento" />
      </label>
      <div className="grid grid--2">
        <label className="form__group">
          <span>CPF presenteado</span>
          <input value={form.cpf_presentado || ''} onChange={(e) => setForm({ ...form, cpf_presentado: maskCpf(e.target.value) })} placeholder="000.000.000-00" />
        </label>
        <label className="form__group">
          <span>Nome presenteado</span>
          <input value={form.nome_presentado || ''} onChange={(e) => setForm({ ...form, nome_presentado: e.target.value })} />
        </label>
      </div>
      <div className="grid grid--2">
        <label className="form__group">
          <span>Email presenteado</span>
          <input type="email" value={form.email_presentado || ''} onChange={(e) => setForm({ ...form, email_presentado: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Endereço presenteado</span>
          <input value={form.endereco_presentado || ''} onChange={(e) => setForm({ ...form, endereco_presentado: e.target.value })} />
        </label>
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Registrando...' : 'Registrar pedido'}
        </button>
      </div>
    </form>
  );
}

function ShipmentForm({ orders, products, onSubmit }: { orders: Order[]; products: Product[]; onSubmit: (payload: Shipment) => Promise<void> }) {
  const [form, setForm] = useState<Shipment>({ pedido_id: null, produto_id: null, quantidade: 0, data_envio: '', preco: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ ...form, quantidade: Number(form.quantidade || 0), preco: Number(form.preco || 0) });
      setForm({ pedido_id: null, produto_id: null, quantidade: 0, data_envio: '', preco: 0 });
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar envio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Pedido</span>
          <select value={form.pedido_id ?? ''} onChange={(e) => setForm({ ...form, pedido_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Selecione</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                Pedido #{order.id}
              </option>
            ))}
          </select>
        </label>
        <label className="form__group">
          <span>Produto</span>
          <select value={form.produto_id ?? ''} onChange={(e) => setForm({ ...form, produto_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Selecione</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="form__group">
          <span>Quantidade</span>
          <input type="number" min={0} value={form.quantidade || 0} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} required />
        </label>
      </div>
      <div className="grid grid--2">
        <label className="form__group">
          <span>Data de envio</span>
          <input type="date" value={form.data_envio || ''} onChange={(e) => setForm({ ...form, data_envio: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Preço</span>
          <input type="number" min={0} step="0.01" value={form.preco || 0} onChange={(e) => setForm({ ...form, preco: Number(e.target.value) })} />
        </label>
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Registrando...' : 'Registrar envio'}
        </button>
      </div>
    </form>
  );
}

function FeedbackForm({ customers, onSubmit }: { customers: Customer[]; onSubmit: (payload: FeedbackRow) => Promise<void> }) {
  const [form, setForm] = useState<FeedbackRow>({ cliente_id: null, data: '', nota: 0, contato: '', observacao: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ ...form, nota: Number(form.nota || 0) });
      setForm({ cliente_id: null, data: '', nota: 0, contato: '', observacao: '' });
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar feedback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--3">
        <label className="form__group">
          <span>Cliente</span>
          <select value={form.cliente_id ?? ''} onChange={(e) => setForm({ ...form, cliente_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Selecione</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="form__group">
          <span>Data</span>
          <input type="date" value={form.data || ''} onChange={(e) => setForm({ ...form, data: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Nota</span>
          <input type="number" min={0} max={10} value={form.nota || 0} onChange={(e) => setForm({ ...form, nota: Number(e.target.value) })} />
        </label>
      </div>
      <div className="grid grid--2">
        <label className="form__group">
          <span>Contato</span>
          <input value={form.contato || ''} onChange={(e) => setForm({ ...form, contato: e.target.value })} />
        </label>
        <label className="form__group">
          <span>Observação</span>
          <textarea value={form.observacao || ''} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
        </label>
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Registrando...' : 'Registrar feedback'}
        </button>
      </div>
    </form>
  );
}

function OperationsTabs({
  active,
  onChange,
}: {
  active: 'manufatura' | 'entrega' | 'pedido' | 'envio' | 'feedback';
  onChange: (key: 'manufatura' | 'entrega' | 'pedido' | 'envio' | 'feedback') => void;
}) {
  const tabs = [
    { key: 'manufatura', label: 'Manufatura' },
    { key: 'entrega', label: 'Entrega de material' },
    { key: 'pedido', label: 'Pedidos' },
    { key: 'envio', label: 'Envio de produto' },
    { key: 'feedback', label: 'Feedback' },
  ] as const;

  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button key={tab.key} className={`tabs__item ${active === tab.key ? 'is-active' : ''}`} onClick={() => onChange(tab.key)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function OperationsPage({
  products,
  materials,
  suppliers,
  customers,
  orders,
  shipments,
  deliveries,
  manufacturing,
  feedbackRows,
  onCreateManufacturing,
  onCreateDelivery,
  onCreateOrder,
  onCreateShipment,
  onCreateFeedback,
}: {
  products: Product[];
  materials: RawMaterial[];
  suppliers: Supplier[];
  customers: Customer[];
  orders: Order[];
  shipments: Shipment[];
  deliveries: MaterialDelivery[];
  manufacturing: Manufacturing[];
  feedbackRows: FeedbackRow[];
  onCreateManufacturing: (payload: Manufacturing) => Promise<void>;
  onCreateDelivery: (payload: MaterialDelivery) => Promise<void>;
  onCreateOrder: (payload: Order) => Promise<void>;
  onCreateShipment: (payload: Shipment) => Promise<void>;
  onCreateFeedback: (payload: FeedbackRow) => Promise<void>;
}) {
  const [tab, setTab] = useState<'manufatura' | 'entrega' | 'pedido' | 'envio' | 'feedback'>('manufatura');

  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <h1>Operações</h1>
          <p className="muted">Fluxos derivados das tabelas de manufatura, entregas, pedidos, envios e feedback.</p>
          <OperationsTabs active={tab} onChange={setTab} />
        </div>
      </header>

      {tab === 'manufatura' && (
        <section className="panel__section">
          <SectionHeader title="Manufatura" subtitle="Relaciona produtos com matérias-primas e quantidades" />
          <ManufacturingForm products={products} materials={materials} onSubmit={onCreateManufacturing} />
          {manufacturing.length ? (
            <div className="table">
              <div className="table__row table__head">
                <span>Produto</span>
                <span>Matéria-prima</span>
                <span>Qtd.</span>
              </div>
              {manufacturing.map((row) => (
                <div key={row.id || `${row.produto_id}-${row.material_id}`} className="table__row">
                  <span className="table__cell">{products.find((p) => p.id === row.produto_id)?.nome || 'Produto'}</span>
                  <span className="table__cell">{materials.find((m) => m.id === row.material_id)?.nome || 'Material'}</span>
                  <span className="table__cell">{row.quantidade_material ?? 0}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Nenhuma relação de manufatura cadastrada." />
          )}
        </section>
      )}

      {tab === 'entrega' && (
        <section className="panel__section">
          <SectionHeader title="Entrega de material" subtitle="Entradas com fornecedor opcional e custo" />
          <MaterialDeliveryForm materials={materials} suppliers={suppliers} onSubmit={onCreateDelivery} />
          {deliveries.length ? (
            <div className="table">
              <div className="table__row table__head">
                <span>Material</span>
                <span>Fornecedor</span>
                <span>Qtd.</span>
                <span>Custo</span>
              </div>
              {deliveries.map((delivery) => (
                <div key={delivery.id || `${delivery.material_id}-${delivery.fornecedor_id}-${delivery.data_entrada}`} className="table__row">
                  <div className="table__cell">
                    <strong>{materials.find((m) => m.id === delivery.material_id)?.nome || 'Material'}</strong>
                    <p className="muted">{delivery.data_entrada || 'Data não informada'}</p>
                  </div>
                  <span className="table__cell">{suppliers.find((s) => s.id === delivery.fornecedor_id)?.razao_social || '---'}</span>
                  <span className="table__cell">{delivery.quantidade ?? 0}</span>
                  <span className="table__cell">{money(delivery.custo || 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Nenhuma entrega registrada." />
          )}
        </section>
      )}

      {tab === 'pedido' && (
        <section className="panel__section">
          <SectionHeader title="Pedidos" subtitle="Ligados a cliente e dados de presenteado" />
          <OrdersForm customers={customers} onSubmit={onCreateOrder} />
          {orders.length ? (
            <div className="table">
              <div className="table__row table__head">
                <span>Pedido</span>
                <span>Cliente</span>
                <span>Preço</span>
              </div>
              {orders.map((order) => (
                <div key={order.id || order.endereco} className="table__row">
                  <div className="table__cell">
                    <strong>#{order.id}</strong>
                    <p className="muted">{order.data_pedido || 'Data não informada'}</p>
                  </div>
                  <span className="table__cell">{customers.find((c) => c.id === order.cliente_id)?.nome || 'Cliente'}</span>
                  <span className="table__cell">{money(order.preco || 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Nenhum pedido registrado." />
          )}
        </section>
      )}

      {tab === 'envio' && (
        <section className="panel__section">
          <SectionHeader title="Envio de produto" subtitle="Relaciona pedidos com produtos e datas de envio" />
          <ShipmentForm orders={orders} products={products} onSubmit={onCreateShipment} />
          {shipments.length ? (
            <div className="table">
              <div className="table__row table__head">
                <span>Pedido</span>
                <span>Produto</span>
                <span>Qtd.</span>
                <span>Preço</span>
              </div>
              {shipments.map((ship) => (
                <div key={ship.id || `${ship.pedido_id}-${ship.produto_id}`} className="table__row">
                  <div className="table__cell">
                    <strong>Pedido #{ship.pedido_id}</strong>
                    <p className="muted">{ship.data_envio || 'Data não informada'}</p>
                  </div>
                  <span className="table__cell">{products.find((p) => p.id === ship.produto_id)?.nome || 'Produto'}</span>
                  <span className="table__cell">{ship.quantidade ?? 0}</span>
                  <span className="table__cell">{money(ship.preco || 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Nenhum envio registrado." />
          )}
        </section>
      )}

      {tab === 'feedback' && (
        <section className="panel__section">
          <SectionHeader title="Feedback" subtitle="Avaliações de clientes com notas e observações" />
          <FeedbackForm customers={customers} onSubmit={onCreateFeedback} />
          {feedbackRows.length ? (
            <div className="table">
              <div className="table__row table__head">
                <span>Cliente</span>
                <span>Nota</span>
                <span>Data</span>
              </div>
              {feedbackRows.map((fb) => (
                <div key={fb.id || `${fb.cliente_id}-${fb.data}`} className="table__row">
                  <div className="table__cell">
                    <strong>{customers.find((c) => c.id === fb.cliente_id)?.nome || 'Cliente'}</strong>
                    <p className="muted">{fb.observacao || 'Sem observação'}</p>
                  </div>
                  <span className="table__cell">{fb.nota ?? 0}</span>
                  <span className="table__cell">{fb.data || '--'}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Nenhum feedback registrado." />
          )}
        </section>
      )}
    </div>
  );
}

function ItemsPage({ products, materials, suppliers, onCreateProduct, onCreateMaterial, onUpload }: { products: Product[]; materials: RawMaterial[]; suppliers: Supplier[]; onCreateProduct: (product: Product) => Promise<void>; onCreateMaterial: (material: RawMaterial) => Promise<void>; onUpload: (file: File) => Promise<string> }) {
  const [tab, setTab] = useState<'produtos' | 'materiais'>('produtos');

  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <h1>Itens</h1>
          <p className="muted">Cadastre produtos e matérias-primas seguindo os campos do banco.</p>
          <div className="tabs">
            <button className={`tabs__item ${tab === 'produtos' ? 'is-active' : ''}`} onClick={() => setTab('produtos')}>
              Produtos
            </button>
            <button className={`tabs__item ${tab === 'materiais' ? 'is-active' : ''}`} onClick={() => setTab('materiais')}>
              Matéria-prima
            </button>
          </div>
        </div>
      </header>
      {tab === 'produtos' ? (
        <section className="panel__section">
          <SectionHeader title="Produtos" subtitle="Código, categoria, estoque, preço e fornecedor" />
          <ProductForm suppliers={suppliers} onSubmit={onCreateProduct} onUpload={onUpload} />
          <ProductsTable products={products} />
        </section>
      ) : (
        <section className="panel__section">
          <SectionHeader title="Matéria-prima" subtitle="Dados completos para manufatura" />
          <RawMaterialForm onSubmit={onCreateMaterial} onUpload={onUpload} />
          <MaterialsTable materials={materials} />
        </section>
      )}
    </div>
  );
}

function SuppliersPage({ suppliers, addresses, onCreate }: { suppliers: Supplier[]; addresses: Address[]; onCreate: (supplier: Supplier) => Promise<void> }) {
  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <h1>Fornecedores</h1>
          <p className="muted">CNPJ, contato e endereço opcional conforme tabela.</p>
        </div>
      </header>
      <SupplierForm addresses={addresses} onSubmit={onCreate} />
      <section className="panel__section">
        <SectionHeader title="Últimos fornecedores" />
        {suppliers.length ? (
          <ul className="list list--bordered">
            {suppliers.map((supplier) => (
              <li key={supplier.id || supplier.cnpj} className="list__item">
                <div>
                  <strong>{supplier.razao_social}</strong>
                  <p className="muted">CNPJ {maskCnpj(supplier.cnpj)}</p>
                </div>
                <div className="list__actions">
                  {supplier.telefone && <span className="badge">{maskPhone(supplier.telefone)}</span>}
                  {supplier.email && <span className="badge badge--soft">{supplier.email}</span>}
                </div>
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

function Dashboard({ products, materials, suppliers, customers }: { products: Product[]; materials: RawMaterial[]; suppliers: Supplier[]; customers: Customer[] }) {
  const summary = [
    { label: 'Produtos', value: products.length },
    { label: 'Matérias-primas', value: materials.length },
    { label: 'Fornecedores', value: suppliers.length },
    { label: 'Clientes', value: customers.length },
  ];

  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Visão rápida das principais entidades.</p>
        </div>
      </header>
      <section className="panel__section grid grid--4">
        {summary.map((item) => (
          <div key={item.label} className="card">
            <p className="muted">{item.label}</p>
            <h2>{item.value}</h2>
          </div>
        ))}
      </section>
      <section className="panel__section">
        <SectionHeader title="Sugestão de ordem" subtitle="1) Endereços → 2) Clientes/Fornecedores → 3) Telefones → 4) Itens" />
        <p className="muted">
          Endereços são pré-requisito para clientes e opcionais para fornecedores. Produtos podem referenciar fornecedores; matérias-primas alimentam manufatura.
        </p>
      </section>
    </div>
  );
}

function SimpleList<T extends { id?: number; nome?: string }>({ title, items, emptyMessage, descriptor }: { title: string; items: T[]; emptyMessage: string; descriptor?: (item: T) => string }) {
  return (
    <section className="panel__section">
      <SectionHeader title={title} />
      {items.length ? (
        <ul className="list list--bordered">
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

function App() {
  const { token, authenticated, saveToken } = useAuth();
  const { request } = useApi(token);
  const [page, setPage] = useState<Page>('dashboard');
  const [loginOpen, setLoginOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [manufacturing, setManufacturing] = useState<Manufacturing[]>([]);
  const [deliveries, setDeliveries] = useState<MaterialDelivery[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const guardedFetch = useCallback(
    async <T,>(path: string): Promise<T> => {
      if (!authenticated) throw new Error('Faça login para carregar dados.');
      const res = await request<T>(path);
      return res.data;
    },
    [authenticated, request]
  );

  const uploadImage = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await request<UploadResponse>('/upload', { method: 'POST', body: formData });
        return res.data.url || res.data.path || URL.createObjectURL(file);
      } catch (err: any) {
        setFeedback('Ative o endpoint /upload no backend para salvar blobs. Pré-visualização local aplicada.');
        return URL.createObjectURL(file);
      }
    },
    [request]
  );

  const loadProducts = useCallback(async () => {
    try {
      const data = await guardedFetch<Product[]>('/products');
      setProducts(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadMaterials = useCallback(async () => {
    try {
      const data = await guardedFetch<RawMaterial[]>('/materials');
      setMaterials(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await guardedFetch<Supplier[]>('/suppliers');
      setSuppliers(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await guardedFetch<Customer[]>('/customers');
      setCustomers(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadAddresses = useCallback(async () => {
    try {
      const data = await guardedFetch<Address[]>('/addresses');
      setAddresses(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadPhones = useCallback(async () => {
    try {
      const data = await guardedFetch<Phone[]>('/phones');
      setPhones(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadManufacturing = useCallback(async () => {
    try {
      const data = await guardedFetch<Manufacturing[]>('/manufaturas');
      setManufacturing(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadDeliveries = useCallback(async () => {
    try {
      const data = await guardedFetch<MaterialDelivery[]>('/entregas-material');
      setDeliveries(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadOrders = useCallback(async () => {
    try {
      const data = await guardedFetch<Order[]>('/pedidos');
      setOrders(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadShipments = useCallback(async () => {
    try {
      const data = await guardedFetch<Shipment[]>('/envios');
      setShipments(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadFeedback = useCallback(async () => {
    try {
      const data = await guardedFetch<FeedbackRow[]>('/feedback');
      setFeedbackRows(data || []);
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  useEffect(() => {
    if (!authenticated) {
      setProducts([]);
      setMaterials([]);
      setSuppliers([]);
      setCustomers([]);
      setAddresses([]);
      setPhones([]);
      setManufacturing([]);
      setDeliveries([]);
      setOrders([]);
      setShipments([]);
      setFeedbackRows([]);
      return;
    }

    loadAddresses();
    if (page === 'dashboard' || page === 'items') {
      loadProducts();
      loadMaterials();
      loadSuppliers();
      loadCustomers();
    }
    if (page === 'operations') {
      loadProducts();
      loadMaterials();
      loadSuppliers();
      loadCustomers();
      loadManufacturing();
      loadDeliveries();
      loadOrders();
      loadShipments();
      loadFeedback();
    }
    if (page === 'suppliers') loadSuppliers();
    if (page === 'customers' || page === 'phones') loadCustomers();
    if (page === 'phones') loadPhones();
    if (page === 'addresses') loadAddresses();
  }, [authenticated, page, loadProducts, loadMaterials, loadSuppliers, loadCustomers, loadAddresses, loadPhones, loadManufacturing, loadDeliveries, loadOrders, loadShipments, loadFeedback]);

  const handleCreateProduct = async (payload: Product) => {
    const res = await request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Produto salvo com sucesso.');
    setProducts((prev) => [res.data, ...prev]);
  };

  const handleCreateMaterial = async (payload: RawMaterial) => {
    const res = await request<RawMaterial>('/materials', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Matéria-prima salva com sucesso.');
    setMaterials((prev) => [res.data, ...prev]);
  };

  const handleCreateSupplier = async (payload: Supplier) => {
    const res = await request<Supplier>('/suppliers', {
      method: 'POST',
      body: JSON.stringify({ ...payload, razaoSocial: payload.razao_social }),
    });
    setFeedback('Fornecedor salvo com sucesso.');
    setSuppliers((prev) => [res.data, ...prev]);
  };

  const handleCreateCustomer = async (payload: Customer) => {
    const res = await request<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Cliente salvo com sucesso.');
    setCustomers((prev) => [res.data, ...prev]);
  };

  const handleCreateAddress = async (payload: Address) => {
    const res = await request<Address>('/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Endereço salvo com sucesso.');
    setAddresses((prev) => [res.data, ...prev]);
  };

  const handleCreatePhone = async (payload: Phone) => {
    const res = await request<Phone>('/phones', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Telefone salvo com sucesso.');
    setPhones((prev) => [res.data, ...prev]);
  };

  const handleCreateManufacturing = async (payload: Manufacturing) => {
    const res = await request<Manufacturing>('/manufaturas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Manufatura registrada.');
    setManufacturing((prev) => [res.data, ...prev]);
  };

  const handleCreateDelivery = async (payload: MaterialDelivery) => {
    const res = await request<MaterialDelivery>('/entregas-material', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Entrega registrada.');
    setDeliveries((prev) => [res.data, ...prev]);
  };

  const handleCreateOrder = async (payload: Order) => {
    const res = await request<Order>('/pedidos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Pedido registrado.');
    setOrders((prev) => [res.data, ...prev]);
  };

  const handleCreateShipment = async (payload: Shipment) => {
    const res = await request<Shipment>('/envios', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Envio registrado.');
    setShipments((prev) => [res.data, ...prev]);
  };

  const handleCreateFeedback = async (payload: FeedbackRow) => {
    const res = await request<FeedbackRow>('/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setFeedback('Feedback registrado.');
    setFeedbackRows((prev) => [res.data, ...prev]);
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
          <p className="muted">O login evita múltiplas requisições anônimas. Use o botão Entrar na lateral para abrir o modal.</p>
        </div>
      );
    }

    switch (page) {
      case 'items':
        return (
          <ItemsPage
            products={products}
            materials={materials}
            suppliers={suppliers}
            onCreateProduct={handleCreateProduct}
            onCreateMaterial={handleCreateMaterial}
            onUpload={uploadImage}
          />
        );
      case 'operations':
        return (
          <OperationsPage
            products={products}
            materials={materials}
            suppliers={suppliers}
            customers={customers}
            orders={orders}
            shipments={shipments}
            deliveries={deliveries}
            manufacturing={manufacturing}
            feedbackRows={feedbackRows}
            onCreateManufacturing={handleCreateManufacturing}
            onCreateDelivery={handleCreateDelivery}
            onCreateOrder={handleCreateOrder}
            onCreateShipment={handleCreateShipment}
            onCreateFeedback={handleCreateFeedback}
          />
        );
      case 'suppliers':
        return <SuppliersPage suppliers={suppliers} addresses={addresses} onCreate={handleCreateSupplier} />;
      case 'customers':
        return (
          <div className="panel">
            <header className="panel__header">
              <div>
                <h1>Clientes</h1>
                <p className="muted">CPF/CNPJ, data de nascimento e endereço obrigatório.</p>
              </div>
            </header>
            <CustomerForm addresses={addresses} onSubmit={handleCreateCustomer} />
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
                <p className="muted">Rua, número e CEP são obrigatórios.</p>
              </div>
            </header>
            <AddressForm onSubmit={handleCreateAddress} />
            <SimpleList
              title="Endereços"
              items={addresses as any}
              emptyMessage="Nenhum endereço encontrado."
              descriptor={(addr: Address) => `${addr.rua}, ${addr.numero} - CEP ${addr.cep}`}
            />
          </div>
        );
      case 'phones':
        return (
          <div className="panel">
            <header className="panel__header">
              <div>
                <h1>Telefones</h1>
                <p className="muted">Associados a clientes com formatação +55 (DDD) número.</p>
              </div>
            </header>
            <PhoneForm customers={customers} onSubmit={handleCreatePhone} />
            <SimpleList
              title="Telefones"
              items={phones as any}
              emptyMessage="Nenhum telefone encontrado."
              descriptor={(phone: Phone) => `${maskPhone(`${phone.ddd || ''}${phone.numero || ''}`)}`}
            />
          </div>
        );
      default:
        return <Dashboard products={products} materials={materials} suppliers={suppliers} customers={customers} />;
    }
  }, [authenticated, page, products, materials, suppliers, customers, addresses, phones, uploadImage, orders, shipments, deliveries, manufacturing, feedbackRows]);

  return (
    <div className="layout">
      <Sidebar page={page} setPage={setPage} authenticated={authenticated} onLogin={() => setLoginOpen(true)} onLogout={() => saveToken(null)} />
      <main className="content">
        {feedback && <div className="toast toast--inline">{feedback}</div>}
        {content}
      </main>
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={(tok) => {
          saveToken(tok);
          setLoginOpen(false);
        }}
      />
    </div>
  );
}

export default App;
