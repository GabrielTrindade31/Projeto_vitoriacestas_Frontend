# Frontend - Vitória Cestas (Estoque)

Interface estática para consumir o backend publicado em
`https://projeto-vitoriacestas-backend.vercel.app`. A página principal apresenta o fluxo
sugerido, formulário de login e um painel com itens/fornecedores recentes e atalhos de
cadastro com visual em branco + verde/verde-água.

## Como usar
1. Instale dependências (opcional; a página funciona abrindo o `index.html`, mas você pode
   servir com qualquer servidor estático). Para deploy no **Vercel**, basta importar este
   repositório: o `vercel.json` já cria um proxy de `/api/*` para o backend publicado.
2. Acesse `index.html` pelo navegador ou via um servidor local.
3. Informe **email** e **senha** utilizados no backend em "Acesso" e envie.
4. Após o login, o painel principal mostra os últimos registros e libera os botões para
   cadastrar item ou fornecedor.

## Notas sobre as chamadas
- API base já configurada para `https://projeto-vitoriacestas-backend.vercel.app/api`.
  - Em produção na Vercel, chamadas usam o caminho relativo `/api` (proxy configurado em
    `vercel.json`), evitando problemas de CORS.
  - Para apontar a outro backend (por exemplo, ambiente de staging), defina
    `window.APP_API_BASE` antes de carregar `main.js`.
- O JWT retornado em `/auth/login` é salvo em `localStorage` (chave `vitoriacestas_token`).
- Cada chamada protegida envia automaticamente `Authorization: Bearer <token>`.
- Em caso de resposta HTML inesperada, o frontend avisa com erro de parse.
