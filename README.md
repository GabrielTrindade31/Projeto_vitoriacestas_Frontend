# Frontend - Vitória Cestas (React + TypeScript)

Interface SPA em React/TypeScript (transpilada no navegador via Babel standalone) para
consumir o backend publicado em `https://projeto-vitoriacestas-backend.vercel.app`. A
aplicação usa um layout com navegação lateral, login modal e páginas de listagem/cadastro
para itens e fornecedores, além de visões de leitura para clientes, endereços e telefones.

## Como usar
1. Servir o diretório com qualquer servidor estático (ex.: `python -m http.server 8000`) e
   acessar `http://localhost:8000`.
2. Informe **email** e **senha** utilizados no backend no botão de **Login** do cabeçalho ou
   no chamado exibido na página inicial.
3. Após autenticar, o painel libera as páginas de Itens, Fornecedores, Clientes, Endereços
   e Telefones; as duas primeiras permitem cadastro imediato, as demais fazem leitura do
   backend.

## Notas sobre as chamadas
- API base configurada para `https://projeto-vitoriacestas-backend.vercel.app/api`.
  - Em produção na Vercel, chamadas usam o caminho relativo `/api` (proxy em `vercel.json`).
  - Para apontar a outro backend, defina `window.APP_API_BASE` antes de carregar o script
    `app.tsx`.
- O JWT retornado em `/auth/login` é salvo em `localStorage` (chave `vitoriacestas_token`).
- Cada chamada protegida envia automaticamente `Authorization: Bearer <token>`.
