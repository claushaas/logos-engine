/** Step 10.3 — Agent Pack Markdown templates */

import type {
	AgentPackRenderMetadata,
	AgentPackRenderSection,
	AgentPackRenderSectionKind,
	AgentPackTemplate,
	AgentPackTemplateKind,
} from './agent-pack-render-types.js';
import { SECTION_SORT_ORDER } from './agent-pack-render-types.js';

// ---------------------------------------------------------------------------
// Derived warning text (shared)
// ---------------------------------------------------------------------------

const DERIVED_WARNING = [
	'> **WARNING: Derived, Non-Canonical Execution Aid**',
	'>',
	'> This Agent Pack is a derived, non-canonical execution aid generated',
	'> from structured project state. It is NOT a source of truth.',
	'>',
	'> Canonical project documentation remains in generated Markdown files',
	'> and structured `.logos/` workspace state.',
	'>',
	'> Do not treat this pack as authoritative.',
	'> Do not make unrelated changes outside the pack scope.',
	'> Do not invent missing project facts.',
	'> Do not treat this pack as canonical documentation.',
	'> Always verify claims against canonical sources before acting.',
].join('\n');

// ---------------------------------------------------------------------------
// Universal constraints (shared)
// ---------------------------------------------------------------------------

const UNIVERSAL_CONSTRAINTS = [
	'Do not make unrelated changes.',
	'Do not treat this Agent Pack as canonical.',
	'Do not modify files outside the declared scope unless explicitly necessary and reported.',
	'Do not invent missing project facts.',
	'Preserve unresolved questions and review-required items.',
	'Do not expose secrets or raw provider context.',
	'Do not call external services unless explicitly authorized by the user/environment and relevant to the task.',
	'Do not change canonical docs unless the pack explicitly instructs documentation updates.',
];

// ---------------------------------------------------------------------------
// Metadata block builder (shared)
// ---------------------------------------------------------------------------

function buildMetadataBlock(metadata: AgentPackRenderMetadata): string {
	const lines: string[] = [];
	lines.push('```yaml');
	lines.push(`artifactType: agent_pack`);
	lines.push(`canonical: false`);
	lines.push(`derived: true`);
	lines.push(`executionAid: true`);
	lines.push(`packId: ${metadata.packId}`);
	lines.push(`packKind: ${metadata.packKind}`);
	lines.push(`templateKind: ${metadata.templateKind}`);
	lines.push(`sourceBundleId: ${metadata.sourceBundleId}`);
	lines.push(`profileId: ${metadata.profileId}`);
	if (metadata.profileVersion) {
		lines.push(`profileVersion: ${metadata.profileVersion}`);
	}
	lines.push(`generatedAt: ${metadata.generatedAt}`);
	if (metadata.sourceDocumentIds.length > 0) {
		lines.push(`sourceDocumentIds: [${metadata.sourceDocumentIds.join(', ')}]`);
	}
	if (metadata.sourceCanonicalPaths.length > 0) {
		lines.push(
			`sourceCanonicalPaths: [${metadata.sourceCanonicalPaths.join(', ')}]`,
		);
	}
	if (metadata.logosItemId) {
		lines.push(`logosItemId: ${metadata.logosItemId}`);
	}
	if (metadata.traceabilitySourceIds.length > 0) {
		lines.push(
			`traceabilitySourceIds: [${metadata.traceabilitySourceIds.join(', ')}]`,
		);
	}
	if (metadata.registerItemIds.length > 0) {
		lines.push(`registerItemIds: [${metadata.registerItemIds.join(', ')}]`);
	}
	if (metadata.validationStatus) {
		lines.push(`validationStatus: ${metadata.validationStatus}`);
	}
	if (metadata.readinessStatus) {
		lines.push(`readinessStatus: ${metadata.readinessStatus}`);
	}
	lines.push('```');
	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Source documents section (shared)
// ---------------------------------------------------------------------------

function buildSourceDocumentsSection(
	metadata: AgentPackRenderMetadata,
	sourceContent: string,
): string {
	const lines: string[] = [];
	lines.push('## Source Canonical Documents');
	lines.push('');

	if (metadata.sourceDocumentIds.length > 0) {
		lines.push('**Document IDs:**');
		for (const id of metadata.sourceDocumentIds) {
			lines.push(`- \`${id}\``);
		}
		lines.push('');
	}

	if (metadata.sourceCanonicalPaths.length > 0) {
		lines.push('**Canonical Paths:**');
		for (const p of metadata.sourceCanonicalPaths) {
			lines.push(`- \`${p}\``);
		}
		lines.push('');
	}

	if (sourceContent) {
		lines.push(sourceContent);
		lines.push('');
	}

	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Section content extractors from bundle
// ---------------------------------------------------------------------------

function sectionTitle(kind: AgentPackRenderSectionKind): string {
	switch (kind) {
		case 'metadata':
			return 'Metadata';
		case 'derived_warning':
			return 'Derived Artifact Warning';
		case 'objective':
			return 'Objective';
		case 'scope':
			return 'Scope';
		case 'source_documents':
			return 'Source Documents';
		case 'constraints':
			return 'Constraints';
		case 'required_changes':
			return 'Required Changes';
		case 'acceptance_criteria':
			return 'Acceptance Criteria';
		case 'non_goals':
			return 'Non-Goals';
		case 'decisions':
			return 'Decisions';
		case 'assumptions':
			return 'Assumptions';
		case 'hypotheses':
			return 'Hypotheses';
		case 'risks':
			return 'Risks';
		case 'open_questions':
			return 'Open Questions';
		case 'validation_findings':
			return 'Validation Findings';
		case 'consistency_findings':
			return 'Consistency Findings';
		case 'traceability':
			return 'Traceability';
		case 'expected_outputs':
			return 'Expected Outputs';
		case 'reporting_requirements':
			return 'Reporting Requirements';
		case 'diagnostics':
			return 'Diagnostics';
	}
}

function renderSections(sections: AgentPackRenderSection[]): string {
	const sorted = [...sections].sort(
		(a, b) =>
			(SECTION_SORT_ORDER[a.kind] ?? 99) - (SECTION_SORT_ORDER[b.kind] ?? 99),
	);

	const parts: string[] = [];
	for (const section of sorted) {
		if (!section.content) continue;
		// Use custom title if different from the default, otherwise use the kind-based title
		const defaultTitle = sectionTitle(section.kind);
		const title = section.title !== defaultTitle ? section.title : defaultTitle;
		parts.push(`## ${title}`);
		parts.push('');
		parts.push(section.content);
		parts.push('');
	}
	return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Template: Coding Agent
// ---------------------------------------------------------------------------

const codingAgentTemplate: AgentPackTemplate = {
	kind: 'coding_agent',
	render(input) {
		const sections: AgentPackRenderSection[] = [];

		// Metadata
		sections.push({
			content: buildMetadataBlock(input.metadata),
			kind: 'metadata',
			sortOrder: SECTION_SORT_ORDER.metadata,
			title: 'Metadata',
		});

		// Derived warning
		sections.push({
			content: DERIVED_WARNING,
			kind: 'derived_warning',
			sortOrder: SECTION_SORT_ORDER.derived_warning,
			title: 'Derived Artifact Warning',
		});

		// Objective
		let objectiveText = input.objective;
		if (!objectiveText) {
			objectiveText = `Implement changes described in this pack.`;
		}
		sections.push({
			content: objectiveText,
			kind: 'objective',
			sortOrder: SECTION_SORT_ORDER.objective,
			title: 'Objective',
		});

		// Scope
		sections.push({
			content: `**Strict Scope**\n\n${input.scope || 'No scope defined. Do not make unrelated changes.'}`,
			kind: 'scope',
			sortOrder: SECTION_SORT_ORDER.scope,
			title: 'Scope',
		});

		// Source documents
		sections.push({
			content: buildSourceDocumentsSection(
				input.metadata,
				input.sourceDocuments,
			),
			kind: 'source_documents',
			sortOrder: SECTION_SORT_ORDER.source_documents,
			title: 'Source Documents',
		});

		// Constraints
		let constraintsText = input.constraints || '';
		constraintsText +=
			'\n\n**Universal Constraints:**\n' +
			UNIVERSAL_CONSTRAINTS.map((c) => `- ${c}`).join('\n');
		sections.push({
			content: constraintsText,
			kind: 'constraints',
			sortOrder: SECTION_SORT_ORDER.constraints,
			title: 'Constraints',
		});

		// Required changes
		if (input.requiredChanges) {
			sections.push({
				content: input.requiredChanges,
				kind: 'required_changes',
				sortOrder: SECTION_SORT_ORDER.required_changes,
				title: 'Required Changes',
			});
		}

		// Acceptance criteria
		if (input.acceptanceCriteria) {
			sections.push({
				content: input.acceptanceCriteria,
				kind: 'acceptance_criteria',
				sortOrder: SECTION_SORT_ORDER.acceptance_criteria,
				title: 'Acceptance Criteria',
			});
		}

		// Non-goals
		if (input.nonGoals) {
			sections.push({
				content: input.nonGoals,
				kind: 'non_goals',
				sortOrder: SECTION_SORT_ORDER.non_goals,
				title: 'Non-Goals',
			});
		}

		// Forbidden unrelated changes
		sections.push({
			content:
				'**Forbidden Unrelated Changes**\n\n' +
				'Do not make any changes outside the declared scope.\n' +
				'If you believe a change outside scope is necessary, report it as a finding — do not implement it.',
			kind: 'non_goals',
			sortOrder: SECTION_SORT_ORDER.non_goals + 0.1,
			title: 'Forbidden Unrelated Changes',
		});

		// Decisions
		if (input.decisions) {
			sections.push({
				content: input.decisions,
				kind: 'decisions',
				sortOrder: SECTION_SORT_ORDER.decisions,
				title: 'Decisions',
			});
		}

		// Assumptions
		if (input.assumptions) {
			sections.push({
				content: input.assumptions,
				kind: 'assumptions',
				sortOrder: SECTION_SORT_ORDER.assumptions,
				title: 'Assumptions',
			});
		}

		// Risks
		if (input.risks) {
			sections.push({
				content: input.risks,
				kind: 'risks',
				sortOrder: SECTION_SORT_ORDER.risks,
				title: 'Risks',
			});
		}

		// Open questions
		if (input.openQuestions) {
			sections.push({
				content: input.openQuestions,
				kind: 'open_questions',
				sortOrder: SECTION_SORT_ORDER.open_questions,
				title: 'Unresolved Questions',
			});
		}

		// Expected outputs
		if (input.expectedOutputs) {
			sections.push({
				content: input.expectedOutputs,
				kind: 'expected_outputs',
				sortOrder: SECTION_SORT_ORDER.expected_outputs,
				title: 'Expected Outputs',
			});
		}

		// Reporting requirements
		const reportingLines: string[] = [];
		if (input.reportingRequirements) {
			reportingLines.push(input.reportingRequirements);
		}
		reportingLines.push(
			'- Report changed files with descriptions',
			'- Report any blockers encountered',
			'- Report any scope assumptions you had to make',
			'- Do not claim validation passed unless you ran the commands',
		);
		if (input.validationFindings) {
			// Include suggested validation commands if present
			reportingLines.push('');
			reportingLines.push('**Suggested Validation Commands:**');
			reportingLines.push(input.validationFindings);
		}
		sections.push({
			content: reportingLines.join('\n'),
			kind: 'reporting_requirements',
			sortOrder: SECTION_SORT_ORDER.reporting_requirements,
			title: 'Reporting Requirements',
		});

		// Diagnostics
		if (input.diagnostics) {
			sections.push({
				content: input.diagnostics,
				kind: 'diagnostics',
				sortOrder: SECTION_SORT_ORDER.diagnostics,
				title: 'Diagnostics',
			});
		}

		return renderSections(sections);
	},
};

// ---------------------------------------------------------------------------
// Template: Review Agent
// ---------------------------------------------------------------------------

const reviewAgentTemplate: AgentPackTemplate = {
	kind: 'review_agent',
	render(input) {
		const sections: AgentPackRenderSection[] = [];

		sections.push({
			content: buildMetadataBlock(input.metadata),
			kind: 'metadata',
			sortOrder: SECTION_SORT_ORDER.metadata,
			title: 'Metadata',
		});

		sections.push({
			content: DERIVED_WARNING,
			kind: 'derived_warning',
			sortOrder: SECTION_SORT_ORDER.derived_warning,
			title: 'Derived Artifact Warning',
		});

		const objectiveText =
			input.objective ||
			'Review the provided artifacts and findings against canonical sources.';
		sections.push({
			content: objectiveText,
			kind: 'objective',
			sortOrder: SECTION_SORT_ORDER.objective,
			title: 'Review Objective',
		});

		sections.push({
			content: buildSourceDocumentsSection(
				input.metadata,
				input.sourceDocuments,
			),
			kind: 'source_documents',
			sortOrder: SECTION_SORT_ORDER.source_documents,
			title: 'Source Documents',
		});

		// Review focus
		const reviewLines: string[] = [];
		reviewLines.push('**Review focus areas:**');
		reviewLines.push(
			'- Verify claims against canonical source documents.',
			'- Inspect validation and consistency findings.',
			'- Assess risks and open questions for impact.',
			'- Check that acceptance criteria are satisfied.',
		);
		if (input.validationFindings) {
			reviewLines.push('');
			reviewLines.push('### Validation Findings to Inspect');
			reviewLines.push('');
			reviewLines.push(input.validationFindings);
		}
		if (input.consistencyFindings) {
			reviewLines.push('');
			reviewLines.push('### Consistency Findings to Inspect');
			reviewLines.push('');
			reviewLines.push(input.consistencyFindings);
		}
		if (input.risks) {
			reviewLines.push('');
			reviewLines.push('### Risk Focus');
			reviewLines.push('');
			reviewLines.push(input.risks);
		}
		if (input.openQuestions) {
			reviewLines.push('');
			reviewLines.push('### Open Question Focus');
			reviewLines.push('');
			reviewLines.push(input.openQuestions);
		}
		sections.push({
			content: reviewLines.join('\n'),
			kind: 'scope',
			sortOrder: SECTION_SORT_ORDER.scope,
			title: 'Review Scope',
		});

		// Constraints
		const constraintLines: string[] = [];
		if (input.constraints) constraintLines.push(input.constraints);
		constraintLines.push(
			'\n**Instructions:**',
			'- Do not mutate files unless explicitly allowed.',
			'- Report findings with source references.',
			'- Distinguish between confirmed facts and assumptions.',
			'- Mark unresolved items clearly.',
		);
		sections.push({
			content: constraintLines.join('\n'),
			kind: 'constraints',
			sortOrder: SECTION_SORT_ORDER.constraints,
			title: 'Review Constraints',
		});

		// Acceptance / review criteria
		if (input.acceptanceCriteria) {
			sections.push({
				content: input.acceptanceCriteria,
				kind: 'acceptance_criteria',
				sortOrder: SECTION_SORT_ORDER.acceptance_criteria,
				title: 'Review Criteria',
			});
		}

		// Decisions
		if (input.decisions) {
			sections.push({
				content: input.decisions,
				kind: 'decisions',
				sortOrder: SECTION_SORT_ORDER.decisions,
				title: 'Decisions',
			});
		}

		// Traceability
		if (input.traceability) {
			sections.push({
				content: input.traceability,
				kind: 'traceability',
				sortOrder: SECTION_SORT_ORDER.traceability,
				title: 'Traceability',
			});
		}

		// Reporting requirements
		const reportLines: string[] = [];
		if (input.reportingRequirements) {
			reportLines.push(input.reportingRequirements);
		}
		reportLines.push(
			'**Required Output Format:**',
			'- Summary of findings (pass / warning / fail per criteria)',
			'- Source references for each finding',
			'- List of unresolved or review-required items',
			'- Recommendations for any corrective action',
		);
		sections.push({
			content: reportLines.join('\n'),
			kind: 'reporting_requirements',
			sortOrder: SECTION_SORT_ORDER.reporting_requirements,
			title: 'Reporting Requirements',
		});

		if (input.diagnostics) {
			sections.push({
				content: input.diagnostics,
				kind: 'diagnostics',
				sortOrder: SECTION_SORT_ORDER.diagnostics,
				title: 'Diagnostics',
			});
		}

		return renderSections(sections);
	},
};

// ---------------------------------------------------------------------------
// Template: Documentation Agent
// ---------------------------------------------------------------------------

const documentationAgentTemplate: AgentPackTemplate = {
	kind: 'documentation_agent',
	render(input) {
		const sections: AgentPackRenderSection[] = [];

		sections.push({
			content: buildMetadataBlock(input.metadata),
			kind: 'metadata',
			sortOrder: SECTION_SORT_ORDER.metadata,
			title: 'Metadata',
		});

		sections.push({
			content: DERIVED_WARNING,
			kind: 'derived_warning',
			sortOrder: SECTION_SORT_ORDER.derived_warning,
			title: 'Derived Artifact Warning',
		});

		const objectiveText =
			input.objective ||
			'Produce or update canonical documentation based on the provided source context.';
		sections.push({
			content: objectiveText,
			kind: 'objective',
			sortOrder: SECTION_SORT_ORDER.objective,
			title: 'Documentation Objective',
		});

		sections.push({
			content: buildSourceDocumentsSection(
				input.metadata,
				input.sourceDocuments,
			),
			kind: 'source_documents',
			sortOrder: SECTION_SORT_ORDER.source_documents,
			title: 'Source Docs / Descriptors',
		});

		// Scope with gap awareness
		let scopeText =
			input.scope || 'Update or create documentation as specified.';
		if (input.openQuestions) {
			scopeText += '\n\n**Known Gaps / Required Sections:**\n';
			scopeText += input.openQuestions;
		}
		sections.push({
			content: scopeText,
			kind: 'scope',
			sortOrder: SECTION_SORT_ORDER.scope,
			title: 'Scope',
		});

		// Instructions
		const instrLines: string[] = [];
		if (input.constraints) instrLines.push(input.constraints);
		instrLines.push(
			'',
			'**Key Instructions:**',
			'- Do not invent missing facts.',
			'- Mark unknowns as assumptions or open questions.',
			'- Use canonical terminology and glossary where available.',
			'- Preserve existing document structure unless explicitly told otherwise.',
			'- Cross-reference other canonical documents where relevant.',
		);
		sections.push({
			content: instrLines.join('\n'),
			kind: 'constraints',
			sortOrder: SECTION_SORT_ORDER.constraints,
			title: 'Constraints',
		});

		if (input.requiredChanges) {
			sections.push({
				content: input.requiredChanges,
				kind: 'required_changes',
				sortOrder: SECTION_SORT_ORDER.required_changes,
				title: 'Required Changes',
			});
		}

		if (input.acceptanceCriteria) {
			sections.push({
				content: input.acceptanceCriteria,
				kind: 'acceptance_criteria',
				sortOrder: SECTION_SORT_ORDER.acceptance_criteria,
				title: 'Acceptance Criteria',
			});
		}

		if (input.nonGoals) {
			sections.push({
				content: input.nonGoals,
				kind: 'non_goals',
				sortOrder: SECTION_SORT_ORDER.non_goals,
				title: 'Non-Goals',
			});
		}

		// Assumptions
		if (input.assumptions) {
			sections.push({
				content: input.assumptions,
				kind: 'assumptions',
				sortOrder: SECTION_SORT_ORDER.assumptions,
				title: 'Assumptions',
			});
		}

		// Traceability
		if (input.traceability) {
			sections.push({
				content: input.traceability,
				kind: 'traceability',
				sortOrder: SECTION_SORT_ORDER.traceability,
				title: 'Source References',
			});
		}

		if (input.expectedOutputs) {
			sections.push({
				content: input.expectedOutputs,
				kind: 'expected_outputs',
				sortOrder: SECTION_SORT_ORDER.expected_outputs,
				title: 'Expected Outputs',
			});
		}

		const reportLines: string[] = [];
		if (input.reportingRequirements) {
			reportLines.push(input.reportingRequirements);
		}
		reportLines.push(
			'- List documents created or updated',
			'- List any assumptions made',
			'- List any open questions that remain',
		);
		sections.push({
			content: reportLines.join('\n'),
			kind: 'reporting_requirements',
			sortOrder: SECTION_SORT_ORDER.reporting_requirements,
			title: 'Reporting Requirements',
		});

		if (input.diagnostics) {
			sections.push({
				content: input.diagnostics,
				kind: 'diagnostics',
				sortOrder: SECTION_SORT_ORDER.diagnostics,
				title: 'Diagnostics',
			});
		}

		return renderSections(sections);
	},
};

// ---------------------------------------------------------------------------
// Template: Research Agent
// ---------------------------------------------------------------------------

const researchAgentTemplate: AgentPackTemplate = {
	kind: 'research_agent',
	render(input) {
		const sections: AgentPackRenderSection[] = [];

		sections.push({
			content: buildMetadataBlock(input.metadata),
			kind: 'metadata',
			sortOrder: SECTION_SORT_ORDER.metadata,
			title: 'Metadata',
		});

		sections.push({
			content: DERIVED_WARNING,
			kind: 'derived_warning',
			sortOrder: SECTION_SORT_ORDER.derived_warning,
			title: 'Derived Artifact Warning',
		});

		const objectiveText =
			input.objective ||
			'Research open questions and evidence gaps identified in the canonical project documentation.';
		sections.push({
			content: objectiveText,
			kind: 'objective',
			sortOrder: SECTION_SORT_ORDER.objective,
			title: 'Research Objective',
		});

		sections.push({
			content: buildSourceDocumentsSection(
				input.metadata,
				input.sourceDocuments,
			),
			kind: 'source_documents',
			sortOrder: SECTION_SORT_ORDER.source_documents,
			title: 'Source Documents',
		});

		// Research boundary
		const researchLines: string[] = [];
		researchLines.push('**Research Boundary**');
		researchLines.push('');
		if (input.scope) {
			researchLines.push(input.scope);
			researchLines.push('');
		}
		researchLines.push(
			'**IMPORTANT: External research must be performed by the downstream agent**',
			'only if the user or execution environment explicitly allows it.',
			'LOGOS has not performed any external research.',
			'This pack only identifies what needs to be researched.',
		);
		sections.push({
			content: researchLines.join('\n'),
			kind: 'scope',
			sortOrder: SECTION_SORT_ORDER.scope,
			title: 'Research Boundary',
		});

		// Known assumptions/hypotheses
		if (input.assumptions) {
			sections.push({
				content: input.assumptions,
				kind: 'assumptions',
				sortOrder: SECTION_SORT_ORDER.assumptions,
				title: 'Known Assumptions',
			});
		}

		if (input.hypotheses) {
			sections.push({
				content: input.hypotheses,
				kind: 'hypotheses',
				sortOrder: SECTION_SORT_ORDER.hypotheses,
				title: 'Hypotheses',
			});
		}

		// Evidence requirements
		const evidenceLines: string[] = [];
		evidenceLines.push('**Evidence Requirements**');
		evidenceLines.push('');
		evidenceLines.push(
			'- Cite all sources clearly.',
			'- Distinguish facts from assumptions.',
			'- Mark confidence levels where possible.',
			'- Do not claim research has already been performed by LOGOS.',
		);
		if (input.expectedOutputs) {
			evidenceLines.push('');
			evidenceLines.push(input.expectedOutputs);
		}
		sections.push({
			content: evidenceLines.join('\n'),
			kind: 'acceptance_criteria',
			sortOrder: SECTION_SORT_ORDER.acceptance_criteria,
			title: 'Evidence Requirements',
		});

		// Open questions
		if (input.openQuestions) {
			sections.push({
				content: input.openQuestions,
				kind: 'open_questions',
				sortOrder: SECTION_SORT_ORDER.open_questions,
				title: 'Open Questions',
			});
		}

		// Constraints
		const constraintLines: string[] = [];
		if (input.constraints) constraintLines.push(input.constraints);
		constraintLines.push(
			'',
			'- Do not claim LOGOS performed any external research.',
			'- Do not fabricate data or sources.',
			'- Distinguish between LOGOS-sourced facts and external research findings.',
		);
		sections.push({
			content: constraintLines.join('\n'),
			kind: 'constraints',
			sortOrder: SECTION_SORT_ORDER.constraints,
			title: 'Research Constraints',
		});

		const reportLines: string[] = [];
		if (input.reportingRequirements) {
			reportLines.push(input.reportingRequirements);
		}
		reportLines.push(
			'- Report research findings with citations.',
			'- Report unresolved questions that remain.',
			'- Distinguish LOGOS-sourced information from externally researched information.',
		);
		sections.push({
			content: reportLines.join('\n'),
			kind: 'reporting_requirements',
			sortOrder: SECTION_SORT_ORDER.reporting_requirements,
			title: 'Reporting Requirements',
		});

		if (input.diagnostics) {
			sections.push({
				content: input.diagnostics,
				kind: 'diagnostics',
				sortOrder: SECTION_SORT_ORDER.diagnostics,
				title: 'Diagnostics',
			});
		}

		return renderSections(sections);
	},
};

// ---------------------------------------------------------------------------
// Template: Follow-Up Agent
// ---------------------------------------------------------------------------

const followUpAgentTemplate: AgentPackTemplate = {
	kind: 'follow_up_agent',
	render(input) {
		const sections: AgentPackRenderSection[] = [];

		sections.push({
			content: buildMetadataBlock(input.metadata),
			kind: 'metadata',
			sortOrder: SECTION_SORT_ORDER.metadata,
			title: 'Metadata',
		});

		sections.push({
			content: DERIVED_WARNING,
			kind: 'derived_warning',
			sortOrder: SECTION_SORT_ORDER.derived_warning,
			title: 'Derived Artifact Warning',
		});

		const objectiveText =
			input.objective ||
			'Follow up on unresolved questions, missing sources, and review-required claims.';
		sections.push({
			content: objectiveText,
			kind: 'objective',
			sortOrder: SECTION_SORT_ORDER.objective,
			title: 'Follow-Up Objective',
		});

		sections.push({
			content: buildSourceDocumentsSection(
				input.metadata,
				input.sourceDocuments,
			),
			kind: 'source_documents',
			sortOrder: SECTION_SORT_ORDER.source_documents,
			title: 'Affected Documents',
		});

		// Unresolved questions
		if (input.openQuestions) {
			sections.push({
				content: input.openQuestions,
				kind: 'open_questions',
				sortOrder: SECTION_SORT_ORDER.open_questions,
				title: 'Unresolved Questions',
			});
		}

		// Missing sources / review-required
		const itemsLines: string[] = [];
		if (input.scope) {
			itemsLines.push('**Scope Items:**');
			itemsLines.push(input.scope);
		}
		if (input.validationFindings) {
			itemsLines.push('');
			itemsLines.push('**Review-Required Claims:**');
			itemsLines.push(input.validationFindings);
		}
		if (!input.scope && !input.validationFindings) {
			itemsLines.push('No specific follow-up items have been identified.');
		}
		sections.push({
			content: itemsLines.join('\n'),
			kind: 'scope',
			sortOrder: SECTION_SORT_ORDER.scope,
			title: 'Follow-Up Items',
		});

		// Expected outputs
		if (input.expectedOutputs) {
			sections.push({
				content: input.expectedOutputs,
				kind: 'expected_outputs',
				sortOrder: SECTION_SORT_ORDER.expected_outputs,
				title: 'Expected Follow-Up Outputs',
			});
		}

		// Instructions
		const instrLines: string[] = [];
		if (input.constraints) instrLines.push(input.constraints);
		instrLines.push(
			'',
			'- Do not confirm state without explicit review.',
			'- Mark all findings with source references.',
			'- Distinguish between resolved and unresolved items.',
			'- Do not mutate canonical documents without explicit permission.',
		);
		sections.push({
			content: instrLines.join('\n'),
			kind: 'constraints',
			sortOrder: SECTION_SORT_ORDER.constraints,
			title: 'Constraints',
		});

		if (input.diagnostics) {
			sections.push({
				content: input.diagnostics,
				kind: 'diagnostics',
				sortOrder: SECTION_SORT_ORDER.diagnostics,
				title: 'Diagnostics',
			});
		}

		return renderSections(sections);
	},
};

// ---------------------------------------------------------------------------
// Template: Task Agent
// ---------------------------------------------------------------------------

const taskAgentTemplate: AgentPackTemplate = {
	kind: 'task_agent',
	render(input) {
		const sections: AgentPackRenderSection[] = [];

		sections.push({
			content: buildMetadataBlock(input.metadata),
			kind: 'metadata',
			sortOrder: SECTION_SORT_ORDER.metadata,
			title: 'Metadata',
		});

		sections.push({
			content: DERIVED_WARNING,
			kind: 'derived_warning',
			sortOrder: SECTION_SORT_ORDER.derived_warning,
			title: 'Derived Artifact Warning',
		});

		const objectiveText =
			input.objective || 'Complete the task described below.';
		sections.push({
			content: objectiveText,
			kind: 'objective',
			sortOrder: SECTION_SORT_ORDER.objective,
			title: 'Task Objective',
		});

		sections.push({
			content: `**Bounded Source Context**\n\n${input.scope || 'No scope defined.'}`,
			kind: 'scope',
			sortOrder: SECTION_SORT_ORDER.scope,
			title: 'Scope',
		});

		sections.push({
			content: buildSourceDocumentsSection(
				input.metadata,
				input.sourceDocuments,
			),
			kind: 'source_documents',
			sortOrder: SECTION_SORT_ORDER.source_documents,
			title: 'Source Context',
		});

		// Constraints
		let constraintsText = input.constraints || '';
		constraintsText +=
			'\n\n**Universal Constraints:**\n' +
			UNIVERSAL_CONSTRAINTS.map((c) => `- ${c}`).join('\n');
		sections.push({
			content: constraintsText,
			kind: 'constraints',
			sortOrder: SECTION_SORT_ORDER.constraints,
			title: 'Constraints',
		});

		// Required files/outputs
		if (input.requiredChanges) {
			sections.push({
				content: input.requiredChanges,
				kind: 'required_changes',
				sortOrder: SECTION_SORT_ORDER.required_changes,
				title: 'Required Files / Outputs',
			});
		}

		// Acceptance criteria
		if (input.acceptanceCriteria) {
			sections.push({
				content: input.acceptanceCriteria,
				kind: 'acceptance_criteria',
				sortOrder: SECTION_SORT_ORDER.acceptance_criteria,
				title: 'Acceptance Criteria',
			});
		}

		// Non-goals
		if (input.nonGoals) {
			sections.push({
				content: input.nonGoals,
				kind: 'non_goals',
				sortOrder: SECTION_SORT_ORDER.non_goals,
				title: 'Non-Goals',
			});
		}

		// Forbidden unrelated changes
		sections.push({
			content:
				'**Unrelated Change Prohibition**\n\n' +
				'Do not make changes outside the declared task scope.',
			kind: 'non_goals',
			sortOrder: SECTION_SORT_ORDER.non_goals + 0.1,
			title: 'Unrelated Change Prohibition',
		});

		// Decisions / risks / open questions
		if (input.decisions) {
			sections.push({
				content: input.decisions,
				kind: 'decisions',
				sortOrder: SECTION_SORT_ORDER.decisions,
				title: 'Decisions',
			});
		}
		if (input.risks) {
			sections.push({
				content: input.risks,
				kind: 'risks',
				sortOrder: SECTION_SORT_ORDER.risks,
				title: 'Risks',
			});
		}
		if (input.openQuestions) {
			sections.push({
				content: input.openQuestions,
				kind: 'open_questions',
				sortOrder: SECTION_SORT_ORDER.open_questions,
				title: 'Unresolved Questions',
			});
		}

		// Expected outputs
		if (input.expectedOutputs) {
			sections.push({
				content: input.expectedOutputs,
				kind: 'expected_outputs',
				sortOrder: SECTION_SORT_ORDER.expected_outputs,
				title: 'Expected Outputs',
			});
		}

		// Validation commands
		if (input.validationFindings) {
			sections.push({
				content:
					'**Suggested Validation Commands**\n\n' +
					'These commands are suggested — they are not automatically executed.\n\n' +
					input.validationFindings,
				kind: 'validation_findings',
				sortOrder: SECTION_SORT_ORDER.validation_findings,
				title: 'Suggested Validation Commands',
			});
		}

		// Reporting
		const reportLines: string[] = [];
		if (input.reportingRequirements) {
			reportLines.push(input.reportingRequirements);
		}
		reportLines.push(
			'- Report the format: what was done, what was found, what remains.',
			'- List files changed or created.',
			'- Report any blockers.',
		);
		sections.push({
			content: reportLines.join('\n'),
			kind: 'reporting_requirements',
			sortOrder: SECTION_SORT_ORDER.reporting_requirements,
			title: 'Reporting Format',
		});

		if (input.diagnostics) {
			sections.push({
				content: input.diagnostics,
				kind: 'diagnostics',
				sortOrder: SECTION_SORT_ORDER.diagnostics,
				title: 'Diagnostics',
			});
		}

		return renderSections(sections);
	},
};

// ---------------------------------------------------------------------------
// Template: Executive Task Agent
// ---------------------------------------------------------------------------

const executiveTaskAgentTemplate: AgentPackTemplate = {
	kind: 'executive_task_agent',
	render(input) {
		const sections: AgentPackRenderSection[] = [];

		sections.push({
			content: buildMetadataBlock(input.metadata),
			kind: 'metadata',
			sortOrder: SECTION_SORT_ORDER.metadata,
			title: 'Metadata',
		});

		sections.push({
			content: DERIVED_WARNING,
			kind: 'derived_warning',
			sortOrder: SECTION_SORT_ORDER.derived_warning,
			title: 'Derived Artifact Warning',
		});

		const objectiveText =
			input.objective ||
			'Execute the executive task described below using the provided normative source context.';
		sections.push({
			content: objectiveText,
			kind: 'objective',
			sortOrder: SECTION_SORT_ORDER.objective,
			title: 'Executive Task Objective',
		});

		sections.push({
			content: buildSourceDocumentsSection(
				input.metadata,
				input.sourceDocuments,
			),
			kind: 'source_documents',
			sortOrder: SECTION_SORT_ORDER.source_documents,
			title: 'Source Normative Documents',
		});

		// Readiness
		if (input.metadata.readinessStatus) {
			sections.push({
				content: `**Readiness Status:** \`${input.metadata.readinessStatus}\``,
				kind: 'scope',
				sortOrder: SECTION_SORT_ORDER.scope,
				title: 'Readiness Status',
			});
		}

		// Constraints
		let constraintsText = input.constraints || '';
		constraintsText +=
			'\n\n**Universal Constraints:**\n' +
			UNIVERSAL_CONSTRAINTS.map((c) => `- ${c}`).join('\n');
		sections.push({
			content: constraintsText,
			kind: 'constraints',
			sortOrder: SECTION_SORT_ORDER.constraints,
			title: 'Constraints',
		});

		// Required changes
		if (input.requiredChanges) {
			sections.push({
				content: input.requiredChanges,
				kind: 'required_changes',
				sortOrder: SECTION_SORT_ORDER.required_changes,
				title: 'Required Work',
			});
		}

		// Acceptance criteria
		if (input.acceptanceCriteria) {
			sections.push({
				content: input.acceptanceCriteria,
				kind: 'acceptance_criteria',
				sortOrder: SECTION_SORT_ORDER.acceptance_criteria,
				title: 'Acceptance Criteria',
			});
		}

		// Expected outputs
		if (input.expectedOutputs) {
			sections.push({
				content: input.expectedOutputs,
				kind: 'expected_outputs',
				sortOrder: SECTION_SORT_ORDER.expected_outputs,
				title: 'Expected Output',
			});
		}

		// Decisions / risks / open questions
		if (input.decisions) {
			sections.push({
				content: input.decisions,
				kind: 'decisions',
				sortOrder: SECTION_SORT_ORDER.decisions,
				title: 'Decisions',
			});
		}
		if (input.risks) {
			sections.push({
				content: input.risks,
				kind: 'risks',
				sortOrder: SECTION_SORT_ORDER.risks,
				title: 'Risks',
			});
		}
		if (input.openQuestions) {
			sections.push({
				content: input.openQuestions,
				kind: 'open_questions',
				sortOrder: SECTION_SORT_ORDER.open_questions,
				title: 'Unresolved Questions',
			});
		}

		// Executive Axis warning
		sections.push({
			content:
				'**Executive Axis Compilation**\n\n' +
				'Executive Axis compilation is NOT performed in this phase.\n' +
				'This task pack is derived from normative canonical sources only.\n' +
				'Executive JSON, Markdown, and HTML exports are Phase 11 deliverables.',
			kind: 'scope',
			sortOrder: SECTION_SORT_ORDER.scope + 0.1,
			title: 'Executive Axis Notice',
		});

		// Traceability
		if (input.traceability) {
			sections.push({
				content: input.traceability,
				kind: 'traceability',
				sortOrder: SECTION_SORT_ORDER.traceability,
				title: 'Source Traceability',
			});
		}

		if (input.diagnostics) {
			sections.push({
				content: input.diagnostics,
				kind: 'diagnostics',
				sortOrder: SECTION_SORT_ORDER.diagnostics,
				title: 'Diagnostics',
			});
		}

		return renderSections(sections);
	},
};

// ---------------------------------------------------------------------------
// Template: Custom
// ---------------------------------------------------------------------------

const customTemplate: AgentPackTemplate = {
	kind: 'custom',
	render(input) {
		const sections: AgentPackRenderSection[] = [];

		sections.push({
			content: buildMetadataBlock(input.metadata),
			kind: 'metadata',
			sortOrder: SECTION_SORT_ORDER.metadata,
			title: 'Metadata',
		});

		sections.push({
			content: DERIVED_WARNING,
			kind: 'derived_warning',
			sortOrder: SECTION_SORT_ORDER.derived_warning,
			title: 'Derived Artifact Warning',
		});

		const objectiveText = input.objective || 'Custom agent pack task.';
		sections.push({
			content: objectiveText,
			kind: 'objective',
			sortOrder: SECTION_SORT_ORDER.objective,
			title: 'Objective',
		});

		sections.push({
			content: buildSourceDocumentsSection(
				input.metadata,
				input.sourceDocuments,
			),
			kind: 'source_documents',
			sortOrder: SECTION_SORT_ORDER.source_documents,
			title: 'Source Documents',
		});

		if (input.scope) {
			sections.push({
				content: input.scope,
				kind: 'scope',
				sortOrder: SECTION_SORT_ORDER.scope,
				title: 'Scope',
			});
		}

		// Constraints
		let constraintsText = input.constraints || '';
		constraintsText +=
			'\n\n**Universal Constraints:**\n' +
			UNIVERSAL_CONSTRAINTS.map((c) => `- ${c}`).join('\n');
		sections.push({
			content: constraintsText,
			kind: 'constraints',
			sortOrder: SECTION_SORT_ORDER.constraints,
			title: 'Constraints',
		});

		if (input.requiredChanges) {
			sections.push({
				content: input.requiredChanges,
				kind: 'required_changes',
				sortOrder: SECTION_SORT_ORDER.required_changes,
				title: 'Required Changes',
			});
		}

		if (input.acceptanceCriteria) {
			sections.push({
				content: input.acceptanceCriteria,
				kind: 'acceptance_criteria',
				sortOrder: SECTION_SORT_ORDER.acceptance_criteria,
				title: 'Acceptance Criteria',
			});
		}

		if (input.nonGoals) {
			sections.push({
				content: input.nonGoals,
				kind: 'non_goals',
				sortOrder: SECTION_SORT_ORDER.non_goals,
				title: 'Non-Goals',
			});
		}

		if (input.expectedOutputs) {
			sections.push({
				content: input.expectedOutputs,
				kind: 'expected_outputs',
				sortOrder: SECTION_SORT_ORDER.expected_outputs,
				title: 'Expected Outputs',
			});
		}

		if (input.diagnostics) {
			sections.push({
				content: input.diagnostics,
				kind: 'diagnostics',
				sortOrder: SECTION_SORT_ORDER.diagnostics,
				title: 'Diagnostics',
			});
		}

		return renderSections(sections);
	},
};

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export const TEMPLATES: Record<AgentPackTemplateKind, AgentPackTemplate> = {
	coding_agent: codingAgentTemplate,
	custom: customTemplate,
	documentation_agent: documentationAgentTemplate,
	executive_task_agent: executiveTaskAgentTemplate,
	follow_up_agent: followUpAgentTemplate,
	research_agent: researchAgentTemplate,
	review_agent: reviewAgentTemplate,
	task_agent: taskAgentTemplate,
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { DERIVED_WARNING, UNIVERSAL_CONSTRAINTS };
