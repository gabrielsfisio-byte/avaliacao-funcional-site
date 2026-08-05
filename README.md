# Avaliação Funcional — Gabriel dos Santos Ferreira

Site para o paciente autoaplicar os questionários validados (ODI, NDI, TSK-13, QuickDASH,
WHODAS 2.0 e EVA) antes da avaliação, com painel privado para você ver os escores já
calculados e classificados na mesma escala CIF usada nos laudos.

## 1. Configurar o Supabase (banco de dados)

1. Acesse seu projeto em [supabase.com](https://supabase.com).
2. Vá em **SQL Editor** → **New query**, cole todo o conteúdo do arquivo
   `supabase-setup.sql` deste repositório e clique em **Run**.
3. Vá em **Authentication** → **Users** → **Add user** e crie seu acesso:
   - **E-mail:** pode ser qualquer coisa, não precisa existir de verdade — por exemplo
     `gabriel@avaliacao-funcional.local` (mesmo valor que vai em `ADMIN_EMAIL` no `config.js`).
   - **Senha:** o **PIN numérico** que você quer usar para entrar no painel. Por padrão o
     Supabase exige pelo menos 6 caracteres — use um PIN de 6 dígitos (ex.: uma data
     importante, "150965"). Se quiser um PIN de 4 dígitos, antes vá em
     **Authentication** → **Sign In / Providers** → **Email** e reduza o
     "Minimum password length" para 4.
   - Marque a opção de confirmar o e-mail automaticamente, se aparecer.
4. Vá em **Project Settings** → **API**. Copie:
   - **Project URL**
   - **anon public** key

## 2. Preencher o `config.js`

Abra o arquivo `config.js` e cole os valores do passo anterior:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
  ADMIN_EMAIL: "gabriel@avaliacao-funcional.local"  // igual ao e-mail criado no passo 1.3
};
```

Salve o arquivo. **O `ADMIN_EMAIL` precisa ser idêntico ao e-mail do usuário criado no
Supabase** — ele nunca aparece na tela para você, é só usado por baixo dos panos para o
login funcionar com o PIN.

## 3. Subir para o GitHub

Se você baixou esta pasta como zip, dentro dela, pelo terminal:

```bash
git init
git add .
git commit -m "primeira versão do site de avaliação funcional"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git
git push -u origin main
```

(Crie o repositório vazio antes, em github.com → New repository. Pode ser privado ou público — o
código não contém nenhum dado de paciente, só a URL e a chave pública do Supabase.)

## 4. Ativar o GitHub Pages

1. No repositório, vá em **Settings** → **Pages**.
2. Em **Source**, selecione a branch `main` e a pasta `/ (root)`.
3. Salve. Em 1–2 minutos seu site estará em:
   `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`

Esse é o link que você manda para o paciente.

## 5. Usar

- **Paciente:** abre o link, digita o nome, responde os questionários. Ao final, só vê uma
  tela de confirmação — nenhuma nota ou interpretação aparece para ele.
- **Você:** clique em "Área do profissional" no topo e digite o PIN criado no passo 1.3.
  Depois da primeira vez, o navegador do seu celular/computador guarda a sessão — não pede
  o PIN de novo, a menos que você clique em "Sair". Dentro do painel, use a busca para
  encontrar um paciente pelo nome; ao abrir, você vê os escores já com a cor e o
  qualificador CIF (0 a 4) que você usa na Seção 7 do laudo.

## Agenda de teleconsultas

No painel do profissional, o card "Agenda de teleconsultas" permite cadastrar horários
livres (data + hora). Ao final do questionário, o paciente vê a pergunta "você teria
interesse em uma teleconsulta rápida (até 10 minutos)?" — se disser sim, escolhe um dos
horários livres, informa o telefone, e o horário sai da lista de disponíveis
automaticamente (evitando que duas pessoas peguem o mesmo horário). Você acompanha tudo
isso no mesmo card, com o nome e telefone de quem agendou.

## Segurança dos dados

- A tabela `submissions` tem Row Level Security ativado: qualquer pessoa pode criar/atualizar
  um registro (para o paciente conseguir responder sem precisar de conta), mas **só quem
  estiver logado com seu usuário consegue ler ou excluir** os dados. Ninguém sem login
  consegue listar ou visualizar as respostas de nenhum paciente.
- Ainda assim, informe ao paciente que os dados que ele preencher serão usados para fins de
  avaliação técnica e enviados a você — dado de saúde é dado sensível pela LGPD.

## Revisão pendente

Os itens dos questionários foram escritos seguindo a estrutura clínica padrão de cada
instrumento, mas a redação não foi conferida palavra por palavra contra as versões
oficiais validadas para o português do Brasil (Vigatto et al. para o ODI, Siqueira et al.
para o TSK-13, Orfale/Silva para o QuickDASH). O mJOA foi adaptado para autorrelato a
partir das descrições padrão de cada domínio (motor de membros superiores/inferiores,
sensibilidade, esfíncter) — vale revisar contra a versão de referência que você usa antes
de citar em laudo, e o total considerado foi 18 pontos (a literatura cita tanto 17 quanto
18 dependendo da fonte). Antes de usar os resultados em um laudo que vá para o INSS ou
para o Judiciário, vale comparar o texto das perguntas com as versões validadas
publicadas — principalmente o item de pontuação invertida do TSK-13, que varia de
numeração entre versões.
