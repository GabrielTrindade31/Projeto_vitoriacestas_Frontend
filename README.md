# Frontend - Vitória Cestas (React + TypeScript)

SPA em React + TypeScript empacotada com **Vite**. O painel mantém navegação lateral,
login via modal e páginas de listagem/criação para produtos, matérias-primas,
fornecedores, clientes, endereços e telefones seguindo o esquema do banco.

## Scripts
- `npm install`: instala dependências.
- `npm run dev`: sobe o Vite em modo desenvolvimento (porta padrão 5173).
- `npm run build`: gera os artefatos estáticos em `dist/` (usados na Vercel).
- `npm run preview`: serve o build localmente.

## API e autenticação
- Base padrão: `https://projeto-vitoriacestas-backend.vercel.app/api`.
  - Em Vercel, o app usa `/api` (proxy configurado em `vercel.json`).
  - Para apontar para outra origem, defina a env `VITE_API_BASE` no build ou a global
    `window.APP_API_BASE` antes de carregar o bundle.
- O JWT retornado em `/auth/login` fica em `localStorage` (`vitoriacestas_token`).
- Chamadas autenticadas adicionam `Authorization: Bearer <token>` automaticamente.
- Upload de imagens usa `/upload` com `multipart/form-data` (FormData). Caso a rota não
  exista no backend, o front mantém apenas a pré-visualização local do blob e exibe um
  lembrete para habilitar o endpoint.

### Endpoints esperados pelo frontend
- Autenticação: `POST /auth/login`.
- Dados base: `GET /addresses`, `POST /addresses`; `GET /customers`, `POST /customers`;
  `GET /suppliers`, `POST /suppliers`; `GET /phones`, `POST /phones`.
- Itens: `GET /products`, `POST /products`; `GET /materials`, `POST /materials`;
  upload opcional em `POST /upload` (imagem Blob).
- Operações: `GET /manufaturas`, `POST /manufaturas`; `GET /entregas-material`,
  `POST /entregas-material`; `GET /pedidos`, `POST /pedidos`; `GET /envios`,
  `POST /envios`; `GET /feedback`, `POST /feedback`.

## Ordem e formato dos cadastros
- Endereços (rua, número, CEP) são obrigatórios para clientes e opcionais para fornecedores.
- Clientes: nome, data de nascimento e um identificador (CPF ou CNPJ) + endereço.
- Telefones precisam de cliente vinculado, DDD (3 dígitos) e número (9 dígitos) e são
  exibidos como `+55 (DDD) número-numero`.
- Fornecedores exigem CNPJ, razão social e contato; telefone e endereço são opcionais.
- Produtos: código único, categoria, quantidade, preço numérico (R$) e fornecedor opcional.
- Matérias-primas: nome obrigatório mais campos de tipo, custo, validade, tamanho,
  material e acessório conforme a tabela `materia_prima`.
