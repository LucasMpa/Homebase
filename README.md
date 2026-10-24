# Homebase

Painel pessoal para organizar as contas da casa. **Fase 2:** cadastro de contas recorrentes, pagamentos, a tela “Esta semana” e o livro-caixa (“Lançamentos”), com gastos avulsos.

Stack: Next.js 16 (App Router, TypeScript strict) · Supabase local (Docker Compose) · Tailwind CSS 4 + shadcn/ui · Supabase Auth com Google · Vitest.

---

## Pré-requisitos

- Docker com o plugin Compose em execução
- Uma conta Google com acesso ao [Google Cloud Console](https://console.cloud.google.com)
- Opcional, para rodar scripts e testes fora do container: Node.js 20.9+ (testado com 24) e [pnpm](https://pnpm.io) 10+

A Supabase CLI continua como dependência de desenvolvimento, mas só para criar migrations, gerar tipos e publicar na nuvem. O ambiente local é o `docker-compose.yml`.

## 1. Criar as credenciais OAuth no Google Cloud Console

1. Acesse **APIs e serviços → Tela de permissão OAuth** (*OAuth consent screen* / *Google Auth Platform*). Configure como **Externo**, preencha nome do app e e-mail de suporte. Em **Público-alvo / Usuários de teste**, adicione o seu e-mail.
2. Vá em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**.
   - Tipo de aplicativo: **Aplicativo da Web**
   - **Origens JavaScript autorizadas:** `http://localhost:3000`
   - **URIs de redirecionamento autorizados:** `http://127.0.0.1:54321/auth/v1/callback`

     Esse é o callback do *Supabase Auth local*, não do Next.js. O Google devolve o usuário ao Supabase, e o Supabase redireciona para `http://localhost:3000/auth/callback`.
3. Copie o **ID do cliente** e a **Chave secreta do cliente**.

## 2. Configurar o `.env.local`

```bash
cp .env.example .env.local
```

Preencha `ALLOWED_EMAIL` (o **único** e-mail Google com acesso ao app) e as duas variáveis `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` com os dados do passo 1. A URL e as chaves do Supabase já vêm preenchidas com os valores locais do compose.

O compose lê o `.env.local` no container do Auth (credenciais do Google) e no do Next (via bind mount). **Depois de mudar as variáveis do Google, recrie o Auth:** `docker compose up -d --force-recreate auth`.

## 3. Subir tudo

```bash
docker compose up -d
```

Na primeira vez as imagens são baixadas e o container do Next roda `pnpm install`, o que leva alguns minutos. Acompanhe com `docker compose logs -f next`.

A ordem de subida é: Postgres → Auth (cria o schema `auth`) → `migrate` (aplica `supabase/migrations` e, num banco novo, o `seed.sql`) → Next. Antes de subir o Next, o `pnpm dev` roda `pnpm sync:allowed-email`, que copia o `ALLOWED_EMAIL` para o banco, onde o hook de cadastro e o RLS o usam.

| Serviço | URL |
|---|---|
| App | http://localhost:3000 |
| API (Kong) | http://127.0.0.1:54321 |
| Studio (painel do banco) | http://127.0.0.1:54323 |
| Mailpit (e-mails do Auth) | http://127.0.0.1:54324 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Abra **http://localhost:3000** e entre com o Google. Use `localhost`, e não `127.0.0.1`: os cookies do login ficam presos ao host.

O container do Next compartilha a rede do Kong. Por isso `http://127.0.0.1:54321` funciona tanto no navegador quanto no servidor, e a porta 3000 aparece publicada no serviço `kong`.

Os segredos (senha do Postgres, JWT secret, chaves `anon`/`service_role`) são os de demonstração da Supabase e ficam no próprio `docker-compose.yml`. Servem só para a sua máquina.

### Contas de exemplo (opcional)

Depois de fazer login pela primeira vez (o usuário só passa a existir no Supabase nesse momento):

```bash
docker compose exec next pnpm seed:dev           # cria 6 contas, alguns pagamentos e 5 gastos avulsos
docker compose exec next pnpm seed:dev --reset   # apaga seus lançamentos e contas antes de recriar
```

O script se recusa a rodar contra qualquer URL que não seja local. Com Node instalado, `pnpm seed:dev` direto no host também funciona.

---

## Comandos

| Comando | O que faz |
|---|---|
| `docker compose up -d` | Sobe o ambiente (aplica migrations novas a cada subida) |
| `docker compose down` | Derruba os containers, mantendo o banco |
| `docker compose down -v && docker compose up -d` | Recria o banco do zero (migrations + `seed.sql`) e **apaga os usuários** |
| `docker compose run --rm migrate` | Aplica migrations novas sem reiniciar nada |
| `docker compose logs -f <serviço>` | Logs (`next`, `auth`, `db`, `migrate`…) |
| `docker compose exec next pnpm <script>` | Roda um script do `package.json` dentro do container |
| `pnpm test` | Testes (Vitest) |
| `pnpm typecheck` | Gera os tipos de rota do Next e roda `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm sync:allowed-email` | Copia `ALLOWED_EMAIL` do `.env.local` para o banco (roda sozinho antes do `pnpm dev`) |
| `pnpm db:types` | Regenera `src/lib/supabase/database.types.ts` a partir do banco local (via `postgres-meta` do compose) |
| `pnpm supabase migration new <nome>` | Cria uma nova migration versionada |

As migrations aplicadas ficam em `supabase_migrations.schema_migrations`, a mesma tabela da Supabase CLI.

## Como funciona

### Contas e recorrência

O banco guarda a **regra** de recorrência (`bills.frequency` + `start_date` + `end_date`), e não cada vencimento. As ocorrências são calculadas no app, e só os pagamentos viram registros: lançamentos em `transactions` com `bill_id` + `due_date`, únicos por `(bill_id, due_date)`.

A lógica fica em `src/lib/recurrence/`, em funções puras e sem acesso ao banco:

- `dates.ts`: aritmética de datas civis (`"YYYY-MM-DD"`) e `todayInSaoPaulo()`.
- `occurrences.ts`: geração das ocorrências.
  - `monthly` usa o dia da âncora ou o último dia do mês.
  - `yearly` transforma 29/02 em 28/02.
  - Nada é gerado fora de `[start_date, end_date]`.
- `status.ts`: os estados paga, atrasada, vence hoje e a vencer.
- `schedule.ts`: junta contas e pagamentos para a tela inicial e o resumo do mês.

### Lançamentos (livro-caixa)

Todo dinheiro que saiu é uma linha de `transactions`. Com `bill_id` + `due_date`, é o pagamento de uma ocorrência de conta; sem conta, é um **gasto avulso**, registrado pelo atalho “+ Gasto” (`/transactions/new`).

- `paid_at` é o dia em que o dinheiro saiu (nunca no futuro). Um ingresso comprado hoje para um show no mês que vem conta hoje.
- Ao marcar uma conta como paga, o lançamento guarda o **retrato** do nome e da categoria da conta naquele momento. Renomear ou recategorizar a conta depois não muda os lançamentos antigos.
- Pagamento de conta só muda pela conta: “Desfazer” apaga o lançamento, excluir a conta apaga os pagamentos dela (cascade) e arquivar preserva. As actions de Lançamentos recusam lançamentos com `bill_id`.
- `/transactions` mostra um mês por vez (`?month=YYYY-MM`), com filtro Tudo/Avulsos/Contas (`?kind=`), agrupado por dia.
- Os Relatórios somam contas e avulsos, por `paid_at` e pela categoria do lançamento. “Esta semana” continua só com contas, e Terceiros fica fora do livro-caixa.

As regras ficam em funções puras: `src/lib/ledger.ts` (agrupamento por dia, filtro de tipo, recusa de edição) e `src/lib/reports.ts` (totais por mês, por categoria e por tipo).

### Gastos de terceiros

Em `/third-party` ficam as compras que outra pessoa passou no seu cartão e que ela precisa te devolver (`third_party_expenses`). Cada gasto guarda o **valor total** da compra. As parcelas definem o **custo mensal**: a 1ª cai no mês da compra, e a sobra de centavos da divisão vai para ela. Ao cadastrar, uma prévia mostra quanto a compra soma em cada mês, junto com o que a pessoa já tinha comprometido. A página mostra o total a receber dos próximos 6 meses. Quando a pessoa te paga, o gasto é marcado como acertado (`settled_at`), um por um ou todos os pendentes da pessoa de uma vez. O acerto pode ser desfeito. Os agrupamentos e totais ficam em `src/lib/third-party.ts`.

### Segurança

- O `src/proxy.ts` (o antigo `middleware.ts`, renomeado no Next 16) roda em todas as rotas. Ele renova a sessão, manda quem não está logado para `/login` e, se o e-mail não for o `ALLOWED_EMAIL`, faz `signOut` e redireciona para `/access-denied`.
- `requireUser()` (`src/lib/auth.ts`) repete a checagem no servidor, no layout autenticado, em toda leitura de dados e em toda Server Action.
- O `/auth/callback` checa o e-mail logo após o OAuth.
- No Supabase Auth, um hook `before_user_created` recusa com 403 o cadastro de qualquer e-mail diferente do permitido. Isso vale também para quem chama a API do Auth direto, sem passar pelo app.
- No banco, o RLS exige que a linha seja do `auth.uid()` **e** que o e-mail do JWT seja o permitido. O papel `anon` não tem nenhum grant, e a FK composta `(bill_id, user_id)` de `transactions` impede um lançamento de apontar para a conta de outro usuário.
- O e-mail permitido fica em `private.app_settings`. Esse schema não é exposto pela API, e só a secret key consegue alterar o valor.
- Sem `ALLOWED_EMAIL` configurado, ninguém entra (falha fechada) em nenhuma das camadas.
- O login por e-mail/senha está desligado (`GOTRUE_EXTERNAL_EMAIL_ENABLED` no `docker-compose.yml`). Só o Google funciona.
- A sessão expira em 30 dias (`GOTRUE_SESSIONS_TIMEBOX: 720h`).
- O hook não roda quando um usuário é criado pela API de admin com a secret key (comportamento do GoTrue). Essa chave nunca sai do servidor.

### Fuso horário

“Hoje”, vencimento e atraso são sempre calculados em `America/Sao_Paulo`, seja qual for o fuso do servidor ou do navegador.

## Indo para a nuvem (fases futuras)

As migrations em `supabase/migrations` são as mesmas que serão aplicadas no projeto em nuvem (`pnpm supabase link` + `pnpm supabase db push`). Depois do `db push`, rode `pnpm sync:allowed-email` apontando para o projeto na nuvem e habilite o hook *Before User Created* no painel (Authentication → Hooks). Na nuvem, `timebox` exige plano Pro, e as URLs de redirecionamento precisam ser cadastradas no painel do Supabase e no Google. As configurações de Auth do `docker-compose.yml` (variáveis `GOTRUE_*`) também precisam ser replicadas no painel. O `supabase/config.toml` não é mais usado localmente e só fica como referência para a CLI.
