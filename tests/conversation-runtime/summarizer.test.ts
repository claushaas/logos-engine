/**
 * Tests for Step 4.3 — conversation summary generation.
 *
 * Covers:
 *  - `summarizeConversation` — generates summary with Facts, Decisions,
 *    Assumptions sections.
 *  - Summary includes source message ID references (full IDs).
 *  - Summary includes reference to key claims from messages.
 *  - Summary length < 50% of original conversation length.
 *  - Empty input returns empty string.
 *  - System messages are ignored.
 *  - Raw messages are not mutated.
 *  - Balanced selection: at least one bullet per non-empty category.
 *  - Very short conversations that cannot produce a shorter summary return ''.
 */
import { describe, expect, it } from 'vitest';

import type {
	NodeMessage,
	NodeMessageRole,
} from '../../src/contracts/index.js';
import { summarizeConversation } from '../../src/conversation-runtime/index.js';
import { generateId, nowIso } from '../../src/shared/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════════════════

function msg(role: NodeMessageRole, content: string, id?: string): NodeMessage {
	return {
		content,
		createdAt: nowIso(),
		id: id ?? generateId(),
		role,
	};
}

/**
 * Build a conversation with N question/answer pairs.
 * Each pair adds heavy assistant padding so the original is much
 * longer than the extractable content, giving the 45% budget room.
 */
function buildPaddedConversation(
	pairs: {
		question: string;
		answer: string;
		id?: string;
	}[],
): { messages: NodeMessage[]; ids: Record<number, string> } {
	const messages: NodeMessage[] = [];
	const ids: Record<number, string> = {};

	for (let i = 0; i < pairs.length; i++) {
		const { question, answer, id } = pairs[i]!;

		messages.push(
			msg(
				'assistant',
				`${question} Please share all relevant background so we have a complete picture for the documentation. The more context you can provide, the better we can capture the important details for the overall project record.`,
			),
		);

		const answerId = id ?? generateId();
		ids[i] = answerId;
		messages.push(msg('user', answer, answerId));
	}

	return { ids, messages };
}

// ═══════════════════════════════════════════════════════════════════════════
// summarizeConversation
// ═══════════════════════════════════════════════════════════════════════════

describe('summarizeConversation', () => {
	it('returns empty string for empty message array', () => {
		expect(summarizeConversation([])).toBe('');
	});

	it('returns empty string when no substantive content is found', () => {
		const messages: NodeMessage[] = [
			msg('user', 'Hi!'),
			msg('assistant', 'Hello! How can I help?'),
			msg('user', 'Thanks.'),
		];
		expect(summarizeConversation(messages)).toBe('');
	});

	it('ignores system messages', () => {
		const messages: NodeMessage[] = [
			msg(
				'system',
				'The system has decided to use Postgres for all persistence layers.',
			),
			msg('user', 'Ok.'),
			msg(
				'assistant',
				'Understood. Is there anything else you would like to discuss?',
			),
		];
		expect(summarizeConversation(messages)).toBe('');
	});

	it('includes Facts section for declarative statements', () => {
		const pairs = [
			{
				answer:
					'The project targets enterprise customers who need real-time analytics. Our platform handles millions of events per second with sub-millisecond latency.',
				question:
					'Can you tell me about your project and who the target audience is?',
			},
			{
				answer:
					'The core differentiator is our proprietary stream processing engine that guarantees exactly-once delivery semantics for all data pipelines.',
				question: 'What makes your platform different from existing solutions?',
			},
			{
				answer:
					'We serve over fifty enterprise customers across three continents with a combined transaction volume of over half a billion events daily.',
				question:
					'How large is your current customer base and transaction volume?',
			},
			{
				answer:
					'The platform was launched three years ago and has grown steadily with a ninety-eight percent customer retention rate.',
				question:
					'How long has the platform been operational and what is the retention?',
			},
		];

		const { messages } = buildPaddedConversation(pairs);
		const result = summarizeConversation(messages);
		expect(result).toContain('Facts:');
		expect(result).toContain('real-time analytics');
	});

	it('includes Decisions section for decision-keyword sentences', () => {
		const decisionId = 'my-decision-msg';
		const pairs = [
			{
				answer:
					'After evaluating several options, we have decided to use Postgres for primary persistence and Redis for caching.',
				id: decisionId,
				question: 'What technology stack have you chosen for the project?',
			},
			{
				answer:
					'We also chose Kubernetes for container orchestration across all deployment environments with automated scaling policies.',
				question: 'What infrastructure tools are you using?',
			},
			{
				answer:
					'For monitoring we selected Prometheus combined with Grafana dashboards for visualization of all system metrics.',
				question: 'What monitoring solution have you chosen for production?',
			},
			{
				answer:
					'The logging infrastructure will be built around Elasticsearch for full-text search across all application logs.',
				question: 'What logging solution are you planning to implement?',
			},
		];

		const { messages } = buildPaddedConversation(pairs);
		const result = summarizeConversation(messages);
		expect(result).toContain('Decisions:');
		expect(result).toContain('Postgres');
		expect(result).toContain(decisionId);
	});

	it('includes Assumptions section for assumption-keyword sentences', () => {
		const assumptionId = 'my-assumption-msg';
		const pairs = [
			{
				answer:
					'We assume the target users are technical and comfortable with configuration. We also expect they will prefer API-first integration over a GUI dashboard for their daily workflows.',
				id: assumptionId,
				question: 'What assumptions are you making about your target users?',
			},
			{
				answer:
					'We believe the market will grow significantly. Our estimates suggest a forty percent increase in demand over the next two years.',
				question: 'What are your expectations for market growth?',
			},
			{
				answer:
					'We estimate that operational costs will decrease by thirty percent once the new architecture is fully deployed and stable.',
				question: 'What cost savings do you expect from the migration?',
			},
			{
				answer:
					'Our assumption is that most customers will adopt the cloud-native version within the first six months of its availability.',
				question:
					'What is your adoption timeline assumption for the new version?',
			},
		];

		const { messages } = buildPaddedConversation(pairs);
		const result = summarizeConversation(messages);
		expect(result).toContain('Assumptions:');
		expect(result).toContain('API-first');
		expect(result).toContain(assumptionId);
	});

	it('generates summary from a multi-turn conversation with balanced categories', () => {
		const pairs = [
			{
				answer:
					'Our platform provides real-time fraud detection for fintech companies. We decided to use a machine learning model trained on transaction patterns.',
				question: 'What is the core problem your product solves?',
			},
			{
				answer:
					'We assume our users have basic technical knowledge and will use our API directly rather than the dashboard.',
				question: 'What assumptions are you making about your users?',
			},
			{
				answer:
					'We decided to build the backend in Rust for maximum performance and memory safety.',
				question: 'What technology choices have you made for the backend?',
			},
			{
				answer:
					'The frontend will use React with TypeScript for type safety and a component-based architecture.',
				question: 'What frontend technology are you using?',
			},
		];

		const { messages } = buildPaddedConversation(pairs);
		const result = summarizeConversation(messages);

		const sectionCount =
			(result.includes('Facts:') ? 1 : 0) +
			(result.includes('Decisions:') ? 1 : 0) +
			(result.includes('Assumptions:') ? 1 : 0);
		expect(sectionCount).toBeGreaterThanOrEqual(2);

		// At least one key content claim should appear.
		const hasFraudOrRust =
			result.includes('fraud detection') || result.includes('Rust');
		expect(hasFraudOrRust).toBe(true);
	});

	it('summary length is less than 50% of original conversation length', () => {
		const pairs = [
			{
				answer:
					'Our platform provides real-time fraud detection for fintech companies across the globe. We decided to use a machine learning model trained on historical transaction patterns.',
				question:
					'Can you describe your platform and the core problem it solves?',
			},
			{
				answer:
					'We assume our users have basic technical knowledge and will use our API directly for critical alerts and notifications.',
				question: 'What assumptions are you making about your target users?',
			},
			{
				answer:
					'The core differentiator is our proprietary streaming engine that handles millions of events per second with sub-millisecond processing latency.',
				question: 'What makes your technology unique in the marketplace?',
			},
			{
				answer:
					'The frontend dashboard will use React with TypeScript for type safety and we will build our own component library.',
				question: 'What frontend technologies have you chosen and why?',
			},
			{
				answer:
					'We assume deployment will be on Kubernetes with Helm charts for orchestration across multiple cloud environments.',
				question: 'What is your deployment and infrastructure strategy?',
			},
			{
				answer:
					'The infrastructure team has decided to use AWS as the primary cloud provider for all production services and workloads.',
				question: 'Which cloud provider have you selected for production?',
			},
		];

		const { messages } = buildPaddedConversation(pairs);
		const originalLength = messages.reduce(
			(sum, m) => sum + m.content.length,
			0,
		);

		const result = summarizeConversation(messages);

		expect(result.length).toBeGreaterThan(0);
		expect(result.length).toBeLessThan(originalLength * 0.5);
		expect(result.length).toBeLessThanOrEqual(1000);
	});

	it('summary includes reference to key claim from messages', () => {
		const m1Id = 'key-message-1';
		const pairs = [
			{
				answer:
					'We decided to use Postgres with the TimescaleDB extension for time-series data. This is a critical architectural choice that affects all downstream components in the pipeline.',
				id: m1Id,
				question:
					'What database technologies have you selected for the project and why?',
			},
			{
				answer:
					'TimescaleDB provides automatic partitioning by time and optimized time-series functions for our analytics workloads.',
				question:
					'What benefits does TimescaleDB provide over standard Postgres?',
			},
			{
				answer:
					'We also considered MongoDB and Cassandra for specific workloads but the relational model was ultimately a better fit for our requirements.',
				question:
					'What alternatives did you evaluate before making this decision?',
			},
			{
				answer:
					'The migration plan involves a phased rollout starting with the least critical services first to minimize operational risk.',
				question: 'What is your migration strategy for the new database?',
			},
		];

		const { messages } = buildPaddedConversation(pairs);
		const result = summarizeConversation(messages);

		expect(result).toContain(m1Id);
		expect(result).toContain('Postgres');
		expect(result).toContain('TimescaleDB');
	});

	it('does not mutate input messages', () => {
		const messages: NodeMessage[] = [
			msg(
				'assistant',
				'Can you tell me what database you have chosen for this project?',
			),
			msg('user', 'We decided to use Postgres for primary data persistence.'),
			msg('assistant', 'That is a solid choice for relational data workloads.'),
		];
		const original = JSON.parse(JSON.stringify(messages));

		summarizeConversation(messages);

		expect(messages).toEqual(original);
	});

	it('returns the same summary for the same input (deterministic)', () => {
		const pairs = [
			{
				answer:
					'We decided to use Postgres for persistence. We assume deployment will be on AWS for all production environments.',
				question: 'What database and deployment choices have you made?',
			},
			{
				answer:
					'The caching layer will use Redis with a clustered configuration for high availability across multiple availability zones.',
				question: 'What caching solution are you planning to use?',
			},
			{
				answer:
					'For message queuing we selected RabbitMQ because of its mature ecosystem and broad community support.',
				question: 'What message broker have you chosen for async processing?',
			},
			{
				answer:
					'The API gateway will be built on Kong with custom plugins for authentication and rate limiting across all services.',
				question: 'What API gateway solution are you implementing?',
			},
		];

		const { messages } = buildPaddedConversation(pairs);

		const r1 = summarizeConversation(messages);
		const r2 = summarizeConversation(messages);

		expect(r1).toBe(r2);
	});

	it('returns empty string for conversations where summary cannot be shorter', () => {
		// A single substantive message with no non-substantive padding:
		// the extractable content equals the original, so no shorter summary
		// can be produced. The function correctly returns ''.
		const messages: NodeMessage[] = [
			msg(
				'assistant',
				'Based on our analysis, the recommended architecture is a microservices approach with event-driven communication between services. This design ensures loose coupling and independent deployability of each component throughout the entire system lifecycle. Each microservice should own its own database following the database-per-service pattern for strong encapsulation. The event bus should use a durable message broker such as Kafka or RabbitMQ to guarantee message delivery across all service boundaries. For observability, every service must expose health endpoints and emit structured logs in a consistent JSON format for centralized aggregation and monitoring.',
			),
		];

		const result = summarizeConversation(messages);
		// A summary cannot be shorter than a single message with no padding.
		expect(result).toBe('');
	});
});
