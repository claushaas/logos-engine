# LOGOS TUI UX Spec

**Status:** Rascunho 1
**Escopo:** LOGOS Engine MVP — experiência da interface de terminal (TUI)
**Público:** produto, engenharia, design
**Propósito canônico:** Definir telas, navegação, atalhos, feedback visual e fluxos de interação da TUI do LOGOS Engine.

---

## 1. Propósito

Esta especificação define a experiência do usuário na TUI do LOGOS Engine. A TUI não é um chat app — é um **workspace de documentação executável** que opera sobre fases, documentos, perguntas, respostas canônicas, validações, patches e artefatos derivados.

### 1.1 O que a TUI é

- Um navegador de projeto documental
- Um console de entrevista estruturada
- Um visualizador de diffs e patches
- Um painel de status e diagnósticos
- Um compilador de execução

### 1.2 O que a TUI NÃO é

- ❌ Um chat app
- ❌ Um editor de Markdown genérico
- ❌ Um task manager
- ❌ Um terminal de agente autônomo
- ❌ Uma interface direta de LLM

### 1.3 Regra arquitetural

```
A TUI NUNCA chama a LLM diretamente.
A TUI NUNCA escreve no filesystem diretamente.

A TUI exibe estado vindo do Core e do Interview Engine.
A TUI despacha ações que o Application Layer processa.
A TUI consome eventos normalizados.
```

---

## 2. Princípios de UX

### 2.1 Clareza sobre estado

```txt
O usuário deve saber, a qualquer momento:
  - Onde está (tela atual)
  - O que existe (documentos, fases, artefatos)
  - O que falta (lacunas, diagnósticos)
  - O que é rastreável (source messages, canonical answers)
  - O que é derivado (gerado, regenerável)
  - Quem produziu o quê (usuário vs LLM)
```

### 2.2 Transparência de origem

```txt
A TUI DEVE diferenciar visualmente:
  - Conteúdo fornecido pelo usuário (verbatim)
  - Conteúdo sintetizado pelo agente (agentRefinement)
  - Conteúdo inferido (agentInference)
  - Conteúdo pendente de aprovação (draft)
  - Conteúdo canônico (accepted/saved)
```

### 2.3 Segurança visível

```txt
Ações que escrevem no filesystem DEVEM ser sinalizadas.
O usuário deve saber, antes de confirmar:
  - O que será escrito
  - Onde será escrito
  - Se é uma operação atômica
  - Se existe backup/snapshot
```

### 2.4 Lacunas não escondidas

```txt
Gaps, missingSignals, low-confidence answers e unresolvedQuestions
DEVEM ser visíveis nas telas relevantes.
NUNCA esconder diagnósticos em "modo avançado" ou submenu.
```

---

## 3. Modelo de Navegação

### 3.1 Grafo de telas

```txt
                    ┌─────────────┐
                    │  Overview   │
                    └──────┬──────┘
                           │
          ┌──────────┬─────┴─────┬──────────┐
          ▼          ▼           ▼          ▼
    ┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐
    │  Phase   │ │Document│ │Executive │ │Artifacts │
    └────┬─────┘ └───┬────┘ └──────────┘ └──────────┘
         │           │
         │     ┌─────┴─────┐
         │     ▼           ▼
         │  ┌────────┐ ┌──────────┐
         └─►│Review  │ │Interview │
            └────────┘ └────┬─────┘
                            │
                     ┌──────┴──────┐
                     ▼             ▼
              ┌───────────┐  ┌──────────────┐
              │Assessment │  │Canonical     │
              │Panel      │  │Answer Modal  │
              └───────────┘  └──────────────┘
```

### 3.2 Transições

| De | Para | Gatilho |
|---|---|---|
| Overview | Phase | `enter` na fase selecionada |
| Overview | Executive | `e` |
| Overview | Artifacts | `a` |
| Overview | Settings | `s` |
| Phase | Document | `enter` no documento selecionado |
| Phase | Interview | `i` (inicia entrevista da fase) |
| Phase | Overview | `esc` |
| Document | Interview | `i` (inicia entrevista do documento) |
| Document | Review | `r` |
| Document | Phase | `esc` |
| Interview | Assessment | automático após resposta |
| Interview | Canonical Answer | automático após síntese |
| Interview | Phase | `esc` (pausa e volta) |
| Qualquer | Command Palette | `ctrl+p` / `cmd+p` |

---

## 4. Inventário de Telas

### 4.1 `OverviewScreen`

```
Propósito:       Visão geral do projeto — status de fases, eixo executivo, artefatos.
Dados:           ProjectStatus, ArtifactSummary[]
Estados vazios:  Projeto recém-inicializado (todas as fases "not started").
Estados loading: "Loading project..." com spinner.
Estados erro:    "Failed to load project: <mensagem>" + opção de retry.
```

**Conteúdo:**

```txt
╭─ LOGOS Engine ───────────────────────────────────────────────╮
│ Project: nomos                         Branch: main           │
│ Root: ~/dev/nomos                      Mode: local            │
├───────────────────────────────────────────────────────────────┤
│ Overview                                                      │
│                                                               │
│  Normative Axis                                               │
│  ┌───────────────────────┬──────────┬────────────┬─────────┐ │
│  │ Phase                 │ Docs     │ Diagnostics│ Action  │ │
│  ├───────────────────────┼──────────┼────────────┼─────────┤ │
│  │ 01 Foundation         │ 7 / 7    │ ✓ clean    │ review  │ │
│  │ 02 Validation         │ 8 / 10   │ ⚠ 2 gaps   │ generate│ │
│  │ 03 Product            │ 5 / 13   │ ⚠ 8 missing │ intervw │ │
│  │ 04 Engineering        │ 0 / 14   │ · not start │ —       │ │
│  │ 05 Go-to-market       │ 0 / 13   │ · not start │ —       │ │
│  │ 06 Operations         │ 0 / 14   │ · not start │ —       │ │
│  └───────────────────────┴──────────┴────────────┴─────────┘ │
│                                                               │
│  Executive Axis                                               │
│  ┌───────────────────────┬─────────────────────────────────┐  │
│  │ executive-plan.json   │ ⊘ not compiled                  │  │
│  │ agent packs           │ ⊘ none                          │  │
│  │ html overview         │ ⊘ stale / missing               │  │
│  └───────────────────────┴─────────────────────────────────┘  │
├───────────────────────────────────────────────────────────────┤
│ Next: Generate missing Validation docs before compiling.      │
├───────────────────────────────────────────────────────────────┤
│ [g] generate  [r] review  [v] validate  [e] executive  [?] help│
╰───────────────────────────────────────────────────────────────╯
```

**Atalhos:**

| Tecla | Ação |
|---|---|
| `↑` `↓` | Navegar fases |
| `enter` | Abrir PhaseScreen da fase selecionada |
| `e` | Abrir ExecutiveScreen |
| `a` | Abrir ArtifactScreen |
| `v` | Executar `logos validate` |
| `g` | Menu de geração (fase ou documento) |
| `?` | Ajuda / atalhos |
| `s` | SettingsScreen |
| `q` | Sair |

**Estados visuais:**

| Símbolo | Significado |
|---|---|
| `✓` | Completo e válido |
| `⚠` | Tem diagnósticos |
| `·` | Não iniciado |
| `⊘` | Não compilado / não gerado |
| `→` | Em progresso (entrevista ativa) |

---

### 4.2 `PhaseScreen`

```
Propósito:       Visão detalhada de uma fase — documentos, diagnósticos, progresso.
Dados:           PhaseStatus, DocumentDescriptor[], Diagnostic[]
Estados vazios:  Fase sem documentos.
Estados erro:    "Failed to load phase: <mensagem>".
```

**Conteúdo:**

```txt
╭─ LOGOS Engine ─ Project: nomos ─ Phase: 03 Product ───────────╮
│ Purpose: define what will be built and how it is experienced. │
├───────────────────────┬───────────────────────────────────────┤
│ Documents             │ Phase Diagnostics                     │
│                       │                                       │
│ ✓ 01-product-brief    │ Completeness: 5 / 13                  │
│ ✓ 02-scope            │ ⚠ Blocking gaps: 3                    │
│ ✓ 03-user-journeys    │                                       │
│ → 04-ux-model         │ Missing required documents:           │
│ · 05-info-architecture│ · 05-information-architecture.md      │
│ · 06-interaction-model│ · 06-interaction-model.md             │
│ · 07-ui-specification │ · 07-ui-specification.md              │
│ · 08-design-system    │                                       │
│ · 09-product-arch     │ Recommended:                          │
│ · 10-functional-reqs  │ Generate IA + interaction model       │
│ · 11-non-functional   │ next. Then interview for UX spec.     │
│ · 12-product-stack    │                                       │
│ · 13-acceptance       │                                       │
├───────────────────────┴───────────────────────────────────────┤
│ [enter] open doc  [i] interview  [g] generate  [esc] back      │
╰───────────────────────────────────────────────────────────────╯
```

**Atalhos:**

| Tecla | Ação |
|---|---|
| `↑` `↓` | Navegar documentos |
| `enter` | Abrir DocumentScreen |
| `i` | Iniciar/retomar entrevista da fase |
| `g` | Gerar documentos pendentes da fase |
| `v` | Validar fase |
| `esc` | Voltar para Overview |

**Estados de documento:**

| Símbolo | Significado |
|---|---|
| `✓` | Canônico, validado |
| `→` | Entrevista em progresso |
| `·` | Não iniciado |
| `!` | Tem drafts pendentes de revisão |

---

### 4.3 `DocumentScreen`

```
Propósito:       Leitura e revisão de um documento canônico.
Dados:           Conteúdo Markdown, DocumentDescriptor, Diagnostic[]
Estados vazios:  Documento não gerado ainda.
Estados erro:    "Failed to load document: <mensagem>".
```

**Conteúdo (modo leitura):**

```txt
╭─ Document: docs/03-product/04-ux-model.md ────────────────────╮
│ Status: canonical     Schema: valid        Version: 3          │
│ Sources: 4 answers    Last interview: 2026-05-24 14:30        │
├───────────────────────────────────────────────────────────────┤
│ ## UX Thesis                                                   │
│                                                                │
│ The product must make the distinction between human input,     │
│ agent suggestion, and canonical state immediately visible.     │
│ Users should never wonder "did I write this or did the AI?".   │
│                                                                │
│ ## Experience Principles                                       │
│ ...                                                            │
├───────────────────────────────────────────────────────────────┤
│ Diagnostics: none                                              │
│ Trace: section "UX Thesis" ← ans_004, ans_007 (msg_012–015)   │
├───────────────────────────────────────────────────────────────┤
│ [r] review  [i] interview  [t] trace  [p] preview html  [esc] back│
╰───────────────────────────────────────────────────────────────╯
```

**Atalhos:**

| Tecla | Ação |
|---|---|
| `↑` `↓` | Scroll |
| `r` | Modo Review (abre ReviewScreen) |
| `i` | Iniciar/retomar entrevista deste documento |
| `t` | Mostrar traceabilidade (fontes por seção) |
| `p` | Preview HTML |
| `d` | Ver diffs de versões anteriores |
| `esc` | Voltar para PhaseScreen |

---

### 4.4 `InterviewScreen`

```
Propósito:       Console de entrevista estruturada — pergunta, resposta, avaliação.
Dados:           InterviewRunState, InterviewQuestion, TranscriptMessage[]
Estados vazios:  Entrevista nova (primeira pergunta).
Estados loading: "Assessing your answer..." com indicador de progresso.
Estados erro:    "Assessment failed: <mensagem>. Retry or skip?"
```

**Conteúdo (pergunta ativa):**

```txt
╭─ LOGOS Interview ─────────────────────────────────────────────╮
│ Phase: 01 Foundation       Document: 01 Thesis                │
│ Question: 2 / 5            Status: awaiting answer            │
│ Mode: interview            Follow-ups used: 0 / 2             │
├───────────────────────────────────────────────────────────────┤
│ Pergunta                                                      │
│                                                                │
│ Que tensão principal este projeto tenta resolver?              │
│                                                                │
│ Orientação                                                    │
│ Descreva o conflito real que faz este projeto ser necessário.  │
│ Quem sofre com esse problema hoje? O que as alternativas       │
│ atuais não resolvem?                                          │
├───────────────────────────────────────────────────────────────┤
│ Sua resposta                                                  │
│                                                                │
│ > _                                                            │
│                                                                │
├───────────────────────────────────────────────────────────────┤
│ [enter] send  [ctrl+d] multiline  [skip] skip  [pause] pause   │
│ [back] previous question  [t] show transcript  [esc] exit      │
╰───────────────────────────────────────────────────────────────╯
```

**Conteúdo (avaliando):**

```txt
╭─ LOGOS Interview ─────────────────────────────────────────────╮
│ Phase: 01 Foundation       Document: 01 Thesis                │
│ Question: 2 / 5            Status: assessing                  │
├───────────────────────────────────────────────────────────────┤
│ Sua resposta (msg_012)                                        │
│                                                                │
│ "As pessoas têm ideias mas não conseguem estruturá-las         │
│  sozinhas. É como ter todas as peças de um quebra-cabeça       │
│  mas não saber por onde começar."                              │
│                                                                │
├───────────────────────────────────────────────────────────────┤
│ ⏳ Avaliando resposta...                                       │
│                                                                │
│ Sinais esperados:                                              │
│   ✓ project_purpose                                           │
│   ○ target_outcome          ← aguardando                      │
│   ○ core_tension            ← aguardando                      │
├───────────────────────────────────────────────────────────────┤
│ [esc] cancel                                             0:02  │
╰───────────────────────────────────────────────────────────────╯
```

**Conteúdo (follow-up):**

```txt
╭─ LOGOS Interview ─────────────────────────────────────────────╮
│ Phase: 01 Foundation       Document: 01 Thesis                │
│ Question: 2 / 5            Status: needs complement           │
│ Follow-ups used: 1 / 2                                       │
├───────────────────────────────────────────────────────────────┤
│ Avaliação                                                     │
│ Status: needs complement    Confidence: medium                │
│                                                                │
│ Sinais capturados: project_purpose                            │
│ Sinais ausentes:   target_outcome                             │
│                                                                │
│ Complemento necessário                                        │
│                                                                │
│ Qual resultado concreto este sistema deve produzir para as     │
│ pessoas que o usarem?                                         │
│                                                                │
├───────────────────────────────────────────────────────────────┤
│ Sua resposta                                                  │
│                                                                │
│ > _                                                            │
├───────────────────────────────────────────────────────────────┤
│ [enter] send  [skip] skip this signal  [esc] back              │
╰───────────────────────────────────────────────────────────────╯
```

**Atalhos:**

| Tecla | Ação |
|---|---|
| `enter` | Enviar resposta |
| `ctrl+d` | Alternar modo multiline |
| `ctrl+enter` | Enviar (multiline) |
| `s` | Pular pergunta (skip) |
| `p` | Pausar entrevista |
| `b` | Voltar para pergunta anterior |
| `t` | Mostrar transcrição atual |
| `h` | Mostrar histórico de respostas canônicas |
| `esc` | Sair da entrevista (salva estado) |

---

### 4.5 `AnswerAssessmentPanel`

```
Propósito:       Exibir resultado da avaliação semântica e opções de ação.
Dados:           AnswerAssessment
Quando:          Automático após resposta do usuário, antes da transição.
```

**Conteúdo (suficiente):**

```txt
╭─ Answer Assessment ───────────────────────────────────────────╮
│ Question: 2 / 5    Status: sufficient    Confidence: high      │
├───────────────────────────────────────────────────────────────┤
│ Avaliação                                                     │
│                                                                │
│ A resposta cobre todos os sinais necessários:                  │
│   ✓ project_purpose                                           │
│   ✓ target_outcome                                            │
│   ✓ core_tension                                              │
│                                                                │
│ Fatos extraídos:                                              │
│  • Pessoas têm ideias mas não conseguem estruturá-las          │
│  • Alternativas atuais focam em produtividade, não em clareza  │
│                                                                │
│ Perguntas em aberto:                                          │
│  • Como o sistema vai gerar a estrutura automaticamente?       │
│                                                                │
│ Próximo passo: sintetizar resposta canônica                   │
├───────────────────────────────────────────────────────────────┤
│ [enter] synthesize  [e] edit assessment  [r] answer again      │
╰───────────────────────────────────────────────────────────────╯
```

**Conteúdo (insuficiente):**

```txt
╭─ Answer Assessment ───────────────────────────────────────────╮
│ Question: 2 / 5    Status: insufficient                       │
├───────────────────────────────────────────────────────────────┤
│ Avaliação                                                     │
│                                                                │
│ ⚠ A resposta não atende à pergunta.                           │
│                                                                │
│ Motivo: A resposta descreve features do produto, mas a         │
│ pergunta pede a tensão central que o projeto resolve.          │
│                                                                │
│ Pergunta reformulada:                                         │
│                                                                │
│ Pense na situação antes deste projeto existir. O que dói?      │
│ Quem sente essa dor? Por que as ferramentas atuais não         │
│ resolvem?                                                     │
│                                                                │
├───────────────────────────────────────────────────────────────┤
│ [enter] answer reformulated  [s] skip  [b] go back             │
╰───────────────────────────────────────────────────────────────╯
```

**Atalhos:**

| Tecla | Ação |
|---|---|
| `enter` | Aceitar avaliação e prosseguir |
| `e` | Solicitar reavaliação |
| `r` | Responder novamente |
| `s` | Pular pergunta |
| `b` | Voltar para pergunta anterior |

---

### 4.6 `CanonicalAnswerModal`

```
Propósito:       Exibir rascunho de resposta canônica para confirmação.
Dados:           CanonicalAnswerDraft
Quando:          Após synthesizeCanonicalAnswer, antes de RECORDING_CANONICAL_ANSWER.
```

**Conteúdo:**

```txt
╭─ Canonical Answer ────────────────────────────────────────────╮
│ Question: 2 / 5           Confidence: medium                   │
│ Agent refinement: applied                                     │
├───────────────────────────────────────────────────────────────┤
│ Resposta canônica proposta                                    │
│                                                                │
│ O projeto resolve a tensão entre ter ideias claras na mente    │
│ e não conseguir transformá-las em documentação estruturada     │
│ e acionável. As pessoas sabem o que querem construir, mas      │
│ ficam paralisadas pela falta de um processo que externalize,   │
│ organize e converta ideias difusas em decisões e próximos      │
│ passos confiáveis.                                            │
│                                                                │
│ ───────────────────────────────────────────────────────────── │
│ Sources: msg_012, msg_014                            [user]   │
│ Agent refinement: conectores e estrutura de frase    [agent]  │
│ Hypothesis: "paralisadas pela falta de processo"     [infer]  │
│ Missing signals: none                                         │
│ Open questions: "Como o sistema gera estrutura automaticamente?"│
├───────────────────────────────────────────────────────────────┤
│ Legenda: [user]=usuário  [agent]=refinamento  [infer]=inferência│
├───────────────────────────────────────────────────────────────┤
│ [a] accept  [e] edit  [r] regenerate  [t] show transcript       │
╰───────────────────────────────────────────────────────────────╯
```

**Atalhos:**

| Tecla | Ação |
|---|---|
| `a` | Aceitar resposta canônica → RECORDING_CANONICAL_ANSWER |
| `e` | Editar resposta manualmente |
| `r` | Regenerar (chamar synthesizeCanonicalAnswer novamente) |
| `t` | Mostrar transcrição das mensagens de origem |
| `esc` | Voltar sem salvar (mantém estado anterior) |

**Diferenciação visual de origem:**

| Marcação | Significado |
|---|---|
| `[user]` | Conteúdo do usuário (verbatim ou parafraseado fielmente) |
| `[agent]` | Refinamento do agente (conectores, estrutura) |
| `[infer]` | Inferência do agente (suposição, hipótese) |
| `⚠` | Campo que requer atenção (missing signal, low confidence) |

---

### 4.7 `ReviewScreen`

```
Propósito:       Revisão de documento com diff de patches propostos.
Dados:           DocumentPatchResult, conteúdo Markdown atual
Quando:          Modo review de documento (gerado ou canônico).
```

**Conteúdo:**

```txt
╭─ Review: docs/03-product/04-ux-model.md ──────────────────────╮
│ Status: draft        Schema: valid        Completeness: 82%    │
├───────────────────────┬───────────────────────────────────────┤
│ Outline               │ Current Section                       │
│                       │                                       │
│ ✓ UX Thesis           │ ## Trust Model                        │
│ ✓ Experience Principles│                                      │
│ ✓ Primary UX Paradigm │ The product should disclose when the  │
│ ✓ User Mental Model   │ agent is reasoning, proposing, or     │
│ ! Trust Model   ← here│ executing. It must not blur suggestion│
│ · UX Anti-Patterns    │ and committed state.                  │
│                       │                                       │
│ Agent suggestions:    │                                       │
│ • Add state distinction│                                      │
│ • Add anti-patterns   │                                       │
├───────────────────────┴───────────────────────────────────────┤
│ Patch 1 / 2 — Type: addition — Confidence: high               │
│                                                                │
│ ## Trust Model                                                 │
│   The product should disclose when the agent is reasoning...   │
│ +                                                              │
│ + ### State Distinction                                        │
│ + The UI must visually differentiate:                          │
│ + - `draft` — proposed, not yet accepted                       │
│ + - `canonical` — accepted and saved                           │
│ + - `inference` — agent-generated, unverified                  │
│                                                                │
│ Rationale: Complements Trust Model with concrete UI categories.│
├───────────────────────────────────────────────────────────────┤
│ [tab] next patch  [a] accept  [x] reject  [e] edit  [v] validate│
│ [A] accept all    [X] reject all         [esc] exit review     │
╰───────────────────────────────────────────────────────────────╯
```

**Atalhos:**

| Tecla | Ação |
|---|---|
| `tab` | Próximo patch |
| `shift+tab` | Patch anterior |
| `a` | Aceitar patch atual |
| `x` | Rejeitar patch atual |
| `A` | Aceitar todos os patches |
| `X` | Rejeitar todos os patches |
| `e` | Editar patch antes de aplicar |
| `v` | Validar documento após aplicar patches aceitos |
| `esc` | Sair do review (patches não aplicados são descartados) |

---

### 4.8 `ExecutiveScreen`

```
Propósito:       Visualização e compilação do eixo executivo.
Dados:           ExecutivePlan (se compilado), ExportSummary[]
Estados vazios:  Nunca compilado ("No executive plan. Compile first.").
Estados erro:    "Compilation failed: <diagnostics>".
```

**Conteúdo:**

```txt
╭─ Executive Compiler ───────────────────────────────────────────╮
│ Source: Normative Axis              Output: executive JSON     │
│ Last compiled: 2026-05-25 15:00     Status: fresh              │
├───────────────────────┬───────────────────────────────────────┤
│ Roadmap               │ Execution Graph                       │
│                       │                                       │
│ → MVP-001             │ Roadmap: MVP-001                      │
│   Normative core      │  └─ Milestone: Foundation Ready       │
│                       │      └─ Initiative: Schema System     │
│ Milestones            │          ├─ TASK-001 Create Zod schemas│
│ ✓ M-001 Foundation    │          ├─ TASK-002 Validate docs    │
│ · M-002 Product       │          ├─ REVIEW-001 Review gaps    │
│ · M-003 Engineering   │          └─ AGENT-001 Generate prompt │
│                       │                                       │
│ Exports               │ Traceability                          │
│ · GitHub Issues       │ TASK-001 ← docs.yml, phases/*.yml     │
│ · Agent Packs         │ AGENT-001 ← engineering docs          │
│ · HTML Overview       │                                       │
│ · Markdown Plan       │                                       │
├───────────────────────┴───────────────────────────────────────┤
│ [c] compile  [x] export  [h] render html  [p] agent packs      │
│ [↑↓] navigate items  [enter] item detail  [esc] back           │
╰───────────────────────────────────────────────────────────────╯
```

**Atalhos:**

| Tecla | Ação |
|---|---|
| `c` | Compilar/recompilar Executive Plan |
| `x` | Menu de exportação |
| `h` | Renderizar HTML |
| `p` | Gerar Agent Packs |
| `↑` `↓` | Navegar execution items |
| `enter` | Ver detalhes do item (fontes, dependências) |
| `esc` | Voltar para Overview |

---

### 4.9 `ArtifactScreen`

```
Propósito:       Listar e gerenciar artefatos derivados.
Dados:           ArtifactSummary[]
Estados vazios:  "No artifacts generated yet."
```

**Conteúdo:**

```txt
╭─ Artifacts ───────────────────────────────────────────────────╮
│ Generated outputs                                             │
├───────────────────────────────┬──────────────┬───────────────┤
│ Path                          │ Type         │ Status        │
├───────────────────────────────┼──────────────┼───────────────┤
│ outcomes/html/project.html    │ HTML         │ ✓ fresh       │
│ executive/executive-plan.json │ JSON         │ ✓ fresh       │
│ executive/exports/agent-packs │ Agent Pack   │ ⚠ stale       │
│ executive/exports/github      │ GitHub Issue │ ⊘ not gen     │
├───────────────────────────────┴──────────────┴───────────────┤
│ Selected: outcomes/html/project.html                          │
│ Source: docs.yml + docs/**/*.md                                │
│ Generated: 2026-05-25 15:02                                   │
│                                                               │
│ Actions: [o] open  [r] regenerate  [i] inspect source         │
├───────────────────────────────────────────────────────────────┤
│ [↑↓] navigate  [esc] back                                     │
╰───────────────────────────────────────────────────────────────╯
```

**Atalhos:**

| Tecla | Ação |
|---|---|
| `↑` `↓` | Navegar artefatos |
| `o` | Abrir artefato (sistema operacional) |
| `r` | Regenerar artefato selecionado |
| `i` | Inspecionar fontes do artefato |
| `c` | Copiar caminho para clipboard |
| `esc` | Voltar |

---

### 4.10 `SettingsScreen`

```
Propósito:       Configurações locais do LOGOS.
Dados:           config.local.json
```

**Conteúdo:**

```txt
╭─ Settings ────────────────────────────────────────────────────╮
│ Project: nomos                                                │
├───────────────────────────────────────────────────────────────┤
│ LLM                                                           │
│   Provider:  https://api.openai.com/v1                        │
│   Model:     gpt-4.1-mini                                     │
│   API Key:   sk-...j8fk                              [change] │
│                                                               │
│ Behavior                                                      │
│   Strict generation:  ✓ on                                   │
│   Auto-approve high confidence:  ✗ off                       │
│   Max follow-ups:      2                                      │
│                                                               │
│ Interview                                                     │
│   Require approval for:                                       │
│     ✓ scope changes                                           │
│     ✓ conflict resolution                                     │
│     ✗ generation                                              │
│                                                               │
│ Editor                                                        │
│   External editor:  code --wait                    [change]   │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│ [↑↓] navigate  [enter] edit  [esc] back                       │
╰───────────────────────────────────────────────────────────────╯
```

---

### 4.11 `CommandPalette`

```
Propósito:       Acesso rápido a qualquer comando.
Atalho:          ctrl+p / cmd+p
```

**Conteúdo:**

```txt
╭─ Command Palette ─────────────────────────────────────────────╮
│                                                                │
│ > gen                                                          │
│                                                                │
│   generate — Generate documents for current phase              │
│   generate 01-thesis — Generate specific document              │
│   interview 03-product — Start/Resume product interview        │
│   validate — Validate project schemas and docs                 │
│                                                                │
├───────────────────────────────────────────────────────────────┤
│ [↑↓] navigate  [enter] execute  [esc] close                    │
╰───────────────────────────────────────────────────────────────╯
```

Comandos disponíveis:

```txt
init                  Initialize new LOGOS project
status                Show project status
validate              Validate all schemas and documents
interview [phase]     Start/resume interview
generate [doc]        Generate documents
review [doc]          Review document with agent
compile executive     Compile Executive Plan
render html           Render HTML outcomes
export github         Export GitHub Issues
export agent-packs    Export Agent Packs
open [path]           Open file in external editor
help                  Show help
```

---

## 5. Modelo de Teclado

### 5.1 Atalhos globais

| Atalho | Ação |
|---|---|
| `ctrl+p` / `cmd+p` | Command Palette |
| `ctrl+c` | Sair (com confirmação se houver estado não salvo) |
| `esc` | Voltar / Fechar modal |
| `?` | Ajuda de atalhos da tela atual |
| `tab` | Alternar painel / próximo foco |

### 5.2 Atalhos da entrevista

| Atalho | Ação |
|---|---|
| `enter` | Enviar resposta |
| `ctrl+d` | Alternar modo multiline |
| `ctrl+enter` | Enviar (multiline) |
| `s` | Pular pergunta atual |
| `p` | Pausar entrevista |
| `b` | Voltar para pergunta anterior |
| `t` | Mostrar transcrição |
| `h` | Mostrar histórico de respostas |

### 5.3 Atalhos de revisão (ReviewScreen)

| Atalho | Ação |
|---|---|
| `a` | Aceitar patch atual |
| `x` | Rejeitar patch atual |
| `A` | Aceitar todos |
| `X` | Rejeitar todos |
| `tab` | Próximo patch |
| `shift+tab` | Patch anterior |
| `e` | Editar patch manualmente |

### 5.4 Atalhos de canonical answer

| Atalho | Ação |
|---|---|
| `a` | Aceitar resposta canônica |
| `e` | Editar manualmente |
| `r` | Regenerar (re-chamar LLM) |
| `t` | Mostrar transcrição das fontes |

### 5.5 Atalhos de navegação geral

| Atalho | Ação |
|---|---|
| `↑` `↓` | Navegar itens da lista |
| `enter` | Selecionar / Abrir |
| `esc` | Voltar |
| `g` | Menu de geração (Overview) |
| `v` | Validar (Overview/Phase) |
| `i` | Iniciar entrevista (Phase/Document) |
| `e` | Executive screen (Overview) |
| `a` | Artifacts screen (Overview) |

---

## 6. Fluxo UX da Entrevista

### 6.1 Diagrama de sequência

```txt
Usuário abre InterviewScreen
  │
  ├─ Entrevista NOVA
  │   ├─ Tela: "Vou fazer uma pergunta por vez."
  │   ├─ Tela: Pergunta 1/N + orientação
  │   └─ Campo de resposta ativo
  │
  ├─ Entrevista RETOMADA
  │   ├─ Tela: "Retomando entrevista. Pergunta 3/5 pendente."
  │   └─ Campo de resposta ativo
  │
  ▼
Usuário digita resposta → [enter]
  │
  ├─ Tela: "⏳ Avaliando resposta..." com sinais esperados
  │
  ▼
Painel: AnswerAssessment
  │
  ├─ sufficient ─────────────→ CanonicalAnswerModal
  │                               ├─ [a] accept → "✓ Resposta salva" → próxima pergunta
  │                               └─ [e] edit → editor manual → accept
  │
  ├─ needs_complement ───────→ InterviewScreen (follow-up)
  │                               └─ Campo de resposta + pergunta de complemento
  │
  ├─ insufficient ───────────→ InterviewScreen (reformulada)
  │                               └─ Pergunta reformulada + explicação
  │
  ├─ conflict ───────────────→ ConflictResolution
  │                               └─ Opções de resolução → nova resposta
  │
  └─ user_intent_override ───→ Ação correspondente
                                  ├─ skip → próxima pergunta
                                  ├─ pause → salva e sai
                                  ├─ go_back → pergunta anterior
                                  └─ generate_now → OfferGeneration
```

### 6.2 Feedback de progresso

```txt
Durante a entrevista, o header sempre mostra:

  Question: 2 / 5            Status: awaiting answer
  Question: 2 / 5            Status: assessing
  Question: 2 / 5            Status: needs complement
  Question: 2 / 5            Status: synthesizing
  Question: 2 / 5            Status: awaiting confirmation
  Question: 3 / 5            Status: ✓ answered
```

---

## 7. UX de Resposta Canônica

### 7.1 Confirmação por confiança

| Confiança | Comportamento |
|---|---|
| `high` | Salva automaticamente (se auto-approve configurado) ou mostra modal rápido |
| `medium` | Mostra modal com destaque para partes refinadas pelo agente |
| `low` | Mostra modal com warning "Baixa confiança — recomenda-se revisão cuidadosa" |

### 7.2 Ações de escrita sinalizadas

```txt
╭─ ⚠ Confirm Save ─────────────────────────────────────────────╮
│                                                                │
│ Esta ação vai ESCREVER no arquivo:                             │
│   .logos/interviews/.../canonical-answers.json                 │
│                                                                │
│ Operação: append (novo registro)                               │
│ Backup:    automático                                          │
│                                                                │
│ [enter] confirm  [esc] cancel                                  │
╰────────────────────────────────────────────────────────────────╯
```

---

## 8. UX de Revisão de Documento

### 8.1 Antes/depois do patch

```
O diff mostra:
  - Linhas removidas em vermelho (ou prefixo "-")
  - Linhas adicionadas em verde (ou prefixo "+")
  - Contexto inalterado em cor normal
```

### 8.2 Pós-aceitação

```
Todos os patches aceitos → documento validado → atomic write

╭─ ✓ Document Saved ───────────────────────────────────────────╮
│ docs/03-product/04-ux-model.md updated.                       │
│ Version: 3 → 4                                                │
│ Schema: valid                                                 │
│ Backup: .bak criado                                           │
├───────────────────────────────────────────────────────────────┤
│ [enter] continue  [d] view diff  [v] validate                  │
╰───────────────────────────────────────────────────────────────╯
```

---

## 9. UX de Artefatos

### 9.1 Indicadores de status

| Ícone | Significado |
|---|---|
| `✓ fresh` | Regenerado após última mudança canônica |
| `⚠ stale` | Fontes canônicas mudaram desde a última geração |
| `⊘ not gen` | Nunca gerado |

### 9.2 Regeneração

```
Selecionar artefato stale → [r] regenerate → spinner "Regenerating..." →
  ✓ Artefato atualizado → status muda para fresh
```

---

## 10. UX de Erro e Recuperação

### 10.1 Erros de LLM

```txt
╭─ ⚠ LLM Error ────────────────────────────────────────────────╮
│                                                                │
│ Assessment failed: provider returned HTTP 500.                 │
│                                                                │
│ Retries: 3 / 3 exhausted                                      │
│                                                                │
│ Your answer has been saved in the transcript.                  │
│                                                                │
│ [r] retry  [s] skip question  [p] pause interview              │
╰────────────────────────────────────────────────────────────────╯
```

### 10.2 Erros de validação

```txt
╭─ ⚠ Validation Failed ────────────────────────────────────────╮
│                                                                │
│ The generated document has schema violations:                  │
│                                                                │
│ • Section "Problem" missing required heading                   │
│ • Section "Audience" has no sourceCanonicalAnswerIds           │
│ • Document completeness is 67% (minimum: 80%)                  │
│                                                                │
│ The document was NOT saved.                                    │
│ Draft preserved at: .logos/.../generated-drafts/01-thesis.draft-001.md │
│                                                                │
│ [r] retry generation  [e] edit manually  [i] fill gaps first   │
╰────────────────────────────────────────────────────────────────╯
```

### 10.3 Estado não salvo

```txt
╭─ ⚠ Unsaved Changes ──────────────────────────────────────────╮
│                                                                │
│ You have an unconfirmed canonical answer draft.                │
│                                                                │
│ [s] save and exit  [d] discard  [c] cancel (stay)              │
╰────────────────────────────────────────────────────────────────╯
```

---

## 11. Considerações de Acessibilidade

### 11.1 Terminal mínimo

```
Largura mínima: 80 colunas
Altura mínima:  24 linhas
Recomendado:    120 × 40
```

### 11.2 Navegação por teclado

```
100% das ações devem ser acessíveis por teclado.
Navegação por tab entre painéis.
Atalhos de uma tecla para ações frequentes.
Atalhos documentados no footer de cada tela.
```

### 11.3 Cor e contraste

```
Usar cores com moderação — a TUI deve ser legível em:
  - Terminal escuro (default)
  - Terminal claro
  - Terminal sem suporte a cores (fallback para símbolos)
```

---

## 12. Critérios de Aceitação

Uma implementação LOGOS satisfaz esta spec quando:

1. ✅ As 9 telas mais CommandPalette estão implementadas.
2. ✅ O CommandPalette (`ctrl+p`) permite acesso a todos os comandos.
3. ✅ A InterviewScreen mostra: pergunta atual, progresso (N/M), status, campo de resposta.
4. ✅ O AnswerAssessmentPanel mostra sinais capturados/ausentes e permite avançar, pular ou responder novamente.
5. ✅ O CanonicalAnswerModal diferencia visualmente `[user]`, `[agent]` e `[infer]`.
6. ✅ O ReviewScreen mostra diff por patch, com aceitar/rejeitar individual e em lote.
7. ✅ Lacunas e diagnósticos são visíveis na OverviewScreen e PhaseScreen — nunca escondidos.
8. ✅ Ações de escrita no filesystem mostram confirmação explícita com path e tipo de operação.
9. ✅ Estados de loading têm indicador visual (spinner com sinais).
10. ✅ Estados de erro oferecem opções de recuperação (retry, skip, edit manual).
11. ✅ Navegação 100% por teclado — atalhos documentados no footer de cada tela.
12. ✅ A TUI funciona em terminal de 80×24 (modo mínimo) e 120×40 (modo recomendado).
13. ✅ A TUI NUNCA chama LLM diretamente e NUNCA escreve no filesystem diretamente.

---

## 13. Resumo

```txt
LOGOS TUI UX:

PRINCÍPIOS
  Clareza sobre estado       — O usuário sempre sabe onde está e o que falta
  Transparência de origem    — Diferencia [user], [agent], [infer]
  Segurança visível          — Escritas são sinalizadas e confirmadas
  Lacunas não escondidas     — Diagnósticos visíveis, não em submenus

TELAS
  OverviewScreen             — Status do projeto, fases, eixo executivo
  PhaseScreen                — Documentos da fase, diagnósticos, progresso
  DocumentScreen             — Leitura do documento canônico
  InterviewScreen            — Console de entrevista (pergunta → resposta)
  AnswerAssessmentPanel      — Resultado da avaliação semântica
  CanonicalAnswerModal       — Confirmação de resposta canônica
  ReviewScreen               — Diff de patches com aceitar/rejeitar
  ExecutiveScreen            — Visualização e compilação do Executive Plan
  ArtifactScreen             — Lista de artefatos derivados
  SettingsScreen             — Configurações locais
  CommandPalette             — Acesso rápido a comandos (ctrl+p)

MODELO DE TECLADO
  100% navegável por teclado
  Atalhos de 1 tecla para ações frequentes
  Footer de atalhos em cada tela

FEEDBACK
  Estados de loading visíveis (spinner + progresso)
  Estados de erro com opções de recuperação
  Confirmação explícita para escritas no filesystem
  Diferenciação visual [user] [agent] [infer]
```