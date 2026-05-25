# Especificação de Ciclo de Vida do Agente LOGOS e Rastreabilidade de Respostas

**Status:** Rascunho 1
**Escopo:** LOGOS Engine / Ciclo de Vida do Agente / Máquina de Estados da Entrevista / Persistência de Respostas
**Público:** produto, engenharia, implementação do agent-runtime, compilador de documentação
**Propósito canônico:** definir como o agente LOGOS conduz entrevistas de documentação, avalia respostas, persiste o histórico da conversa, sintetiza respostas finais e preserva a rastreabilidade desde a entrada do usuário até a documentação gerada.

---

## 1. Propósito

Esta especificação define o ciclo de vida esperado do agente LOGOS durante entrevistas de documentação estruturada.

Ela cobre:

- como o agente inicializa uma conversa;
- como prepara a primeira pergunta de documentação;
- como recebe e registra mensagens do usuário;
- como avalia se uma resposta é suficiente;
- como solicita complementos quando necessário;
- como avança pela fila de perguntas;
- como reage quando todas as perguntas são esgotadas;
- como oferece a geração de documentos;
- como cada mensagem e resposta deve ser persistida;
- como a documentação gerada deve permanecer rastreável até a entrada original do usuário.

O agente LOGOS não deve se comportar como um assistente de chat livre. Deve se comportar como um entrevistador estruturado, avaliador semântico, reconciliador de conflitos e compilador de documentação.

---

## 2. Princípio Central

O agente LOGOS opera sobre perguntas de documentação. Cada pergunta existe para coletar material semântico suficiente para produzir uma parte específica de um documento canônico.

O ciclo de vida central é:

```txt
perguntar
→ receber
→ persistir literalmente
→ avaliar
→ complementar ou avançar
→ sintetizar resposta final
→ registrar resposta canônica
→ repetir
→ resumir
→ oferecer geração
→ gerar
→ validar
→ revisar
→ salvar
```

O agente nunca deve gerar documentação canônica diretamente de uma conversa não estruturada sem uma camada intermediária de resposta canônica.

Fluxo correto:

```txt
transcrição literal
  ↓
registros de resposta canônica
  ↓
rascunho de documento gerado
  ↓
documento canônico validado
```

Fluxo incorreto:

```txt
chat bruto
  ↓
documentação final
```

---

## 3. Camadas de Dados Primárias

O sistema deve persistir duas camadas distintas de dados da entrevista.

### 3.1 Log de Transcrição Literal

O log de transcrição literal é o registro completo e fiel de todas as mensagens trocadas durante a entrevista.

Inclui:

- todas as mensagens do usuário;
- todas as mensagens do agente;
- perguntas do agente;
- perguntas de acompanhamento;
- reformulações;
- resumos;
- explicações de avaliação;
- prompts de resolução de conflitos;
- ofertas de geração;
- aprovações do usuário;
- rejeições do usuário;
- eventos relevantes do sistema;
- chamadas de ferramentas e resultados relevantes, quando afetam decisões de documentação.

A transcrição existe para preservar a origem de cada decisão de documentação.

Requisitos:

- cada mensagem deve ser persistida antes que a avaliação semântica ocorra;
- as mensagens devem ser salvas literalmente;
- a transcrição deve ser somente de acréscimo (append-only);
- nenhuma mensagem anterior da transcrição pode ser reescrita ou excluída durante a operação normal;
- correções posteriores devem criar novas entradas de transcrição e revisões de resposta.

### 3.2 Registros de Resposta Canônica

Registros de Resposta Canônica são respostas finais e consolidadas para perguntas de documentação.

Uma resposta canônica não é necessariamente uma única mensagem do usuário. Pode ser sintetizada a partir de:

- a resposta inicial do usuário;
- esclarecimentos de acompanhamento;
- correções;
- resoluções de conflitos;
- refinamentos do agente;
- aprovações explícitas do usuário;
- aceitação implícita sob política configurada.

Respostas canônicas são o material de origem direto para documentos gerados.

Requisitos:

- cada pergunta de documentação deve ter zero ou uma versão ativa de resposta canônica;
- respostas canônicas devem referenciar IDs de mensagens de transcrição de origem;
- respostas canônicas devem ser versionadas;
- revisões devem preservar versões anteriores;
- uma resposta canônica pode ser final, provisória, hipótese, pulada, não aplicável ou conflitante.

---

## 4. Visão Geral da Máquina de Estados

O ciclo de vida do agente deve ser implementado como uma máquina de estados explícita.

```txt
SESSION_INITIALIZING
  ↓
CONTEXT_LOADING
  ↓
INTERVIEW_READY
  ↓
ASKING_QUESTION
  ↓
WAITING_FOR_ANSWER
  ↓
TRANSCRIBING_MESSAGE
  ↓
ASSESSING_ANSWER
  ├─ precisa de complemento → ASKING_FOLLOW_UP → WAITING_FOR_ANSWER
  ├─ insuficiente           → REFORMULATING_QUESTION → WAITING_FOR_ANSWER
  ├─ conflito               → RECONCILING_CONFLICT → WAITING_FOR_ANSWER
  ├─ sobreposição do usuário → HANDLING_USER_OVERRIDE
  └─ suficiente             → SYNTHESIZING_FINAL_ANSWER
                                 ↓
                           FINALIZING_ANSWER
                                 ↓
                      RECORDING_CANONICAL_ANSWER
                                 ↓
                           ADVANCING_QUEUE
                                 ↓
                ASKING_QUESTION | INTERVIEW_COMPLETE
                                 ↓
                          OFFER_GENERATION
                                 ↓
              GENERATING_DOCUMENTS | REVIEWING_ANSWERS | WAITING_USER_DECISION
                                 ↓
                         GENERATION_COMPLETE
```

O LLM pode auxiliar na avaliação semântica e síntese de respostas, mas o LOGOS Core deve governar as transições de estado.

---

## 5. Estados do Ciclo de Vida

### 5.1 `SESSION_INITIALIZING`

Ocorre quando o usuário inicia ou retoma uma entrevista LOGOS.

Possíveis comandos de entrada:

```bash
logos
logos interview
logos generate foundation
logos generate --doc 01-thesis
logos resume
```

Responsabilidades:

- identificar a raiz do projeto;
- identificar a fase alvo, documento ou escopo do projeto;
- detectar se é uma entrevista nova ou retomada;
- carregar configuração local;
- inicializar metadados da sessão;
- preparar serviços de runtime.

Saída:

```ts
type SessionContext = {
  projectRoot: string;
  projectId: string;
  mode: "interview" | "generate" | "review" | "resume";
  selectedPhaseId?: string;
  selectedDocumentId?: string;
  activeInterviewId?: string;
};
```

---

### 5.2 `CONTEXT_LOADING`

Ocorre após a inicialização da sessão.

Responsabilidades:

- carregar `logos.yml`;
- carregar `docs.yml`;
- carregar `phases/*.yml`;
- carregar documentos canônicos existentes;
- carregar estado da entrevista existente;
- carregar respostas canônicas anteriores;
- carregar entradas de transcrição anteriores;
- detectar perguntas pendentes;
- detectar perguntas puladas;
- detectar conflitos não resolvidos;
- construir a fila da entrevista.

Saída:

```ts
type InterviewPlan = {
  phaseId: string;
  documentId: string;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  answeredQuestions: CanonicalAnswerRecord[];
  missingRequiredAnswers: string[];
};
```

---

### 5.3 `INTERVIEW_READY`

Ocorre após o contexto ser carregado.

Responsabilidades:

- determinar se deve iniciar, retomar, revisar ou oferecer geração;
- preparar a primeira pergunta ou a pergunta ativa atual;
- explicar brevemente o fluxo ao usuário;
- fazer exatamente uma pergunta.

Se a entrevista for nova, o agente deve explicar:

```txt
Vou fazer uma pergunta por vez. Depois de cada resposta, vou avaliar se ela é suficiente para o documento ou se preciso pedir um complemento específico.
```

Se a entrevista for retomada, o agente deve indicar onde parou:

```txt
Retomando a entrevista em 01-foundation / 01-thesis.md.
A próxima pergunta pendente é a pergunta 3/5.
```

---

### 5.4 `ASKING_QUESTION`

Ocorre sempre que o agente apresenta uma pergunta de documentação ativa.

A mensagem da pergunta deve incluir:

- contexto da fase ou documento;
- número da pergunta atual;
- total de perguntas;
- texto da pergunta;
- orientação curta;
- exemplo opcional ou expectativa de resposta.

Formato recomendado:

```txt
Pergunta 2/7 — Problema

Que dor, fricção ou limitação este projeto existe para enfrentar?

Responda em termos concretos: como isso aparece na vida real, para quem aparece e por que as alternativas atuais são insuficientes.
```

Regras:

- faça uma pergunta ativa por vez;
- não agrupe perguntas não relacionadas;
- não gere documentação final durante o loop de perguntas;
- mantenha a pergunta focada no documento ou seção atual.

---

### 5.5 `WAITING_FOR_ANSWER`

Ocorre após uma pergunta ter sido feita.

Possíveis entradas do usuário:

- resposta direta;
- resposta parcial;
- resposta vaga;
- resposta muito longa;
- contradição;
- solicitação para pular;
- solicitação para pausar;
- solicitação para voltar;
- solicitação para gerar agora;
- meta-pergunta;
- mudança de escopo.

O sistema não deve avaliar a mensagem do usuário antes de persistí-la literalmente.

---

### 5.6 `TRANSCRIBING_MESSAGE`

Ocorre imediatamente após receber a entrada do usuário.

Responsabilidades:

- persistir a mensagem do usuário literalmente;
- atribuir ID de mensagem;
- associar a mensagem com a entrevista, fase, documento e pergunta atuais;
- registrar o estado antes da avaliação.

Este estado é obrigatório.

Ordem correta:

```txt
receber mensagem do usuário
→ anexar à transcrição
→ avaliar mensagem
```

Ordem incorreta:

```txt
receber mensagem do usuário
→ avaliar mensagem
→ salvar apenas resumo
```

---

### 5.7 `ASSESSING_ANSWER`

Ocorre após a mensagem do usuário ter sido persistida.

Responsabilidades:

- avaliar se a resposta satisfaz a pergunta ativa;
- extrair fatos, decisões, suposições, hipóteses, restrições e perguntas em aberto;
- detectar sinais obrigatórios ausentes;
- detectar conflitos com respostas anteriores;
- classificar a confiança da resposta;
- decidir se deve avançar, complementar, reformular, reconciliar ou tratar sobreposição do usuário.

Resultado da avaliação:

```ts
type AnswerAssessment =
  | {
      status: "sufficient";
      confidence: "low" | "medium" | "high";
      extractedFacts: string[];
      extractedDecisions: string[];
      extractedAssumptions: string[];
      missingSignals: [];
    }
  | {
      status: "needs_complement";
      confidence: "low" | "medium" | "high";
      capturedSignals: string[];
      missingSignals: string[];
      followUpQuestion: string;
    }
  | {
      status: "insufficient";
      reason: string;
      reformulatedQuestion: string;
    }
  | {
      status: "conflict";
      conflicts: ConflictRecord[];
      reconciliationQuestion: string;
    }
  | {
      status: "user_intent_override";
      requestedAction:
        | "skip"
        | "pause"
        | "go_back"
        | "generate_now"
        | "change_scope"
        | "review_answers";
    };
```

---

### 5.8 `ASKING_FOLLOW_UP`

Ocorre quando a resposta é útil mas incompleta.

O acompanhamento deve ser específico e limitado aos sinais ausentes.

Exemplo:

```txt
Isso já define a direção, mas ainda falta a tensão central.

Complemento:
O que hoje impede essas pessoas de transformar ideias em documentação clara: excesso de informação, falta de método, dificuldade de decisão, dispersão, medo de executar, ou outra coisa?
```

Regras:

- não repita a pergunta original a menos que necessário;
- pergunte apenas pelas informações ausentes;
- combine a resposta original e o complemento durante a reavaliação;
- limite as tentativas de acompanhamento por pergunta.

Limite recomendado:

```txt
maxFollowUps = 2
```

Após o limite ser atingido, ofereça opções:

```txt
Ainda não temos material suficiente para fechar esta resposta.

Escolha uma opção:
1. responder com mais detalhe;
2. registrar como hipótese provisória;
3. pular por enquanto;
4. voltar depois.
```

---

### 5.9 `REFORMULATING_QUESTION`

Ocorre quando a resposta do usuário está fora do tópico ou é inutilizável.

Exemplo:

```txt
Isso descreve uma qualidade desejada do produto, mas ainda não descreve o problema que ele resolve.

Vou reformular:
Que situação concreta faz alguém precisar deste projeto antes de existir qualquer solução visual ou técnica?
```

Regras:

- explique brevemente por que a resposta não satisfaz a pergunta;
- reformule com orientação mais concreta;
- preserve a entrada original da transcrição;
- não marque a pergunta como respondida.

---

### 5.10 `RECONCILING_CONFLICT`

Ocorre quando uma nova resposta contradiz uma resposta ou decisão anterior.

Exemplo:

```txt
Há uma tensão com uma resposta anterior.

Antes você indicou que o projeto seria open source e gratuito. Agora apareceu um modelo de assinatura SaaS fechada.

Qual das interpretações está correta?

1. O core é open source, mas haverá hosted SaaS pago.
2. O produto deixou de ser open source.
3. A assinatura se aplica apenas a serviços complementares.
4. Ainda é uma decisão em aberto.
```

Regras:

- não esconda contradições;
- não resolva contradições críticas sem confirmação do usuário;
- a resolução de conflito deve ser persistida como decisão de documentação;
- respostas afetadas devem ser revisadas ou marcadas como em aberto.

---

### 5.11 `SYNTHESIZING_FINAL_ANSWER`

Ocorre quando a resposta é suficiente ou suficiente após complemento/reconciliação.

Responsabilidades:

- sintetizar uma resposta final clara para a pergunta de documentação;
- combinar as mensagens relevantes do usuário e esclarecimentos;
- preservar fidelidade à intenção do usuário;
- distinguir fato, decisão, hipótese, suposição e inferência;
- registrar os IDs das mensagens de origem utilizadas;
- produzir um rascunho de resposta canônica.

Exemplo:

Resposta original do usuário:

```txt
Quero criar um sistema que ajude pessoas a tirar ideias da cabeça.
```

Complemento:

```txt
O problema é que muita gente trava porque tem tudo misturado mentalmente e não consegue transformar isso em plano claro.
```

Resposta canônica sintetizada:

```txt
O projeto existe para ajudar pessoas a transformar ideias difusas, acumuladas mentalmente, em documentação clara, estruturada e acionável. A convicção central é que muitos projetos não falham por falta de ideias, mas por falta de um processo que externalize, organize e converta essas ideias em decisões e próximos passos confiáveis.
```

---

### 5.12 `FINALIZING_ANSWER`

Ocorre após um rascunho de resposta canônica ser sintetizado.

Responsabilidades:

- decidir se a resposta pode ser salva automaticamente;
- decidir se a aprovação explícita do usuário é necessária;
- marcar respostas de baixa confiança como hipóteses quando apropriado;
- exigir aprovação para decisões críticas;
- preparar a resposta para persistência canônica.

Política recomendada:

```txt
Se confidence = high:
  salvar resposta final e avançar.

Se confidence = medium:
  salvar resposta final com agentRefinement.applied = true.

Se confidence = low:
  perguntar se deve registrar como hipótese.

Se houve conflito:
  exigir aprovação explícita do usuário.

Se o documento for fundacional ou crítico para decisões:
  opcionalmente exigir confirmação explícita antes de avançar.
```

Possível mensagem de confirmação:

```txt
Vou registrar esta resposta final para a pergunta:

"O projeto existe para ajudar pessoas a transformar ideias difusas..."

Está correto?
1. Sim, avançar
2. Ajustar
3. Responder novamente
```

---

### 5.13 `RECORDING_CANONICAL_ANSWER`

Ocorre após a resposta final ter sido aceita sob a política configurada.

Responsabilidades:

- persistir registro de resposta canônica;
- vincular mensagens de transcrição de origem;
- armazenar campos semânticos extraídos;
- armazenar confiança;
- armazenar versão da revisão;
- marcar pergunta ativa como respondida;
- registrar decisão de documentação.

---

### 5.14 `ADVANCING_QUEUE`

Ocorre após uma resposta canônica ser registrada ou uma pergunta ser explicitamente pulada.

Responsabilidades:

- atualizar estado da pergunta;
- recalcular completude do documento;
- identificar próxima pergunta;
- detectar se ainda há perguntas obrigatórias;
- transitar para `ASKING_QUESTION` ou `INTERVIEW_COMPLETE`.

---

### 5.15 `INTERVIEW_COMPLETE`

Ocorre quando todas as perguntas obrigatórias no escopo ativo foram respondidas, puladas como não aplicáveis ou aceitas como provisórias.

Responsabilidades:

- resumir respostas capturadas;
- listar pontos fracos;
- listar perguntas não resolvidas;
- listar perguntas obrigatórias puladas, se houver;
- calcular prontidão para geração;
- oferecer próxima ação.

Exemplo:

```txt
Concluímos as perguntas necessárias para este documento.

Resumo capturado:
- Tese central: ...
- Problema principal: ...
- Público primário: ...
- Tensão central: ...

Ainda há 1 ponto fraco:
- A definição de sucesso está pouco mensurável.

Posso agora:
1. gerar o documento completo;
2. revisar respostas antes de gerar;
3. preencher lacunas primeiro;
4. salvar como rascunho e parar.
```

O agente deve oferecer geração. Não deve gerar automaticamente a menos que o modo ativo permita explicitamente a geração automática.

---

### 5.16 `OFFER_GENERATION`

Ocorre após a conclusão da entrevista ou quando o usuário solicita gerar antecipadamente.

Responsabilidades:

- mostrar prontidão para geração;
- explicar lacunas bloqueadoras;
- oferecer modos de geração;
- solicitar decisão do usuário.

Modos de geração:

```txt
strict_generation
  gerar apenas se as respostas mínimas obrigatórias forem suficientes.

partial_generation
  gerar com lacunas explícitas.

hypothesis_generation
  gerar marcando suposições e hipóteses não resolvidas.

skeleton_generation
  gerar estrutura com placeholders.
```

---

### 5.17 `GENERATING_DOCUMENTS`

Ocorre após o usuário solicitar geração.

Responsabilidades:

- carregar respostas canônicas;
- carregar template do documento;
- carregar schema do documento;
- gerar rascunho;
- preservar rastreabilidade;
- validar rascunho;
- produzir pré-visualização ou diff;
- solicitar aceitação antes de salvar documento canônico.

O rascunho do documento gerado deve referenciar:

- IDs de respostas canônicas;
- IDs de mensagens de transcrição de origem;
- suposições utilizadas;
- perguntas não resolvidas;
- inferências do agente.

---

## 6. Fluxos de Sobreposição do Usuário

### 6.1 Pular Pergunta

Exemplos de entrada do usuário:

```txt
pula essa
não sei ainda
vamos deixar para depois
```

Comportamento:

- marcar pergunta como pulada;
- não fabricar resposta;
- classificar motivo de pular;
- continuar se permitido;
- expor perguntas obrigatórias puladas antes da geração.

```ts
type QuestionState = {
  status: "skipped";
  reason?: "unknown" | "deferred" | "not_applicable" | "user_choice";
};
```

---

### 6.2 Voltar

Exemplos de entrada do usuário:

```txt
volta na anterior
quero mudar a resposta da tese
a resposta anterior ficou errada
```

Comportamento:

- localizar pergunta alvo;
- mostrar resposta canônica atual;
- coletar resposta revisada;
- persistir revisão;
- preservar versão anterior;
- recalcular dependências.

```ts
type AnswerRevision = {
  previousAnswerId: string;
  newAnswerId: string;
  revisionReason?: string;
  changedByUser: true;
  createdAt: string;
};
```

---

### 6.3 Pausar Entrevista

Exemplos de entrada do usuário:

```txt
pausar
continuamos depois
salva e sai
```

Comportamento:

- persistir estado;
- marcar entrevista como pausada;
- manter pergunta atual pendente;
- permitir retomada posterior.

---

### 6.4 Cancelar Entrevista

Exemplos de entrada do usuário:

```txt
cancelar
abandona essa entrevista
```

Comportamento:

- perguntar se deseja salvar respostas parciais;
- persistir ou descartar conforme escolha do usuário;
- nunca excluir transcrição silenciosamente;
- retornar à visão geral.

---

### 6.5 Gerar Antecipadamente

Exemplos de entrada do usuário:

```txt
gera agora
gera com o que temos
vamos fazer a documentação já
```

Comportamento:

- calcular prontidão para geração;
- explicar respostas obrigatórias ausentes;
- oferecer geração parcial ou estrita;
- exigir confirmação antes de gerar.

---

### 6.6 Mudança de Escopo

Exemplos de entrada do usuário:

```txt
na verdade não é mais para negócios, é para projetos pessoais
quero mudar de app mobile para CLI
decidi que não será open source
```

Comportamento:

- detectar escopo do impacto;
- classificar perguntas e documentos afetados;
- perguntar ao usuário como aplicar a mudança;
- revisar respostas anteriores quando necessário;
- registrar mudança de escopo como decisão de documentação.

```ts
type ScopeChange = {
  impact: "local" | "document" | "phase" | "project";
  affectedQuestions: string[];
  affectedDocuments: string[];
  requiresReassessment: boolean;
};
```

---

## 7. Modelos de Dados

### 7.1 Mensagem de Transcrição

```ts
type TranscriptMessage = {
  id: string;

  interviewRunId: string;
  projectId: string;
  phaseId?: string;
  documentId?: string;
  questionId?: string;

  role: "user" | "agent" | "system" | "tool";

  content: string;

  contentFormat: "plain_text" | "markdown" | "json" | "tool_result";

  source:
    | "user_input"
    | "agent_question"
    | "agent_follow_up"
    | "agent_assessment"
    | "agent_summary"
    | "agent_generation_offer"
    | "tool_call"
    | "tool_result"
    | "system_event";

  createdAt: string;

  metadata?: {
    stateBefore?: InterviewStateName;
    stateAfter?: InterviewStateName;
    relatedTransitionId?: string;
    toolName?: string;
    modelProvider?: string;
    modelId?: string;
    tokenUsage?: {
      input?: number;
      output?: number;
      total?: number;
    };
  };
};
```

---

### 7.2 Registro de Resposta Canônica

```ts
type CanonicalAnswerRecord = {
  id: string;

  interviewRunId: string;
  projectId: string;
  phaseId: string;
  documentId: string;
  questionId: string;

  questionText: string;

  finalAnswer: string;

  answerStatus:
    | "final"
    | "provisional"
    | "hypothesis"
    | "skipped"
    | "not_applicable"
    | "conflicted";

  confidence: "low" | "medium" | "high";

  sourceMessageIds: string[];

  derivation: {
    userMessageIds: string[];
    agentMessageIds: string[];
    complementMessageIds: string[];
    conflictResolutionMessageIds: string[];
  };

  extracted: {
    facts: string[];
    decisions: string[];
    assumptions: string[];
    hypotheses: string[];
    constraints: string[];
    openQuestions: string[];
  };

  missingSignals: string[];

  agentRefinement: {
    applied: boolean;
    description: string;
    rationale: string;
  };

  userApproval: {
    status: "explicit" | "implicit" | "not_requested" | "rejected";
    messageId?: string;
    approvedAt?: string;
  };

  revision: {
    version: number;
    previousAnswerId?: string;
    revisionReason?: string;
    revisedAt?: string;
  };

  createdAt: string;
  updatedAt: string;
};
```

---

### 7.3 Pergunta da Entrevista

```ts
type InterviewQuestion = {
  id: string;
  phaseId: string;
  documentId: string;
  sectionId?: string;

  order: number;
  title: string;
  question: string;
  helpText?: string;

  required: boolean;

  sufficiencyCriteria: {
    requiredSignals: string[];
    optionalSignals?: string[];
    insufficientPatterns?: string[];
  };

  followUpPolicy: {
    maxFollowUps: number;
    allowSkip: boolean;
    allowHypothesis: boolean;
  };

  generationMapping: {
    targetSections: string[];
    extractionHints: string[];
  };
};
```

---

### 7.4 Fila da Entrevista

```ts
type InterviewQueue = {
  scope: "document" | "phase" | "project";
  phaseId: string;
  documentId?: string;
  questions: InterviewQuestion[];
  currentIndex: number;
  completedQuestionIds: string[];
  skippedQuestionIds: string[];
  blockedQuestionIds: string[];
};
```

---

### 7.5 Estado da Execução da Entrevista

```ts
type InterviewRunState = {
  id: string;
  projectId: string;
  phaseId: string;
  documentId: string;

  status:
    | "active"
    | "paused"
    | "completed"
    | "generated"
    | "cancelled";

  currentQuestionId?: string;
  questionStates: Record<string, QuestionState>;
  answers: CanonicalAnswerRecord[];
  conflicts: ConflictRecord[];
  generatedDrafts: GeneratedDocumentDraft[];
  createdAt: string;
  updatedAt: string;
};
```

---

### 7.6 Decisão de Documentação

```ts
type DocumentationDecision = {
  id: string;

  type:
    | "answer_finalized"
    | "question_skipped"
    | "conflict_resolved"
    | "scope_changed"
    | "generation_started"
    | "document_accepted"
    | "document_rejected"
    | "document_patched";

  phaseId?: string;
  documentId?: string;
  questionId?: string;

  decision: string;

  rationale: string;

  sourceMessageIds: string[];
  sourceCanonicalAnswerIds?: string[];

  madeBy: "user" | "agent" | "system";

  requiresUserApproval: boolean;

  approvalMessageId?: string;

  createdAt: string;
};
```

---

### 7.7 Rascunho de Documento Gerado

```ts
type GeneratedDocumentSectionTrace = {
  sectionId: string;
  generatedContent: string;
  sourceCanonicalAnswerIds: string[];
  sourceMessageIds: string[];
  assumptionsUsed: string[];
  agentInferences: string[];
};

type GeneratedDocumentDraft = {
  id: string;
  phaseId: string;
  documentId: string;

  markdown: string;

  sourceCanonicalAnswerIds: string[];
  sourceTranscriptMessageIds: string[];

  sectionTrace: GeneratedDocumentSectionTrace[];

  validation: DocumentValidationResult;

  createdAt: string;
};
```

---

## 8. Layout de Persistência

Estrutura local recomendada:

```txt
.logos/
  interviews/
    interview_2026-05-24_135000/
      state.json
      transcript.jsonl
      transcript.md
      canonical-answers.json
      answer-revisions.json
      conflicts.json
      decisions.json
      generation-readiness.json
      generated-drafts/
        01-thesis.draft-001.md
        01-thesis.draft-001.trace.json
```

### 8.1 `transcript.jsonl`

A fonte de verdade estruturada e somente de acréscimo para o histórico da conversa.

### 8.2 `transcript.md`

Exportação legível por humanos da transcrição.

### 8.3 `canonical-answers.json`

A lista estruturada de respostas finais por pergunta de documentação.

### 8.4 `decisions.json`

Um log estruturado de decisões de documentação e seus IDs de mensagens de origem.

### 8.5 `generated-drafts/*.trace.json`

Metadados de rastreamento conectando seções do documento gerado a respostas canônicas e mensagens de origem literais.

---

## 9. Política de Suficiência

Uma resposta é suficiente apenas quando todas as condições abaixo são verdadeiras:

```txt
- contém os sinais semânticos mínimos obrigatórios;
- pode ser sintetizada em uma resposta final;
- possui mensagens de origem literais identificáveis;
- não possui conflitos não resolvidos;
- pode ser classificada com confiança;
- pode ser armazenada como registro de resposta canônica.
```

Status de suficiência:

```txt
sufficient
  A resposta contém os sinais mínimos obrigatórios.

needs_complement
  A resposta é útil mas carece de um ou mais sinais obrigatórios.

insufficient
  A resposta não atende à pergunta de forma utilizável.

conflict
  A resposta contradiz material anterior.

defer
  O usuário explicitamente não quer responder agora.

not_applicable
  A pergunta não se aplica ao projeto.
```

Níveis de confiança:

```txt
high
  clara, específica e diretamente utilizável.

medium
  utilizável mas requer refinamento do agente.

low
  fraca, vaga ou provisória; deve ser marcada como hipótese ou exigir confirmação.
```

---

## 10. Requisitos de Rastreabilidade

### 10.1 Rastreabilidade de Resposta Canônica

Toda resposta canônica deve referenciar:

- mensagens de origem do usuário;
- mensagens de origem do agente quando relevantes;
- mensagens de complemento;
- mensagens de resolução de conflito;
- mensagens de aprovação quando houver aprovação explícita.

### 10.2 Rastreabilidade de Documentação

Todo documento gerado deve referenciar:

- IDs de respostas canônicas;
- IDs de mensagens de transcrição;
- perguntas não resolvidas;
- suposições;
- inferências do agente;
- resultado da validação.

### 10.3 Rastreabilidade em Nível de Seção

Toda seção gerada deve referenciar as respostas canônicas usadas para produzi-la.

Se uma seção for gerada sem material de origem suficiente, deve ser marcada como:

```txt
agent_inference
```

ou:

```txt
missing_source
```

No modo estrito, `missing_source` bloqueia o salvamento canônico.

---

## 11. Regras de Comportamento do Agente

O agente deve:

- fazer uma pergunta por vez;
- persistir cada mensagem antes da avaliação;
- avaliar se a resposta é suficiente;
- solicitar complementos específicos quando necessário;
- expor contradições explicitamente;
- sintetizar respostas finais por pergunta;
- distinguir conteúdo fornecido pelo usuário de inferência do agente;
- preservar rastreabilidade;
- oferecer geração apenas após avaliação de prontidão;
- gerar documentos a partir de respostas canônicas, não do chat bruto;
- solicitar aprovação antes de decisões críticas.

O agente não deve:

- pular sinais ausentes silenciosamente;
- aceitar respostas vagas como completas;
- gerar documentação antes que exista material suficiente, a menos que a geração parcial seja explicitamente escolhida;
- sobrescrever respostas canônicas sem registros de revisão;
- editar entradas da transcrição;
- esconder suposições não resolvidas dentro de prosa polida;
- tratar sua própria inferência como decisão do usuário.

---

## 12. Responsabilidades do LOGOS Core vs Agente

### 12.1 Responsabilidades do LOGOS Core

O LOGOS Core governa:

- estado da entrevista;
- fila de perguntas;
- persistência;
- validação de schema;
- cálculo de completude;
- regras de transição;
- prontidão para geração;
- verificações de rastreabilidade;
- versionamento de respostas canônicas.

### 12.2 Responsabilidades do Agent Runtime

O agente auxilia com:

- avaliação semântica;
- síntese de respostas;
- geração de perguntas de acompanhamento;
- detecção de conflitos;
- geração de rascunhos;
- revisão de documentos;
- propostas de correção.

### 12.3 Regra Crítica

O agente pode recomendar transições, mas o LOGOS Core as aplica.

```txt
Agente diz: sufficient
Core valida: criteria e traceability estão satisfeitos
Então: advance
```

---

## 13. Pacote Necessário

A arquitetura deve incluir um pacote dedicado:

```txt
packages/logos-interview/
```

Estrutura recomendada:

```txt
packages/logos-interview/
  src/
    transcript/
      TranscriptStore.ts
      appendTranscriptMessage.ts
      exportTranscriptMarkdown.ts

    answers/
      CanonicalAnswerRecord.ts
      synthesizeFinalAnswer.ts
      finalizeAnswer.ts
      reviseAnswer.ts

    decisions/
      DocumentationDecision.ts
      recordDecision.ts
      traceDecisionSources.ts

    state/
      InterviewState.ts
      transitionInterviewState.ts
      persistInterviewState.ts

    trace/
      buildAnswerTrace.ts
      buildDocumentTrace.ts
      verifyTraceCompleteness.ts

    queue/
      InterviewQueue.ts
      advanceQueue.ts
      getCurrentQuestion.ts

    assessment/
      assessAnswer.ts
      detectMissingSignals.ts
      detectConflicts.ts
      calculateSufficiency.ts
```

---

## 14. Requisitos da TUI

A TUI deve expor o estado da entrevista com clareza.

Deve mostrar:

- fase atual;
- documento atual;
- pergunta atual;
- progresso das perguntas;
- status da resposta;
- sinais ausentes;
- conflitos detectados;
- prontidão para geração;
- rascunho da resposta canônica atual quando aplicável.

### 14.1 Mockup de Pergunta Ativa

```txt
╭─ LOGOS Interview ─────────────────────────────────────────────╮
│ Phase: 01 Foundation       Document: 01 Thesis                │
│ Question: 2 / 5            Status: awaiting answer            │
├───────────────────────────────────────────────────────────────┤
│ Pergunta                                                      │
│ Que tensão principal este projeto tenta resolver?             │
│                                                               │
│ Orientação                                                    │
│ Descreva o conflito real que faz este projeto ser necessário. │
├───────────────────────────────────────────────────────────────┤
│ Resposta atual                                                │
│ _                                                             │
├───────────────────────────────────────────────────────────────┤
│ [enter] send  [skip] skip  [back] previous  [pause] pause     │
╰───────────────────────────────────────────────────────────────╯
```

### 14.2 Mockup de Resposta Parcial

```txt
╭─ Answer Assessment ───────────────────────────────────────────╮
│ Status: needs complement                                      │
│ Captured: project direction                                   │
│ Missing: central tension                                      │
├───────────────────────────────────────────────────────────────┤
│ Complemento necessário                                       │
│ O que hoje impede o usuário de resolver isso bem com as        │
│ alternativas existentes?                                      │
╰───────────────────────────────────────────────────────────────╯
```

### 14.3 Mockup de Confirmação de Resposta Final

```txt
╭─ Canonical Answer Draft ──────────────────────────────────────╮
│ Question: 1 / 5                                               │
│ Confidence: medium                                            │
├───────────────────────────────────────────────────────────────┤
│ Resposta final proposta                                       │
│                                                               │
│ O projeto existe para ajudar pessoas a transformar ideias      │
│ difusas em documentação clara, estruturada e acionável.        │
│                                                               │
│ Source messages: msg_002, msg_004                             │
├───────────────────────────────────────────────────────────────┤
│ [a] accept  [e] edit  [r] answer again  [d] show transcript    │
╰───────────────────────────────────────────────────────────────╯
```

### 14.4 Mockup de Entrevista Concluída

```txt
╭─ Interview Complete ──────────────────────────────────────────╮
│ Document: 01-thesis.md                                        │
│ Required answers: complete                                    │
│ Weak points: 1                                                │
├───────────────────────────────────────────────────────────────┤
│ Resumo capturado                                              │
│ - Tese central: ...                                           │
│ - Tensão: ...                                                 │
│ - Promessa essencial: ...                                     │
│                                                               │
│ Próxima ação                                                  │
│ 1. Generate document                                          │
│ 2. Review answers                                             │
│ 3. Fill weak points                                           │
│ 4. Save and stop                                              │
╰───────────────────────────────────────────────────────────────╯
```

---

## 15. Regras de Integridade

### Regra 1 — Literal Primeiro

Cada mensagem do usuário deve ser persistida literalmente antes de qualquer avaliação semântica.

### Regra 2 — Transcrição é Somente de Acréscimo

Entradas da transcrição não devem ser editadas ou excluídas durante a operação normal.

### Regra 3 — Respostas São Versionadas

Revisões de respostas canônicas criam novos registros e preservam versões anteriores.

### Regra 4 — Documentos Derivam de Respostas Canônicas

Documentos devem ser gerados a partir de respostas canônicas, não diretamente do chat bruto.

### Regra 5 — Toda Decisão de Documentação Deve Ser Rastreável

Toda decisão relevante deve referenciar IDs de mensagens de transcrição e/ou IDs de respostas canônicas.

### Regra 6 — Decisões Críticas Exigem Confirmação

Decisões críticas incluem:

- mudanças de escopo;
- resoluções de conflitos;
- definição de público-alvo;
- definição de modelo de negócio;
- limites de anti-escopo;
- aceitação de geração;
- aceitação de documento canônico.

### Regra 7 — Inferência do Agente Deve Ser Rotulada

Interpretação gerada pelo agente não deve ser apresentada como fato fornecido pelo usuário.

### Regra 8 — Lacunas Devem Sobreviver

Lacunas não resolvidas devem aparecer em:

- diagnósticos;
- prontidão para geração;
- rastreamento do rascunho gerado;
- painel de revisão.

---

## 16. Critérios Mínimos de Aceitação do MVP

A primeira implementação deste ciclo de vida é aceitável apenas se puder:

1. iniciar uma entrevista de documento;
2. fazer uma pergunta por vez;
3. persistir todas as mensagens do usuário e do agente literalmente;
4. avaliar suficiência da resposta;
5. solicitar complemento quando necessário;
6. sintetizar resposta final por pergunta;
7. persistir registros de resposta canônica com IDs de mensagens de origem;
8. avançar pela fila de perguntas;
9. detectar conclusão da entrevista;
10. oferecer geração de documento;
11. gerar um rascunho a partir de respostas canônicas;
12. validar rastreabilidade antes de salvar;
13. preservar transcrição e revisões de respostas ao retomar.

---

## 17. Resumo

O ciclo de vida do agente LOGOS deve ser tratado como um sistema de entrevista determinística apoiado por um LLM, não como um chat livre.

A distinção arquitetural chave é:

```txt
Log de Transcrição
  origem literal completa

Registros de Resposta Canônica
  respostas finais refinadas por pergunta

Documentação Gerada
  artefato derivado de respostas canônicas
```

Isso confere ao LOGOS uma cadeia de custódia semântica:

```txt
mensagem
→ resposta
→ decisão
→ documento
→ saída executiva
```

Sem essa cadeia, a documentação gerada pode parecer coerente mas não pode ser auditada. Com essa cadeia, cada decisão de documentação pode ser rastreada até as mensagens exatas do usuário e do agente que a produziram.
