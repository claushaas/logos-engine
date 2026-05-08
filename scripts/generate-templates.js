import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const documentsFile = readFileSync(
	'profiles/app-business/documents.yml',
	'utf8',
);
const documentsData = parse(documentsFile);

for (const doc of documentsData.documents) {
	const templatePath = `profiles/app-business/${doc.template}`;
	const sections = doc.sections
		.map((section) => `## ${section.title}\n\n_Awaiting input._`)
		.join('\n\n');

	const content = `# ${doc.title}\n\n${doc.purpose}\n\n${sections}\n`;

	const { writeFileSync, mkdirSync } = await import('node:fs');
	const { dirname: pathDirname } = await import('node:path');
	mkdirSync(pathDirname(templatePath), { recursive: true });
	writeFileSync(templatePath, content, 'utf8');
	console.log(`Created ${templatePath}`);
}

console.log(`Generated ${documentsData.documents.length} templates.`);
