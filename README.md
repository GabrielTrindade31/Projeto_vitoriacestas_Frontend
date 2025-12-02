# Frontend - Vitória Cestas (React + TypeScript)

SPA em React + TypeScript empacotada com **Vite** para publicar sem Babel no navegador.
O painel mantém navegação lateral, login em modal e páginas de listagem/criação para
itens e fornecedores, além de visões de leitura para clientes, endereços e telefones.

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
