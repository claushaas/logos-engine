# Data Model

## Project

```ts
type Project = {
  id: string;
  name: string;
  profileId: string;
  createdAt: string;
  updatedAt: string;
  version: string;
};
```

## Profile

```ts
type Profile = {
  id: string;
  name: string;
  description: string;
  phases: Phase[];
  documents: DocumentDefinition[];
  questions: Question[];
  decisionSchema: DecisionSchema[];
  validationRules: ValidationRule[];
};
```

## Phase

```ts
type Phase = {
  id: string;
  title: string;
  description: string;
  requiredDecisionIds: string[];
  documentIds: string[];
};
```

## Question

```ts
type Question = {
  id: string;
  phaseId: string;
  text: string;
  helpText?: string;
  answerType: "text" | "choice" | "multi_choice" | "number" | "boolean";
  options?: string[];
  mapsToDecisionIds?: string[];
  condition?: Condition;
};
```

## Answer

```ts
type Answer = {
  id: string;
  questionId: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
};
```

## Decision

```ts
type DecisionStatus = "unknown" | "assumed" | "proposed" | "confirmed" | "deprecated";

type Decision = {
  id: string;
  title: string;
  value: unknown;
  status: DecisionStatus;
  confidence: "low" | "medium" | "high";
  sourceAnswerIds: string[];
  sourceProposalId?: string;
  impacts: string[];
  affectedDocuments: string[];
  createdAt: string;
  updatedAt: string;
};
```

## AI Output

```ts
type AiOutputStatus = "draft" | "proposed" | "needs_review" | "rejected" | "confirmed";

type AiOutput = {
  id: string;
  operation: string;
  status: AiOutputStatus;
  promptVersion: string;
  providerId: string;
  sourceAnswerIds: string[];
  relatedDecisionIds: string[];
  createdAt: string;
};
```

Decision status and AI output status are separate concepts. A generated AI proposal can become a confirmed decision only after user confirmation.

## AI Provider Configuration

```ts
type AiProviderProtocol = "openai_compatible" | "anthropic" | "ollama" | "custom";

type AiTransmissionMode = "local_only" | "remote_explicit";

type AiProviderConfig = {
  enabled: boolean;
  provider: string;
  protocol: AiProviderProtocol;
  endpoint: string;
  model: string;
  tokenEnvVar?: string;
  tokenCredentialRef?: string;
  requiresToken: boolean;
  transmission: AiTransmissionMode;
  timeoutMs?: number;
};
```

`AiProviderConfig` may be stored in `.logos/config.json` when it contains no raw secrets.

Raw API tokens should not be stored in project state by default. They should be read from environment variables, an OS credential store, or temporary session input.

## Risk

```ts
type Risk = {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  relatedDecisionIds: string[];
  mitigation?: string;
};
```

## Document Definition

```ts
type DocumentDefinition = {
  id: string;
  phaseId: string;
  path: string;
  title: string;
  purpose: string;
  templatePath: string;
  requiredDecisionIds: string[];
  primaryQuestions: string[];
  sections: DocumentSectionDefinition[];
  generatedOutputs: string[];
  dependencies: DocumentDependencyDefinition;
  completionCriteria: string[];
  validationRuleIds: string[];
  promptContext: DocumentPromptContext;
};

type DocumentSectionDefinition = {
  id: string;
  title: string;
  required: boolean;
};

type DocumentDependencyDefinition = {
  documents: string[];
  decisions: string[];
};

type DocumentPromptContext = {
  includeConfirmedDecisions: boolean;
  includeAssumptions: boolean;
  includeOpenQuestions: boolean;
};
```

## Validation Rule

```ts
type ValidationRule = {
  id: string;
  description: string;
  severity: "info" | "warning" | "error" | "critical";
  condition: Condition;
  message: string;
};
```
