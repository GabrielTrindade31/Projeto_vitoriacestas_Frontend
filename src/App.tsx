import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
  bairro?: string;
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
  ddi?: string | null;
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
  fornecedorId?: number | null;
  imagem_url?: string;
  imagemUrl?: string;
}

interface RawMaterial {
  id?: number;
  nome: string;
  tipo?: string;
  custo?: number;
  datavalidade?: string;
  dataValidade?: string;
  descricao?: string;
  tamanho?: string;
  material?: string;
  acessorio?: string;
  imagem_url?: string;
  imagemUrl?: string;
}

interface Phone {
  id?: number;
  cliente_id?: number;
  ddi?: string;
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

interface ColumnDef<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

type Page = 'dashboard' | 'items' | 'operations' | 'suppliers' | 'customers' | 'addresses' | 'phones';

const digitsOnly = (value: string) => value.replace(/\D+/g, '');

const normalizeIdValue = (value?: number | string | null) => {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeOptionalString = (value?: string | null) => {
  const trimmed = value?.trim() || '';
  return trimmed ? trimmed : null;
};

const normalizeNumberValue = (value?: number | string | null, allowNull = false) => {
  const normalized = normalizeIdValue(value);
  if (normalized === null) return allowNull ? null : 0;
  return normalized;
};

const normalizeDateValue = (value?: string | null) => {
  if (!value) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
};

const normalizePhoneDigits = (value: string) => {
  const digits = digitsOnly(value);
  return digits.slice(0, 13);
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

const maskPhone = (value: string, ddi = '55') => {
  const digits = normalizePhoneDigits(value);
  if (!digits) return '';
  const countrySize = digits.length > 11 ? digits.length - 11 : 0;
  const country = digits.slice(0, countrySize) || ddi;
  const ddd = digits.slice(countrySize, countrySize + 3).replace(/^0/, '') || '--';
  const rest = digits.slice(countrySize + 3);
  if (!rest) return `+${country} (${ddd})`;
  const first = rest.slice(0, Math.max(0, rest.length - 4));
  const last = rest.slice(-4);
  return `+${country} (${ddd}) ${first ? `${first}-` : ''}${last}`;
};

const formatPhoneInput = (ddi: string, ddd: string, numero: string) => {
  const base = digitsOnly(numero || '');
  const ddiValue = digitsOnly(ddi || '') || '55';
  const dddValue = digitsOnly(ddd || '');
  const first = base.slice(0, Math.max(0, base.length - 4));
  const last = base.slice(-4);
  return `+${ddiValue} (${dddValue || '--'}) ${first ? `${first}-` : ''}${last}`.trim();
};

const DDI_OPTIONS = [
  { code: '55', label: 'Brasil', flag: '🇧🇷' },
  { code: '1', label: 'Estados Unidos/Canadá', flag: '🇺🇸' },
  { code: '52', label: 'México', flag: '🇲🇽' },
  { code: '54', label: 'Argentina', flag: '🇦🇷' },
  { code: '56', label: 'Chile', flag: '🇨🇱' },
  { code: '57', label: 'Colômbia', flag: '🇨🇴' },
  { code: '351', label: 'Portugal', flag: '🇵🇹' },
  { code: '34', label: 'Espanha', flag: '🇪🇸' },
  { code: '44', label: 'Reino Unido', flag: '🇬🇧' },
  { code: '49', label: 'Alemanha', flag: '🇩🇪' },
  { code: '33', label: 'França', flag: '🇫🇷' },
  { code: '39', label: 'Itália', flag: '🇮🇹' },
  { code: '81', label: 'Japão', flag: '🇯🇵' },
  { code: '82', label: 'Coreia do Sul', flag: '🇰🇷' },
  { code: '86', label: 'China', flag: '🇨🇳' },
  { code: '91', label: 'Índia', flag: '🇮🇳' },
  { code: '7', label: 'Rússia', flag: '🇷🇺' },
  { code: '61', label: 'Austrália', flag: '🇦🇺' },
  { code: '64', label: 'Nova Zelândia', flag: '🇳🇿' },
  { code: '27', label: 'África do Sul', flag: '🇿🇦' },
];

const PRODUCT_IMAGE_CACHE_KEY = 'vc_product_images';
const MATERIAL_IMAGE_CACHE_KEY = 'vc_material_images';

const loadImageCache = (key: string): Record<string, string> => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch (err) {
    console.warn('Falha ao carregar cache de imagens', err);
    return {};
  }
};

const saveImageCache = (key: string, cache: Record<string, string>) => {
  try {
    localStorage.setItem(key, JSON.stringify(cache));
  } catch (err) {
    console.warn('Falha ao salvar cache de imagens', err);
  }
};

const cacheImage = (key: string, identifier?: string | number | null, url?: string | null) => {
  const safeUrl = normalizeOptionalString(url || undefined);
  if (!identifier || !safeUrl) return;
  const cache = loadImageCache(key);
  cache[String(identifier)] = safeUrl;
  saveImageCache(key, cache);
};

const mergeCachedImages = <T extends { imagem_url?: string; imagemUrl?: string }>(
  items: T[],
  key: string,
  getIdentifier: (item: T) => string | number | undefined | null
) => {
  const cache = loadImageCache(key);
  return items.map((item) => {
    const identifier = getIdentifier(item);
    const cached = identifier ? cache[String(identifier)] : undefined;
    if (cached && !item.imagem_url && !item.imagemUrl) {
      return { ...item, imagem_url: cached, imagemUrl: cached } as T;
    }
    return item;
  });
};

const mapProductResponse = (product: any): Product => ({
  ...product,
  fornecedor_id: normalizeIdValue(product?.fornecedor_id ?? product?.fornecedorId),
  fornecedorId: normalizeIdValue(product?.fornecedor_id ?? product?.fornecedorId),
  imagem_url: product?.imagem_url ?? product?.imagemUrl,
  imagemUrl: product?.imagemUrl ?? product?.imagem_url,
});

const mapMaterialResponse = (material: any): RawMaterial => ({
  ...material,
  datavalidade: material?.datavalidade ?? material?.dataValidade ?? null,
  dataValidade: material?.dataValidade ?? material?.datavalidade ?? null,
  imagem_url: material?.imagem_url ?? material?.imagemUrl,
  imagemUrl: material?.imagemUrl ?? material?.imagem_url,
});

const mapSupplierResponse = (supplier: any): Supplier => ({
  ...supplier,
  razao_social: supplier?.razao_social ?? supplier?.razaoSocial,
  contato: supplier?.contato ?? supplier?.contato,
  endereco_id: normalizeIdValue(supplier?.endereco_id ?? supplier?.enderecoId),
  ddi: supplier?.ddi ?? null,
  telefone: supplier?.telefone ?? null,
});

const mapCustomerResponse = (customer: any): Customer => ({
  ...customer,
  endereco_id: normalizeIdValue(customer?.endereco_id ?? customer?.enderecoId) ?? undefined,
});

const mapPhoneResponse = (phone: any): Phone => ({
  ...phone,
  cliente_id: normalizeIdValue(phone?.cliente_id ?? phone?.clienteId) ?? undefined,
  ddi: phone?.ddi ?? '55',
});

const mapAddressResponse = (address: any): Address => ({
  ...address,
  bairro: address?.bairro ?? address?.district ?? undefined,
});

const mapManufacturingResponse = (row: any): Manufacturing => ({
  ...row,
  produto_id: normalizeIdValue(row?.produto_id ?? row?.produtoId),
  material_id: normalizeIdValue(row?.material_id ?? row?.materialId),
  quantidade_material: normalizeNumberValue(row?.quantidade_material ?? row?.quantidadeMaterial, true) ?? undefined,
});

const mapDeliveryResponse = (delivery: any): MaterialDelivery => ({
  ...delivery,
  material_id: normalizeIdValue(delivery?.material_id ?? delivery?.materialId),
  fornecedor_id: normalizeIdValue(delivery?.fornecedor_id ?? delivery?.fornecedorId),
  data_entrada: delivery?.data_entrada ?? delivery?.dataEntrada ?? null,
});

const mapOrderResponse = (order: any): Order => ({
  ...order,
  cliente_id: normalizeIdValue(order?.cliente_id ?? order?.clienteId),
  data_pedido: order?.data_pedido ?? order?.dataPedido ?? null,
});

const mapShipmentResponse = (shipment: any): Shipment => ({
  ...shipment,
  pedido_id: normalizeIdValue(shipment?.pedido_id ?? shipment?.pedidoId),
  produto_id: normalizeIdValue(shipment?.produto_id ?? shipment?.produtoId),
  data_envio: shipment?.data_envio ?? shipment?.dataEnvio ?? null,
});

const mapFeedbackResponse = (feedback: any): FeedbackRow => ({
  ...feedback,
  cliente_id: normalizeIdValue(feedback?.cliente_id ?? feedback?.clienteId),
});

const money = (value: number | string) => `R$ ${Number(value || 0).toFixed(2)}`;

const exportToXls = <T,>(filename: string, columns: ColumnDef<T>[], rows: T[]) => {
  if (!rows.length) return;
  const header = columns.map((col) => col.label).join('\t');
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const raw = col.value(row);
        if (raw === null || raw === undefined) return '';
        return String(raw).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
      })
      .join('\t')
  );
  const content = [header, ...lines].join('\n');
  const blob = new Blob([content], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

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

      const normalizedData = data && typeof data === 'object' && 'data' in data ? (data as any).data : data;

      return { data: normalizedData as T, message: (data as any)?.message } as ApiResponse<T>;
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

function SearchControls({
  value,
  onChange,
  field,
  onFieldChange,
  options,
  onSearch,
  placeholder = 'Digite para filtrar',
  searchLabel = 'Buscar',
  clearLabel = 'Limpar',
}: {
  value: string;
  onChange: (val: string) => void;
  field: string;
  onFieldChange: (val: any) => void;
  options: { value: string; label: string }[];
  onSearch?: () => void;
  placeholder?: string;
  searchLabel?: string;
  clearLabel?: string;
}) {
  return (
    <div className="search-panel search-panel--inline" style={{ marginBottom: '12px' }}>
      <div className="grid grid--3" style={{ alignItems: 'flex-end' }}>
        <label className="form__group">
          <span>Campo</span>
          <select value={field} onChange={(e) => onFieldChange(e.target.value)}>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form__group">
          <span>Pesquisar</span>
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        </label>
        <div className="form__actions" style={{ margin: 0, justifyContent: 'flex-start', gap: '8px' }}>
          {onSearch && (
            <button className="btn" type="button" onClick={onSearch}>
              {searchLabel}
            </button>
          )}
          <button className="btn btn--ghost" type="button" onClick={() => onChange('')}>
            {clearLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddressForm({
  onSubmit,
  onSearch,
  addresses,
}: {
  onSubmit: (address: Address) => Promise<void>;
  onSearch: (term: string, field?: string) => Promise<Address[]>;
  addresses: Address[];
}) {
  const [form, setForm] = useState<Address>({ rua: '', cep: '', numero: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Address[]>([]);
  const [editing, setEditing] = useState<Address | null>(null);
  const [searchField, setSearchField] = useState<'all' | 'id' | 'rua' | 'numero' | 'cep'>('all');

  const displayedAddresses = results.length ? results : addresses;

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (!value.trim()) {
      setResults([]);
    }
  };

  const handleSubmit = async (
    event?: React.FormEvent | React.MouseEvent<HTMLButtonElement>,
    mode: 'create' | 'update' = editing ? 'update' : 'create'
  ) => {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = { ...form, id: mode === 'update' ? editing?.id : undefined, cep: digitsOnly(form.cep) } as Address;
      await onSubmit(payload);
      setForm({ rua: '', cep: '', numero: '' });
      if (mode === 'update') {
        setEditing(null);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar endereço');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    const query = searchTerm.trim();
    if (!query) {
      setResults([]);
      return;
    }
    const data = await onSearch(query, searchField === 'all' ? undefined : searchField);
    if (data.length) {
      setResults(data);
      return;
    }
    const lowered = query.toLowerCase();
    const local = addresses.filter((addr) => {
      const matchesField = (value?: string | number | null) => String(value || '').toLowerCase().includes(lowered);
      if (searchField === 'rua') return matchesField(addr.rua);
      if (searchField === 'numero') return matchesField(addr.numero);
      if (searchField === 'cep') return matchesField(addr.cep);
      if (searchField === 'id') return matchesField(addr.id);
      return matchesField(addr.rua) || matchesField(addr.numero) || matchesField(addr.cep) || matchesField(addr.id);
    });
    setResults(local);
  };

  const handleSelect = (address: Address) => {
    setEditing(address);
    setForm({ rua: address.rua, numero: String(address.numero), cep: address.cep });
  };

  const resetSearch = () => {
    setResults([]);
    setSearchTerm('');
  };

  return (
    <form className="form" onSubmit={(e) => handleSubmit(e, editing ? 'update' : 'create')}>
      <div className="table__actions" style={{ marginBottom: '12px', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge badge--soft">Busca de endereços</span>
          {editing && <span className="badge">Editando #{editing.id}</span>}
        </div>
        {results.length > 0 && (
          <button className="btn btn--ghost" type="button" onClick={resetSearch}>
            Limpar busca
          </button>
        )}
      </div>

      <SearchControls
        value={searchTerm}
        onChange={handleSearchChange}
        field={searchField}
        onFieldChange={(val) => setSearchField(val as any)}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'id', label: 'ID' },
          { value: 'rua', label: 'Rua' },
          { value: 'numero', label: 'Número' },
          { value: 'cep', label: 'CEP' },
        ]}
        onSearch={handleSearch}
        placeholder="Digite ID, rua, número ou CEP"
        clearLabel="Limpar"
      />

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

      <div className="table table--addresses" style={{ marginTop: '16px' }}>
        <div className="table__row table__head">
          <span>Endereço</span>
          <span>CEP</span>
        </div>
        {displayedAddresses.map((address) => {
          const isSelected = editing?.id === address.id;
          return (
            <div
              key={address.id || `${address.rua}-${address.numero}`}
              role="button"
              tabIndex={0}
              className={`table__row is-selectable ${isSelected ? 'is-selected' : ''}`}
              onClick={() => handleSelect(address)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleSelect(address);
              }}
            >
              <span className="table__cell">{address.rua} {address.numero}</span>
              <span className="table__cell">{address.cep}</span>
            </div>
          );
        })}
        {displayedAddresses.length === 0 && (
          <div className="table__row">
            <span className="table__cell">Nenhum endereço encontrado.</span>
          </div>
        )}
      </div>

      {error && <p className="form__error">{error}</p>}
      <div className="form__actions" style={{ gap: '8px' }}>
        <button className="btn" type="button" disabled={loading} onClick={(e) => handleSubmit(e, 'create')}>
          {loading ? 'Salvando...' : 'Cadastrar endereço'}
        </button>
        <button
          className="btn btn--ghost"
          type="button"
          disabled={!editing || loading}
          onClick={(e) => handleSubmit(e, 'update')}
        >
          Atualizar
        </button>
      </div>
    </form>
  );
}

function CustomerForm({
  addresses,
  onSubmit,
  editing,
  onClearEditing,
}: {
  addresses: Address[];
  onSubmit: (customer: Customer) => Promise<void>;
  editing?: Customer | null;
  onClearEditing?: () => void;
}) {
  const [form, setForm] = useState<Customer>({ nome: '', email: '', data_nascimento: '', cpf: '', cnpj: '', endereco_id: undefined });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        id: editing.id,
        nome: editing.nome,
        email: editing.email,
        data_nascimento: normalizeDateValue(editing.data_nascimento) || '',
        cpf: editing.cpf || '',
        cnpj: editing.cnpj || '',
        endereco_id: editing.endereco_id,
      });
    } else {
      setForm({ nome: '', email: '', data_nascimento: '', cpf: '', cnpj: '', endereco_id: undefined });
    }
  }, [editing]);

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
      onClearEditing?.();
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
      <div className="form__actions" style={{ gap: '8px' }}>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : editing ? 'Atualizar cliente' : 'Cadastrar cliente'}
        </button>
        {editing && (
          <button className="btn btn--ghost" type="button" disabled={loading} onClick={() => onClearEditing?.()}>
            Cancelar edição
          </button>
        )}
      </div>
    </form>
  );
}

function PhoneForm({
  customers,
  onSubmit,
  editing,
  onClearEditing,
}: {
  customers: Customer[];
  onSubmit: (phone: Phone) => Promise<void>;
  editing?: Phone | null;
  onClearEditing?: () => void;
}) {
  const [form, setForm] = useState<Phone>({ cliente_id: undefined, ddi: '55', ddd: '', numero: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        id: editing.id,
        cliente_id: editing.cliente_id,
        ddi: editing.ddi || '55',
        ddd: editing.ddd || '',
        numero: editing.numero || '',
      });
    } else {
      setForm({ cliente_id: undefined, ddi: '55', ddd: '', numero: '' });
    }
  }, [editing]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        ddd: digitsOnly(form.ddd).slice(0, 3),
        numero: digitsOnly(form.numero).slice(0, 9),
        cliente_id: form.cliente_id ? Number(form.cliente_id) : undefined,
      });
      setForm({ cliente_id: undefined, ddi: '55', ddd: '', numero: '' });
      onClearEditing?.();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar telefone');
    } finally {
      setLoading(false);
    }
  };

  const displayValue = formatPhoneInput(form.ddi || '55', form.ddd || '', form.numero || '');

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid--4-fixed phone-grid">
        <label className="form__group">
          <span>DDI</span>
          <select
            value={form.ddi || '55'}
            onChange={(e) => setForm({ ...form, ddi: e.target.value })}
            className="ddi-select"
          >
            {DDI_OPTIONS.map((ddi) => (
              <option key={ddi.code} value={ddi.code}>{`${ddi.flag} +${ddi.code} (${ddi.label})`}</option>
            ))}
          </select>
        </label>
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
      <div className="form__actions" style={{ gap: '8px' }}>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : editing ? 'Atualizar telefone' : 'Cadastrar telefone'}
        </button>
        {editing && (
          <button className="btn btn--ghost" type="button" disabled={loading} onClick={() => onClearEditing?.()}>
            Cancelar edição
          </button>
        )}
      </div>
    </form>
  );
}

function SupplierForm({
  addresses,
  onSubmit,
  editing,
  onClearEditing,
}: {
  addresses: Address[];
  onSubmit: (supplier: Supplier) => Promise<void>;
  editing?: Supplier | null;
  onClearEditing?: () => void;
}) {
  const [form, setForm] = useState<Supplier>({
    cnpj: '',
    razao_social: '',
    contato: '',
    email: '',
    telefone: '',
    ddi: '55',
    endereco_id: undefined,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maskedPhone = maskPhone(`${form.ddi || ''}${form.telefone || ''}`, form.ddi || '55');

  useEffect(() => {
    if (editing) {
      setForm({
        id: editing.id,
        cnpj: editing.cnpj,
        razao_social: editing.razao_social,
        contato: editing.contato,
        email: editing.email || '',
        telefone: editing.telefone || '',
        ddi: editing.ddi || '55',
        endereco_id: normalizeIdValue(editing.endereco_id),
      });
    } else {
      setForm({ cnpj: '', razao_social: '', contato: '', email: '', telefone: '', ddi: '55', endereco_id: undefined });
    }
  }, [editing]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const ddi = digitsOnly(form.ddi || '');
      const phoneDigits = normalizePhoneDigits(form.telefone || '');
      await onSubmit({
        ...form,
        razao_social: form.razao_social.trim(),
        cnpj: digitsOnly(form.cnpj),
        email: normalizeOptionalString(form.email),
        telefone: phoneDigits ? `${ddi || '55'}${phoneDigits}` : null,
        ddi: ddi || null,
        endereco_id: normalizeIdValue(form.endereco_id),
      });
      setForm({ cnpj: '', razao_social: '', contato: '', email: '', telefone: '', ddi: '55', endereco_id: undefined });
      onClearEditing?.();
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={form.ddi || ''}
              onChange={(e) => setForm({ ...form, ddi: digitsOnly(e.target.value).slice(0, 3) })}
              placeholder="55"
              style={{ width: '72px' }}
            />
            <input
              value={form.telefone || ''}
              onChange={(e) => setForm({ ...form, telefone: normalizePhoneDigits(e.target.value) })}
              placeholder="11999990000"
            />
          </div>
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
      <div className="form__actions" style={{ gap: '8px' }}>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : editing ? 'Atualizar fornecedor' : 'Cadastrar fornecedor'}
        </button>
        {editing && (
          <button className="btn btn--ghost" type="button" disabled={loading} onClick={() => onClearEditing?.()}>
            Cancelar edição
          </button>
        )}
      </div>
    </form>
  );
}

function ImagePicker({
  label,
  onUpload,
  preview,
  onClear,
}: {
  label: string;
  onUpload: (file: File) => Promise<string>;
  preview?: string;
  onClear?: () => void;
}) {
  const [localPreview, setLocalPreview] = useState<string | undefined>(preview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLocalPreview(preview);
  }, [preview]);

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

  const handleClear = () => {
    setLocalPreview(undefined);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onClear?.();
  };

  return (
    <div className="form__group">
      <span>{label}</span>
      <div className="upload-row">
        <label className="upload">
          <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} />
          <span>{loading ? 'Enviando...' : 'Selecionar imagem'}</span>
        </label>
        {(preview || localPreview) && (
          <button type="button" className="btn btn--ghost" onClick={handleClear} aria-label="Remover imagem">
            Remover imagem
          </button>
        )}
      </div>
      {(preview || localPreview) && <img src={localPreview || preview} className="upload__preview" alt="Pré-visualização" />}
      {error && <p className="form__error">{error}</p>}
    </div>
  );
}

function BulkImport({ label, onImport, exampleHint }: { label: string; onImport: (rows: any[]) => Promise<void>; exampleHint: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      let rows: any[] = [];
      try {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : Array.isArray((parsed as any)?.data) ? (parsed as any).data : [];
      } catch (err) {
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length > 1) {
          const headers = lines[0].split(/[,;\t]/).map((h) => h.trim());
          rows = lines.slice(1).map((line) => {
            const values = line.split(/[,;\t]/);
            return headers.reduce((acc, header, idx) => {
              acc[header] = values[idx]?.trim();
              return acc;
            }, {} as any);
          });
        }
      }

      if (!rows.length) {
        throw new Error('Nenhuma linha encontrada no arquivo.');
      }

      await onImport(rows);
    } catch (err: any) {
      setError(err.message || 'Falha ao importar.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="importer">
      <label className="upload">
        <input type="file" accept=".json,.csv,.txt" onChange={handleFile} />
        <span>{loading ? 'Importando...' : label}</span>
      </label>
      <small className="muted">{exampleHint}</small>
      {error && <p className="form__error">{error}</p>}
    </div>
  );
}

function ProductForm({
  suppliers,
  onSubmit,
  onUpload,
  editing,
  onClearEditing,
}: {
  suppliers: Supplier[];
  onSubmit: (product: Product) => Promise<void>;
  onUpload: (file: File) => Promise<string>;
  editing?: Product | null;
  onClearEditing?: () => void;
}) {
  const [form, setForm] = useState<Product>({ codigo: '', nome: '', descricao: '', categoria: 'produto', quantidade: 0, preco: 0, fornecedor_id: null });
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        id: editing.id,
        codigo: editing.codigo,
        nome: editing.nome,
        descricao: editing.descricao || '',
        categoria: editing.categoria || 'produto',
        quantidade: editing.quantidade || 0,
        preco: editing.preco || 0,
        fornecedor_id: normalizeIdValue(editing.fornecedor_id ?? editing.fornecedorId),
      });
      setImageUrl(editing.imagem_url || editing.imagemUrl);
    } else {
      setForm({ codigo: '', nome: '', descricao: '', categoria: 'produto', quantidade: 0, preco: 0, fornecedor_id: null });
      setImageUrl(undefined);
    }
  }, [editing]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ ...form, imagem_url: imageUrl });
      if (!editing) {
        setForm({ codigo: '', nome: '', descricao: '', categoria: 'produto', quantidade: 0, preco: 0, fornecedor_id: null });
        setImageUrl(undefined);
      }
      onClearEditing?.();
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
      <ImagePicker
        label="Imagem"
        onUpload={async (file) => {
          const url = await onUpload(file);
          setImageUrl(url);
          return url;
        }}
        preview={imageUrl}
        onClear={() => setImageUrl(undefined)}
      />
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions" style={{ gap: '8px' }}>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : editing ? 'Atualizar produto' : 'Cadastrar produto'}
        </button>
        {editing && (
          <button className="btn btn--ghost" type="button" disabled={loading} onClick={() => onClearEditing?.()}>
            Cancelar edição
          </button>
        )}
      </div>
    </form>
  );
}

function RawMaterialForm({
  onSubmit,
  onUpload,
  editing,
  onClearEditing,
}: {
  onSubmit: (material: RawMaterial) => Promise<void>;
  onUpload: (file: File) => Promise<string>;
  editing?: RawMaterial | null;
  onClearEditing?: () => void;
}) {
  const [form, setForm] = useState<RawMaterial>({ nome: '', tipo: '', custo: 0, datavalidade: '', descricao: '', tamanho: '', material: '', acessorio: '' });
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        id: editing.id,
        nome: editing.nome,
        tipo: editing.tipo || '',
        custo: editing.custo || 0,
        datavalidade: editing.datavalidade || editing.dataValidade || '',
        descricao: editing.descricao || '',
        tamanho: editing.tamanho || '',
        material: editing.material || '',
        acessorio: editing.acessorio || '',
      });
      setImageUrl(editing.imagem_url || editing.imagemUrl);
    } else {
      setForm({ nome: '', tipo: '', custo: 0, datavalidade: '', descricao: '', tamanho: '', material: '', acessorio: '' });
      setImageUrl(undefined);
    }
  }, [editing]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        nome: form.nome.trim(),
        tipo: normalizeOptionalString(form.tipo) || undefined,
        custo: normalizeNumberValue(form.custo, true) ?? undefined,
        datavalidade: normalizeDateValue(form.datavalidade || form.dataValidade || null) || undefined,
        descricao: normalizeOptionalString(form.descricao) || undefined,
        tamanho: normalizeOptionalString(form.tamanho) || undefined,
        material: normalizeOptionalString(form.material) || undefined,
        acessorio: normalizeOptionalString(form.acessorio) || undefined,
        imagem_url: imageUrl || undefined,
      });
      if (!editing) {
        setForm({ nome: '', tipo: '', custo: 0, datavalidade: '', descricao: '', tamanho: '', material: '', acessorio: '' });
        setImageUrl(undefined);
      }
      onClearEditing?.();
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
      <ImagePicker
        label="Imagem"
        onUpload={async (file) => {
          const url = await onUpload(file);
          setImageUrl(url);
          return url;
        }}
        preview={imageUrl}
        onClear={() => setImageUrl(undefined)}
      />
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions" style={{ gap: '8px' }}>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : editing ? 'Atualizar matéria-prima' : 'Cadastrar matéria-prima'}
        </button>
        {editing && (
          <button className="btn btn--ghost" type="button" disabled={loading} onClick={() => onClearEditing?.()}>
            Cancelar edição
          </button>
        )}
      </div>
    </form>
  );
}

function ProductsTable({ products, selectedId, onSelect }: { products: Product[]; selectedId?: number | null; onSelect?: (product: Product) => void }) {
  if (!products.length) return <EmptyState message="Nenhum produto cadastrado." />;
  const columns: ColumnDef<Product>[] = [
    { label: 'Nome', value: (row) => row.nome },
    { label: 'Código', value: (row) => row.codigo },
    { label: 'Categoria', value: (row) => row.categoria || '' },
    { label: 'Quantidade', value: (row) => row.quantidade },
    { label: 'Preço', value: (row) => row.preco },
  ];
  return (
    <>
      <div className="table__actions">
        <button className="btn btn--ghost" type="button" onClick={() => exportToXls<Product>('produtos.xls', columns, products)}>
          Baixar .xls
        </button>
      </div>
      <div className="table">
        <div className="table__row table__head">
          <span>Nome</span>
          <span>Código</span>
          <span>Categoria</span>
          <span>Qtd</span>
          <span>Preço</span>
        </div>
        {products.map((product) => {
          const isSelected = selectedId && selectedId === product.id;
          return (
            <div
              key={product.id || product.codigo}
              role="button"
              tabIndex={0}
              className={`table__row is-selectable ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelect?.(product)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect?.(product);
              }}
            >
              <div className="table__cell">
                <div className="thumbnail">
                  {product.imagem_url || product.imagemUrl ? (
                    <img src={product.imagem_url || product.imagemUrl} alt={`Imagem de ${product.nome}`} />
                  ) : (
                    <span className="muted">Sem imagem</span>
                  )}
                </div>
                <strong>{product.nome}</strong>
                <p className="muted">{product.descricao || 'Sem descrição'}</p>
              </div>
              <span className="table__cell">{product.codigo}</span>
              <span className="table__cell">{product.categoria || 'Produto'}</span>
              <span className="table__cell">{product.quantidade}</span>
              <span className="table__cell">{money(product.preco)}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function MaterialsTable({ materials, selectedId, onSelect }: { materials: RawMaterial[]; selectedId?: number | null; onSelect?: (material: RawMaterial) => void }) {
  if (!materials.length) return <EmptyState message="Nenhuma matéria-prima cadastrada." />;
  const columns: ColumnDef<RawMaterial>[] = [
    { label: 'Nome', value: (row) => row.nome },
    { label: 'Tipo', value: (row) => row.tipo || '' },
    { label: 'Custo', value: (row) => row.custo || 0 },
    { label: 'Validade', value: (row) => row.datavalidade || row.dataValidade || '' },
  ];
  return (
    <>
      <div className="table__actions">
        <button
          className="btn btn--ghost"
          type="button"
          onClick={() => exportToXls<RawMaterial>('materiais.xls', columns, materials)}
        >
          Baixar .xls
        </button>
      </div>
      <div className="table">
        <div className="table__row table__head">
          <span>Nome</span>
          <span>Tipo</span>
          <span>Custo</span>
          <span>Validade</span>
        </div>
        {materials.map((material) => {
          const isSelected = selectedId && selectedId === material.id;
          return (
            <div
              key={material.id || material.nome}
              role="button"
              tabIndex={0}
              className={`table__row is-selectable ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelect?.(material)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect?.(material);
              }}
            >
              <div className="table__cell">
                <div className="thumbnail">
                  {material.imagem_url || material.imagemUrl ? (
                    <img src={material.imagem_url || material.imagemUrl} alt={`Imagem de ${material.nome}`} />
                  ) : (
                    <span className="muted">Sem imagem</span>
                  )}
                </div>
                <strong>{material.nome}</strong>
                <p className="muted">{material.descricao || 'Sem descrição'}</p>
              </div>
              <span className="table__cell">{material.tipo || 'N/I'}</span>
              <span className="table__cell">{money(material.custo || 0)}</span>
              <span className="table__cell">{material.datavalidade || '--'}</span>
            </div>
          );
        })}
      </div>
    </>
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
            <>
              <div className="table__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() =>
                    exportToXls<Manufacturing>('manufatura.xls', [
                      { label: 'Produto', value: (row) => row.produto_id || row.produtoId },
                      { label: 'Material', value: (row) => row.material_id || row.materialId },
                      { label: 'Quantidade', value: (row) => row.quantidade_material ?? row.quantidadeMaterial ?? 0 },
                    ], manufacturing)
                  }
                >
                  Baixar .xls
                </button>
              </div>
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
            </>
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
            <>
              <div className="table__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() =>
                    exportToXls<MaterialDelivery>('entregas-material.xls', [
                      { label: 'Material', value: (row) => row.material_id || row.materialId },
                      { label: 'Fornecedor', value: (row) => row.fornecedor_id || row.fornecedorId || '' },
                      { label: 'Quantidade', value: (row) => row.quantidade ?? 0 },
                      { label: 'Custo', value: (row) => row.custo ?? 0 },
                      { label: 'Data entrada', value: (row) => row.data_entrada || row.dataEntrada || '' },
                    ], deliveries)
                  }
                >
                  Baixar .xls
                </button>
              </div>
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
            </>
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
            <>
              <div className="table__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() =>
                    exportToXls<Order>('pedidos.xls', [
                      { label: 'Pedido', value: (row) => row.id || '' },
                      { label: 'Cliente', value: (row) => row.cliente_id || row.clienteId || '' },
                      { label: 'Preço', value: (row) => row.preco || 0 },
                      { label: 'Data', value: (row) => row.data_pedido || row.dataPedido || '' },
                      { label: 'Endereço', value: (row) => row.endereco || '' },
                    ], orders)
                  }
                >
                  Baixar .xls
                </button>
              </div>
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
            </>
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
            <>
              <div className="table__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() =>
                    exportToXls<Shipment>('envios.xls', [
                      { label: 'Pedido', value: (row) => row.pedido_id || row.pedidoId },
                      { label: 'Produto', value: (row) => row.produto_id || row.produtoId },
                      { label: 'Quantidade', value: (row) => row.quantidade || 0 },
                      { label: 'Preço', value: (row) => row.preco || 0 },
                      { label: 'Data envio', value: (row) => row.data_envio || row.dataEnvio || '' },
                    ], shipments)
                  }
                >
                  Baixar .xls
                </button>
              </div>
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
            </>
          ) : (
            <EmptyState message={'Nenhum envio registrado.'} />
          )}
        </section>
      )}

      {tab === 'feedback' && (
        <section className="panel__section">
          <SectionHeader title="Feedback" subtitle="Avaliações de clientes com notas e observações" />
          <FeedbackForm customers={customers} onSubmit={onCreateFeedback} />
          {feedbackRows.length ? (
            <>
              <div className="table__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() =>
                    exportToXls<FeedbackRow>('feedbacks.xls', [
                      { label: 'Cliente', value: (row) => row.cliente_id || row.clienteId || '' },
                      { label: 'Nota', value: (row) => row.nota ?? 0 },
                      { label: 'Data', value: (row) => row.data || '' },
                      { label: 'Contato', value: (row) => row.contato || '' },
                      { label: 'Observação', value: (row) => row.observacao || '' },
                    ], feedbackRows)
                  }
                >
                  Baixar .xls
                </button>
              </div>
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
            </>
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
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchField, setProductSearchField] = useState<'all' | 'nome' | 'codigo' | 'categoria'>('all');
  const [materialSearchTerm, setMaterialSearchTerm] = useState('');
  const [materialSearchField, setMaterialSearchField] = useState<'all' | 'nome' | 'tipo' | 'material'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);

  const filteredProducts = useMemo(() => {
    const query = productSearchTerm.trim().toLowerCase();
    if (!query) return products;
    return products.filter((prod) => {
      const fields: Record<string, string> = {
        nome: prod.nome?.toLowerCase() || '',
        codigo: prod.codigo?.toLowerCase() || '',
        categoria: prod.categoria?.toLowerCase() || '',
      };
      if (productSearchField === 'all') {
        return Object.values(fields).some((value) => value.includes(query));
      }
      return fields[productSearchField]?.includes(query);
    });
  }, [productSearchField, productSearchTerm, products]);

  const filteredMaterials = useMemo(() => {
    const query = materialSearchTerm.trim().toLowerCase();
    if (!query) return materials;
    return materials.filter((mat) => {
      const fields: Record<string, string> = {
        nome: mat.nome?.toLowerCase() || '',
        tipo: mat.tipo?.toLowerCase() || '',
        material: mat.material?.toLowerCase() || '',
      };
      if (materialSearchField === 'all') {
        return Object.values(fields).some((value) => value.includes(query));
      }
      return fields[materialSearchField]?.includes(query);
    });
  }, [materialSearchField, materialSearchTerm, materials]);

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
          <ProductForm
            suppliers={suppliers}
            onSubmit={onCreateProduct}
            onUpload={onUpload}
            editing={editingProduct}
            onClearEditing={() => setEditingProduct(null)}
          />
          <SearchControls
            value={productSearchTerm}
            onChange={setProductSearchTerm}
            field={productSearchField}
            onFieldChange={setProductSearchField}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'nome', label: 'Nome' },
              { value: 'codigo', label: 'Código' },
              { value: 'categoria', label: 'Categoria' },
            ]}
          />
          <ProductsTable products={filteredProducts} selectedId={editingProduct?.id ?? null} onSelect={(prod) => setEditingProduct(prod)} />
        </section>
      ) : (
        <section className="panel__section">
          <SectionHeader title="Matéria-prima" subtitle="Dados completos para manufatura" />
          <RawMaterialForm
            onSubmit={onCreateMaterial}
            onUpload={onUpload}
            editing={editingMaterial}
            onClearEditing={() => setEditingMaterial(null)}
          />
          <SearchControls
            value={materialSearchTerm}
            onChange={setMaterialSearchTerm}
            field={materialSearchField}
            onFieldChange={setMaterialSearchField}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'nome', label: 'Nome' },
              { value: 'tipo', label: 'Tipo' },
              { value: 'material', label: 'Material' },
            ]}
          />
          <MaterialsTable
            materials={filteredMaterials}
            selectedId={editingMaterial?.id ?? null}
            onSelect={(mat) => setEditingMaterial(mat)}
          />
        </section>
      )}
    </div>
  );
}

function SuppliersPage({ suppliers, addresses, onCreate, onImport }: { suppliers: Supplier[]; addresses: Address[]; onCreate: (supplier: Supplier) => Promise<void>; onImport: (rows: any[]) => Promise<void> }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'razao_social' | 'cnpj' | 'contato'>('all');
  const [editing, setEditing] = useState<Supplier | null>(null);

  const filteredSuppliers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter((sup) => {
      const fields: Record<string, string> = {
        razao_social: sup.razao_social.toLowerCase(),
        cnpj: digitsOnly(sup.cnpj).toLowerCase(),
        contato: sup.contato.toLowerCase(),
      };
      if (searchField === 'all') return Object.values(fields).some((val) => val.includes(query));
      return fields[searchField]?.includes(query);
    });
  }, [searchField, searchTerm, suppliers]);

  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <h1>Fornecedores</h1>
          <p className="muted">CNPJ, contato e endereço opcional conforme tabela.</p>
        </div>
      </header>
      <SupplierForm addresses={addresses} onSubmit={onCreate} editing={editing} onClearEditing={() => setEditing(null)} />
      <BulkImport
        label="Importar fornecedores (.csv/.json)"
        exampleHint="Cabeçalhos esperados: cnpj, razaoSocial, contato, email, telefone, enderecoId"
        onImport={onImport}
      />
      <section className="panel__section">
        <SectionHeader title="Fornecedores" />
        <SearchControls
          value={searchTerm}
          onChange={setSearchTerm}
          field={searchField}
          onFieldChange={(val) => setSearchField(val as any)}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'razao_social', label: 'Razão social' },
            { value: 'cnpj', label: 'CNPJ' },
            { value: 'contato', label: 'Contato' },
          ]}
        />
        <div className="table" style={{ marginTop: '8px' }}>
          <div className="table__row table__head">
            <span>Razão social</span>
            <span>Contato</span>
            <span>CNPJ</span>
          </div>
          {filteredSuppliers.map((supplier) => {
            const isSelected = editing?.id === supplier.id;
            return (
              <div
                key={supplier.id || supplier.cnpj}
                className={`table__row is-selectable ${isSelected ? 'is-selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setEditing(supplier)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setEditing(supplier);
                }}
              >
                <span className="table__cell">{supplier.razao_social}</span>
                <span className="table__cell">{supplier.contato}</span>
                <span className="table__cell">{maskCnpj(supplier.cnpj)}</span>
              </div>
            );
          })}
          {!filteredSuppliers.length && (
            <div className="table__row">
              <span className="table__cell">Nenhum fornecedor encontrado.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CustomersPage({
  customers,
  addresses,
  onSubmit,
  onImport,
}: {
  customers: Customer[];
  addresses: Address[];
  onSubmit: (customer: Customer) => Promise<void>;
  onImport: (rows: any[]) => Promise<void>;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'nome' | 'cpf' | 'cnpj' | 'email'>('all');
  const [editing, setEditing] = useState<Customer | null>(null);

  const filteredCustomers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((cust) => {
      const fields: Record<string, string> = {
        nome: cust.nome.toLowerCase(),
        cpf: digitsOnly(cust.cpf || '').toLowerCase(),
        cnpj: digitsOnly(cust.cnpj || '').toLowerCase(),
        email: (cust.email || '').toLowerCase(),
      };
      if (searchField === 'all') return Object.values(fields).some((val) => val.includes(query));
      return fields[searchField]?.includes(query);
    });
  }, [customers, searchField, searchTerm]);

  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <h1>Clientes</h1>
          <p className="muted">CPF/CNPJ, data de nascimento e endereço obrigatório.</p>
        </div>
      </header>
      <CustomerForm addresses={addresses} onSubmit={onSubmit} editing={editing} onClearEditing={() => setEditing(null)} />
      <BulkImport
        label="Importar clientes (.csv/.json)"
        exampleHint="Campos: nome, email, dataNascimento, cpf/cnpj, enderecoId"
        onImport={onImport}
      />
      <section className="panel__section">
        <SectionHeader title="Clientes" />
        <SearchControls
          value={searchTerm}
          onChange={setSearchTerm}
          field={searchField}
          onFieldChange={(val) => setSearchField(val as any)}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'nome', label: 'Nome' },
            { value: 'cpf', label: 'CPF' },
            { value: 'cnpj', label: 'CNPJ' },
            { value: 'email', label: 'Email' },
          ]}
        />
        <div className="table" style={{ marginTop: '8px' }}>
          <div className="table__row table__head">
            <span>Nome</span>
            <span>Documento</span>
            <span>Email</span>
          </div>
          {filteredCustomers.map((customer) => {
            const isSelected = editing?.id === customer.id;
            const doc = customer.cpf ? maskCpf(customer.cpf) : customer.cnpj ? maskCnpj(customer.cnpj) : '--';
            return (
              <div
                key={customer.id || customer.nome}
                className={`table__row is-selectable ${isSelected ? 'is-selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setEditing(customer)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setEditing(customer);
                }}
              >
                <span className="table__cell">{customer.nome}</span>
                <span className="table__cell">{doc}</span>
                <span className="table__cell">{customer.email || '--'}</span>
              </div>
            );
          })}
          {!filteredCustomers.length && (
            <div className="table__row">
              <span className="table__cell">Nenhum cliente encontrado.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PhonesPage({ customers, phones, onSubmit }: { customers: Customer[]; phones: Phone[]; onSubmit: (phone: Phone) => Promise<void> }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'cliente' | 'ddd' | 'numero'>('all');
  const [editing, setEditing] = useState<Phone | null>(null);

  const filteredPhones = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return phones;
    return phones.filter((phone) => {
      const clienteNome = customers.find((c) => c.id === phone.cliente_id)?.nome?.toLowerCase() || '';
      const fields: Record<string, string> = {
        cliente: clienteNome,
        ddd: (phone.ddd || '').toLowerCase(),
        numero: digitsOnly(phone.numero || '').toLowerCase(),
      };
      if (searchField === 'all') return Object.values(fields).some((val) => val.includes(query));
      return fields[searchField]?.includes(query);
    });
  }, [customers, phones, searchField, searchTerm]);

  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <h1>Telefones</h1>
          <p className="muted">Associados a clientes com formatação +55 (DDD) número.</p>
        </div>
      </header>
      <PhoneForm customers={customers} onSubmit={onSubmit} editing={editing} onClearEditing={() => setEditing(null)} />
      <section className="panel__section">
        <SectionHeader title="Telefones" />
        <SearchControls
          value={searchTerm}
          onChange={setSearchTerm}
          field={searchField}
          onFieldChange={(val) => setSearchField(val as any)}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'cliente', label: 'Cliente' },
            { value: 'ddd', label: 'DDD' },
            { value: 'numero', label: 'Número' },
          ]}
        />
        <div className="table" style={{ marginTop: '8px' }}>
          <div className="table__row table__head">
            <span>Cliente</span>
            <span>DDD</span>
            <span>Número</span>
          </div>
          {filteredPhones.map((phone) => {
            const isSelected = editing?.id === phone.id;
            const clienteNome = customers.find((c) => c.id === phone.cliente_id)?.nome || 'Cliente';
            return (
              <div
                key={phone.id || `${phone.ddd}-${phone.numero}`}
                className={`table__row is-selectable ${isSelected ? 'is-selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setEditing(phone)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setEditing(phone);
                }}
              >
                <span className="table__cell">{clienteNome}</span>
                <span className="table__cell">{phone.ddd || '--'}</span>
                <span className="table__cell">{formatPhoneInput(phone.ddi || '55', phone.ddd || '', phone.numero || '')}</span>
              </div>
            );
          })}
          {!filteredPhones.length && (
            <div className="table__row">
              <span className="table__cell">Nenhum telefone encontrado.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

type ChartPoint = { label: string; value: number };

function formatCurrencyBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function BarChart({
  data,
  color = '#1fe4ce',
  valueFormatter = (value: number) => value.toLocaleString('pt-BR'),
}: {
  data: ChartPoint[];
  color?: string;
  valueFormatter?: (value: number) => string | number;
}) {
  if (!data.length) return <EmptyState message="Sem dados suficientes para gerar o gráfico." />;

  return (
    <div className="chart-card">
      <ResponsiveContainer width="100%" height={260}>
        <ReBarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} angle={-10} height={50} textAnchor="end" />
          <YAxis tick={{ fontSize: 12 }} />
          <RechartsTooltip
            cursor={{ fill: 'rgba(31, 228, 206, 0.08)' }}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
            formatter={(value: number) => valueFormatter(value)}
          />
          <Legend formatter={(value) => value} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="value" name="Total" radius={[6, 6, 0, 0]} fill={color} />
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Dashboard({
  products,
  materials,
  suppliers,
  customers,
  shipments,
  deliveries,
  orders,
  addresses,
}: {
  products: Product[];
  materials: RawMaterial[];
  suppliers: Supplier[];
  customers: Customer[];
  shipments: Shipment[];
  deliveries: MaterialDelivery[];
  orders: Order[];
  addresses: Address[];
}) {
  const LOW_STOCK_THRESHOLD = 5;

  const addressById = useMemo(() => {
    return addresses.reduce<Record<number, Address>>((acc, addr) => {
      if (addr.id) acc[addr.id] = addr;
      return acc;
    }, {});
  }, [addresses]);

  const customerById = useMemo(() => {
    return customers.reduce<Record<number, Customer>>((acc, customer) => {
      if (customer.id) acc[customer.id] = customer;
      return acc;
    }, {});
  }, [customers]);

  const parseDate = useCallback((value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }, []);

  const monthLabel = (date: Date) =>
    date.toLocaleDateString('pt-BR', {
      month: 'short',
      year: 'numeric',
    });

  const totalInventoryItems = useMemo(() => {
    return products.reduce((sum, product) => {
      const qty = normalizeNumberValue(product.quantidade, true) ?? 0;
      return sum + qty;
    }, 0);
  }, [products]);

  const totalInventoryValue = useMemo(() => {
    return products.reduce((sum, product) => {
      const qty = normalizeNumberValue(product.quantidade, true) ?? 0;
      const price = normalizeNumberValue(product.preco, true) ?? 0;
      return sum + qty * price;
    }, 0);
  }, [products]);

  const lowStockItems = useMemo(() => {
    return products.filter((product) => (normalizeNumberValue(product.quantidade, true) ?? 0) <= LOW_STOCK_THRESHOLD);
  }, [LOW_STOCK_THRESHOLD, products]);

  type MovementRow = {
    date: Date;
    type: 'Entrada' | 'Saída';
    label: string;
    qty: number;
    value?: number;
  };

  const recentMovements = useMemo(() => {
    const deliveryRows: MovementRow[] = deliveries
      .map((delivery) => {
        const date = parseDate(delivery.data_entrada);
        if (!date) return null;
        const qty = normalizeNumberValue(delivery.quantidade, true);
        const materialName = materials.find((mat) => mat.id === delivery.material_id)?.nome || 'Material';
        const value = normalizeNumberValue(delivery.custo, true) * (delivery.quantidade ?? 1);
        return { date, type: 'Entrada', label: materialName, qty, value } as MovementRow;
      })
      .filter(Boolean) as MovementRow[];

    const shipmentRows: MovementRow[] = shipments
      .map((shipment) => {
        const date = parseDate(shipment.data_envio);
        if (!date) return null;
        const qty = normalizeNumberValue(shipment.quantidade, true);
        const productName = products.find((prod) => prod.id === shipment.produto_id)?.nome || 'Produto';
        const value = normalizeNumberValue(shipment.preco, true) * (shipment.quantidade ?? 1);
        return { date, type: 'Saída', label: productName, qty, value } as MovementRow;
      })
      .filter(Boolean) as MovementRow[];

    return [...deliveryRows, ...shipmentRows]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8);
  }, [deliveries, materials, parseDate, products, shipments]);

  const dashboardMetrics = [
    { label: 'Itens em estoque', value: totalInventoryItems.toLocaleString('pt-BR'), helper: 'Soma das quantidades disponíveis.' },
    { label: 'Valor total do estoque', value: formatCurrencyBRL(totalInventoryValue), helper: 'Quantidade x preço unitário.' },
    {
      label: 'Itens com estoque baixo',
      value: lowStockItems.length.toLocaleString('pt-BR'),
      helper: `Até ${LOW_STOCK_THRESHOLD} unidades.`,
    },
    {
      label: 'Movimentações recentes',
      value: recentMovements.length.toLocaleString('pt-BR'),
      helper: 'Entradas e saídas mais recentes.',
    },
  ];

  const monthlySales = useMemo(() => {
    const totals: Record<string, number> = {};
    const labels: Record<string, string> = {};

    shipments.forEach((shipment) => {
      const date = parseDate(shipment.data_envio);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      labels[key] = monthLabel(date);
      const amount = (shipment.preco ?? 0) * (shipment.quantidade ?? 1);
      totals[key] = (totals[key] || 0) + amount;
    });

    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ label: labels[key] || key, value }));
  }, [shipments]);

  const monthlyPurchases = useMemo(() => {
    const totals: Record<string, number> = {};
    const labels: Record<string, string> = {};

    deliveries.forEach((delivery) => {
      const date = parseDate(delivery.data_entrada);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      labels[key] = monthLabel(date);
      const amount = (delivery.custo ?? 0) * (delivery.quantidade ?? 1);
      totals[key] = (totals[key] || 0) + amount;
    });

    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ label: labels[key] || key, value }));
  }, [deliveries]);

  const topSellingProduct = useMemo(() => {
    const totals: Record<number, number> = {};
    shipments.forEach((shipment) => {
      if (!shipment.produto_id) return;
      const qty = normalizeNumberValue(shipment.quantidade, true) ?? 0;
      totals[shipment.produto_id] = (totals[shipment.produto_id] || 0) + qty;
    });
    const [id, qty] = Object.entries(totals).sort(([, a], [, b]) => Number(b) - Number(a))[0] || [];
    const productName = id ? products.find((prod) => prod.id === Number(id))?.nome || 'Produto' : null;
    return productName ? { name: productName, qty } : null;
  }, [products, shipments]);

  const topPurchasedMaterial = useMemo(() => {
    const totals: Record<number, number> = {};
    deliveries.forEach((delivery) => {
      if (!delivery.material_id) return;
      const qty = normalizeNumberValue(delivery.quantidade, true) ?? 0;
      totals[delivery.material_id] = (totals[delivery.material_id] || 0) + qty;
    });
    const [id, qty] = Object.entries(totals).sort(([, a], [, b]) => Number(b) - Number(a))[0] || [];
    const materialName = id ? materials.find((mat) => mat.id === Number(id))?.nome || 'Matéria-prima' : null;
    return materialName ? { name: materialName, qty } : null;
  }, [deliveries, materials]);

  const deliveriesByNeighborhood = useMemo(() => {
    const totals: Record<string, number> = {};

    shipments.forEach((shipment) => {
      if (!shipment.pedido_id) return;
      const order = orders.find((o) => o.id === shipment.pedido_id);
      const customer = order?.cliente_id ? customerById[order.cliente_id] : null;
      const address = customer?.endereco_id ? addressById[customer.endereco_id] : null;
      const neighborhood = address?.bairro || order?.endereco || address?.rua || 'Sem bairro';
      totals[neighborhood] = (totals[neighborhood] || 0) + (shipment.quantidade ?? 0);
    });

    return Object.entries(totals)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, [addressById, customerById, orders, shipments]);

  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Visão rápida das principais métricas operacionais e desempenho.</p>
        </div>
      </header>
      <section className="panel__section grid grid--4">
        {dashboardMetrics.map((item) => (
          <div key={item.label} className="card card--metric">
            <p className="muted">{item.label}</p>
            <h2>{item.value}</h2>
            <p className="muted small">{item.helper}</p>
          </div>
        ))}
      </section>
      <section className="panel__section grid grid--2">
        <div className="card">
          <SectionHeader title="Vendas mensais" subtitle="Total enviado por mês" />
          <BarChart data={monthlySales} color="#14b6a2" valueFormatter={formatCurrencyBRL} />
        </div>
        <div className="card">
          <SectionHeader title="Compras mensais" subtitle="Entradas de materiais" />
          <BarChart data={monthlyPurchases} color="#0ea5e9" valueFormatter={formatCurrencyBRL} />
        </div>
      </section>
      <section className="panel__section grid grid--3">
        <div className="card">
          <SectionHeader title="Produto mais vendido" />
          {topSellingProduct ? (
            <>
              <h3>{topSellingProduct.name}</h3>
              <p className="muted">Quantidade enviada: {topSellingProduct.qty?.toLocaleString('pt-BR')}</p>
            </>
          ) : (
            <EmptyState message="Sem vendas registradas." />
          )}
        </div>
        <div className="card">
          <SectionHeader title="Material mais comprado" />
          {topPurchasedMaterial ? (
            <>
              <h3>{topPurchasedMaterial.name}</h3>
              <p className="muted">Quantidade adquirida: {topPurchasedMaterial.qty?.toLocaleString('pt-BR')}</p>
            </>
          ) : (
            <EmptyState message="Sem compras registradas." />
          )}
        </div>
        <div className="card">
          <SectionHeader title="Bairros com mais entregas" />
          <BarChart data={deliveriesByNeighborhood} color="#8b5cf6" />
        </div>
      </section>
      <section className="panel__section grid grid--2">
        <div className="card card--bordered">
          <SectionHeader title="Itens com estoque baixo" subtitle={`Itens com ≤ ${LOW_STOCK_THRESHOLD} unidades`} />
          {lowStockItems.length ? (
            <ul className="list list--bordered">
              {lowStockItems.slice(0, 6).map((item) => (
                <li key={item.id || item.codigo} className="list__item">
                  <div>
                    <strong>{item.nome}</strong>
                    <p className="muted small">
                      {(item.quantidade ?? 0).toLocaleString('pt-BR')} unidades • {formatCurrencyBRL(item.preco || 0)}
                    </p>
                  </div>
                  <span className="badge badge--soft">{item.quantidade ?? 0} un.</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhum item abaixo do limite." />
          )}
        </div>
        <div className="card card--bordered">
          <SectionHeader title="Movimentações recentes" subtitle="Entradas e saídas do estoque" />
          {recentMovements.length ? (
            <ul className="timeline">
              {recentMovements.map((move, index) => (
                <li key={`${move.label}-${move.date.getTime()}-${index}`} className="timeline__item">
                  <div className={`timeline__dot ${move.type === 'Saída' ? 'is-out' : 'is-in'}`} />
                  <div className="timeline__body">
                    <div className="timeline__title">
                      <strong>{move.label}</strong>
                      <span className="badge badge--soft">{move.type}</span>
                    </div>
                    <p className="muted small">
                      {move.qty.toLocaleString('pt-BR')} unidades •{' '}
                      {move.value ? formatCurrencyBRL(move.value) : 'Sem valor informado'}
                    </p>
                    <p className="muted small">{move.date.toLocaleString('pt-BR')}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhuma movimentação registrada ainda." />
          )}
        </div>
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
  const safeItems = (items || []).filter(Boolean) as T[];

  return (
    <section className="panel__section">
      <SectionHeader title={title} />
      {safeItems.length ? (
        <ul className="list list--bordered">
          {safeItems.map((item, index) => (
            <li key={`${item.id ?? item.nome ?? index}`} className="list__item">
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
  const [lastActivity, setLastActivity] = useState<number>(() => Number(localStorage.getItem('vc_last_activity')) || Date.now());

  const markActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    localStorage.setItem('vc_last_activity', String(now));
  }, []);

  const guardedFetch = useCallback(
    async <T,>(path: string, key?: string): Promise<T> => {
      if (!authenticated) throw new Error('Faça login para carregar dados.');
      const res = await request<any>(path);
      const base = res.data ?? res;
      const payload = key ? base?.[key] ?? (res as any)?.[key] : base;
      return (payload ?? []) as T;
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
      const data = await guardedFetch<Product[]>('/items', 'items');
      const mapped = (data || []).map(mapProductResponse);
      setProducts(mergeCachedImages(mapped, PRODUCT_IMAGE_CACHE_KEY, (item) => item.codigo || item.id));
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadMaterials = useCallback(async () => {
    try {
      const data = await guardedFetch<RawMaterial[]>('/materials', 'materials');
      const mapped = (data || []).map(mapMaterialResponse);
      setMaterials(mergeCachedImages(mapped, MATERIAL_IMAGE_CACHE_KEY, (item) => item.nome || item.id));
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await guardedFetch<Supplier[]>('/suppliers', 'suppliers');
      setSuppliers((data || []).map(mapSupplierResponse));
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await guardedFetch<Customer[]>('/customers', 'customers');
      setCustomers((data || []).map(mapCustomerResponse));
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadAddresses = useCallback(async () => {
    try {
      const data = await guardedFetch<Address[]>('/addresses', 'addresses');
      setAddresses((data || []).map(mapAddressResponse));
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadPhones = useCallback(async () => {
    try {
      const data = await guardedFetch<Phone[]>('/phones', 'phones');
      setPhones((data || []).map(mapPhoneResponse));
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadManufacturing = useCallback(async () => {
    try {
      const data = await guardedFetch<Manufacturing[]>('/manufacturing', 'manufacturing');
      setManufacturing((data || []).map(mapManufacturingResponse));
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadDeliveries = useCallback(async () => {
    try {
      const data = await guardedFetch<MaterialDelivery[]>('/material-deliveries', 'deliveries');
      setDeliveries((data || []).map(mapDeliveryResponse));
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadOrders = useCallback(async () => {
    try {
      const data = await guardedFetch<Order[]>('/orders', 'orders');
      setOrders((data || []).map(mapOrderResponse));
    } catch (err: any) {
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadShipments = useCallback(async () => {
    try {
      const data = await guardedFetch<Shipment[]>('/product-shipments', 'shipments');
      setShipments((data || []).map(mapShipmentResponse));
    } catch (err: any) {
      setShipments([]);
      setFeedback(err.message);
    }
  }, [guardedFetch]);

  const loadFeedback = useCallback(async () => {
    try {
      const data = await guardedFetch<FeedbackRow[]>('/feedback', 'feedbacks');
      setFeedbackRows((data || []).map(mapFeedbackResponse));
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
    loadProducts();
    loadMaterials();
    loadSuppliers();
    loadCustomers();
    loadPhones();
    loadManufacturing();
    loadDeliveries();
    loadOrders();
    loadShipments();
    loadFeedback();
  }, [authenticated, page, loadProducts, loadMaterials, loadSuppliers, loadCustomers, loadAddresses, loadPhones, loadManufacturing, loadDeliveries, loadOrders, loadShipments, loadFeedback]);

  useEffect(() => {
    if (!authenticated || page !== 'dashboard') return;

    const interval = setInterval(() => {
      loadProducts();
      loadDeliveries();
      loadShipments();
      loadOrders();
    }, 30000);

    return () => clearInterval(interval);
  }, [authenticated, page, loadDeliveries, loadOrders, loadProducts, loadShipments]);

  useEffect(() => {
    const INACTIVITY_LIMIT = 20 * 60 * 1000;
    const events = ['click', 'keydown', 'mousemove', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, markActivity));

    const interval = setInterval(() => {
      const stored = Number(localStorage.getItem('vc_last_activity')) || lastActivity;
      if (token && Date.now() - stored > INACTIVITY_LIMIT) {
        saveToken(null);
        setPage('dashboard');
        setFeedback('Sessão expirada por inatividade. Faça login novamente.');
        window.location.href = '/';
      }
    }, 60 * 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActivity));
      clearInterval(interval);
    };
  }, [lastActivity, markActivity, saveToken, setPage, token]);

  const handleCreateProduct = async (payload: Product) => {
    const duplicated = products.find(
      (prod) =>
        prod.id !== payload.id &&
        (prod.codigo.trim() === payload.codigo.trim() || prod.nome.trim().toLowerCase() === payload.nome.trim().toLowerCase())
    );
    if (duplicated) {
      setFeedback('Produto já cadastrado com este código ou nome.');
      return;
    }
    const body = {
      codigo: payload.codigo.trim(),
      nome: payload.nome.trim(),
      descricao: normalizeOptionalString(payload.descricao),
      categoria: normalizeOptionalString(payload.categoria) || 'produto',
      quantidade: normalizeNumberValue(payload.quantidade),
      preco: normalizeNumberValue(payload.preco),
      fornecedorId: normalizeIdValue(payload.fornecedor_id ?? payload.fornecedorId),
      imagemUrl: normalizeOptionalString(payload.imagem_url ?? payload.imagemUrl),
    };

    if (payload.id) {
      const res = await request<Product>(`/items/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const updated = mapProductResponse({ ...payload, ...res.data });
      setProducts((prev) => prev.map((prod) => (prod.id === payload.id ? updated : prod)));
      setFeedback('Produto atualizado com sucesso.');
      loadProducts();
      setTimeout(loadProducts, 2000);
      return;
    }

    const res = await request<Product>('/items', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setFeedback('Produto inserido com sucesso.');
    cacheImage(PRODUCT_IMAGE_CACHE_KEY, payload.codigo, payload.imagem_url ?? payload.imagemUrl);
    const created = mapProductResponse({ ...res.data, imagem_url: payload.imagem_url ?? payload.imagemUrl });
    setProducts((prev) => [created, ...prev]);
    loadProducts();
    setTimeout(loadProducts, 2000);
  };

  const handleCreateMaterial = async (payload: RawMaterial) => {
    const duplicated = materials.find(
      (mat) =>
        mat.id !== payload.id &&
        mat.nome.trim().toLowerCase() === payload.nome.trim().toLowerCase() &&
        (normalizeOptionalString(mat.tipo)?.toLowerCase() || '') === (normalizeOptionalString(payload.tipo)?.toLowerCase() || '')
    );
    if (duplicated) {
      setFeedback('Matéria-prima já cadastrada com este nome/tipo.');
      return;
    }
    const body: any = {
      nome: payload.nome.trim(),
      tipo: normalizeOptionalString(payload.tipo),
      custo: normalizeNumberValue(payload.custo, true),
      dataValidade: normalizeDateValue(payload.datavalidade ?? payload.dataValidade),
      descricao: normalizeOptionalString(payload.descricao),
      tamanho: normalizeOptionalString(payload.tamanho),
      material: normalizeOptionalString(payload.material),
      acessorio: normalizeOptionalString(payload.acessorio),
      imagemUrl: normalizeOptionalString(payload.imagem_url ?? payload.imagemUrl),
    };

    if (payload.id) {
      const res = await request<RawMaterial>(`/materials/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const updated = mapMaterialResponse({ ...payload, ...res.data });
      setMaterials((prev) => prev.map((mat) => (mat.id === payload.id ? updated : mat)));
      setFeedback('Matéria-prima atualizada com sucesso.');
      loadMaterials();
      setTimeout(loadMaterials, 2000);
      return;
    }

    const res = await request<RawMaterial>('/materials', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setFeedback('Matéria-prima inserida com sucesso.');
    cacheImage(MATERIAL_IMAGE_CACHE_KEY, payload.nome, payload.imagem_url ?? payload.imagemUrl);
    const created = mapMaterialResponse({ ...payload, ...res.data });
    setMaterials((prev) => [created, ...prev]);
    loadMaterials();
    setTimeout(loadMaterials, 2000);
  };

  const handleCreateSupplier = async (payload: Supplier) => {
    const cnpjDigits = digitsOnly(payload.cnpj);
    const existingSupplier = suppliers.find((sup) => digitsOnly(sup.cnpj) === cnpjDigits);
    if (!payload.id && existingSupplier) {
      setFeedback('Fornecedor já cadastrado com este CNPJ.');
      return;
    }
    const phoneDigits = digitsOnly(payload.telefone || '');
    const ddiValue = normalizeOptionalString(payload.ddi) || '';

    const body = {
      cnpj: digitsOnly(payload.cnpj),
      razaoSocial: payload.razao_social.trim(),
      contato: payload.contato.trim(),
      email: normalizeOptionalString(payload.email),
      telefone: phoneDigits ? `${ddiValue || '55'}${phoneDigits}` : null,
      enderecoId: normalizeIdValue(payload.endereco_id),
    };

    if (payload.id) {
      const res = await request<Supplier>(`/suppliers/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const updated = mapSupplierResponse({ ...payload, ...res.data });
      setSuppliers((prev) => prev.map((sup) => (sup.id === payload.id ? updated : sup)));
      setFeedback('Fornecedor atualizado com sucesso.');
      loadSuppliers();
      setTimeout(loadSuppliers, 2000);
      return;
    }

    const res = await request<Supplier>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setFeedback('Fornecedor salvo com sucesso.');
    setSuppliers((prev) => [mapSupplierResponse(res.data), ...prev]);
    loadSuppliers();
    setTimeout(loadSuppliers, 2000);
  };

  const handleCreateCustomer = async (payload: Customer) => {
    const cpfDigits = digitsOnly(payload.cpf || '');
    const cnpjDigits = digitsOnly(payload.cnpj || '');
    const existingCpf = customers.find((cust) => digitsOnly(cust.cpf || '') === cpfDigits && cpfDigits);
    if (!payload.id && existingCpf) {
      setFeedback('Cliente já cadastrado com este CPF.');
      return;
    }
    const existingCnpj = customers.find((cust) => digitsOnly(cust.cnpj || '') === cnpjDigits && cnpjDigits);
    if (!payload.id && existingCnpj) {
      setFeedback('Cliente já cadastrado com este CNPJ.');
      return;
    }
    const body = {
      nome: payload.nome.trim(),
      email: normalizeOptionalString(payload.email),
      dataNascimento: normalizeDateValue(payload.data_nascimento),
      cnpj: payload.cnpj ? digitsOnly(payload.cnpj) : undefined,
      cpf: payload.cpf ? digitsOnly(payload.cpf) : undefined,
      enderecoId: normalizeIdValue(payload.endereco_id),
    };

    if (payload.id) {
      const res = await request<Customer>(`/customers/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const updated = mapCustomerResponse({ ...payload, ...res.data });
      setCustomers((prev) => prev.map((cust) => (cust.id === payload.id ? updated : cust)));
      setFeedback('Cliente atualizado com sucesso.');
      loadCustomers();
      setTimeout(loadCustomers, 2000);
      return;
    }

    const res = await request<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setFeedback('Cliente salvo com sucesso.');
    setCustomers((prev) => [mapCustomerResponse(res.data), ...prev]);
    loadCustomers();
    setTimeout(loadCustomers, 2000);
  };

  const handleCreateAddress = async (payload: Address) => {
    const body = {
      rua: payload.rua.trim(),
      numero: digitsOnly(payload.numero),
      cep: digitsOnly(payload.cep),
    };

    if (payload.id) {
      await request<Address>(`/addresses/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setFeedback('Endereço atualizado com sucesso.');
      await loadAddresses();
      return;
    }

    const exists = addresses.find(
      (addr) =>
        addr.rua.trim().toLowerCase() === body.rua.trim().toLowerCase() &&
        digitsOnly(addr.numero) === body.numero &&
        digitsOnly(addr.cep) === body.cep
    );
    if (exists) {
      setFeedback('Endereço já cadastrado.');
      return;
    }

    const res = await request<Address>('/addresses', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const created = res.data || { ...body, id: Date.now() };
    setFeedback('Endereço salvo com sucesso.');
    setAddresses((prev) => [created, ...prev]);
    loadAddresses();
    setTimeout(loadAddresses, 2000);
  };

  const searchAddresses = useCallback(
    async (term: string, field?: string) => {
      const query = term.trim();
      if (!query) return [] as Address[];
      try {
        const url = `/addresses/search?query=${encodeURIComponent(query)}${field ? `&field=${encodeURIComponent(field)}` : ''}`;
        const res = await request<any>(url);
        const data = (res.data?.addresses || res.data || res.addresses || []) as Address[];
        return data;
      } catch (err) {
        console.warn('Falha ao buscar endereços', err);
        return [] as Address[];
      }
    },
    [request]
  );

  const handleCreatePhone = async (payload: Phone) => {
    const body = {
      clienteId: normalizeIdValue(payload.cliente_id),
      ddd: digitsOnly(payload.ddd || ''),
      numero: digitsOnly(payload.numero || ''),
    };

    if (payload.id) {
      const res = await request<Phone>(`/phones/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const updated = mapPhoneResponse({ ...payload, ...res.data });
      setPhones((prev) => prev.map((phone) => (phone.id === payload.id ? updated : phone)));
      setFeedback('Telefone atualizado com sucesso.');
      loadPhones();
      setTimeout(loadPhones, 2000);
      return;
    }

    const res = await request<Phone>('/phones', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setFeedback('Telefone salvo com sucesso.');
    setPhones((prev) => [mapPhoneResponse(res.data), ...prev]);
    loadPhones();
    setTimeout(loadPhones, 2000);
  };

  const importAddresses = async (rows: any[]) => {
    for (const row of rows) {
      if (!row.rua || !row.numero || !row.cep) continue;
      await handleCreateAddress({ rua: row.rua, numero: String(row.numero), cep: String(row.cep) });
    }
  };

  const importSuppliers = async (rows: any[]) => {
    for (const row of rows) {
      if (!row.cnpj || !row.razaoSocial || !row.contato) continue;
      await handleCreateSupplier({
        cnpj: String(row.cnpj),
        razao_social: row.razaoSocial || row.razao_social || '',
        contato: row.contato || '',
        email: row.email,
        telefone: row.telefone,
        ddi: row.ddi,
        endereco_id: normalizeIdValue(row.enderecoId ?? row.endereco_id) || undefined,
      });
    }
  };

  const importCustomers = async (rows: any[]) => {
    for (const row of rows) {
      if (!row.nome || (!row.cpf && !row.cnpj)) continue;
      await handleCreateCustomer({
        nome: row.nome,
        email: row.email,
        data_nascimento: row.dataNascimento || row.data_nascimento || row.nascimento,
        cpf: row.cpf,
        cnpj: row.cnpj,
        endereco_id: normalizeIdValue(row.enderecoId ?? row.endereco_id) || undefined,
      });
    }
  };

  const handleCreateManufacturing = async (payload: Manufacturing) => {
    const res = await request<Manufacturing>('/manufacturing', {
      method: 'POST',
      body: JSON.stringify({
        produtoId: normalizeIdValue(payload.produto_id ?? payload.produtoId),
        materialId: normalizeIdValue(payload.material_id ?? payload.materialId),
        quantidadeMaterial: normalizeNumberValue(payload.quantidade_material, true),
      }),
    });
    setFeedback('Manufatura registrada.');
    setManufacturing((prev) => [mapManufacturingResponse(res.data), ...prev]);
    loadManufacturing();
    setTimeout(loadManufacturing, 2000);
  };

  const handleCreateDelivery = async (payload: MaterialDelivery) => {
    const res = await request<MaterialDelivery>('/material-deliveries', {
      method: 'POST',
      body: JSON.stringify({
        materialId: normalizeIdValue(payload.material_id ?? payload.materialId),
        fornecedorId: normalizeIdValue(payload.fornecedor_id ?? payload.fornecedorId),
        quantidade: normalizeNumberValue(payload.quantidade, true),
        dataEntrada: normalizeDateValue(payload.data_entrada ?? payload.dataEntrada),
        custo: normalizeNumberValue(payload.custo, true),
      }),
    });
    setFeedback('Entrega registrada.');
    setDeliveries((prev) => [mapDeliveryResponse(res.data), ...prev]);
    loadDeliveries();
    setTimeout(loadDeliveries, 2000);
  };

  const handleCreateOrder = async (payload: Order) => {
    const res = await request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        clienteId: normalizeIdValue(payload.cliente_id ?? payload.clienteId),
        endereco: normalizeOptionalString(payload.endereco),
        preco: normalizeNumberValue(payload.preco, true),
        dataPedido: normalizeDateValue(payload.data_pedido ?? payload.dataPedido),
        cpfPresentado: payload.cpf_presentado ? digitsOnly(payload.cpf_presentado) : undefined,
        nomePresentado: normalizeOptionalString(payload.nome_presentado),
        emailPresentado: normalizeOptionalString(payload.email_presentado),
        enderecoPresentado: normalizeOptionalString(payload.endereco_presentado),
      }),
    });
    setFeedback('Pedido registrado.');
    setOrders((prev) => [mapOrderResponse(res.data), ...prev]);
    loadOrders();
    setTimeout(loadOrders, 2000);
  };

  const handleCreateShipment = async (payload: Shipment) => {
    const res = await request<Shipment>('/product-shipments', {
      method: 'POST',
      body: JSON.stringify({
        pedidoId: normalizeIdValue(payload.pedido_id ?? payload.pedidoId),
        produtoId: normalizeIdValue(payload.produto_id ?? payload.produtoId),
        quantidade: normalizeNumberValue(payload.quantidade, true),
        dataEnvio: normalizeDateValue(payload.data_envio ?? payload.dataEnvio),
        preco: normalizeNumberValue(payload.preco, true),
      }),
    });
    setFeedback('Envio registrado.');
    setShipments((prev) => [mapShipmentResponse(res.data), ...prev]);
    loadShipments();
    setTimeout(loadShipments, 2000);
  };

  const handleCreateFeedback = async (payload: FeedbackRow) => {
    const res = await request<FeedbackRow>('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        clienteId: normalizeIdValue(payload.cliente_id ?? payload.clienteId),
        data: normalizeDateValue(payload.data),
        nota: normalizeNumberValue(payload.nota, true),
        contato: normalizeOptionalString(payload.contato),
        observacao: normalizeOptionalString(payload.observacao),
      }),
    });
    setFeedback('Feedback registrado.');
    setFeedbackRows((prev) => [mapFeedbackResponse(res.data), ...prev]);
    loadFeedback();
    setTimeout(loadFeedback, 2000);
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
        return <SuppliersPage suppliers={suppliers} addresses={addresses} onCreate={handleCreateSupplier} onImport={importSuppliers} />;
      case 'customers':
        return (
          <CustomersPage customers={customers} addresses={addresses} onSubmit={handleCreateCustomer} onImport={importCustomers} />
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
      <AddressForm onSubmit={handleCreateAddress} onSearch={searchAddresses} addresses={addresses} />
      <BulkImport
        label="Importar endereços (.csv/.json)"
        exampleHint="Campos: rua, numero, cep"
        onImport={importAddresses}
      />
          </div>
        );
      case 'phones':
        return <PhonesPage customers={customers} phones={phones} onSubmit={handleCreatePhone} />;
      default:
        return (
          <Dashboard
            products={products}
            materials={materials}
            suppliers={suppliers}
            customers={customers}
            shipments={shipments}
            deliveries={deliveries}
            orders={orders}
            addresses={addresses}
          />
        );
    }
  }, [authenticated, page, products, materials, suppliers, customers, addresses, phones, uploadImage, orders, shipments, deliveries, manufacturing, feedbackRows, searchAddresses]);

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
          markActivity();
          saveToken(tok);
          setLoginOpen(false);
        }}
      />
    </div>
  );
}

export default App;
