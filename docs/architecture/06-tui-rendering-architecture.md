# 06 — TUI Rendering Architecture

## 1. Purpose

This document defines how the LOGOS Engine TUI should render state without owning state logic.

---

## 2. Rendering Thesis

```txt
The TUI is a projection of runtime state.
It is not the source of runtime truth.
```

---

## 3. Rendering Inputs

The TUI receives a render snapshot from the application layer.

```ts
type TuiRenderSnapshot = {
  mode: SessionMode
  sidebar: SidebarRenderModel
  mainPanel: MainPanelRenderModel
  actionBar: ActionBarRenderModel
  input: InputRenderModel
  diagnostics: RuntimeDiagnostic[]
}
```

---

## 4. Primary Layout

```txt
┌──────────────────────────────┬────────────────────────────────────┐
│ Structure Sidebar            │ Main Conversational Surface         │
│                              │                                    │
│ Profile                      │ Breadcrumb                         │
│ Phase / Document / Node Tree │ Conversation / Preview             │
│ Status Indicators            │ Input + Contextual Actions         │
└──────────────────────────────┴────────────────────────────────────┘
```

Optional future regions:

```txt
- command palette;
- document preview split;
- diagnostics drawer;
- export panel;
- help overlay.
```

---

## 5. Render Modes

```ts
type TuiRenderMode =
  | "idle"
  | "profile_selection"
  | "structure_overview"
  | "node_focus"
  | "document_preview"
  | "export"
  | "settings"
  | "error"
```

Render mode derives from runtime state.

---

## 6. Structural Mode

Condition:

```txt
activeNodeId === null
```

Render:

```txt
- selected profile or profile selection;
- deterministic actions;
- profile structure if selected;
- resume last active node if available;
- settings/import/export actions when valid.
```

---

## 7. Node-Focused Mode

Condition:

```txt
activeNodeId !== null
```

Render:

```txt
- active node breadcrumb;
- node lifecycle status;
- node conversation;
- canonical answer preview if available;
- completeness hints when useful;
- allowed contextual actions;
- free text input when allowed.
```

---

## 8. Sidebar Render Model

```ts
type SidebarRenderModel = {
  profileTitle?: string
  phases: SidebarPhase[]
  activeNodeId: string | null
}
```

```ts
type SidebarNode = {
  nodeId: string
  title: string
  statusSymbol: string
  selected: boolean
  disabled: boolean
  reasonIfDisabled?: string
}
```

---

## 9. Main Panel Render Model

```ts
type MainPanelRenderModel =
  | IdlePanel
  | ProfilePanel
  | NodeConversationPanel
  | DocumentPreviewPanel
  | ExportPanel
  | SettingsPanel
  | ErrorPanel
```

---

## 10. Action Bar Rendering

Actions must come from state engine.

```ts
type ActionBarRenderModel = {
  actions: Array<{
    id: string
    label: string
    enabled: boolean
    reasonIfDisabled?: string
  }>
}
```

The TUI may map action IDs to keybindings, but it cannot invent actions.

---

## 11. Input Rendering

```ts
type InputRenderModel = {
  enabled: boolean
  placeholder?: string
  submitAction?: string
  reasonIfDisabled?: string
}
```

Input enabled only when current state permits user response.

---

## 12. Focus Management

The TUI should manage focus between:

```txt
- sidebar tree;
- conversation input;
- action bar;
- document preview;
- command palette, if implemented.
```

Initial rules:

```txt
- node-focused mode focuses input when input is enabled;
- structural mode focuses first deterministic action;
- document preview focuses preview body;
- blocked node focuses recommended action.
```

---

## 13. Keyboard Navigation

Minimum expected keyboard behavior:

```txt
- up/down navigate sidebar items;
- enter selects focused node/action;
- tab changes focus region;
- escape returns from preview/export/settings to previous mode;
- ctrl/cmd+k reserved for future command palette.
```

Full shortcut spec can come later.

---

## 14. Rendering Invariants

```txt
- Active sidebar node must equal activeNodeId.
- Conversation displayed must belong to activeNodeId.
- Canonical preview must belong to active node.
- Disabled actions must include reason when possible.
- TUI must tolerate missing optional regions.
- Render must be possible from snapshot alone.
```

---

## 15. Anti-Patterns

```txt
- rendering static questionnaire fields;
- hiding state transitions inside UI components;
- calling LLM from UI event handlers;
- storing canonical answers in UI state only;
- allowing UI actions not approved by state engine.
```
