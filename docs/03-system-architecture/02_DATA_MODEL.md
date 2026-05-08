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
type Decision = {
  id: string;
  title: string;
  value: unknown;
  status: "unknown" | "assumed" | "proposed" | "confirmed" | "deprecated";
  confidence: "low" | "medium" | "high";
  sourceAnswerIds: string[];
  impacts: string[];
  affectedDocuments: string[];
  createdAt: string;
  updatedAt: string;
};
```

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
  path: string;
  title: string;
  templatePath: string;
  requiredDecisionIds: string[];
};
```

## Validation Rule

```ts
type ValidationRule = {
  id: string;
  description: string;
  severity: "info" | "warning" | "error";
  condition: Condition;
  message: string;
};
```
