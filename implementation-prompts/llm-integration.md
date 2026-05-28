Implemente exatamente a etapa LLM-09 - Prompt Context Redaction descrita em
docs/15-real-llm-implementation-roadmap.md.

Escopo:
- Implementar somente esta etapa.
- Não antecipar etapas posteriores.
- Não refatorar áreas não relacionadas.
- Preservar o comportamento atual do MockLlmProvider.
- Preservar CI provider-free e network-free.
- Não armazenar tokens, prompts brutos ou payloads brutos de provider.
- Manter a regra: o LLM propõe, o state engine valida e decide.

Leitura obrigatória antes de editar:
- LIMITATIONS.md
- docs/14-real-llm-integration-plan.md
- docs/15-real-llm-implementation-roadmap.md
- docs/architecture/05-llm-integration-architecture.md
- docs/05-prompt-orchestration-spec.md
- docs/06-agent-turn-contract.md
- docs/architecture/adr/0006-use-structured-llm-output.md
- docs/architecture/adr/0007-prevent-llm-from-mutating-state-directly.md
- Os arquivos listados em “Likely files” da etapa [LLM-XX].

Regras de execução:
1. Primeiro audite o estado real do repositório.
2. Compare a etapa com a implementação existente.
3. Se houver contradição, lacuna ou ambiguidade no contrato, pare e pergunte antes de decidir.
4. Implemente a menor alteração suficiente para cumprir a etapa.
5. Adicione ou ajuste testes proporcionais ao risco da etapa.
6. Não faça chamadas reais a provider em testes automatizados.
7. Não altere LIMITATIONS.md para remover a limitação mock-only antes da etapa LLM-12.

Validação esperada:
- Rode os testes/checks indicados na própria etapa.
- Rode validações adicionais somente se a alteração tocar áreas compartilhadas.
- Reporte claramente o que passou, o que não foi possível rodar e qualquer risco restante.

Entrega final:
- Resuma a etapa implementada.
- Liste arquivos alterados.
- Liste testes/comandos executados.
- Informe se o escopo foi respeitado.
- Informe riscos, pendências ou próximos passos naturais.