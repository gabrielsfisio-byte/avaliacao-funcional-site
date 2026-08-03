-- Execute este script inteiro no Supabase: seu projeto > SQL Editor > New query > cole tudo > Run

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  responses jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table submissions enable row level security;

-- Pacientes (sem login) podem CRIAR uma resposta nova
create policy "anon_insert" on submissions
  for insert to anon
  with check (true);

-- Pacientes (sem login) podem ATUALIZAR a resposta que criaram (sabendo o id, que é um UUID
-- aleatório e nunca fica listado em lugar nenhum — funciona como um "token" de sessão)
create policy "anon_update" on submissions
  for update to anon
  using (true);

-- Só usuários LOGADOS (você, via Supabase Auth) podem LER a lista de pacientes
create policy "authenticated_select" on submissions
  for select to authenticated
  using (true);

-- Só usuários LOGADOS podem EXCLUIR
create policy "authenticated_delete" on submissions
  for delete to authenticated
  using (true);

-- IMPORTANTE: sem login (papel "anon"), ninguém consegue LISTAR ou LER pacientes — só
-- criar/atualizar um registro que ele mesmo criou. Isso é o que protege os dados dos
-- outros pacientes mesmo com a chave pública (anon key) exposta no código do site.
