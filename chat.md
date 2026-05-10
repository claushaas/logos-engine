Falando agora exclusivamente sobre o primeiro tópico do eixo normativo, Fundação, qual seria o sweetspot de set de documentos? Nem demais, mas também sem faltar o fundamental. Que faça o user perceber que o conjunto faz sentido sem a impressão de que algo foi redundante.

---

## Sweet spot para **01-foundation** 🧱

Para o eixo normativo, **Fundação** não deve tentar documentar o produto inteiro. Ela deve responder:

> **“Por que isso existe, para quem, sob quais princípios, com quais limites e com qual definição de sucesso?”**

O sweet spot, na minha avaliação, é **6 documentos principais + 1 índice canônico**.

Menos que isso tende a misturar conceitos demais. Mais que isso começa a parecer arquitetura artificial.

---

# Estrutura recomendada

```txt
01-foundation/
├── README.md
├── 01-thesis.md
├── 02-problem.md
├── 03-audience.md
├── 04-principles.md
├── 05-boundaries.md
├── 06-success-definition.md
└── 07-glossary.md
```

---

# 1. `README.md` — Foundation Index

## Função

O README não é um documento conceitual profundo. Ele é o **mapa de entrada** da Fundação.

Ele responde:

* O que existe nesta pasta?
* Em que ordem ler?
* Qual documento responde qual pergunta?
* Como esta fundação se conecta aos próximos eixos?

## Por que precisa existir?

Sem ele, a Fundação vira uma coleção de documentos soltos.
Com ele, o usuário percebe imediatamente que há **sistema**, não acúmulo.

## Conteúdo ideal

```md
# Foundation

This section defines the normative base of the project.

It explains why the project exists, what problem it addresses, who it serves, what principles guide it, what boundaries constrain it, and how success is understood.

## Reading Order

1. Thesis
2. Problem
3. Audience
4. Principles
5. Boundaries
6. Success Definition
7. Glossary
```

---

# 2. `01-thesis.md` — Tese Fundadora

## Função

Este é o documento mais importante da Fundação.

Ele define a **proposição central** do projeto.

Não é pitch.
Não é manifesto longo.
Não é roadmap.

É a resposta estruturada para:

> **“Que verdade, hipótese ou convicção justifica este projeto existir?”**

## Perguntas que deve responder

* Qual é a tese central?
* Que mudança no mundo, no mercado ou no comportamento humano torna isso relevante?
* Que tensão o projeto tenta resolver?
* O que este projeto afirma que outros sistemas negligenciam?
* Qual é a promessa essencial, sem marketing?

## Exemplo de escopo

```md
# Thesis

## Core Thesis

## Context

## Central Tension

## Foundational Claim

## What This Project Makes Possible

## What This Project Is Not
```

## Risco se faltar

Sem tese, o projeto vira uma lista de features.

---

# 3. `02-problem.md` — Problema

## Função

Define o problema real antes de qualquer solução.

Esse documento impede que o sistema pule cedo demais para produto, UX ou engenharia.

Ele responde:

> **“Que dor, fricção, confusão ou limitação este projeto existe para enfrentar?”**

## Perguntas que deve responder

* Qual problema está sendo resolvido?
* Como esse problema aparece na vida real?
* Quem sofre esse problema?
* Quais soluções atuais são insuficientes?
* O que acontece se esse problema não for resolvido?
* Qual parte do problema está dentro do escopo inicial?

## Escopo ideal

```md
# Problem

## Problem Statement

## Symptoms

## Root Causes

## Existing Alternatives

## Why Current Solutions Are Insufficient

## Scope of the Problem

## Non-Problems
```

## Risco se faltar

Sem esse documento, a tese fica abstrata demais.

---

# 4. `03-audience.md` — Público / SER / Usuário

## Função

Define para quem o projeto existe.

Não precisa virar persona superficial.
O objetivo é esclarecer o **tipo de pessoa, contexto e necessidade** que o sistema serve.

Ele responde:

> **“Quem deve reconhecer este projeto como útil, necessário ou inevitável?”**

## Perguntas que deve responder

* Quem é o usuário primário?
* Em que situação ele está?
* O que ele já tentou?
* Que capacidades ele tem?
* Que limitações ele tem?
* O que ele valoriza?
* O que o projeto não deve presumir sobre ele?

## Escopo ideal

```md
# Audience

## Primary Audience

## Context of Use

## User Capabilities

## User Constraints

## User Motivations

## User Risks

## Excluded Audiences
```

## Risco se faltar

Sem público claro, princípios e produto ficam genéricos.

---

# 5. `04-principles.md` — Princípios

## Função

Define as regras normativas que orientam decisões futuras.

Esse documento não deve conter “valores bonitos”.
Cada princípio precisa ser **acionável**.

Um bom princípio deve ajudar a decidir entre duas alternativas reais.

## Perguntas que deve responder

* Quais decisões o projeto deve favorecer?
* O que deve ser priorizado quando houver conflito?
* Que comportamentos o sistema deve ter?
* Que padrões devem ser evitados?
* Que trade-offs são aceitos?

## Escopo ideal

```md
# Principles

## Principle 1: [Name]

### Meaning

### Decision Rule

### Acceptable Trade-offs

### Violations

---

## Principle 2: [Name]
```

## Exemplo de princípio forte

```md
## Clarity Before Automation

### Meaning

The system must clarify user intent before optimizing execution.

### Decision Rule

When choosing between faster automation and better user understanding, prefer user understanding.

### Acceptable Trade-offs

- Slower first interaction
- More explicit confirmation steps
- Less autonomous behavior

### Violations

- Acting before intent is stable
- Hiding assumptions
- Optimizing for speed at the cost of comprehension
```

## Risco se faltar

Sem princípios, decisões futuras dependem do humor do momento.

---

# 6. `05-boundaries.md` — Limites / Anti-escopo

## Função

Define o que o projeto **não é**, **não faz** e **não promete**.

Esse documento é essencial para evitar expansão conceitual infinita.

Ele responde:

> **“Quais tentações este projeto deve resistir?”**

## Perguntas que deve responder

* O que está explicitamente fora do escopo?
* Que tipos de solução parecem atraentes, mas violam a tese?
* Que promessas o projeto não deve fazer?
* Que comportamentos seriam antiéticos, frágeis ou desalinhados?
* Que responsabilidades permanecem com o usuário?

## Escopo ideal

```md
# Boundaries

## What This Project Is Not

## Out of Scope

## Anti-Patterns

## Ethical Boundaries

## Product Boundaries

## User Responsibility Boundaries

## Future Temptations to Resist
```

## Risco se faltar

Sem limites, a Fundação vira uma autorização para construir qualquer coisa.

---

# 7. `06-success-definition.md` — Definição de Sucesso

## Função

Define como saber se o projeto está cumprindo sua razão de existir.

Ainda não é métrica de produto detalhada.
Isso virá depois em validação/produto.

Aqui o foco é sucesso **fundacional**.

Ele responde:

> **“O que precisa ser verdadeiro para dizermos que este projeto funciona?”**

## Perguntas que deve responder

* Como o sucesso será reconhecido?
* Que mudança o usuário deve experimentar?
* Que resultado mínimo validaria a tese?
* Que sinais indicam desalinhamento?
* Que sucesso aparente seria falso sucesso?

## Escopo ideal

```md
# Success Definition

## Foundational Success

## User-Level Success

## System-Level Success

## Failure Signals

## False Success

## Minimum Validation Threshold
```

## Risco se faltar

Sem definição de sucesso, o projeto pode crescer sem saber se está certo.

---

# 8. `07-glossary.md` — Glossário Canônico

## Função

Define os termos fundamentais.

Não é um dicionário genérico.
É um **controle semântico**.

Ele responde:

> **“Quando usamos uma palavra importante, exatamente o que ela quer dizer neste projeto?”**

## Termos possíveis

* Foundation
* Thesis
* User
* Agent
* System
* Intent
* Clarity
* Execution
* Validation
* Constraint
* Roadmap
* Normative axis
* Temporal axis

## Escopo ideal

```md
# Glossary

## Term

### Definition

### Used In

### Not To Be Confused With
```

## Risco se faltar

Sem glossário, os mesmos termos começam a carregar significados diferentes em documentos diferentes.

---

# Por que esse conjunto é o sweet spot?

## Ele cobre o essencial sem redundância

| Documento                  | Pergunta central            | Papel                    |
| -------------------------- | --------------------------- | ------------------------ |
| `README.md`                | Como ler isso?              | Navegação                |
| `01-thesis.md`             | Por que existe?             | Núcleo conceitual        |
| `02-problem.md`            | Que problema resolve?       | Ancoragem na realidade   |
| `03-audience.md`           | Para quem existe?           | Direção humana           |
| `04-principles.md`         | Como decide?                | Regra normativa          |
| `05-boundaries.md`         | O que não faz?              | Proteção contra expansão |
| `06-success-definition.md` | Como saber se funciona?     | Critério de validade     |
| `07-glossary.md`           | O que os termos significam? | Estabilidade semântica   |

---

# O que eu **não** colocaria em Fundação

Eu evitaria estes documentos nesta fase:

```txt
vision.md
mission.md
values.md
manifesto.md
strategy.md
market.md
brand.md
architecture.md
roadmap.md
features.md
requirements.md
business-model.md
```

Não porque sejam inúteis, mas porque pertencem melhor a outros eixos.

## Mapeamento melhor

| Documento tentador  | Melhor lugar                        |
| ------------------- | ----------------------------------- |
| `vision.md`         | Pode ser absorvido pela tese        |
| `mission.md`        | Geralmente vira redundância da tese |
| `values.md`         | Melhor como princípios acionáveis   |
| `manifesto.md`      | Go-to-market ou comunicação         |
| `strategy.md`       | Validation / Go-to-market           |
| `market.md`         | Validation                          |
| `architecture.md`   | Engineering                         |
| `roadmap.md`        | Eixo temporal                       |
| `features.md`       | Product                             |
| `requirements.md`   | Product / Engineering               |
| `business-model.md` | Go-to-market / Operations           |

---

# Minha recomendação final

O set ideal para **Fundação** é:

```txt
01-foundation/
├── README.md
├── 01-thesis.md
├── 02-problem.md
├── 03-audience.md
├── 04-principles.md
├── 05-boundaries.md
├── 06-success-definition.md
└── 07-glossary.md
```

## Regra prática

Cada documento deve passar neste teste:

> **“Este documento esclarece uma dimensão fundacional que nenhum outro documento esclarece melhor?”**

Se a resposta for não, ele não entra.

## Observação crítica

O ponto mais importante: **não criar documentos por simetria estética**.

A Fundação precisa parecer inevitável, não sofisticada.
Esse set é forte porque cada arquivo tem uma função distinta, auditável e difícil de eliminar sem perda real.

e para o segundo tópico, Validation, qual o set ideal de documentos?

## Sweet spot para **02-validation** 🧪

Para **Validation**, o objetivo não é ainda detalhar produto, engenharia ou go-to-market. O objetivo é responder:

> **“Como saberemos, com evidências, que a tese fundacional merece virar produto?”**

O set ideal aqui é **7 documentos + 1 README**.

Menos que isso mistura hipótese, pesquisa, experimento e decisão.
Mais que isso começa a virar burocracia de startup.

---

# Estrutura recomendada

```txt
02-validation/
├── README.md
├── 01-validation-strategy.md
├── 02-core-assumptions.md
├── 03-hypotheses.md
├── 04-research-plan.md
├── 05-experiments.md
├── 06-evidence-log.md
├── 07-decision-record.md
└── 08-validation-report.md
```

---

# 1. `README.md` — Validation Index

## Função

Explica como a validação funciona dentro do projeto.

Ele responde:

> **“O que esta pasta valida, em que ordem, e como as evidências viram decisão?”**

## Conteúdo ideal

```md
# Validation

This section defines how the project thesis, problem, audience, and solution direction are tested before deeper product and engineering commitments are made.

## Reading Order

1. Validation Strategy
2. Core Assumptions
3. Hypotheses
4. Research Plan
5. Experiments
6. Evidence Log
7. Decision Record
8. Validation Report
```

---

# 2. `01-validation-strategy.md` — Estratégia de Validação

## Função

Define a abordagem geral de validação.

Não é lista de experimentos ainda.
É o documento que determina **o que precisa ser provado primeiro**.

## Perguntas centrais

* O que precisa ser validado?
* O que não precisa ser validado agora?
* Qual nível de evidência é suficiente?
* Qual risco vem primeiro: problema, público, solução, disposição de uso, disposição de pagar?
* O que impediria o projeto de avançar?

## Estrutura ideal

```md
# Validation Strategy

## Validation Objective

## Validation Scope

## Validation Priorities

## Evidence Standards

## Validation Sequence

## Invalidating Conditions

## Decision Gates
```

## Por que existe?

Sem esse documento, a validação vira uma coleção de testes aleatórios.

---

# 3. `02-core-assumptions.md` — Assunções Centrais

## Função

Explicita o que o projeto está assumindo como verdadeiro.

Aqui entram os “pilares frágeis” da tese.

## Perguntas centrais

* O que precisa ser verdadeiro para o projeto fazer sentido?
* Quais assunções são mais perigosas?
* Quais assunções são conhecidas, desconhecidas ou apenas intuídas?
* Quais assunções, se falsas, matam o projeto?
* Quais apenas alteram o posicionamento?

## Estrutura ideal

```md
# Core Assumptions

## Assumption Map

## Critical Assumptions

## Secondary Assumptions

## Unknowns

## Dependency Between Assumptions

## Assumptions That Can Kill the Project

## Assumptions That Only Change Direction
```

## Exemplo

```md
## Critical Assumption

Users experience the target problem frequently enough that they are willing to change behavior to solve it.

### Risk Level

High

### Why It Matters

If the problem is only intellectually interesting but not behaviorally painful, the project may receive praise without usage.
```

---

# 4. `03-hypotheses.md` — Hipóteses

## Função

Converte assunções em proposições testáveis.

Esse documento é o filtro entre “acho que” e “vamos testar”.

## Perguntas centrais

* Que hipótese específica será testada?
* Qual comportamento esperado confirmaria a hipótese?
* Qual evidência refutaria a hipótese?
* Qual métrica ou sinal será observado?
* Qual é a prioridade dessa hipótese?

## Estrutura ideal

```md
# Hypotheses

## Hypothesis Register

## Problem Hypotheses

## Audience Hypotheses

## Behavior Hypotheses

## Solution Hypotheses

## Willingness-to-Pay Hypotheses

## Adoption Hypotheses

## Retention Hypotheses
```

## Formato recomendado

```md
## H-001: [Hypothesis Name]

### Type

Problem / Audience / Behavior / Solution / Pricing / Retention

### Statement

We believe that...

### Evidence Required

### Refutation Signal

### Priority

Critical / High / Medium / Low

### Status

Untested / Testing / Supported / Refuted / Inconclusive
```

---

# 5. `04-research-plan.md` — Plano de Pesquisa

## Função

Define como obter evidência qualitativa e contextual.

Pesquisa não é experimento quantitativo ainda.
É escuta estruturada.

## Perguntas centrais

* Quem será entrevistado ou observado?
* Que perguntas serão feitas?
* Que vieses precisam ser evitados?
* Que sinais devem ser capturados?
* Como os dados serão registrados?
* Como evitar confirmar apenas a tese que já queremos acreditar?

## Estrutura ideal

```md
# Research Plan

## Research Goals

## Participant Profile

## Recruitment Criteria

## Interview Guide

## Observation Criteria

## Bias Risks

## Data Capture Format

## Synthesis Method
```

## Por que existe?

Sem plano de pesquisa, entrevistas viram conversa agradável.
Conversa agradável raramente invalida ideia ruim.

---

# 6. `05-experiments.md` — Experimentos

## Função

Define testes concretos de comportamento.

Aqui entram landing pages, concierge MVP, protótipos, fake door tests, waitlists, simulações manuais, teste de preço, etc.

## Perguntas centrais

* Que experimento será executado?
* Que hipótese ele testa?
* Qual público será exposto?
* Qual comportamento será observado?
* Qual resultado permite avançar?
* Qual resultado força revisão?
* Qual custo máximo aceitável?

## Estrutura ideal

```md
# Experiments

## Experiment Register

## Active Experiments

## Planned Experiments

## Completed Experiments

## Experiment Templates

## Experiment Results Summary
```

## Formato recomendado

```md
## EXP-001: [Experiment Name]

### Related Hypothesis

H-001

### Objective

### Method

### Target Audience

### Success Criteria

### Failure Criteria

### Required Assets

### Duration

### Result

### Decision
```

---

# 7. `06-evidence-log.md` — Registro de Evidências

## Função

Centraliza evidências observadas.

É o documento mais “contábil” da validação.
Não decide. Apenas registra.

## Perguntas centrais

* Que evidência foi coletada?
* De onde veio?
* Quando foi coletada?
* A qual hipótese se conecta?
* Quão confiável é?
* É evidência forte, fraca ou ambígua?
* Contradiz alguma crença anterior?

## Estrutura ideal

```md
# Evidence Log

## Evidence Register

## Interview Evidence

## Behavioral Evidence

## Quantitative Evidence

## Market Evidence

## Contradictory Evidence

## Evidence Quality Notes
```

## Formato recomendado

```md
## EV-001: [Evidence Summary]

### Date

### Source

Interview / Analytics / Experiment / Market / Support / Observation

### Related Hypotheses

H-001, H-003

### Evidence

### Interpretation

### Strength

Strong / Medium / Weak

### Contradictions

### Notes
```

## Por que existe?

Sem evidence log, a validação vira memória seletiva. ⚠️

---

# 8. `07-decision-record.md` — Registro de Decisões de Validação

## Função

Registra decisões tomadas a partir das evidências.

É diferente do evidence log:

* `evidence-log.md` registra **o que foi observado**
* `decision-record.md` registra **o que foi decidido**

## Perguntas centrais

* Que decisão foi tomada?
* Com base em quais evidências?
* Que alternativas foram consideradas?
* Que risco permanece?
* Essa decisão confirma, muda ou mata uma hipótese?
* Qual é a próxima ação?

## Estrutura ideal

```md
# Validation Decision Record

## Decision Register

## Accepted Hypotheses

## Refuted Hypotheses

## Pivot Decisions

## Proceed Decisions

## Stop Decisions

## Open Risks
```

## Formato recomendado

```md
## VDR-001: [Decision Title]

### Date

### Decision

Proceed / Pivot / Pause / Stop / Re-test

### Related Hypotheses

### Evidence Used

EV-001, EV-004

### Reasoning

### Alternatives Considered

### Remaining Risk

### Next Step
```

---

# 9. `08-validation-report.md` — Relatório de Validação

## Função

Sintetiza o estado atual da validação.

Este é o documento que permite a alguém abrir a pasta e entender:

> **“A ideia foi validada o suficiente para avançar?”**

## Perguntas centrais

* O que foi validado?
* O que foi refutado?
* O que segue incerto?
* Quais riscos permanecem?
* O projeto deve avançar para Product?
* Com quais restrições?

## Estrutura ideal

```md
# Validation Report

## Executive Summary

## Validation Status

## Supported Claims

## Refuted Claims

## Inconclusive Claims

## Key Evidence

## Remaining Risks

## Recommendation

## Required Changes Before Product
```

## Por que existe?

Sem relatório, a validação fica espalhada em registros e experimentos.
O relatório é a ponte para o próximo eixo: **Product**.

---

# Por que esse conjunto é o sweet spot?

| Documento                   | Pergunta central           | Papel            |
| --------------------------- | -------------------------- | ---------------- |
| `README.md`                 | Como navegar?              | Mapa             |
| `01-validation-strategy.md` | Como validar?              | Método           |
| `02-core-assumptions.md`    | O que estamos assumindo?   | Risco conceitual |
| `03-hypotheses.md`          | O que será testado?        | Testabilidade    |
| `04-research-plan.md`       | Como ouvir/observar?       | Pesquisa         |
| `05-experiments.md`         | Como testar comportamento? | Execução         |
| `06-evidence-log.md`        | O que foi observado?       | Registro         |
| `07-decision-record.md`     | O que foi decidido?        | Governança       |
| `08-validation-report.md`   | Podemos avançar?           | Síntese          |

---

# O que eu **não** colocaria em Validation

Eu evitaria estes documentos aqui:

```txt
market-analysis.md
competitor-analysis.md
pricing-strategy.md
product-requirements.md
mvp-spec.md
user-stories.md
analytics-plan.md
growth-strategy.md
business-model.md
```

## Motivo

Eles podem aparecer **como insumo**, mas não como núcleo da validação.

| Documento tentador        | Melhor lugar                        |
| ------------------------- | ----------------------------------- |
| `market-analysis.md`      | Go-to-market ou Validation appendix |
| `competitor-analysis.md`  | Go-to-market / Product positioning  |
| `pricing-strategy.md`     | Go-to-market                        |
| `product-requirements.md` | Product                             |
| `mvp-spec.md`             | Product                             |
| `user-stories.md`         | Product                             |
| `analytics-plan.md`       | Product / Operations                |
| `growth-strategy.md`      | Go-to-market                        |
| `business-model.md`       | Go-to-market / Operations           |

---

# Ajuste importante

Eu **não** separaria validação em documentos demais por tipo de teste, como:

```txt
interviews.md
surveys.md
landing-page-tests.md
prototype-tests.md
pricing-tests.md
retention-tests.md
```

Isso parece organizado, mas fragmenta cedo demais.

Melhor manter:

```txt
04-research-plan.md
05-experiments.md
06-evidence-log.md
```

Esses três documentos já suportam quase todos os métodos de validação sem inflar a pasta.

---

# Recomendação final

```txt
02-validation/
├── README.md
├── 01-validation-strategy.md
├── 02-core-assumptions.md
├── 03-hypotheses.md
├── 04-research-plan.md
├── 05-experiments.md
├── 06-evidence-log.md
├── 07-decision-record.md
└── 08-validation-report.md
```

## Regra prática

Cada documento deve existir porque responde uma etapa distinta:

```txt
Assumir → Transformar em hipótese → Testar → Registrar evidência → Decidir → Sintetizar
```

Essa sequência faz o usuário perceber que a validação não é decoração metodológica.
É um mecanismo de redução de risco.

---

ok, mas senti falta de uma validação econômica também. Cálculos com estimativas de receitas, despesas e lucratividade. Estimativa de quantas vendas ou quantos usuários ativos são necessários para chegar a um break even. Não deve ser uma validação de ideias per se, por que no final das contas vivemos em um mundo em que o dinheiro é quem realmente decide tudo e se não puder ser lucrativo de alguma forma, não faz sentido.

---

Sim — **essa crítica está correta**. O set anterior ficou bom para **validação de tese, problema e comportamento**, mas ficou incompleto para um projeto real porque faltou a pergunta mais dura:

> **“Mesmo que as pessoas queiram isso, a conta fecha?”** 💸

Eu ajustaria o eixo **02-validation** para incluir explicitamente uma camada de **economic validation**.

---

# Correção estrutural

Eu mudaria de:

```txt
02-validation/
├── 01-validation-strategy.md
├── 02-core-assumptions.md
├── 03-hypotheses.md
├── 04-research-plan.md
├── 05-experiments.md
├── 06-evidence-log.md
├── 07-decision-record.md
└── 08-validation-report.md
```

Para:

```txt
02-validation/
├── README.md
├── 01-validation-strategy.md
├── 02-core-assumptions.md
├── 03-hypotheses.md
├── 04-research-plan.md
├── 05-experiments.md
├── 06-economic-model.md
├── 07-evidence-log.md
├── 08-decision-record.md
└── 09-validation-report.md
```

O novo documento-chave é:

```txt
06-economic-model.md
```

---

# `06-economic-model.md` — Modelo Econômico / Viabilidade Financeira

## Função

Este documento valida se o projeto tem potencial de ser **economicamente sustentável**.

Ele não substitui pricing strategy, business model ou go-to-market.
Ele responde uma pergunta anterior e mais brutal:

> **“Existe uma configuração plausível em que este projeto paga seus próprios custos e gera margem suficiente para continuar existindo?”**

---

# Perguntas que ele deve responder

## Receita

* Como o projeto pode gerar receita?
* Qual é o preço estimado?
* A receita será unitária, recorrente, transacional, por licença, por uso ou híbrida?
* Qual é a receita média esperada por usuário?
* Qual é o ticket médio?
* Qual é o MRR ou ARR projetado?
* Quais fontes de receita são primárias e quais são secundárias?

## Custos

* Quais são os custos fixos mensais?
* Quais são os custos variáveis por usuário, venda ou uso?
* Quais custos crescem com escala?
* Quais custos existem mesmo sem usuário?
* Quais custos podem ser ignorados no início, mas não depois?

## Margem

* Qual é a margem bruta estimada?
* Qual é a margem líquida estimada?
* Qual é o custo por usuário ativo?
* Qual é o custo por cliente pagante?
* A margem melhora ou piora com escala?

## Break-even

* Quantos clientes pagantes são necessários para empatar?
* Quantos usuários ativos são necessários para gerar esse número de pagantes?
* Qual taxa de conversão é necessária?
* Qual churn máximo é tolerável?
* Qual CAC máximo é viável?
* Em que cenário o projeto nunca fecha a conta?

## Cenários

* Cenário conservador
* Cenário realista
* Cenário otimista
* Cenário inviável
* Sensibilidade a preço, churn, CAC e custo de infraestrutura

---

# Estrutura ideal

```md
# Economic Model

## Economic Validation Objective

## Revenue Model

## Pricing Assumptions

## Cost Structure

## Unit Economics

## Break-even Analysis

## Scenario Analysis

## Sensitivity Analysis

## Economic Risks

## Invalidating Conditions

## Economic Validation Summary
```

---

# Modelo interno do documento

## 1. `Economic Validation Objective`

Define o que está sendo validado economicamente.

Exemplo:

```md
## Economic Validation Objective

This document evaluates whether the project can plausibly become financially sustainable under realistic pricing, cost, conversion, retention, and operational assumptions.
```

---

## 2. `Revenue Model`

Aqui entram os modelos possíveis de receita.

```md
## Revenue Model

### Primary Revenue Model

Subscription / One-time purchase / Usage-based / Transactional / Licensing / Sponsorship / Donation / Services / Hybrid

### Secondary Revenue Opportunities

### Revenue Constraints

### Revenue Model Risks
```

Ponto importante: para projeto open source, isso fica ainda mais necessário, não menos.

Um projeto pode ser gratuito e open source, mas ainda precisa responder:

* Quem paga a infraestrutura?
* Quem paga manutenção?
* Quem paga suporte?
* Existe sponsor?
* Existe hosted version?
* Existe consultoria?
* Existe grant?
* Existe doação?
* Existe versão managed?
* Existe produto complementar?

---

## 3. `Pricing Assumptions`

Aqui entram os preços hipotéticos.

```md
## Pricing Assumptions

### Base Price

### Alternative Price Points

### Expected Conversion Rate

### Expected Churn

### Expected ARPU

### Expected LTV

### Pricing Risks
```

Exemplo simples:

```md
### Base Price

R$ 29/month per paying user.

### Expected Conversion Rate

3% of active users become paying users.

### Expected Churn

5% monthly churn.

### Expected ARPU

R$ 29/month.
```

---

## 4. `Cost Structure`

Divide custos fixos e variáveis.

```md
## Cost Structure

### Fixed Monthly Costs

| Cost | Estimate | Notes |
|---|---:|---|
| Hosting | R$ 300 | Initial production infra |
| Database | R$ 150 | Managed Postgres |
| Email | R$ 100 | Transactional + marketing |
| Monitoring | R$ 100 | Logs, errors, uptime |
| Domain/tools | R$ 100 | Miscellaneous |

### Variable Costs

| Cost | Unit | Estimate | Notes |
|---|---:|---:|---|
| AI inference | per active user | R$ 2.50/month | Depends on usage |
| Storage | per active user | R$ 0.20/month | Low initially |
| Support | per paying user | R$ 3.00/month | Human time proxy |
| Payment fees | per transaction | 4.99% + fixed fee | Depends on provider |
```

---

## 5. `Unit Economics`

Este é o coração do documento.

```md
## Unit Economics

### Revenue Per Paying User

### Cost Per Active User

### Cost Per Paying User

### Gross Margin Per Paying User

### Contribution Margin

### LTV

### CAC Ceiling

### Payback Period
```

Fórmulas conceituais:

```txt
Gross margin per paying user =
monthly price - variable cost per paying user

Break-even paying users =
fixed monthly costs / contribution margin per paying user

Required active users =
break-even paying users / conversion rate

LTV =
ARPU × gross margin % / monthly churn

CAC ceiling =
LTV × acceptable CAC ratio
```

---

# Exemplo rápido de break-even

Suponha:

```txt
Preço mensal: R$ 29
Custos fixos mensais: R$ 2.000
Custo variável por cliente pagante: R$ 5
Margem de contribuição por cliente: R$ 24
Conversão de usuário ativo para pagante: 3%
```

Então:

```txt
Clientes pagantes para break-even:
R$ 2.000 / R$ 24 = 84 clientes pagantes

Usuários ativos necessários:
84 / 0,03 = 2.800 usuários ativos
```

Interpretação:

> O projeto precisa de aproximadamente **84 clientes pagantes** ou **2.800 usuários ativos com 3% de conversão** para empatar.

Isso muda completamente a conversa.
A ideia pode ser desejável, mas se o canal não consegue trazer 2.800 usuários ativos de forma barata, o modelo ainda não fecha.

---

# 6. `Scenario Analysis`

Aqui o documento força realismo.

```md
## Scenario Analysis

### Conservative Scenario

### Realistic Scenario

### Optimistic Scenario

### Failure Scenario
```

Exemplo:

| Cenário     | Preço | Conversão | Churn | Pagantes break-even | Usuários ativos necessários |
| ----------- | ----: | --------: | ----: | ------------------: | --------------------------: |
| Conservador | R$ 19 |        1% |    8% |                 143 |                      14.300 |
| Realista    | R$ 29 |        3% |    5% |                  84 |                       2.800 |
| Otimista    | R$ 49 |        5% |    3% |                  46 |                         920 |

Esse tipo de tabela revela rapidamente se o projeto é uma empresa, um hobby sustentável, um projeto comunitário ou uma fantasia econômica.

---

# 7. `Sensitivity Analysis`

Essa seção responde:

> **“Qual variável pode matar o projeto?”**

Normalmente são:

* preço baixo demais;
* conversão baixa;
* churn alto;
* CAC alto;
* uso intensivo de IA;
* suporte humano excessivo;
* infraestrutura com custo variável não controlado;
* público sem disposição real de pagar.

Estrutura:

```md
## Sensitivity Analysis

### Price Sensitivity

### Conversion Sensitivity

### Churn Sensitivity

### CAC Sensitivity

### Infrastructure Cost Sensitivity

### AI Usage Cost Sensitivity

### Support Load Sensitivity
```

---

# 8. `Invalidating Conditions`

Essa seção é essencial.

Ela define quando a ideia deve parar ou mudar.

Exemplo:

```md
## Invalidating Conditions

The project should not proceed under the current model if:

- Break-even requires more active users than the project can realistically acquire.
- Required conversion rate is higher than comparable products.
- Variable costs grow faster than revenue.
- Support cost per user destroys margin.
- Users express interest but no willingness to pay.
- The project depends on unpaid founder labor indefinitely.
```

A última linha é importante.
“Mão de obra gratuita do fundador” é uma das formas mais comuns de autoengano econômico. ⚠️

---

# Como isso se conecta aos outros documentos

O `economic-model.md` fica depois de `experiments.md` porque ele usa insumos de:

* entrevistas;
* teste de preço;
* landing page;
* waitlist;
* fake door;
* dados de conversão;
* estimativas de infra;
* hipóteses de aquisição.

Mas fica antes de `evidence-log.md` e `decision-record.md` porque os resultados econômicos também viram evidência e decisão.

Fluxo correto:

```txt
Assunções
  ↓
Hipóteses
  ↓
Pesquisa + Experimentos
  ↓
Modelo Econômico
  ↓
Evidências
  ↓
Decisões
  ↓
Relatório de Validação
```

---

# O que muda no conceito de Validation

A validação passa a ter **três camadas**, não uma só:

```txt
1. Desirability
   As pessoas querem isso?

2. Viability
   Isso pode sustentar dinheiro, operação e continuidade?

3. Feasibility
   Isso pode ser construído com os recursos disponíveis?
```

Mas cuidado: **feasibility técnica profunda** ainda pertence mais a Engineering.
Em Validation, a feasibility é só uma checagem de risco inicial.

---

# Ajuste fino no set

Agora o set ideal fica assim:

| Documento                   | Pergunta central                 |
| --------------------------- | -------------------------------- |
| `01-validation-strategy.md` | Como vamos validar?              |
| `02-core-assumptions.md`    | O que estamos assumindo?         |
| `03-hypotheses.md`          | O que precisa ser testável?      |
| `04-research-plan.md`       | Como vamos ouvir/observar?       |
| `05-experiments.md`         | Como vamos testar comportamento? |
| `06-economic-model.md`      | A conta fecha?                   |
| `07-evidence-log.md`        | O que foi observado?             |
| `08-decision-record.md`     | O que foi decidido?              |
| `09-validation-report.md`   | Podemos avançar?                 |

Esse é mais completo e ainda não está inchado.

---

# Minha recomendação revisada

```txt
02-validation/
├── README.md
├── 01-validation-strategy.md
├── 02-core-assumptions.md
├── 03-hypotheses.md
├── 04-research-plan.md
├── 05-experiments.md
├── 06-economic-model.md
├── 07-evidence-log.md
├── 08-decision-record.md
└── 09-validation-report.md
```

## Veredito

Você está certo: **sem validação econômica, Validation fica conceitualmente incompleta**.

A tese pode ser verdadeira.
O problema pode ser real.
O usuário pode amar.
Mas se a estrutura econômica exige aquisição impossível, margem negativa ou trabalho manual infinito, o projeto não é validado — ele só é desejado.

E isso é exatamente o tipo de verdade que o eixo normativo precisa forçar antes do roadmap começar.

---

ok, mas acho que ainda não terminamos, analisada a viabilidade existencial (tese, problema e comportamento) e a viabilidade economica, precisamos encerrar com um modelo de negócios, é o fechamento desse tópico. E no caso de users que queiram apresentar seu projeto para possíveis investidores ou acionistas, sem isso não vão nem olhar o projeto

---

Sim — **correto**. O tópico **Validation** ainda estava incompleto.

A sequência conceitual deveria ser:

```txt
1. Viabilidade existencial
   A tese, o problema, o público e o comportamento fazem sentido?

2. Viabilidade econômica
   A conta fecha?

3. Modelo de negócios
   Como isso vira uma organização/projeto sustentável e apresentável?
```

A validação econômica responde **“a conta pode fechar?”**.
O modelo de negócios responde **“qual é a lógica operacional e comercial que faz essa conta fechar?”**

São documentos relacionados, mas não redundantes.

---

# Ajuste final do set de **02-validation**

Eu fecharia assim:

```txt
02-validation/
├── README.md
├── 01-validation-strategy.md
├── 02-core-assumptions.md
├── 03-hypotheses.md
├── 04-research-plan.md
├── 05-experiments.md
├── 06-economic-model.md
├── 07-business-model.md
├── 08-evidence-log.md
├── 09-decision-record.md
└── 10-validation-report.md
```

Esse é provavelmente o **sweet spot real**.

Mais enxuto que isso deixa buracos.
Mais amplo que isso começa a invadir **Product**, **Go-to-market** e **Operations**.

---

# Novo documento: `07-business-model.md`

## Função

Define como o projeto cria, entrega, captura e sustenta valor.

Ele responde:

> **“Qual é o mecanismo pelo qual este projeto se torna economicamente, operacionalmente e estrategicamente viável?”**

Não é apenas receita.
Não é apenas pricing.
Não é apenas planilha.

É a lógica integrada do negócio.

---

# Diferença entre `economic-model.md` e `business-model.md`

| Documento              | Pergunta                 | Natureza                |
| ---------------------- | ------------------------ | ----------------------- |
| `06-economic-model.md` | A conta fecha?           | Quantitativo            |
| `07-business-model.md` | Como o negócio funciona? | Estratégico-operacional |

## Exemplo prático

`economic-model.md` diz:

```txt
Com R$ 49/mês, 300 clientes pagantes e custo variável de R$ 8 por cliente,
o projeto pode chegar ao break-even.
```

`business-model.md` diz:

```txt
O projeto será open source, com uma versão hosted paga, suporte premium,
consultoria de implantação e eventual licenciamento para organizações.
```

Um calcula.
O outro explica o mecanismo.

---

# Estrutura ideal do `07-business-model.md`

```md
# Business Model

## Business Model Objective

## Value Proposition

## Customer Segments

## Users, Customers, Buyers, and Beneficiaries

## Revenue Streams

## Pricing Logic

## Distribution Channels

## Customer Relationships

## Key Activities

## Key Resources

## Key Partners

## Cost Drivers

## Competitive Advantage

## Scalability Logic

## Investor / Stakeholder Narrative

## Business Model Risks

## Invalidating Conditions

## Business Model Summary
```

---

# Seções essenciais

## 1. `Value Proposition`

A proposta de valor em termos de negócio.

Perguntas:

* Que valor o projeto entrega?
* Por que alguém pagaria?
* Que custo, risco, dor ou ineficiência ele reduz?
* Que capacidade nova ele cria?
* Por que isso importa agora?

---

## 2. `Customer Segments`

Aqui entra uma distinção importante:

```txt
Usuário ≠ Cliente ≠ Pagador ≠ Comprador ≠ Beneficiário
```

Isso é crítico em projetos B2B, educação, saúde, open source e produtos para organizações.

Exemplo:

| Papel        | Quem pode ser                    |
| ------------ | -------------------------------- |
| Usuário      | Pessoa que usa diariamente       |
| Cliente      | Organização que adota            |
| Pagador      | Área financeira                  |
| Comprador    | Gestor, diretor, fundador        |
| Beneficiário | Time, aluno, família, comunidade |

Sem essa distinção, o modelo de negócios costuma ficar frágil.

---

## 3. `Revenue Streams`

Define as fontes possíveis de receita.

Exemplos:

```txt
- Assinatura SaaS
- Versão hosted paga
- Licenciamento
- Suporte premium
- Serviços profissionais
- Consultoria
- Marketplace
- Taxa transacional
- Revenue share
- Treinamentos
- Certificações
- Grants
- Sponsorship
- Doações
- Enterprise plans
```

Para projeto open source, esta seção é obrigatória.
Open source sem modelo de sustentabilidade vira dependência de energia pessoal.

---

## 4. `Pricing Logic`

Não precisa ser pricing strategy completo ainda.

Mas precisa responder:

* O preço deriva de custo?
* De valor percebido?
* De comparação com alternativas?
* De orçamento disponível do cliente?
* De frequência de uso?
* De economia gerada?
* De risco reduzido?

Essa seção conecta o modelo de negócios ao `economic-model.md`.

---

## 5. `Distribution Channels`

Validação de negócio sem canal é incompleta.

Perguntas:

* Como o projeto chega ao cliente?
* Conteúdo?
* Comunidade?
* Vendas diretas?
* Parcerias?
* Marketplace?
* App stores?
* GitHub?
* Indicação?
* SEO?
* Enterprise sales?
* Afiliados?

Aqui ainda não é plano detalhado de go-to-market.
É apenas a lógica de distribuição presumida.

---

## 6. `Key Activities`

O que o projeto precisa fazer continuamente para funcionar?

Exemplos:

```txt
- Desenvolver produto
- Manter infraestrutura
- Produzir conteúdo
- Prestar suporte
- Gerenciar comunidade
- Fazer vendas
- Operar onboarding
- Garantir segurança
- Manter documentação
- Atender clientes enterprise
```

Essa seção evita fantasia de “produto que se vende sozinho”.

---

## 7. `Key Resources`

Recursos sem os quais o modelo não roda.

Exemplos:

```txt
- Software
- Marca
- Comunidade
- Dados
- Infraestrutura
- Conhecimento proprietário
- Documentação
- Repositório open source
- Time técnico
- Canal de distribuição
- Capital
```

---

## 8. `Cost Drivers`

Diferente de custos detalhados do `economic-model.md`.

Aqui o foco é: **o que estruturalmente puxa custo para cima?**

Exemplos:

```txt
- Uso intensivo de IA
- Suporte humano
- Vendas enterprise
- Compliance
- Infraestrutura multi-tenant
- Armazenamento
- Processamento em tempo real
- Dependência de APIs pagas
- Onboarding manual
```

---

## 9. `Competitive Advantage`

Para investidores ou acionistas, isso é central.

Perguntas:

* Por que este projeto pode vencer?
* Qual é o diferencial defensável?
* Tecnologia?
* Distribuição?
* Comunidade?
* Dados?
* Marca?
* Timing?
* Domínio específico?
* Baixo custo operacional?
* Integração vertical?
* Open source como aquisição?

Sem isso, o projeto parece apenas “mais um app”.

---

## 10. `Scalability Logic`

Essa seção responde:

> **“O modelo melhora com escala ou piora com escala?”**

Perguntas:

* A margem melhora com mais usuários?
* O suporte cresce linearmente?
* A infraestrutura escala bem?
* O CAC cai ou sobe?
* Existe efeito de rede?
* Existe lock-in legítimo?
* Existe expansão para novos segmentos?
* Existe receita expansion-based?

Essa seção é importante porque há negócios que dão lucro pequeno no início, mas escalam bem; e outros parecem bons no início, mas colapsam com volume.

---

## 11. `Investor / Stakeholder Narrative`

Eu incluiria explicitamente essa seção.

Não como pitch deck, mas como material-base.

Ela deve responder:

```txt
Por que este projeto merece atenção, confiança, capital, tempo ou apoio institucional?
```

Estrutura possível:

```md
## Investor / Stakeholder Narrative

### Market Logic

### Problem Urgency

### Business Opportunity

### Strategic Timing

### Defensibility

### Economic Upside

### Execution Thesis

### Current Validation Status
```

Isso cria uma ponte direta para:

```txt
05-go-to-market/
06-operations/
pitch deck futuro
investor memo
shareholder report
```

---

# Relação entre os documentos finais

Agora o fluxo fica bem mais forte:

```txt
Assumptions
  ↓
Hypotheses
  ↓
Research + Experiments
  ↓
Economic Model
  ↓
Business Model
  ↓
Evidence Log
  ↓
Decision Record
  ↓
Validation Report
```

Ou, em linguagem mais conceitual:

```txt
Desejável?
  ↓
Comportamentalmente plausível?
  ↓
Economicamente viável?
  ↓
Comercialmente estruturável?
  ↓
Vale avançar?
```

---

# Set revisado definitivo

| Documento                   | Pergunta central           | Papel                    |
| --------------------------- | -------------------------- | ------------------------ |
| `README.md`                 | Como navegar a validação?  | Índice                   |
| `01-validation-strategy.md` | Como validar?              | Método                   |
| `02-core-assumptions.md`    | O que estamos assumindo?   | Riscos fundamentais      |
| `03-hypotheses.md`          | O que será testado?        | Testabilidade            |
| `04-research-plan.md`       | Como ouvir e observar?     | Pesquisa                 |
| `05-experiments.md`         | Como testar comportamento? | Evidência prática        |
| `06-economic-model.md`      | A conta fecha?             | Viabilidade quantitativa |
| `07-business-model.md`      | Como o negócio funciona?   | Lógica comercial         |
| `08-evidence-log.md`        | O que foi observado?       | Registro factual         |
| `09-decision-record.md`     | O que foi decidido?        | Governança               |
| `10-validation-report.md`   | Podemos avançar?           | Síntese executiva        |

---

# O que eu **não** adicionaria ainda

Mesmo com business model, eu **não** colocaria estes documentos em Validation:

```txt
pitch-deck.md
investor-memo.md
sales-strategy.md
growth-plan.md
pricing-strategy.md
financial-projections.md
fundraising-strategy.md
partnership-strategy.md
```

Eles são importantes, mas pertencem melhor a **Go-to-market** ou **Operations**.

## Por quê?

Porque em Validation o objetivo é provar que existe uma lógica de negócio viável.

Em Go-to-market, o objetivo é executar essa lógica no mercado.

---

# Veredito

Você fechou a lacuna principal.

O tópico **Validation** não deve terminar apenas com:

```txt
As pessoas querem?
```

Nem apenas com:

```txt
A conta fecha?
```

Ele deve terminar com:

```txt
Existe uma lógica de negócio clara, defensável e apresentável?
```

Então sim: `07-business-model.md` deve entrar como documento fundacional de validação.

Sem ele, um investidor, acionista ou parceiro estratégico olharia o projeto e concluiria:

> “Interessante, talvez útil, talvez até lucrativo — mas ainda não está estruturado como negócio.”

Com ele, o eixo **Validation** passa a encerrar com maturidade.

---

perfeito, vamos ao próximo tópico, Product, qual será o nosso sweet spot de docs nele? Já adianto que precisamos esgotar UX, UI, Stack, Arquitetura, Design, Escopo, entre outros que não lembro agora

---

## Sweet spot para **03-product** 📐

Para **Product**, o objetivo é responder:

> **“O que exatamente será construído, para quem, com qual experiência, com qual escopo, com qual linguagem visual e com quais regras de produto?”**

Aqui o eixo precisa ser mais robusto que Foundation e Validation, porque é nele que a ideia vira **forma utilizável**.

Meu sweet spot: **12 documentos + README**.

Menos que isso tende a misturar UX, UI, escopo, arquitetura de produto e requisitos.
Mais que isso começa a invadir **Engineering**, **Design System isolado** e **Operations**.

---

# Estrutura recomendada

```txt
03-product/
├── README.md
├── 01-product-brief.md
├── 02-scope.md
├── 03-user-journeys.md
├── 04-ux-model.md
├── 05-information-architecture.md
├── 06-interaction-model.md
├── 07-ui-specification.md
├── 08-design-system.md
├── 09-product-architecture.md
├── 10-functional-requirements.md
├── 11-non-functional-requirements.md
├── 12-product-stack.md
└── 13-acceptance-criteria.md
```

Esse é o conjunto que eu consideraria **completo sem ficar burocrático**.

---

# Visão geral

| Documento                           | Pergunta central                        | Papel                          |
| ----------------------------------- | --------------------------------------- | ------------------------------ |
| `README.md`                         | Como navegar o Product?                 | Índice                         |
| `01-product-brief.md`               | O que será construído?                  | Síntese do produto             |
| `02-scope.md`                       | O que entra e o que fica fora?          | Controle de escopo             |
| `03-user-journeys.md`               | Como o usuário percorre o produto?      | Fluxos humanos                 |
| `04-ux-model.md`                    | Como a experiência funciona?            | Modelo de experiência          |
| `05-information-architecture.md`    | Como a informação é organizada?         | Estrutura conceitual           |
| `06-interaction-model.md`           | Como o usuário age no sistema?          | Interações                     |
| `07-ui-specification.md`            | Como as telas se comportam?             | Especificação visual-funcional |
| `08-design-system.md`               | Quais padrões visuais guiam o produto?  | Linguagem visual               |
| `09-product-architecture.md`        | Quais módulos compõem o produto?        | Arquitetura de produto         |
| `10-functional-requirements.md`     | O que o sistema deve fazer?             | Requisitos funcionais          |
| `11-non-functional-requirements.md` | Quais qualidades o produto precisa ter? | Requisitos de qualidade        |
| `12-product-stack.md`               | Que stack suporta o produto?            | Decisões técnicas de produto   |
| `13-acceptance-criteria.md`         | Quando algo está pronto?                | Critério de aceitação          |

---

# 1. `README.md` — Product Index

## Função

Explica como a pasta Product deve ser lida.

Ele responde:

> **“Como esses documentos transformam a validação em produto especificável?”**

## Estrutura ideal

```md
# Product

This section defines what will be built, how users experience it, what belongs in scope, how the interface behaves, what product architecture supports it, and what criteria determine whether it is ready.

## Reading Order

1. Product Brief
2. Scope
3. User Journeys
4. UX Model
5. Information Architecture
6. Interaction Model
7. UI Specification
8. Design System
9. Product Architecture
10. Functional Requirements
11. Non-Functional Requirements
12. Product Stack
13. Acceptance Criteria
```

---

# 2. `01-product-brief.md` — Product Brief

## Função

É a síntese executiva do produto.

Ele não deve repetir Foundation nem Validation.
Ele deve dizer: **dado tudo que foi validado, qual produto será construído?**

## Perguntas centrais

* Qual é o produto?
* Qual problema validado ele resolve?
* Para quem ele é?
* Qual é a promessa principal?
* Qual é a experiência central?
* Qual é o primeiro recorte do produto?
* Qual é a tese de produto?

## Estrutura ideal

```md
# Product Brief

## Product Summary

## Validated Problem

## Target User

## Core Product Promise

## Product Thesis

## Primary Use Case

## Product Differentiation

## Product Constraints

## Product Success Criteria
```

## Por que existe?

Sem Product Brief, Product vira uma pilha de requisitos sem centro.

---

# 3. `02-scope.md` — Escopo

## Função

Define o que entra e o que não entra no produto.

Este documento é crítico.
Ele impede que o produto vire um organismo infinito.

## Perguntas centrais

* O que está dentro do MVP?
* O que está fora do MVP?
* O que é essencial?
* O que é opcional?
* O que é futuro?
* O que nunca deve entrar?
* Que decisões de escopo já foram tomadas?

## Estrutura ideal

```md
# Scope

## Scope Objective

## In Scope

## Out of Scope

## MVP Scope

## Post-MVP Scope

## Explicit Non-Goals

## Scope Boundaries

## Deferred Decisions

## Scope Risks
```

## Observação crítica

Esse documento precisa ser severo.
Sem escopo bem escrito, todo Product vira roadmap disfarçado.

---

# 4. `03-user-journeys.md` — Jornadas do Usuário

## Função

Descreve os caminhos humanos pelo produto.

Não é ainda screen-by-screen spec.
É a jornada do usuário em termos de intenção, contexto, decisão e resultado.

## Perguntas centrais

* Como o usuário chega ao produto?
* Qual é o primeiro momento de valor?
* Qual é a jornada principal?
* Quais jornadas secundárias existem?
* Onde há fricção?
* Onde há decisão?
* Onde o produto deve reduzir carga cognitiva?
* Como o usuário retorna?

## Estrutura ideal

```md
# User Journeys

## Journey Overview

## Primary Journey

## Secondary Journeys

## Onboarding Journey

## First Value Journey

## Repeat Use Journey

## Failure / Recovery Journeys

## Exit / Completion Journeys

## Journey Risks
```

## Por que existe?

Sem jornadas, o produto tende a ser especificado por telas.
Isso é frágil: usuários não vivem telas, vivem tarefas.

---

# 5. `04-ux-model.md` — Modelo de UX

## Função

Define o modelo conceitual da experiência.

É aqui que você responde:

> **“Como este produto deve ser sentido, compreendido e usado?”**

Não é UI.
Não é design system.
É o **modelo de experiência**.

## Perguntas centrais

* Qual é o paradigma de UX?
* O produto é chat-first, dashboard-first, canvas-first, form-first, timeline-first?
* O usuário navega por tarefas, objetos, conversas, documentos, projetos?
* O produto é proativo ou reativo?
* O produto exige configuração ou aprende pelo uso?
* O produto guia, recomenda, executa ou apenas registra?
* Qual é a carga cognitiva aceitável?

## Estrutura ideal

```md
# UX Model

## UX Thesis

## Experience Principles

## Primary UX Paradigm

## User Mental Model

## Cognitive Load Rules

## Guidance Model

## Feedback Model

## Error and Recovery Model

## Proactivity Model

## Trust Model

## UX Anti-Patterns
```

## Exemplo

Para um produto como NOMOS, uma tese de UX poderia ser:

```md
## UX Thesis

The product should behave less like a spreadsheet and more like a financial reasoning companion: it should help the user understand trade-offs before decisions become transactions.
```

Esse documento é onde a experiência ganha identidade.

---

# 6. `05-information-architecture.md` — Arquitetura da Informação

## Função

Define como os conceitos do produto são organizados.

Ele responde:

> **“Quais objetos existem no produto e como eles se relacionam?”**

## Perguntas centrais

* Quais são as entidades principais?
* Quais são os espaços de navegação?
* Quais informações são primárias?
* Quais informações são secundárias?
* Como o usuário encontra algo?
* Como os dados são agrupados?
* Que hierarquia existe?
* Que vocabulário aparece na interface?

## Estrutura ideal

```md
# Information Architecture

## Core Objects

## Object Relationships

## Navigation Structure

## Content Hierarchy

## Naming Rules

## Search and Retrieval

## Empty States

## Information Density Rules

## IA Risks
```

## Diferença importante

`information-architecture.md` não é schema de banco.

Ele define a organização mental e navegacional do produto.
O schema técnico vem depois em **Engineering**.

---

# 7. `06-interaction-model.md` — Modelo de Interação

## Função

Define como o usuário age dentro do produto.

Este documento é especialmente importante para produtos com:

* chat;
* agentes;
* automação;
* comandos;
* atalhos;
* gestures;
* estados ricos;
* fluxos de confirmação;
* recomendações;
* decisões assistidas.

## Perguntas centrais

* Quais ações o usuário pode tomar?
* Quais ações o sistema pode sugerir?
* Quais ações exigem confirmação?
* O que acontece após cada ação?
* Como undo, cancelamento e recuperação funcionam?
* Como o sistema lida com ambiguidade?
* Como o sistema apresenta opções?
* Como o usuário corrige o sistema?

## Estrutura ideal

```md
# Interaction Model

## Interaction Principles

## Primary Interaction Patterns

## Commands and Actions

## Confirmation Rules

## Undo and Recovery

## Ambiguity Handling

## System Suggestions

## User Corrections

## State Transitions

## Interaction Anti-Patterns
```

## Por que existe?

Sem esse documento, a UI pode parecer bonita, mas o produto fica inconsistente na ação.

---

# 8. `07-ui-specification.md` — UI Specification

## Função

Define as telas, componentes e estados de interface.

Aqui sim entram:

* telas;
* layouts;
* estados;
* componentes;
* responsividade;
* comportamento visual;
* mensagens;
* empty states;
* loading states;
* error states.

## Perguntas centrais

* Quais telas existem?
* Quais componentes aparecem em cada tela?
* Quais estados cada tela suporta?
* Como os componentes se comportam?
* Como a interface responde a erro, vazio, loading e sucesso?
* Como a interface se adapta a diferentes tamanhos?
* Quais microcopy aparecem?

## Estrutura ideal

```md
# UI Specification

## Screen Inventory

## Layout Rules

## Component Usage

## Screen-by-Screen Specification

## Empty States

## Loading States

## Error States

## Success States

## Responsive Behavior

## Microcopy Rules

## UI Risks
```

## Observação

Este documento deve ser concreto o suficiente para design e front-end trabalharem, mas não precisa conter implementação de componentes ainda.

---

# 9. `08-design-system.md` — Design System

## Função

Define a linguagem visual e os padrões de design.

Ele responde:

> **“Que consistência visual e sensorial o produto deve manter?”**

## Perguntas centrais

* Quais são os princípios visuais?
* Qual é a tipografia?
* Qual é a paleta?
* Como spacing funciona?
* Como elevação/sombra/borda funciona?
* Como estados visuais são representados?
* Como componentes devem parecer?
* Quais padrões são proibidos?

## Estrutura ideal

```md
# Design System

## Design Principles

## Visual Language

## Typography

## Color System

## Spacing System

## Layout Grid

## Shape and Radius

## Iconography

## Motion

## Component Principles

## Accessibility Rules

## Design Anti-Patterns
```

## Trade-off

Se o produto for grande, esse documento pode virar uma pasta própria futuramente:

```txt
03-product/design-system/
├── typography.md
├── color.md
├── components.md
├── motion.md
└── accessibility.md
```

Mas no sweet spot inicial, eu manteria **um único documento**.

---

# 10. `09-product-architecture.md` — Arquitetura de Produto

## Função

Define a arquitetura conceitual do produto, não a arquitetura técnica profunda.

Ele responde:

> **“Quais módulos, áreas e capacidades compõem o produto?”**

## Perguntas centrais

* Quais são os módulos principais?
* Quais capacidades pertencem a cada módulo?
* Como os módulos se relacionam?
* Quais objetos atravessam múltiplos módulos?
* Quais áreas são core?
* Quais áreas são auxiliares?
* Quais capacidades podem ser adiadas?
* Quais dependências de produto existem?

## Estrutura ideal

```md
# Product Architecture

## Product Modules

## Core Capabilities

## Supporting Capabilities

## Cross-Cutting Capabilities

## Module Relationships

## Capability Map

## Product Dependencies

## Product Architecture Risks
```

## Diferença para Engineering

Product Architecture:

```txt
O produto tem módulos: Chat, Planning, Decisions, Transactions, Insights.
```

Engineering Architecture:

```txt
Esses módulos serão implementados com Expo Router, packages, GraphQL, SQLite, Sync Engine, event store etc.
```

---

# 11. `10-functional-requirements.md` — Requisitos Funcionais

## Função

Lista o que o produto deve fazer.

É o documento mais próximo de uma especificação tradicional.

## Perguntas centrais

* Que funcionalidades são obrigatórias?
* Que comportamentos o sistema deve suportar?
* Quais ações o usuário pode executar?
* Quais regras de negócio existem?
* Quais permissões existem?
* Quais integrações funcionais são necessárias?
* Quais estados precisam ser suportados?

## Estrutura ideal

```md
# Functional Requirements

## Requirement Format

## Core Requirements

## User Requirements

## System Requirements

## Admin Requirements

## Integration Requirements

## Data Requirements

## Business Rules

## Requirement Traceability
```

## Formato recomendado

```md
## FR-001: [Requirement Name]

### Description

### User Value

### Priority

Must / Should / Could / Won't

### Related Journey

### Related Module

### Acceptance Criteria

### Dependencies

### Notes
```

---

# 12. `11-non-functional-requirements.md` — Requisitos Não Funcionais

## Função

Define as qualidades do produto.

Aqui entram requisitos que não são “features”, mas determinam se o produto é aceitável.

## Perguntas centrais

* Qual performance é aceitável?
* Qual nível de acessibilidade?
* Qual privacidade?
* Qual segurança?
* Qual confiabilidade?
* Qual disponibilidade?
* Qual latência?
* Qual escalabilidade?
* Qual compatibilidade?
* Qual observabilidade?
* Qual padrão de internacionalização?

## Estrutura ideal

```md
# Non-Functional Requirements

## Performance

## Accessibility

## Privacy

## Security

## Reliability

## Availability

## Scalability

## Compatibility

## Observability

## Internationalization

## Compliance

## Operational Constraints
```

## Observação crítica

Esse documento pertence a Product porque ele define **qualidade esperada pelo produto**.

A implementação técnica desses requisitos pertence a Engineering.

---

# 13. `12-product-stack.md` — Stack de Produto

## Função

Define as tecnologias e plataformas escolhidas no nível de produto.

Esse documento é delicado: ele não deve virar arquitetura de engenharia completa.

Ele responde:

> **“Quais escolhas tecnológicas moldam diretamente a experiência, o escopo e as restrições do produto?”**

## Perguntas centrais

* Produto será web, mobile, desktop, CLI, API, extensão, agente?
* Qual plataforma vem primeiro?
* Qual framework principal?
* Quais dependências moldam a experiência?
* Quais tecnologias são decisões de produto?
* Quais restrições técnicas impactam UX?
* Quais escolhas ficam adiadas para Engineering?

## Estrutura ideal

```md
# Product Stack

## Platform Strategy

## Primary Client

## Secondary Clients

## Product-Level Technology Choices

## UX-Relevant Technical Constraints

## Integration Surface

## Tooling Assumptions

## Deferred Engineering Decisions

## Stack Risks
```

## Exemplo

Para NOMOS:

```md
## Platform Strategy

The first product surface is an iOS-first Expo mobile application.

## Primary Client

React Native with Expo.

## UX-Relevant Technical Constraints

The product may use native-feeling iOS components where appropriate. Offline behavior should support quick capture, but full sync strategy belongs to Engineering.
```

---

# 14. `13-acceptance-criteria.md` — Critérios de Aceitação

## Função

Define quando o produto, uma feature ou um fluxo está pronto.

Ele fecha o eixo Product.

## Perguntas centrais

* O que significa “pronto”?
* Como validar se um fluxo funciona?
* Que critérios impedem release?
* Quais requisitos são obrigatórios?
* Quais estados precisam estar cobertos?
* Que padrões de qualidade mínima devem ser satisfeitos?
* Como Product passa para Engineering sem ambiguidade?

## Estrutura ideal

```md
# Acceptance Criteria

## Product Acceptance Standard

## Feature Acceptance Standard

## UX Acceptance Criteria

## UI Acceptance Criteria

## Functional Acceptance Criteria

## Non-Functional Acceptance Criteria

## Release Blocking Issues

## Product Readiness Checklist
```

## Por que ele fecha bem Product?

Porque transforma documentação em contrato.

Sem acceptance criteria, Product fica opinativo.
Com acceptance criteria, Engineering consegue executar e testar.

---

# Agrupamento conceitual do eixo Product

O conjunto fica melhor se entendido em 4 blocos:

```txt
A. Direção de Produto
├── 01-product-brief.md
└── 02-scope.md

B. Experiência
├── 03-user-journeys.md
├── 04-ux-model.md
├── 05-information-architecture.md
└── 06-interaction-model.md

C. Interface e Design
├── 07-ui-specification.md
└── 08-design-system.md

D. Especificação Construível
├── 09-product-architecture.md
├── 10-functional-requirements.md
├── 11-non-functional-requirements.md
├── 12-product-stack.md
└── 13-acceptance-criteria.md
```

Esse agrupamento é importante porque evita a sensação de “13 arquivos soltos”.

---

# O que eu **não** colocaria em Product

Eu evitaria estes documentos aqui:

```txt
database-schema.md
api-spec.md
sync-engine.md
deployment.md
infrastructure.md
observability-implementation.md
test-plan.md
ci-cd.md
analytics-implementation.md
growth-plan.md
sales-plan.md
support-playbook.md
```

## Melhor lugar

| Documento tentador            | Melhor eixo              |
| ----------------------------- | ------------------------ |
| `database-schema.md`          | Engineering              |
| `api-spec.md`                 | Engineering              |
| `sync-engine.md`              | Engineering              |
| `deployment.md`               | Engineering / Operations |
| `infrastructure.md`           | Engineering / Operations |
| `test-plan.md`                | Engineering              |
| `ci-cd.md`                    | Engineering              |
| `analytics-implementation.md` | Engineering / Operations |
| `growth-plan.md`              | Go-to-market             |
| `sales-plan.md`               | Go-to-market             |
| `support-playbook.md`         | Operations               |

---

# Ponto sensível: Stack e Arquitetura

Você citou **Stack** e **Arquitetura**. Eu manteria ambos em Product, mas com escopo controlado.

## `12-product-stack.md`

Deve conter decisões como:

```txt
- mobile-first ou web-first;
- app nativo, web app, desktop ou CLI;
- React Native, Expo, Next.js, Electron etc.;
- restrições de plataforma que afetam UX;
- integração com IA, calendário, arquivos, câmera, notificações etc.;
- superfície primária do produto.
```

## `09-product-architecture.md`

Deve conter:

```txt
- módulos de produto;
- capacidades;
- objetos principais;
- relação entre áreas;
- dependências funcionais;
- mapa de features.
```

Mas não deve conter ainda:

```txt
- schema SQL;
- filas;
- cache;
- arquitetura de serviços;
- CI/CD;
- observabilidade técnica;
- estratégia detalhada de deploy.
```

Isso protege a fronteira entre **Product** e **Engineering**.

---

# Recomendação final

```txt
03-product/
├── README.md
├── 01-product-brief.md
├── 02-scope.md
├── 03-user-journeys.md
├── 04-ux-model.md
├── 05-information-architecture.md
├── 06-interaction-model.md
├── 07-ui-specification.md
├── 08-design-system.md
├── 09-product-architecture.md
├── 10-functional-requirements.md
├── 11-non-functional-requirements.md
├── 12-product-stack.md
└── 13-acceptance-criteria.md
```

## Veredito

Este é o sweet spot porque cobre todas as camadas necessárias:

```txt
Produto
→ Escopo
→ Jornada
→ UX
→ Informação
→ Interação
→ UI
→ Design
→ Arquitetura de produto
→ Requisitos
→ Qualidade
→ Stack
→ Aceite
```

A regra de corte é simples:

> **Product define o que deve existir e como deve ser experienciado. Engineering define como isso será implementado de forma confiável.**

Esse set dá ao usuário a sensação correta: **“agora o produto existe no papel com clareza suficiente para ser construído.”**

---

perfeito, e para o próximo tópico, Engineering?

---

## Sweet spot para **04-engineering** ⚙️

Para **Engineering**, o objetivo é responder:

> **“Como este produto será implementado com arquitetura, dados, APIs, infraestrutura, testes, segurança, observabilidade e processos técnicos suficientes para ser confiável?”**

Meu sweet spot: **13 documentos + README**.

Menos que isso tende a deixar buracos técnicos.
Mais que isso começa a virar documentação operacional excessiva ou duplicar specs de implementação.

---

# Estrutura recomendada

```txt
04-engineering/
├── README.md
├── 01-engineering-brief.md
├── 02-system-architecture.md
├── 03-technical-stack.md
├── 04-domain-model.md
├── 05-data-model.md
├── 06-api-contracts.md
├── 07-integration-architecture.md
├── 08-security-and-privacy.md
├── 09-sync-and-state.md
├── 10-testing-strategy.md
├── 11-observability.md
├── 12-deployment-and-environments.md
├── 13-engineering-standards.md
└── 14-technical-risks.md
```

Esse conjunto cobre o essencial sem virar enciclopédia.

---

# Visão geral

| Documento                           | Pergunta central                       | Papel                      |
| ----------------------------------- | -------------------------------------- | -------------------------- |
| `README.md`                         | Como navegar Engineering?              | Índice                     |
| `01-engineering-brief.md`           | O que Engineering precisa entregar?    | Síntese técnica            |
| `02-system-architecture.md`         | Como o sistema é estruturado?          | Arquitetura macro          |
| `03-technical-stack.md`             | Quais tecnologias serão usadas?        | Stack real                 |
| `04-domain-model.md`                | Quais conceitos de domínio existem?    | Modelo conceitual técnico  |
| `05-data-model.md`                  | Como os dados são persistidos?         | Banco, entidades e eventos |
| `06-api-contracts.md`               | Como as partes se comunicam?           | APIs e contratos           |
| `07-integration-architecture.md`    | Como sistemas externos entram?         | Integrações                |
| `08-security-and-privacy.md`        | Como proteger dados e acesso?          | Segurança                  |
| `09-sync-and-state.md`              | Como estado e sincronização funcionam? | Estado, cache, offline     |
| `10-testing-strategy.md`            | Como provar que funciona?              | Testes                     |
| `11-observability.md`               | Como diagnosticar o sistema?           | Logs, métricas, tracing    |
| `12-deployment-and-environments.md` | Como rodar e publicar?                 | Ambientes e deploy         |
| `13-engineering-standards.md`       | Como o código deve ser escrito?        | Convenções                 |
| `14-technical-risks.md`             | O que pode quebrar tecnicamente?       | Riscos técnicos            |

---

# 1. `README.md` — Engineering Index

## Função

Explica o papel do eixo técnico.

Ele responde:

> **“Como a especificação de produto vira sistema implementável?”**

## Estrutura ideal

```md
# Engineering

This section defines how the product will be implemented, structured, integrated, tested, deployed, observed, secured, and maintained.

## Reading Order

1. Engineering Brief
2. System Architecture
3. Technical Stack
4. Domain Model
5. Data Model
6. API Contracts
7. Integration Architecture
8. Security and Privacy
9. Sync and State
10. Testing Strategy
11. Observability
12. Deployment and Environments
13. Engineering Standards
14. Technical Risks
```

---

# 2. `01-engineering-brief.md` — Engineering Brief

## Função

É a síntese executiva técnica.

Ele conecta Product com Engineering sem repetir Product.

## Perguntas centrais

* Que produto será implementado?
* Quais decisões de Product impactam engenharia?
* Quais são as restrições técnicas principais?
* Quais capacidades técnicas são obrigatórias?
* Qual é a estratégia técnica inicial?
* O que precisa estar pronto para a primeira versão?
* O que será deliberadamente adiado?

## Estrutura ideal

```md
# Engineering Brief

## Engineering Objective

## Product Inputs

## Technical Scope

## Engineering Constraints

## Core Technical Capabilities

## Initial Implementation Strategy

## Deferred Technical Decisions

## Engineering Success Criteria
```

## Por que existe?

Sem ele, Engineering começa direto em arquitetura e perde a ponte com o produto.

---

# 3. `02-system-architecture.md` — System Architecture

## Função

Define a arquitetura macro do sistema.

Ele responde:

> **“Quais são os blocos técnicos principais e como eles se relacionam?”**

## Perguntas centrais

* O sistema será monólito, modular monolith, serviços, serverless, local-first, offline-first?
* Quais camadas existem?
* Quais boundaries são rígidas?
* Como o client conversa com backend?
* Onde ficam regras de domínio?
* Onde ficam adapters?
* Onde ficam integrações externas?
* Como o sistema evolui sem acoplamento excessivo?

## Estrutura ideal

```md
# System Architecture

## Architecture Overview

## Architectural Style

## System Context

## Application Layers

## Module Boundaries

## Dependency Rules

## Runtime Architecture

## Data Flow

## Failure Modes

## Architecture Decisions

## Architecture Risks
```

## Exemplo de regra forte

```md
## Dependency Rule

The UI must depend on the application layer, not directly on infrastructure adapters.
```

Esse é o tipo de coisa que evita dívida estrutural cedo.

---

# 4. `03-technical-stack.md` — Technical Stack

## Função

Define a stack técnica real.

Diferença importante:

* `Product Stack` define escolhas que moldam o produto.
* `Technical Stack` define as tecnologias específicas de implementação.

## Perguntas centrais

* Qual linguagem?
* Qual runtime?
* Qual framework?
* Qual banco?
* Qual ORM/query builder?
* Qual sistema de autenticação?
* Qual infraestrutura?
* Qual ferramenta de build?
* Qual sistema de testes?
* Qual estratégia de package management?
* Quais versões mínimas/importantes?

## Estrutura ideal

```md
# Technical Stack

## Runtime

## Languages

## Frameworks

## Package Management

## Database

## Storage

## Authentication

## API Layer

## Background Jobs

## Testing Tools

## Deployment Platform

## Monitoring Tools

## Local Development Tools

## Version Constraints

## Stack Risks
```

## Observação

Este documento deve ser auditável.
“Usar React Native” é pouco. Melhor:

```txt
React Native via Expo SDK X
Expo Router
TypeScript
pnpm workspaces
SQLite local adapter
Postgres remote store
HTTP API
```

---

# 5. `04-domain-model.md` — Domain Model

## Função

Traduz o produto em conceitos técnicos de domínio.

Ele responde:

> **“Quais objetos, regras e invariantes existem no coração do sistema?”**

## Perguntas centrais

* Quais entidades de domínio existem?
* Quais agregados existem?
* Quais invariantes precisam ser preservadas?
* Quais regras independem da UI?
* Quais eventos de domínio existem?
* Quais comandos existem?
* Quais estados são válidos ou inválidos?
* Quais conceitos não devem ser misturados?

## Estrutura ideal

```md
# Domain Model

## Domain Overview

## Core Entities

## Value Objects

## Aggregates

## Domain Events

## Commands

## Invariants

## Business Rules

## State Machines

## Domain Boundaries

## Domain Risks
```

## Por que existe?

Sem domain model, o banco de dados vira o modelo mental do sistema.
Isso quase sempre degrada arquitetura.

---

# 6. `05-data-model.md` — Data Model

## Função

Define persistência e estrutura de dados.

Ele responde:

> **“Como os dados serão armazenados, relacionados, versionados e migrados?”**

## Perguntas centrais

* Quais tabelas/coleções existem?
* Quais relações existem?
* Quais índices são necessários?
* Quais constraints existem?
* Que dados são locais?
* Que dados são remotos?
* Como migrations funcionam?
* Como versionamento de schema funciona?
* Como soft delete, audit log ou eventos funcionam?
* Quais dados são sensíveis?

## Estrutura ideal

```md
# Data Model

## Data Storage Strategy

## Entity Relationship Overview

## Tables / Collections

## Fields

## Constraints

## Indexes

## Local Data

## Remote Data

## Migration Strategy

## Data Retention

## Data Sensitivity

## Data Model Risks
```

## Observação

Se o sistema for event-driven ou sync-heavy, o data model deve incluir:

```txt
- event envelope
- event payload
- cursor/checkpoint
- idempotency keys
- conflict metadata
- schema version
```

---

# 7. `06-api-contracts.md` — API Contracts

## Função

Define contratos entre partes do sistema.

Ele responde:

> **“Como client, backend, agentes, adapters e serviços conversam sem ambiguidade?”**

## Perguntas centrais

* Quais endpoints existem?
* Quais payloads entram e saem?
* Quais erros são possíveis?
* Como autenticação funciona nos contratos?
* Como paginação funciona?
* Como idempotência funciona?
* Como versionamento de API funciona?
* Quais contratos são públicos, internos ou privados?
* Como breaking changes serão tratados?

## Estrutura ideal

```md
# API Contracts

## API Strategy

## Public APIs

## Internal APIs

## Endpoint Register

## Request Formats

## Response Formats

## Error Model

## Pagination

## Idempotency

## Versioning

## Authentication Requirements

## Contract Testing

## API Risks
```

## Nota

Se houver OpenAPI, GraphQL schema ou tRPC, este documento pode apontar para artefatos formais:

```txt
api/openapi.yaml
schema.graphql
```

Mas ainda vale ter o `.md` explicando decisões e regras.

---

# 8. `07-integration-architecture.md` — Integration Architecture

## Função

Define como o sistema se conecta com terceiros.

## Perguntas centrais

* Quais integrações externas existem?
* Quais são obrigatórias?
* Quais são opcionais?
* Como autenticação externa funciona?
* Como lidar com rate limits?
* Como lidar com retries?
* Como lidar com webhooks?
* Como lidar com falhas externas?
* Quais integrações são mockáveis?
* Quais vendors podem ser substituídos?

## Estrutura ideal

```md
# Integration Architecture

## Integration Overview

## External Services

## Integration Boundaries

## Authentication with External Services

## Webhooks

## Rate Limits

## Retry Strategy

## Fallback Strategy

## Vendor Lock-in Risks

## Mocking Strategy

## Integration Risks
```

## Por que separado de API?

Porque API Contracts fala de **contratos do seu sistema**.
Integration Architecture fala de **dependência de sistemas externos**.

---

# 9. `08-security-and-privacy.md` — Security and Privacy

## Função

Define requisitos e decisões técnicas de proteção.

Ele responde:

> **“Como o sistema protege acesso, dados, identidade e privacidade?”**

## Perguntas centrais

* Como autenticação funciona?
* Como autorização funciona?
* Que dados são sensíveis?
* Como secrets são tratados?
* Como criptografia será usada?
* Como logs evitam vazar dados?
* Como backups são protegidos?
* Como exportação e deleção de dados funcionam?
* Que ameaças são relevantes?
* Que abusos precisam ser prevenidos?

## Estrutura ideal

```md
# Security and Privacy

## Security Objective

## Threat Model

## Authentication

## Authorization

## Data Classification

## Encryption

## Secrets Management

## Secure Logging

## Backup Security

## Data Export

## Data Deletion

## Abuse Prevention

## Security Testing

## Security Risks
```

## Observação crítica

Esse documento não pode ser “vamos usar login seguro”.
Precisa especificar decisões verificáveis.

---

# 10. `09-sync-and-state.md` — Sync and State

## Função

Define estado local, remoto, cache, sincronização e consistência.

Este documento só deve existir separado porque, em produtos modernos, isso costuma ser complexo o suficiente para merecer autonomia.

## Perguntas centrais

* O que é estado local?
* O que é estado remoto?
* O que é cache?
* O que é fonte da verdade?
* O produto funciona offline?
* O que pode ser capturado offline?
* Como sync funciona?
* Como conflitos são resolvidos?
* Como estado derivado é recalculado?
* Como invalidation funciona?
* Como hydrations funcionam?

## Estrutura ideal

```md
# Sync and State

## State Strategy

## Source of Truth

## Local State

## Remote State

## Cache Strategy

## Offline Behavior

## Sync Model

## Conflict Resolution

## Idempotency

## Hydration

## Derived State

## State Recovery

## Sync Risks
```

## Quando poderia ser removido?

Se o produto for web simples, online-only, sem estado local relevante, esse documento pode ser absorvido por `02-system-architecture.md`.

Mas para mobile, agentes, sync engine, offline-first ou dados financeiros, ele merece existir. ⚠️

---

# 11. `10-testing-strategy.md` — Testing Strategy

## Função

Define como o sistema será verificado tecnicamente.

Ele responde:

> **“Como saberemos que o sistema funciona, continua funcionando e não quebrou silenciosamente?”**

## Perguntas centrais

* Quais testes são obrigatórios?
* O que será testado por unidade?
* O que será testado por integração?
* O que será testado end-to-end?
* Como testar domínio?
* Como testar APIs?
* Como testar sync?
* Como testar UI crítica?
* Como testar regressão?
* Quais testes bloqueiam merge ou release?

## Estrutura ideal

```md
# Testing Strategy

## Testing Objective

## Test Pyramid

## Unit Tests

## Integration Tests

## End-to-End Tests

## Contract Tests

## Domain Tests

## Sync Tests

## Security Tests

## Performance Tests

## Regression Strategy

## CI Requirements

## Release Gates

## Testing Risks
```

## Observação

Este documento não é lista de casos de teste detalhada.
Ele define estratégia, cobertura e gates.

Casos específicos podem viver depois em:

```txt
tests/
qa/
specs/
```

---

# 12. `11-observability.md` — Observability

## Função

Define como o sistema será entendido em produção.

Ele responde:

> **“Quando algo falhar, como saberemos o que aconteceu?”**

## Perguntas centrais

* Quais logs existem?
* Quais métricas importam?
* Quais eventos técnicos são rastreados?
* Quais erros são capturados?
* Como tracing funciona?
* Quais dashboards são necessários?
* Quais alertas existem?
* Como evitar logging de dados sensíveis?
* Como correlacionar client/backend/sync?
* Quais SLOs técnicos existem?

## Estrutura ideal

```md
# Observability

## Observability Objective

## Logging Strategy

## Metrics Strategy

## Tracing Strategy

## Error Reporting

## Audit Events

## Health Checks

## Dashboards

## Alerts

## SLOs

## Sensitive Data Rules

## Observability Risks
```

## Por que não deixar para Operations?

Porque instrumentation precisa ser desenhada na engenharia.
Operations usa observabilidade; Engineering constrói observabilidade.

---

# 13. `12-deployment-and-environments.md` — Deployment and Environments

## Função

Define ambientes, release e deploy.

## Perguntas centrais

* Quais ambientes existem?
* Como local development funciona?
* Como staging funciona?
* Como produção funciona?
* Como secrets diferem por ambiente?
* Como migrations são aplicadas?
* Como rollback funciona?
* Como releases são versionadas?
* Como feature flags entram?
* Como builds são gerados?

## Estrutura ideal

```md
# Deployment and Environments

## Environment Strategy

## Local Development

## Preview Environments

## Staging

## Production

## Environment Variables

## Secrets Per Environment

## Build Process

## Migration Process

## Release Process

## Rollback Strategy

## Feature Flags

## Deployment Risks
```

## Fronteira com Operations

Engineering define **como publicar tecnicamente**.
Operations define **como operar continuamente**.

---

# 14. `13-engineering-standards.md` — Engineering Standards

## Função

Define padrões de código, repositório e colaboração técnica.

Ele responde:

> **“Como manter consistência técnica enquanto o sistema cresce?”**

## Perguntas centrais

* Como o código deve ser organizado?
* Quais convenções de naming?
* Quais regras de TypeScript?
* Como commits são feitos?
* Como PRs são revisados?
* Como errors são modelados?
* Como logs são escritos?
* Como dependências são adicionadas?
* Como migrations são revisadas?
* Como documentação técnica é atualizada?

## Estrutura ideal

```md
# Engineering Standards

## Repository Structure

## Code Organization

## Naming Conventions

## Type Safety

## Error Handling

## Logging Conventions

## Dependency Management

## Migration Rules

## Git Workflow

## Pull Request Rules

## Documentation Rules

## Review Checklist

## Standards Risks
```

## Observação

Esse documento evita que o repo dependa de “bom senso”.
Bom senso não escala. 🧊

---

# 15. `14-technical-risks.md` — Technical Risks

## Função

Centraliza riscos técnicos.

Ele responde:

> **“O que pode tornar o sistema difícil, caro, instável ou inviável?”**

## Perguntas centrais

* Quais decisões técnicas são incertas?
* Quais dependências são perigosas?
* Quais partes podem não escalar?
* Quais partes podem ser caras?
* Quais partes podem gerar lock-in?
* Quais riscos de segurança existem?
* Quais riscos de performance existem?
* Quais riscos de manutenção existem?
* Quais riscos precisam de spike técnico?

## Estrutura ideal

```md
# Technical Risks

## Risk Register

## Architecture Risks

## Data Risks

## Sync Risks

## Security Risks

## Performance Risks

## Integration Risks

## Vendor Risks

## Maintenance Risks

## Required Technical Spikes

## Risk Mitigation Plan
```

## Formato recomendado

```md
## TR-001: [Risk Name]

### Category

Architecture / Data / Security / Performance / Integration / Vendor / Maintenance

### Description

### Likelihood

Low / Medium / High

### Impact

Low / Medium / High

### Detection Signal

### Mitigation

### Owner

### Status
```

---

# Agrupamento conceitual

Para não parecer uma lista longa, organize mentalmente Engineering em 5 blocos:

```txt
A. Direção técnica
├── 01-engineering-brief.md
├── 02-system-architecture.md
└── 03-technical-stack.md

B. Modelo e contratos
├── 04-domain-model.md
├── 05-data-model.md
├── 06-api-contracts.md
└── 07-integration-architecture.md

C. Confiabilidade e segurança
├── 08-security-and-privacy.md
├── 09-sync-and-state.md
├── 10-testing-strategy.md
└── 11-observability.md

D. Entrega técnica
├── 12-deployment-and-environments.md
└── 13-engineering-standards.md

E. Controle de risco
└── 14-technical-risks.md
```

Isso dá sensação de sistema, não de checklist inchado.

---

# O que eu **não** colocaria em Engineering

Eu evitaria estes documentos aqui:

```txt
feature-roadmap.md
marketing-site.md
sales-funnel.md
support-playbook.md
incident-response.md
hiring-plan.md
pricing.md
analytics-report.md
customer-success.md
```

## Melhor lugar

| Documento tentador     | Melhor eixo               |
| ---------------------- | ------------------------- |
| `feature-roadmap.md`   | Roadmap / Product         |
| `marketing-site.md`    | Go-to-market              |
| `sales-funnel.md`      | Go-to-market              |
| `support-playbook.md`  | Operations                |
| `incident-response.md` | Operations                |
| `hiring-plan.md`       | Operations                |
| `pricing.md`           | Validation / Go-to-market |
| `analytics-report.md`  | Operations                |
| `customer-success.md`  | Operations                |

---

# Ponto sensível: `sync-and-state.md`

Esse documento é o mais condicional do set.

## Manter separado quando houver

```txt
- mobile app;
- offline-first;
- local database;
- sync engine;
- event sourcing;
- cache complexo;
- agentes;
- múltiplos clientes;
- colaboração;
- dados financeiros;
- dados que precisam sobreviver sem rede.
```

## Absorver em `system-architecture.md` quando for

```txt
- web app simples;
- online-only;
- backend como única fonte de verdade;
- cache trivial;
- sem estado local relevante.
```

Para o teu contexto, eu manteria separado. Especialmente por causa de **mobile**, **eventos**, **sync**, **Logos/Synaxis/Oikonomia** e múltiplas superfícies futuras.

---

# Diferença entre Product Architecture e System Architecture

Essa separação precisa ficar explícita.

## Product Architecture

```txt
Quais capacidades existem?
Como o produto é dividido para o usuário?
Quais módulos de produto fazem sentido?
```

Exemplo:

```txt
Chat
Decisions
Plans
Transactions
Insights
Settings
```

## System Architecture

```txt
Como o software implementa essas capacidades?
Quais camadas existem?
Quais dependências são permitidas?
Como dados fluem?
Como módulos técnicos se comunicam?
```

Exemplo:

```txt
UI → Application Layer → Domain Kit → Ports → Infrastructure Adapters
```

As duas arquiteturas se conectam, mas não são a mesma coisa.

---

# Recomendação final

```txt
04-engineering/
├── README.md
├── 01-engineering-brief.md
├── 02-system-architecture.md
├── 03-technical-stack.md
├── 04-domain-model.md
├── 05-data-model.md
├── 06-api-contracts.md
├── 07-integration-architecture.md
├── 08-security-and-privacy.md
├── 09-sync-and-state.md
├── 10-testing-strategy.md
├── 11-observability.md
├── 12-deployment-and-environments.md
├── 13-engineering-standards.md
└── 14-technical-risks.md
```

## Veredito

Este é o sweet spot porque cobre o ciclo técnico completo:

```txt
Arquitetura
→ Stack
→ Domínio
→ Dados
→ APIs
→ Integrações
→ Segurança
→ Estado/sync
→ Testes
→ Observabilidade
→ Deploy
→ Padrões
→ Riscos
```

A regra de corte:

> **Engineering deve documentar tudo que afeta a construção confiável do sistema, mas não deve assumir a operação contínua do negócio.**

Esse set deixa o projeto pronto para virar repositório, monorepo, packages, APIs, testes, deploy e manutenção técnica sem transformar a pasta em burocracia morta.

---

vamos ao próximo, Go To Market!

---

## Sweet spot para **05-go-to-market** 🚀

Para **Go-to-market**, o objetivo é responder:

> **“Como este produto chega ao mercado certo, com uma mensagem clara, por canais viáveis, convertendo usuários/clientes de forma mensurável?”**

Meu sweet spot: **12 documentos + README**.

Menos que isso deixa buracos em posicionamento, canais, lançamento ou conversão.
Mais que isso começa a virar operação comercial pesada demais para esta fase.

---

# Estrutura recomendada

```txt
05-go-to-market/
├── README.md
├── 01-go-to-market-brief.md
├── 02-market-definition.md
├── 03-positioning.md
├── 04-messaging.md
├── 05-customer-segments.md
├── 06-channel-strategy.md
├── 07-launch-plan.md
├── 08-conversion-funnel.md
├── 09-sales-strategy.md
├── 10-pricing-and-packaging.md
├── 11-marketing-assets.md
├── 12-growth-metrics.md
└── 13-go-to-market-risks.md
```

---

# Visão geral

| Documento                     | Pergunta central                       | Papel              |
| ----------------------------- | -------------------------------------- | ------------------ |
| `README.md`                   | Como navegar GTM?                      | Índice             |
| `01-go-to-market-brief.md`    | Qual é a estratégia comercial geral?   | Síntese            |
| `02-market-definition.md`     | Em que mercado estamos entrando?       | Contexto           |
| `03-positioning.md`           | Como queremos ser percebidos?          | Posição            |
| `04-messaging.md`             | O que dizemos e como dizemos?          | Comunicação        |
| `05-customer-segments.md`     | Quem comprará, usará e decidirá?       | Segmentação        |
| `06-channel-strategy.md`      | Por onde chegaremos ao cliente?        | Aquisição          |
| `07-launch-plan.md`           | Como lançar?                           | Entrada no mercado |
| `08-conversion-funnel.md`     | Como converter atenção em uso/receita? | Funil              |
| `09-sales-strategy.md`        | Como vender?                           | Vendas             |
| `10-pricing-and-packaging.md` | Como empacotar e cobrar?               | Monetização        |
| `11-marketing-assets.md`      | Que materiais precisam existir?        | Ativos             |
| `12-growth-metrics.md`        | Como medir tração?                     | Métricas           |
| `13-go-to-market-risks.md`    | O que pode falhar no mercado?          | Riscos             |

---

# 1. `README.md` — Go-to-market Index

## Função

Explica como a pasta GTM transforma produto em entrada de mercado.

```md
# Go-to-market

This section defines how the product reaches its target market, communicates its value, acquires users or customers, converts demand, launches publicly, and measures commercial traction.

## Reading Order

1. Go-to-market Brief
2. Market Definition
3. Positioning
4. Messaging
5. Customer Segments
6. Channel Strategy
7. Launch Plan
8. Conversion Funnel
9. Sales Strategy
10. Pricing and Packaging
11. Marketing Assets
12. Growth Metrics
13. Go-to-market Risks
```

---

# 2. `01-go-to-market-brief.md` — GTM Brief

## Função

É a síntese executiva do eixo comercial.

Responde:

> **“Qual é a tese de entrada no mercado?”**

## Estrutura ideal

```md
# Go-to-market Brief

## GTM Objective

## Product Context

## Target Market

## Primary Customer

## Core Positioning

## Primary Channel

## Launch Strategy

## Revenue Motion

## GTM Success Criteria
```

## Por que existe?

Sem ele, os documentos de mercado viram peças soltas: canal, mensagem, preço e lançamento sem tese comum.

---

# 3. `02-market-definition.md` — Definição de Mercado

## Função

Define o mercado onde o produto compete.

Não precisa ser um relatório gigante de mercado.
Precisa responder com clareza:

> **“Em qual categoria este produto será compreendido?”**

## Perguntas centrais

* Qual é o mercado primário?
* Qual é o mercado secundário?
* Qual categoria o usuário usaria para comparar o produto?
* Quais alternativas existem?
* Que comportamento atual estamos substituindo?
* O mercado é existente, emergente ou precisa ser educado?
* Qual é o timing?

## Estrutura ideal

```md
# Market Definition

## Market Category

## Primary Market

## Secondary Markets

## Existing Alternatives

## Substitute Behaviors

## Market Maturity

## Timing Rationale

## Market Constraints

## Market Risks
```

## Observação crítica

Aqui entram concorrentes e alternativas, mas sem virar `competitor-analysis.md` separado ainda.

O mais importante é entender **categoria mental**, não listar players.

---

# 4. `03-positioning.md` — Posicionamento

## Função

Define como o produto deve ser percebido em relação às alternativas.

Responde:

> **“Por que este produto é diferente, relevante e preferível?”**

## Estrutura ideal

```md
# Positioning

## Positioning Statement

## Category

## Target Customer

## Primary Pain

## Unique Value

## Differentiators

## Alternatives

## Reasons to Believe

## Positioning Anti-Patterns
```

## Fórmula útil

```txt
For [target customer],
who struggles with [problem],
[product] is a [category]
that provides [unique value],
unlike [alternative],
because [reason to believe].
```

## Por que não é redundante com Foundation?

Foundation responde **por que existe**.
Positioning responde **como deve ser entendido pelo mercado**.

---

# 5. `04-messaging.md` — Mensagem

## Função

Transforma posicionamento em linguagem.

Responde:

> **“O que dizemos para o mercado sem distorcer o produto?”**

## Estrutura ideal

```md
# Messaging

## Messaging Objective

## Core Message

## One-liner

## Short Description

## Long Description

## Pain Messages

## Outcome Messages

## Objection Responses

## Proof Points

## Tone and Voice

## Forbidden Claims
```

## Diferença entre posicionamento e mensagem

| Documento        | Natureza                |
| ---------------- | ----------------------- |
| `positioning.md` | Estratégia de percepção |
| `messaging.md`   | Linguagem pública       |

## Exemplo

Posicionamento:

```txt
A decision-support finance app for people who need clarity before spending.
```

Mensagem:

```txt
Know whether a purchase fits your real financial life before you make it.
```

---

# 6. `05-customer-segments.md` — Segmentos de Cliente

## Função

Refina público para aquisição, venda e comunicação.

Product já definiu usuário.
GTM precisa definir cliente comercial.

## Perguntas centrais

* Quem usa?
* Quem paga?
* Quem decide?
* Quem influencia?
* Quem bloqueia?
* Qual segmento vem primeiro?
* Qual segmento deve ser evitado no início?
* Qual segmento tem maior urgência?
* Qual segmento tem melhor CAC/LTV?

## Estrutura ideal

```md
# Customer Segments

## Segment Overview

## Primary Segment

## Secondary Segments

## Early Adopters

## Buyers

## Users

## Decision Makers

## Influencers

## Segment Prioritization

## Excluded Segments

## Segment Risks
```

## Observação importante

Este documento evita um erro clássico:

> Confundir usuário interessado com cliente economicamente viável.

---

# 7. `06-channel-strategy.md` — Estratégia de Canais

## Função

Define por onde o produto chegará ao mercado.

Responde:

> **“Como pessoas certas descobrirão este produto?”**

## Perguntas centrais

* Quais canais serão testados?
* Qual será o canal primário?
* Quais canais são orgânicos?
* Quais são pagos?
* Quais dependem de comunidade?
* Quais dependem de vendas?
* Quais são viáveis com os recursos atuais?
* Quais canais não combinam com o produto?

## Estrutura ideal

```md
# Channel Strategy

## Channel Objective

## Primary Channel

## Secondary Channels

## Organic Channels

## Paid Channels

## Partnership Channels

## Community Channels

## Sales Channels

## Channel Experiments

## Channel Constraints

## Channel Risks
```

## Exemplos de canais

```txt
- SEO
- Conteúdo
- Comunidade
- YouTube
- Newsletter
- Product Hunt
- App Store
- GitHub
- LinkedIn
- Parcerias
- Afiliados
- Vendas diretas
- Marketplaces
- Indicações
- Eventos
```

---

# 8. `07-launch-plan.md` — Plano de Lançamento

## Função

Define a entrada inicial no mercado.

Não é roadmap de produto.
É plano de exposição controlada.

## Perguntas centrais

* Qual tipo de lançamento será feito?
* Beta fechado?
* Beta público?
* Waitlist?
* Soft launch?
* Lançamento público?
* Quem terá acesso primeiro?
* Quais materiais precisam estar prontos?
* Qual é o critério de sucesso do lançamento?
* O que acontece depois do lançamento?

## Estrutura ideal

```md
# Launch Plan

## Launch Objective

## Launch Type

## Launch Audience

## Pre-launch Phase

## Launch Phase

## Post-launch Phase

## Launch Assets

## Launch Checklist

## Launch Success Criteria

## Launch Risks
```

## Tipos de lançamento

| Tipo          | Quando usar                                       |
| ------------- | ------------------------------------------------- |
| Waitlist      | Quando ainda precisa medir demanda                |
| Beta fechado  | Quando precisa aprender com poucos usuários       |
| Beta público  | Quando estabilidade já é aceitável                |
| Soft launch   | Quando quer testar canal sem grande exposição     |
| Public launch | Quando produto, suporte e conversão estão prontos |

---

# 9. `08-conversion-funnel.md` — Funil de Conversão

## Função

Define como atenção vira ativação, uso e receita.

Responde:

> **“Qual caminho leva alguém de desconhecido a usuário ou cliente?”**

## Estrutura ideal

```md
# Conversion Funnel

## Funnel Objective

## Awareness

## Acquisition

## Activation

## Engagement

## Conversion

## Retention

## Referral

## Funnel Events

## Drop-off Risks

## Funnel Metrics
```

## Exemplo de funil

```txt
Visit landing page
→ Join waitlist
→ Receive invite
→ Complete onboarding
→ First meaningful action
→ Return within 7 days
→ Start trial
→ Convert to paid
→ Retain after first billing cycle
```

## Por que existe?

Sem funil, GTM vira “postar conteúdo e torcer”.
Com funil, aquisição e conversão viram sistema.

---

# 10. `09-sales-strategy.md` — Estratégia de Vendas

## Função

Define se haverá venda ativa e como ela funciona.

Nem todo produto precisa de sales motion pesado.
Mas todo produto precisa decidir isso explicitamente.

## Perguntas centrais

* Produto será self-serve, sales-led, product-led, founder-led ou híbrido?
* Existe venda consultiva?
* Existe plano enterprise?
* Como leads serão qualificados?
* Que objeções aparecem?
* Como demos funcionam?
* Quem decide compra?
* Qual ciclo de vendas esperado?
* Que materiais comerciais são necessários?

## Estrutura ideal

```md
# Sales Strategy

## Sales Motion

## Self-Serve Sales

## Founder-Led Sales

## Sales-Led Motion

## Lead Qualification

## Sales Process

## Objection Handling

## Demo Strategy

## Sales Assets

## Sales Risks
```

## Observação

Para B2C simples, este documento pode ser curto.
Para B2B, ele é central.

---

# 11. `10-pricing-and-packaging.md` — Pricing and Packaging

## Função

Transforma modelo econômico e modelo de negócios em oferta vendável.

Validation respondeu:

```txt
A conta pode fechar?
```

GTM responde:

```txt
Como a oferta será apresentada e comprada?
```

## Estrutura ideal

```md
# Pricing and Packaging

## Pricing Objective

## Pricing Model

## Packages

## Plan Structure

## Free / Trial Strategy

## Subscription Terms

## Discounts

## Payment Flow

## Upgrade and Downgrade Logic

## Cancellation Logic

## Pricing Objections

## Pricing Risks
```

## Diferença para `economic-model.md`

| Documento                  | Pergunta                        |
| -------------------------- | ------------------------------- |
| `economic-model.md`        | O preço sustenta a operação?    |
| `pricing-and-packaging.md` | Como o preço vira oferta clara? |

## Exemplo

```txt
Trial de 14 dias
→ Plano mensal
→ Plano anual com desconto
→ Sem plano gratuito permanente
```

Isso pertence muito mais a GTM do que a Product.

---

# 12. `11-marketing-assets.md` — Ativos de Marketing

## Função

Lista e especifica os materiais necessários para mercado.

Responde:

> **“Que peças precisam existir para lançar, comunicar e vender?”**

## Estrutura ideal

```md
# Marketing Assets

## Asset Inventory

## Landing Page

## Website Copy

## Email Sequences

## Social Posts

## Demo Script

## Product Screenshots

## Explainer Video

## Pitch Materials

## Press Kit

## App Store / Marketplace Listing

## Asset Readiness Checklist
```

## Observação

Este documento não precisa conter todo o texto final de cada peça.
Ele define o inventário e os critérios.

As peças podem viver em subpastas depois:

```txt
05-go-to-market/assets/
├── landing-page.md
├── launch-email-sequence.md
├── demo-script.md
└── app-store-listing.md
```

---

# 13. `12-growth-metrics.md` — Métricas de Crescimento

## Função

Define como medir tração comercial.

Responde:

> **“Quais sinais indicam que o mercado está respondendo?”**

## Estrutura ideal

```md
# Growth Metrics

## Growth Objective

## North Star Metric

## Acquisition Metrics

## Activation Metrics

## Conversion Metrics

## Retention Metrics

## Referral Metrics

## Revenue Metrics

## Channel Metrics

## Cohort Metrics

## Reporting Cadence

## Metric Risks
```

## Métricas possíveis

```txt
- Visitors
- Waitlist conversion
- Signup conversion
- Activation rate
- Trial start rate
- Trial-to-paid rate
- CAC
- LTV
- Payback period
- Churn
- Retention
- Referral rate
- MRR
- ARR
- ARPU
- Revenue per channel
```

## Cuidado

Métrica demais vira ruído.
O documento deve forçar uma hierarquia:

```txt
North Star
→ 3 a 5 métricas primárias
→ métricas diagnósticas secundárias
```

---

# 14. `13-go-to-market-risks.md` — Riscos de Mercado

## Função

Centraliza riscos comerciais, comunicacionais e de aquisição.

## Estrutura ideal

```md
# Go-to-market Risks

## Risk Register

## Market Risks

## Positioning Risks

## Messaging Risks

## Channel Risks

## Launch Risks

## Sales Risks

## Pricing Risks

## Competitive Risks

## Trust Risks

## Mitigation Plan
```

## Formato recomendado

```md
## GTMR-001: [Risk Name]

### Category

Market / Positioning / Messaging / Channel / Launch / Sales / Pricing / Competitive / Trust

### Description

### Likelihood

Low / Medium / High

### Impact

Low / Medium / High

### Detection Signal

### Mitigation

### Status
```

---

# Agrupamento conceitual

Para o usuário perceber que não é redundante, eu agruparia assim:

```txt
A. Estratégia de mercado
├── 01-go-to-market-brief.md
├── 02-market-definition.md
├── 03-positioning.md
└── 04-messaging.md

B. Cliente e canal
├── 05-customer-segments.md
├── 06-channel-strategy.md
└── 08-conversion-funnel.md

C. Lançamento e venda
├── 07-launch-plan.md
├── 09-sales-strategy.md
├── 10-pricing-and-packaging.md
└── 11-marketing-assets.md

D. Medição e risco
├── 12-growth-metrics.md
└── 13-go-to-market-risks.md
```

---

# O que eu **não** colocaria em Go-to-market

Eu evitaria estes documentos no sweet spot inicial:

```txt
brand-book.md
content-calendar.md
seo-plan.md
social-media-plan.md
paid-ads-plan.md
partnership-playbook.md
customer-success-playbook.md
support-playbook.md
fundraising-strategy.md
investor-deck.md
```

## Melhor lugar

| Documento tentador             | Melhor lugar                        |
| ------------------------------ | ----------------------------------- |
| `brand-book.md`                | Product / Design ou Brand separado  |
| `content-calendar.md`          | Operations / Marketing execution    |
| `seo-plan.md`                  | GTM appendix ou Operations          |
| `social-media-plan.md`         | Operations                          |
| `paid-ads-plan.md`             | Operations / Marketing execution    |
| `partnership-playbook.md`      | Operations / BD                     |
| `customer-success-playbook.md` | Operations                          |
| `support-playbook.md`          | Operations                          |
| `fundraising-strategy.md`      | Operations / Corporate              |
| `investor-deck.md`             | Artifact derivado do Business Model |

---

# Ponto sensível: `pricing-and-packaging.md`

Você já colocou validação econômica e modelo de negócios em **Validation**. Mesmo assim, eu manteria `pricing-and-packaging.md` em GTM.

## Não é redundante

### Em Validation

```txt
R$ 49/mês permite margem positiva?
Quantos clientes precisamos para break-even?
Qual churn máximo é tolerável?
```

### Em GTM

```txt
Como esse preço aparece para o cliente?
Existe trial?
Existem planos?
Existe anual?
Existe pacote enterprise?
Como comunicar valor antes do preço?
```

Um valida a viabilidade.
O outro empacota a venda.

---

# Ponto sensível: `market-definition.md` vs `customer-segments.md`

Também não são redundantes.

## `market-definition.md`

Define o espaço competitivo:

```txt
Estamos competindo com apps financeiros, planilhas, consultores, bancos ou assistentes pessoais?
```

## `customer-segments.md`

Define quem será priorizado:

```txt
Profissionais autônomos?
Famílias?
Casais?
Pessoas endividadas?
Usuários premium?
Pequenas empresas?
```

Categoria e segmento precisam conversar, mas são dimensões diferentes.

---

# Recomendação final

```txt
05-go-to-market/
├── README.md
├── 01-go-to-market-brief.md
├── 02-market-definition.md
├── 03-positioning.md
├── 04-messaging.md
├── 05-customer-segments.md
├── 06-channel-strategy.md
├── 07-launch-plan.md
├── 08-conversion-funnel.md
├── 09-sales-strategy.md
├── 10-pricing-and-packaging.md
├── 11-marketing-assets.md
├── 12-growth-metrics.md
└── 13-go-to-market-risks.md
```

## Veredito

Esse é o sweet spot porque cobre o arco completo:

```txt
Mercado
→ Posicionamento
→ Mensagem
→ Segmento
→ Canal
→ Lançamento
→ Funil
→ Vendas
→ Oferta
→ Ativos
→ Métricas
→ Riscos
```

A regra de corte:

> **Go-to-market documenta como o produto entra no mercado e gera tração; Operations documenta como essa máquina roda continuamente.**

Com esse set, o usuário percebe que o produto não está apenas “pronto para construir”.
Ele está pronto para ser **apresentado, lançado, vendido, medido e ajustado no mercado**.

---

E finalmente, Operations

---

## Sweet spot para **06-operations** 🧭

Para **Operations**, o objetivo é responder:

> **“Como este produto/negócio será mantido, monitorado, suportado, governado e melhorado continuamente depois que estiver no mundo?”**

Aqui termina o eixo normativo.
Depois disso, o projeto já tem:

```txt
Foundation → por que existe
Validation → por que merece avançar
Product → o que será construído
Engineering → como será construído
Go-to-market → como chegará ao mercado
Operations → como continuará vivo
```

Meu sweet spot para **Operations**: **13 documentos + README**.

Menos que isso deixa buracos em suporte, governança, métricas, incidentes ou rotinas.
Mais que isso começa a virar manual corporativo pesado demais.

---

# Estrutura recomendada

```txt
06-operations/
├── README.md
├── 01-operations-brief.md
├── 02-operating-model.md
├── 03-team-and-responsibilities.md
├── 04-customer-support.md
├── 05-customer-success.md
├── 06-business-processes.md
├── 07-operational-metrics.md
├── 08-reporting-and-cadence.md
├── 09-incident-management.md
├── 10-risk-and-compliance.md
├── 11-financial-operations.md
├── 12-knowledge-management.md
├── 13-continuous-improvement.md
└── 14-operational-risks.md
```

---

# Visão geral

| Documento                         | Pergunta central                               | Papel               |
| --------------------------------- | ---------------------------------------------- | ------------------- |
| `README.md`                       | Como navegar Operations?                       | Índice              |
| `01-operations-brief.md`          | O que Operations precisa garantir?             | Síntese             |
| `02-operating-model.md`           | Como o negócio/produto opera no dia a dia?     | Modelo operacional  |
| `03-team-and-responsibilities.md` | Quem faz o quê?                                | Responsabilidades   |
| `04-customer-support.md`          | Como problemas de usuários são tratados?       | Suporte             |
| `05-customer-success.md`          | Como garantir valor contínuo ao cliente?       | Retenção            |
| `06-business-processes.md`        | Quais processos recorrentes existem?           | Rotinas             |
| `07-operational-metrics.md`       | Como medir saúde operacional?                  | Métricas            |
| `08-reporting-and-cadence.md`     | Com que frequência revisar o quê?              | Ritmo de gestão     |
| `09-incident-management.md`       | Como responder a falhas?                       | Incidentes          |
| `10-risk-and-compliance.md`       | Como lidar com risco, regras e obrigações?     | Governança          |
| `11-financial-operations.md`      | Como dinheiro, cobrança e custos são operados? | FinOps / receita    |
| `12-knowledge-management.md`      | Como conhecimento é preservado?                | Memória operacional |
| `13-continuous-improvement.md`    | Como melhorar sem caos?                        | Evolução            |
| `14-operational-risks.md`         | O que pode quebrar a operação?                 | Riscos              |

---

# 1. `README.md` — Operations Index

## Função

Explica como Operations fecha o sistema.

```md
# Operations

This section defines how the product, business, customers, revenue, support, risks, reporting, knowledge, and continuous improvement are operated after launch.

## Reading Order

1. Operations Brief
2. Operating Model
3. Team and Responsibilities
4. Customer Support
5. Customer Success
6. Business Processes
7. Operational Metrics
8. Reporting and Cadence
9. Incident Management
10. Risk and Compliance
11. Financial Operations
12. Knowledge Management
13. Continuous Improvement
14. Operational Risks
```

---

# 2. `01-operations-brief.md` — Operations Brief

## Função

Síntese executiva da operação.

Responde:

> **“O que precisa funcionar continuamente para o projeto permanecer saudável?”**

## Estrutura ideal

```md
# Operations Brief

## Operations Objective

## Product Context

## Business Context

## Operational Scope

## Critical Operational Functions

## Service Expectations

## Operational Constraints

## Operational Success Criteria
```

## Por que existe?

Sem esse documento, Operations vira uma coleção de manuais.
Com ele, fica claro o que a operação precisa proteger.

---

# 3. `02-operating-model.md` — Operating Model

## Função

Define como o projeto funciona no dia a dia.

É o documento central de Operations.

## Perguntas centrais

* Como o produto será operado?
* Quais funções operacionais existem?
* Quais rotinas são obrigatórias?
* O que é manual?
* O que é automatizado?
* O que depende de terceiros?
* O que precisa ser revisado periodicamente?
* Quais decisões operacionais são recorrentes?

## Estrutura ideal

```md
# Operating Model

## Operating Principles

## Core Operational Functions

## Manual Operations

## Automated Operations

## Third-Party Dependencies

## Operational Workflows

## Decision Points

## Escalation Paths

## Operating Constraints

## Operating Model Risks
```

## Diferença para Engineering

Engineering define:

```txt
Como o sistema é construído e publicado.
```

Operations define:

```txt
Como o sistema é mantido, monitorado, suportado e melhorado.
```

---

# 4. `03-team-and-responsibilities.md` — Time e Responsabilidades

## Função

Define ownership.

Mesmo em projeto solo, isso importa.
A diferença é que os papéis são ocupados pela mesma pessoa no início.

## Perguntas centrais

* Quais papéis existem?
* Quem é responsável por suporte?
* Quem decide produto?
* Quem responde incidentes?
* Quem cuida de finanças?
* Quem revisa métricas?
* Quem aprova mudanças críticas?
* Como responsabilidades mudam quando o time cresce?

## Estrutura ideal

```md
# Team and Responsibilities

## Responsibility Model

## Current Team

## Operational Roles

## Product Responsibilities

## Engineering Responsibilities

## Support Responsibilities

## Commercial Responsibilities

## Financial Responsibilities

## Decision Authority

## Escalation Rules

## Future Hiring Needs
```

## Observação crítica

Esse documento impede o autoengano clássico:

> “Está tudo sob controle” = ninguém sabe quem é dono de nada.

---

# 5. `04-customer-support.md` — Customer Support

## Função

Define como dúvidas, problemas e reclamações são tratadas.

## Perguntas centrais

* Quais canais de suporte existem?
* Qual tempo de resposta esperado?
* Quais tipos de tickets existem?
* Como priorizar problemas?
* Como responder reclamações?
* Como bugs reportados viram trabalho técnico?
* Como suporte alimenta Product?
* O que não será suportado?

## Estrutura ideal

```md
# Customer Support

## Support Objective

## Support Channels

## Support Scope

## Ticket Categories

## Priority Levels

## Response Time Targets

## Escalation Rules

## Bug Reporting Flow

## Refund and Billing Support

## Support Macros / Templates

## Unsupported Requests

## Support Risks
```

## Exemplo de categorias

```txt
- Account
- Billing
- Bug
- Feature request
- Usability issue
- Data issue
- Security concern
- Cancellation
```

---

# 6. `05-customer-success.md` — Customer Success

## Função

Define como garantir que usuários/clientes obtenham valor contínuo.

Support é reativo.
Customer Success é proativo.

## Perguntas centrais

* Como saber se o usuário está obtendo valor?
* Qual é o momento de ativação?
* Como onboarding continua depois do signup?
* Como reduzir churn?
* Como identificar usuários em risco?
* Como incentivar expansão ou upgrade?
* Como coletar feedback útil?
* Como medir satisfação?

## Estrutura ideal

```md
# Customer Success

## Customer Success Objective

## Activation Milestones

## Onboarding Follow-up

## Health Signals

## At-Risk User Signals

## Retention Actions

## Expansion Opportunities

## Feedback Loops

## Satisfaction Measurement

## Churn Prevention

## Customer Success Risks
```

## Diferença para GTM

GTM converte.
Customer Success retém e expande.

---

# 7. `06-business-processes.md` — Business Processes

## Função

Define processos recorrentes do negócio.

Responde:

> **“Quais operações precisam acontecer de forma repetível?”**

## Estrutura ideal

```md
# Business Processes

## Process Inventory

## User Onboarding Process

## Billing Process

## Cancellation Process

## Refund Process

## Feature Request Process

## Bug Triage Process

## Release Communication Process

## Vendor Management Process

## Data Export / Deletion Process

## Process Review
```

## Por que existe?

Sem processos, tudo vira caso especial.
Caso especial demais destrói operação.

---

# 8. `07-operational-metrics.md` — Operational Metrics

## Função

Define métricas de saúde operacional.

Não é Growth Metrics.
Aqui o foco é estabilidade, suporte, qualidade, custo e eficiência.

## Estrutura ideal

```md
# Operational Metrics

## Operational Health Objective

## Support Metrics

## Reliability Metrics

## Quality Metrics

## Financial Operations Metrics

## Customer Success Metrics

## Process Metrics

## Cost Metrics

## SLA / SLO Metrics

## Metric Review Rules
```

## Exemplos

```txt
- Ticket volume
- First response time
- Resolution time
- Bug reopen rate
- Incident count
- Uptime
- Error rate
- Churn
- Refund rate
- Failed payments
- Support cost per customer
- Infrastructure cost per active user
- Manual intervention rate
```

## Diferença para GTM metrics

GTM mede:

```txt
Aquisição, conversão, canal, receita inicial.
```

Operations mede:

```txt
Saúde, continuidade, suporte, custo, confiabilidade, retenção.
```

---

# 9. `08-reporting-and-cadence.md` — Reporting and Cadence

## Função

Define o ritmo de revisão da operação.

Responde:

> **“Quando olhamos para quais informações e decidimos o quê?”**

## Estrutura ideal

```md
# Reporting and Cadence

## Reporting Objective

## Daily Checks

## Weekly Review

## Monthly Review

## Quarterly Review

## Metrics Dashboard

## Decision Meetings

## Review Artifacts

## Reporting Responsibilities

## Escalation Triggers

## Cadence Risks
```

## Exemplo

```txt
Daily:
- erros críticos
- pagamentos falhos
- tickets urgentes

Weekly:
- suporte
- bugs
- churn
- uso
- custos

Monthly:
- MRR
- margem
- retenção
- roadmap operacional
- riscos
```

## Observação importante

Esse documento evita a oscilação entre dois extremos:

```txt
1. Não olhar nada até dar problema.
2. Olhar tudo todos os dias e virar refém dos dashboards.
```

---

# 10. `09-incident-management.md` — Incident Management

## Função

Define como responder quando algo quebra.

Engineering documenta observability e deploy.
Operations documenta resposta operacional.

## Perguntas centrais

* O que conta como incidente?
* Quais severidades existem?
* Quem responde?
* Como comunicar usuários?
* Como registrar incidente?
* Como mitigar?
* Como fazer postmortem?
* Como evitar recorrência?

## Estrutura ideal

```md
# Incident Management

## Incident Definition

## Severity Levels

## Incident Roles

## Detection Sources

## Response Process

## Communication Rules

## Status Updates

## Mitigation Steps

## Postmortem Process

## Corrective Actions

## Incident Archive
```

## Severidade exemplo

| Severidade | Definição                                          |
| ---------- | -------------------------------------------------- |
| SEV-1      | Produto indisponível ou perda/risco grave de dados |
| SEV-2      | Função crítica quebrada para muitos usuários       |
| SEV-3      | Problema relevante com workaround                  |
| SEV-4      | Incidente menor ou degradação parcial              |

---

# 11. `10-risk-and-compliance.md` — Risk and Compliance

## Função

Define como riscos regulatórios, legais, contratuais e de governança são tratados.

## Perguntas centrais

* Quais obrigações legais existem?
* Quais políticas precisam existir?
* Como lidar com privacidade?
* Como lidar com termos de uso?
* Como lidar com LGPD/GDPR, se aplicável?
* Como lidar com dados sensíveis?
* Como controlar fornecedores?
* Como registrar decisões críticas?
* Como lidar com auditoria?

## Estrutura ideal

```md
# Risk and Compliance

## Compliance Scope

## Legal Requirements

## Privacy Requirements

## Data Protection Requirements

## Terms and Policies

## Vendor Compliance

## Contractual Obligations

## Audit Trail

## Governance Rules

## Compliance Review Cadence

## Compliance Risks
```

## Observação

Security técnica fica em Engineering.
Compliance operacional fica aqui.

---

# 12. `11-financial-operations.md` — Financial Operations

## Função

Define como dinheiro é operado no dia a dia.

Validation modelou viabilidade.
GTM empacotou preço.
Operations gerencia execução financeira.

## Perguntas centrais

* Como cobrança funciona?
* Como pagamentos falhos são tratados?
* Como reembolsos funcionam?
* Como custos são monitorados?
* Como margem é acompanhada?
* Como receita é reportada?
* Como impostos/contabilidade entram?
* Como assinaturas são gerenciadas?
* Como inadimplência é tratada?

## Estrutura ideal

```md
# Financial Operations

## Financial Operations Objective

## Billing Operations

## Subscription Management

## Payment Failures

## Refund Process

## Revenue Recognition Notes

## Cost Monitoring

## Margin Monitoring

## Vendor Costs

## Tax / Accounting Interface

## Financial Reporting

## Financial Operations Risks
```

## Diferença clara

| Documento                  | Pergunta                       |
| -------------------------- | ------------------------------ |
| `economic-model.md`        | A conta pode fechar?           |
| `pricing-and-packaging.md` | Como vender a oferta?          |
| `financial-operations.md`  | Como operar dinheiro todo mês? |

---

# 13. `12-knowledge-management.md` — Knowledge Management

## Função

Define como conhecimento operacional é preservado.

Esse documento é subestimado, mas muito importante.

## Perguntas centrais

* Onde ficam runbooks?
* Onde ficam decisões?
* Onde ficam aprendizados?
* Como suporte vira documentação?
* Como incidentes viram prevenção?
* Como onboarding interno funciona?
* Como evitar conhecimento tribal?
* Como versionar documentação viva?

## Estrutura ideal

```md
# Knowledge Management

## Knowledge Objective

## Documentation Sources

## Runbooks

## Decision Records

## Support Knowledge Base

## Internal Notes

## Customer-Facing Documentation

## Documentation Ownership

## Review Cadence

## Archival Rules

## Knowledge Risks
```

## Por que existe?

Sem isso, a operação depende de memória individual.
Memória individual é frágil. 🧠

---

# 14. `13-continuous-improvement.md` — Continuous Improvement

## Função

Define como o sistema melhora sem virar caos.

## Perguntas centrais

* Como feedback vira mudança?
* Como bugs recorrentes viram melhorias?
* Como métricas geram ações?
* Como priorizar melhorias operacionais?
* Como evitar mudanças impulsivas?
* Como revisar processos?
* Como aprender com churn, incidentes e suporte?
* Como decidir o que automatizar?

## Estrutura ideal

```md
# Continuous Improvement

## Improvement Objective

## Feedback Sources

## Improvement Backlog

## Prioritization Rules

## Process Review

## Automation Candidates

## Quality Improvement

## Cost Reduction

## Churn Learning

## Incident Learning

## Improvement Cadence
```

## Observação crítica

Esse documento protege contra dois problemas:

```txt
- operação estagnada;
- operação reativa e caótica.
```

A melhoria precisa ser deliberada, não compulsiva.

---

# 15. `14-operational-risks.md` — Operational Risks

## Função

Centraliza riscos operacionais.

## Estrutura ideal

```md
# Operational Risks

## Risk Register

## Support Risks

## Reliability Risks

## Financial Risks

## Compliance Risks

## Vendor Risks

## Team Risks

## Process Risks

## Customer Success Risks

## Knowledge Risks

## Mitigation Plan
```

## Formato recomendado

```md
## OR-001: [Risk Name]

### Category

Support / Reliability / Financial / Compliance / Vendor / Team / Process / Customer Success / Knowledge

### Description

### Likelihood

Low / Medium / High

### Impact

Low / Medium / High

### Detection Signal

### Mitigation

### Owner

### Status
```

---

# Agrupamento conceitual

Para a pasta não parecer um monte de documentos administrativos, eu agruparia assim:

```txt
A. Modelo operacional
├── 01-operations-brief.md
├── 02-operating-model.md
└── 03-team-and-responsibilities.md

B. Cliente e continuidade
├── 04-customer-support.md
├── 05-customer-success.md
└── 06-business-processes.md

C. Medição e governança
├── 07-operational-metrics.md
├── 08-reporting-and-cadence.md
├── 10-risk-and-compliance.md
└── 11-financial-operations.md

D. Resposta e aprendizado
├── 09-incident-management.md
├── 12-knowledge-management.md
├── 13-continuous-improvement.md
└── 14-operational-risks.md
```

Esse agrupamento dá coerência:

```txt
Operar → Suportar → Medir → Governar → Responder → Aprender
```

---

# O que eu **não** colocaria em Operations

Eu evitaria estes documentos no sweet spot inicial:

```txt
hiring-plan.md
org-chart.md
legal-contracts.md
board-report.md
fundraising-plan.md
investor-updates.md
partner-management.md
detailed-sop-library.md
customer-training-curriculum.md
tax-strategy.md
```

## Melhor lugar

| Documento tentador                | Melhor lugar                   |
| --------------------------------- | ------------------------------ |
| `hiring-plan.md`                  | Operations appendix / People   |
| `org-chart.md`                    | Operations futuro              |
| `legal-contracts.md`              | Legal / Compliance artifacts   |
| `board-report.md`                 | Corporate / Investor relations |
| `fundraising-plan.md`             | Corporate / Finance            |
| `investor-updates.md`             | Corporate / Stakeholders       |
| `partner-management.md`           | Operations appendix / BD       |
| `detailed-sop-library.md`         | Subpasta de runbooks           |
| `customer-training-curriculum.md` | Customer Success appendix      |
| `tax-strategy.md`                 | Finance / Accounting           |

---

# Ponto sensível: Support vs Customer Success

Eles devem ser separados.

## `04-customer-support.md`

Reativo:

```txt
Usuário tem problema → sistema responde.
```

Exemplos:

```txt
- bug
- dúvida
- cobrança
- login
- cancelamento
- erro de dados
```

## `05-customer-success.md`

Proativo:

```txt
Usuário precisa obter valor → sistema acompanha.
```

Exemplos:

```txt
- ativação
- retenção
- saúde do cliente
- risco de churn
- expansão
- onboarding contínuo
```

Se misturar os dois, o projeto tende a tratar retenção como fila de suporte.
Isso é fraco.

---

# Ponto sensível: Incident Management vs Engineering Observability

Também devem ser separados.

## Engineering / Observability

Define:

```txt
logs
metrics
tracing
alerts
health checks
error reporting
instrumentation
```

## Operations / Incident Management

Define:

```txt
quem responde
como classifica
como comunica
como mitiga
como registra
como aprende
```

Observability detecta.
Incident Management coordena resposta.

---

# Ponto sensível: Financial Operations

Esse documento é obrigatório se o projeto tiver qualquer cobrança real.

Ele fecha uma cadeia importante:

```txt
Validation:
A conta fecha?

Go-to-market:
Como vender e empacotar?

Operations:
Como cobrar, acompanhar, reconciliar, reembolsar e controlar custos?
```

Sem isso, o projeto pode ter receita no papel e bagunça na execução.

---

# Recomendação final

```txt
06-operations/
├── README.md
├── 01-operations-brief.md
├── 02-operating-model.md
├── 03-team-and-responsibilities.md
├── 04-customer-support.md
├── 05-customer-success.md
├── 06-business-processes.md
├── 07-operational-metrics.md
├── 08-reporting-and-cadence.md
├── 09-incident-management.md
├── 10-risk-and-compliance.md
├── 11-financial-operations.md
├── 12-knowledge-management.md
├── 13-continuous-improvement.md
└── 14-operational-risks.md
```

---

# Veredito

Esse é o sweet spot porque cobre o arco operacional completo:

```txt
Modelo operacional
→ Responsabilidades
→ Suporte
→ Sucesso do cliente
→ Processos
→ Métricas
→ Cadência
→ Incidentes
→ Compliance
→ Finanças
→ Conhecimento
→ Melhoria contínua
→ Riscos
```

A regra de corte:

> **Operations documenta como o projeto permanece confiável, útil, financeiramente controlado e capaz de aprender depois do lançamento.**

Com esse eixo, o sistema normativo fecha bem.
O projeto deixa de ser apenas **concebido, validado, especificado, construído e lançado** — ele passa a ser **operável**.
