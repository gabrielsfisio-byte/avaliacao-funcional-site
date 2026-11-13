-- AGENDA PRIVADA DE COMPROMISSOS DOS LEADS
-- Execute este arquivo no SQL Editor do mesmo projeto Supabase usado pelo site.
-- Pode ser executado novamente. Não recria nem modifica pacientes, questionários
-- ou horários de teleconsulta. Não usa dados nem credenciais de produção.
--
-- Os registros pertencem ao usuário autenticado que os cria. A chave pública do
-- site não permite ler ou escrever esta agenda sem login. Compartilhamento entre
-- contas não é habilitado por esta migração.

begin;

create table if not exists public.lead_commitments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  name text,
  phone text not null,
  commitment_date date not null,
  commitment_time text,
  status text not null default 'pending',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_commitments_name_length
    check (name is null or char_length(name) <= 120),
  constraint lead_commitments_phone_format
    check (phone ~ '^[1-9][0-9]{7,14}$'),
  constraint lead_commitments_time_format
    check (commitment_time is null or
      commitment_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  constraint lead_commitments_status_values
    check (status in ('pending', 'contacted', 'paid', 'closed')),
  constraint lead_commitments_note_length
    check (char_length(note) <= 1500),
  constraint lead_commitments_owner_phone_date_key
    unique (owner_id, phone, commitment_date)
);

create index if not exists lead_commitments_owner_date_status_idx
  on public.lead_commitments (owner_id, commitment_date, status);

alter table public.lead_commitments enable row level security;

-- Revoga inclusive privilégios decorrentes das configurações padrão do projeto.
-- Os seis campos de formulário são os únicos que o cliente pode gravar.
-- id, owner_id e carimbos de data são definidos pelo banco, não pelo navegador.
revoke all on table public.lead_commitments from public, anon, authenticated;
grant select, delete on table public.lead_commitments to authenticated;
grant insert (name, phone, commitment_date, commitment_time, status, note)
  on public.lead_commitments to authenticated;
grant update (name, phone, commitment_date, commitment_time, status, note)
  on public.lead_commitments to authenticated;

drop policy if exists "lead_commitments_select_own" on public.lead_commitments;
drop policy if exists "lead_commitments_insert_own" on public.lead_commitments;
drop policy if exists "lead_commitments_update_own" on public.lead_commitments;
drop policy if exists "lead_commitments_delete_own" on public.lead_commitments;

create policy "lead_commitments_select_own"
  on public.lead_commitments for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "lead_commitments_insert_own"
  on public.lead_commitments for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "lead_commitments_update_own"
  on public.lead_commitments for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "lead_commitments_delete_own"
  on public.lead_commitments for delete to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.set_lead_commitment_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.id is distinct from old.id
    or new.owner_id is distinct from old.owner_id
    or new.created_at is distinct from old.created_at then
    raise exception 'A identidade e a data de criação do compromisso não podem ser alteradas.'
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- A função só é usada pelo gatilho, não é um endpoint RPC para o site.
revoke all on function public.set_lead_commitment_updated_at()
  from public, anon, authenticated;

drop trigger if exists lead_commitments_set_updated_at
  on public.lead_commitments;
create trigger lead_commitments_set_updated_at
  before update on public.lead_commitments
  for each row execute function public.set_lead_commitment_updated_at();

commit;

-- Se o site mostrar que a agenda ainda não foi configurada após executar o SQL,
-- atualize a página. Em caso de erro, confira o projeto e a sessão de login.
-- Não desative o RLS para resolver uma falha de acesso.
