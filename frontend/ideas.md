# MADM Brasil — Brainstorming de Design

## Contexto
Plataforma SaaS de rastreamento de comissões e performance para equipe de vendas brasileira.
Cores da marca: Azul #09175b | Verde #34a853 | Gelo #c8eaed | Esmeralda #045b5b | Ouro #ffcc00

---

<response>
<idea>
**Design Movement:** Corporate Data Modernism — inspirado em Bloomberg Terminal reimaginado com sensibilidade Stripe
**Probability:** 0.07

**Core Principles:**
1. Hierarquia de dados como arquitetura visual — métricas grandes, contexto pequeno
2. Contraste intencional: fundo branco puro com acentos de cor cirúrgicos
3. Densidade informacional sem ruído — cada pixel justificado
4. Tipografia como ferramenta de navegação

**Color Philosophy:**
Azul profundo (#09175b) como âncora de autoridade, usado em sidebars e cabeçalhos de seção.
Verde (#34a853) exclusivamente para indicadores positivos e metas atingidas.
Ouro (#ffcc00) como sinal de alerta positivo — bônus, top performers, conquistas.
Gelo (#c8eaed) como fundo de cards secundários e estados hover sutis.
Fundo branco (#ffffff) absoluto para máxima clareza de dados.

**Layout Paradigm:**
Sidebar fixa à esquerda com 64px de largura (ícones) expandindo para 240px.
Área de conteúdo com grid assimétrico: métricas primárias ocupam 2/3, secundárias 1/3.
Cards com bordas superiores coloridas (color-coded por categoria).

**Signature Elements:**
1. Barra de progresso de meta com gradiente azul→verde ao atingir 100%
2. Números de KPI em fonte display bold com unidade em tamanho menor
3. Badges dourados para top performers com ícone de troféu

**Interaction Philosophy:**
Hover revela detalhes adicionais. Clique expande cards para visão detalhada.
Transições rápidas (150ms) para parecer responsivo e profissional.

**Animation:**
Números contam de 0 ao valor real ao carregar (countUp animation).
Cards entram com fade-in + translateY(8px) em cascata.
Barras de progresso animam da esquerda para direita.

**Typography System:**
Display: Space Grotesk Bold — para KPIs e títulos principais
Body: Inter Regular/Medium — para dados e labels
Monospace: JetBrains Mono — para valores monetários e percentuais
</idea>
<probability>0.07</probability>
</response>

<response>
<idea>
**Design Movement:** Financial Command Center — inspirado em dashboards de trading e fintech premium
**Probability:** 0.06

**Core Principles:**
1. Informação em camadas: visão macro → micro em drill-down
2. Status sempre visível: verde/vermelho/amarelo como linguagem universal
3. Sidebar escura contrastando com conteúdo branco (split personality)
4. Gamificação integrada ao layout, não como adorno

**Color Philosophy:**
Sidebar em azul escuro (#09175b) criando separação visual clara do conteúdo.
Cards brancos com sombras suaves (box-shadow: 0 2px 8px rgba(0,0,0,0.08)).
Esmeralda (#045b5b) para seções de análise e funil.
Ouro (#ffcc00) com background escuro para badges de ranking.

**Layout Paradigm:**
Layout de duas colunas: sidebar 240px fixa + área de conteúdo fluida.
Dashboard principal com grid de 12 colunas, cards de 4, 6 e 12 colunas.
Seção de ranking em coluna lateral direita sempre visível.

**Signature Elements:**
1. Indicador de posição no ranking sempre visível no header
2. Termômetro de meta animado verticalmente
3. Linha do tempo de performance como sparkline no card de KPI

**Interaction Philosophy:**
Filtros persistentes no topo da área de conteúdo.
Tooltips ricos em dados ao hover em gráficos.
Notificações como drawer lateral deslizante.

**Animation:**
Sparklines desenham em tempo real ao carregar.
Ranking atualiza com animação de reordenação.
Hover em cards eleva com transform: translateY(-2px) + shadow increase.

**Typography System:**
Display: Sora ExtraBold — para números e rankings
Body: DM Sans Regular — para textos e labels
Accent: Sora Medium — para subtítulos e categorias
</idea>
<probability>0.06</probability>
</response>

<response>
<idea>
**Design Movement:** Precision SaaS — síntese entre HubSpot's clarity e Stripe's sophistication
**Probability:** 0.08

**Core Principles:**
1. Cada tela responde: "O que devo fazer agora?" — ação como norte do design
2. Hierarquia tipográfica rigorosa: 3 tamanhos de texto, 3 pesos, sem exceções
3. Espaçamento generoso como sinal de premium e confiança
4. Cor como semântica, não decoração

**Color Philosophy:**
Branco (#ffffff) como fundo absoluto — nunca cinza, nunca off-white.
Azul (#09175b) para elementos de navegação e CTAs primários.
Verde (#34a853) apenas para estados positivos confirmados.
Ouro (#ffcc00) com fundo azul escuro para destaque de bônus e conquistas.
Gelo (#c8eaed) como fill de cards de destaque e hover states.
Bordas em cinza muito claro (1px solid #e8eaed) para separação sem peso visual.

**Layout Paradigm:**
Sidebar esquerda 256px com logo, nav e perfil do usuário.
Header fixo com breadcrumb, filtro de período e notificações.
Grid de conteúdo com 3 zonas: KPIs (topo), gráficos (meio), tabelas (base).
Mobile: bottom navigation bar com 5 ícones.

**Signature Elements:**
1. "Goal Meter" — arco circular animado mostrando % da meta com cor dinâmica
2. Leaderboard card sempre no topo da sidebar com posição atual destacada
3. Insight cards com ícone de raio (⚡) e borda esquerda colorida por urgência

**Interaction Philosophy:**
Filtros de período (Hoje/Semana/Mês) como toggle pills no topo.
Drill-down por clique em qualquer métrica.
Notificações com badge de contagem e drawer deslizante.

**Animation:**
Goal meter anima ao carregar com ease-out-cubic.
Números de KPI com countUp em 800ms.
Transição de página com fade (200ms) — nunca slide.
Cards com stagger animation de 50ms entre eles.

**Typography System:**
Display: Plus Jakarta Sans ExtraBold (800) — KPIs e títulos de seção
Body: Plus Jakarta Sans Regular (400) e Medium (500) — textos e labels
Numbers: Tabular nums com font-variant-numeric: tabular-nums
Hierarquia: 32px KPI / 20px título / 14px label / 12px caption
</idea>
<probability>0.08</probability>
</response>

---

## Decisão Final
**Abordagem escolhida: Precision SaaS (Resposta 3)**

Razão: Melhor equilíbrio entre clareza de dados, motivação por gamificação e usabilidade mobile/web.
A filosofia de "cada tela responde o que fazer agora" alinha perfeitamente com o objetivo do produto.
