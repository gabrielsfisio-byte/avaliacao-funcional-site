-- Execute este script inteiro no Supabase: seu projeto > SQL Editor > New query > cole tudo > Run

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  responses jsonb not null default '{}'::jsonb,
  assigned jsonb,
  created_at timestamptz not null default now()
);

alter table submissions add column if not exists assigned jsonb;

alter table submissions enable row level security;

drop policy if exists "anon_insert" on submissions;
drop policy if exists "anon_update" on submissions;
drop policy if exists "authenticated_select" on submissions;
drop policy if exists "authenticated_delete" on submissions;

-- Pacientes (sem login) podem CRIAR uma resposta nova; você (logado) também pode criar,
-- para gerar um link específico por paciente com os questionários já escolhidos
create policy "anon_insert" on submissions
  for insert to anon, authenticated
  with check (true);

-- Só usuários LOGADOS (você, via Supabase Auth) podem LER a lista de pacientes
create policy "authenticated_select" on submissions
  for select to authenticated
  using (true);

-- Só usuários LOGADOS podem EXCLUIR
create policy "authenticated_delete" on submissions
  for delete to authenticated
  using (true);

-- Não existe política de UPDATE direta para "anon": no Postgres, uma atualização
-- filtrada por WHERE (ex.: "where id = ...") também exige permissão de LEITURA daquela
-- linha, não só de escrita. Dar leitura ao paciente sem login abriria a tabela toda.
-- Em vez disso, os pacientes atualizam suas respostas através da função abaixo, que
-- roda com privilégio elevado (SECURITY DEFINER) e nunca expõe leitura da tabela.

create or replace function save_submission_responses(p_id uuid, p_responses jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update submissions set responses = p_responses where id = p_id;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function save_submission_responses(uuid, jsonb) from public;
grant execute on function save_submission_responses(uuid, jsonb) to anon;

-- Função para o paciente, ao abrir um link específico (?p=id), buscar só o NOME dele,
-- quais questionários foram atribuídos a ele, e o que ele já respondeu — sem nunca
-- abrir acesso de leitura à tabela inteira (só devolve a linha exata daquele id).
create or replace function get_assignment(p_id uuid)
returns table(name text, assigned jsonb, responses jsonb)
language sql
security definer
set search_path = public
as $$
  select s.name, s.assigned, s.responses from submissions s where s.id = p_id;
$$;

revoke all on function get_assignment(uuid) from public;
grant execute on function get_assignment(uuid) to anon;

-- IMPORTANTE: sem login (papel "anon"), ninguém consegue LISTAR ou LER pacientes — só
-- criar/atualizar um registro que ele mesmo criou. Isso é o que protege os dados dos
-- outros pacientes mesmo com a chave pública (anon key) exposta no código do site.
