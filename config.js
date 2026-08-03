// Cole aqui os dados do SEU projeto Supabase.
// Onde encontrar: Supabase > seu projeto > Project Settings > API
//   - Project URL              -> SUPABASE_URL
//   - anon public (API key)    -> SUPABASE_ANON_KEY
// Essas duas informações são PÚBLICAS por design (o site precisa delas para funcionar
// no navegador do paciente) — a segurança real vem das políticas RLS do supabase-setup.sql,
// não do sigilo desses valores.

window.APP_CONFIG = {
  SUPABASE_URL: "https://esnasqtghtvpamyzonlx.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_WJoUE5Mi1E_76dc3lRAWxw_QW8vy3kv",

  // E-mail usado só internamente para o login (o site pede a você apenas o PIN,
  // nunca esse e-mail). Precisa ser IDÊNTICO ao e-mail do usuário que você criar
  // em Supabase > Authentication > Users. Pode ser qualquer e-mail, real ou não.
  ADMIN_EMAIL: "gabriel@avaliacao-funcional.local"
};
