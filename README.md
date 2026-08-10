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
para o TSK-13, Orfale/Silva para o QuickDASH, Freitas et al. 2024 para o SFI-10-Br,
Pinheiro/Tróccoli/Carvalho 2002 para o NMQ, Martinez/Latorre/Fischer 2009 para o
ICT/WAI). O mJOA foi adaptado para autorrelato a partir das descrições padrão de cada
domínio (motor de membros superiores/inferiores, sensibilidade, esfíncter) — vale revisar
contra a versão de referência que você usa antes de citar em laudo, e o total considerado
foi 18 pontos (a literatura cita tanto 17 quanto 18 dependendo da fonte).

**Atenção especial ao ICT/WAI:** o sistema coleta as respostas de cada item, mas
NÃO calcula automaticamente o escore composto oficial (que depende de tabelas de
conversão específicas e não-lineares para vários itens, ex.: número de doenças e dias de
afastamento). Antes de citar uma classificação (capacidade baixa/moderada/boa/ótima) no
laudo, aplique manualmente a tabela de conversão oficial do manual do ICT sobre as
respostas registradas.

**Atenção especial ao HIT-6:** o escore oficial usa uma tabela de pesos específica por
item e por resposta (não é uma soma simples de 0 a 4 por item). O sistema mostra a soma
simplificada só como referência — confira a tabela oficial antes de citar a categoria de
impacto (pouco/algum/substancial/severo) no laudo.

**WPI e SSS** são instrumentos complementares que juntos compõem o critério diagnóstico
oficial de fibromialgia (ACR 2010/2016): considera-se o critério preenchido quando
WPI ≥ 7 e SSS ≥ 5, OU WPI entre 4 e 6 e SSS ≥ 9. O sistema mostra o resultado de cada um
separadamente — a combinação dos dois deve ser feita por você.

**HOOS e KOOS** aqui implementados são versões condensadas (16 itens cada), cobrindo os
mesmos cinco domínios das versões oficiais completas (dor, sintomas, atividades de vida
diária, esporte/lazer e qualidade de vida), mas com menos itens por domínio que as
versões oficiais de 40 itens. Para o nível máximo de fidelidade psicométrica em um caso
específico, considere aplicar a versão oficial completa.

**HADS:** para simplificar a aplicação, todos os 14 itens usam a mesma escala de resposta
(Nunca/Raramente/Às vezes/Frequentemente). A versão oficial tem uma redação de opções
específica e diferente para cada item (ex.: "Sim, com certeza/Geralmente/Não muito/Nunca").
O cálculo das subescalas de Ansiedade e Depressão (incluindo a inversão dos itens
positivos) segue a lógica oficial — só a redação das opções de resposta foi padronizada.

**CSI (Central Sensitization Inventory):** a versão da Parte A (25 itens, sintomas) foi
escrita a partir do conteúdo geral conhecido do instrumento. A Parte B oficial (checklist
de diagnósticos prévios como fibromialgia, síndrome do intestino irritável, etc.), que
normalmente acompanha o CSI mas não entra no escore, não foi incluída aqui.

**Örebro (versão curta):** o escore oficial (corte usual ≥50 sugerindo alto risco de
cronificação/não retorno ao trabalho) foi validado sobre a soma bruta dos itens originais.
Como os domínios aqui têm amplitudes diferentes entre si, o resultado mostrado é
**normalizado** para uma escala de 0 a 100 — trate o número como uma aproximação da
gravidade, não como o escore oficial exato validado na literatura.

Antes de usar os resultados em um laudo que vá para o INSS ou para o Judiciário, vale
comparar o texto das perguntas com as versões validadas publicadas — principalmente o
item de pontuação invertida do TSK-13, que varia de numeração entre versões.
