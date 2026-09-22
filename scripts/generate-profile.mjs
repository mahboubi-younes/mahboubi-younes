import { readFile, writeFile } from 'node:fs/promises';

const catalogUrl = process.env.PROJECT_CATALOG_URL || 'https://raw.githubusercontent.com/mahboubi-younes/Porftolio/main/projects/catalog.json';
const readmePath = new URL('../README.md', import.meta.url);
const catalog = await fetch(catalogUrl).then((response) => {
  if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
  return response.json();
});

const projects = catalog.projects.filter((project) => project.featured).sort((a, b) => a.snapshotOrder - b.snapshotOrder);
const featured = projects.map((project) => {
  const links = [`[Démo](${project.demo})`, `[Source](${project.repository})`];
  if (project.sourceRepository) links.push(`[Source produit](${project.sourceRepository})`);
  return `- **${project.name}** — ${project.description} ${links.join(' · ')}`;
}).join('\n');
const snapshots = projects.map((project) => `### ${project.name}\n\n**${project.category}** — ${project.demoCapabilities.slice(0, 3).join(' · ')}\n\n[Explorer la démo](${project.demo}) · [Lire le code](${project.repository})`).join('\n\n');
const generated = `<!-- GENERATED:ENGINEERING_PROFILE:START -->\n## Engineering projects\n\n${featured}\n\n## Project snapshots\n\n${snapshots}\n\n_Generated from the public project catalog. The catalog is the source of truth for project links and capabilities._\n<!-- GENERATED:ENGINEERING_PROFILE:END -->`;
const readme = await readFile(readmePath, 'utf8');
const marker = /<!-- GENERATED:ENGINEERING_PROFILE:START -->[\s\S]*?<!-- GENERATED:ENGINEERING_PROFILE:END -->/;
const next = marker.test(readme) ? readme.replace(marker, generated) : `${readme.trim()}\n\n${generated}\n`;
await writeFile(readmePath, next);
console.log(`Generated ${projects.length} flagship projects from ${catalogUrl}`);
