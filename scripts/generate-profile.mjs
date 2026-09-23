import fs, { readFile, writeFile, mkdir } from 'node:fs/promises';

const catalogUrl = process.env.PROJECT_CATALOG_URL || 'https://raw.githubusercontent.com/mahboubi-younes/Porftolio/main/projects/catalog.json';
const readmePath = new URL('../README.md', import.meta.url);
const evidenceSvgPath = new URL('../assets/engineering-evidence.svg', import.meta.url);

const catalog = catalogUrl.startsWith('file:')
  ? JSON.parse(await readFile(new URL(catalogUrl), 'utf8'))
  : await fetch(catalogUrl).then((response) =>
      response.ok ? response.json() : Promise.reject(new Error('Catalog request failed: ' + response.status))
    );

const projects = catalog.projects
  .filter((project) => project.featured)
  .sort((a, b) => a.snapshotOrder - b.snapshotOrder);

const passportFor = async (project) => {
  const match = String(project.repository).match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return null;

  const url = `https://raw.githubusercontent.com/${match[1]}/${match[2]}/main/engineering-passport.json`;

  try {
    const response = await fetch(url);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
};

const passports = await Promise.all(projects.map(passportFor));

const status = (passport, key) => {
  const value = passport?.evidence?.[key]?.status;
  return value === 'verified'
    ? 'VERIFIED'
    : value === 'detected'
      ? 'DETECTED'
      : 'UNKNOWN';
};

const featured = projects.map((project) => {
  const links = [`[Démo](${project.demo})`, `[Source](${project.repository})`];
  if (project.sourceRepository) links.push(`[Source produit](${project.sourceRepository})`);
  links.push(`[Passport](${project.repository}/blob/main/engineering-passport.md)`);

  return `- **${project.name}** — ${project.description} Limites : ${project.limitations.join('; ')}. ${links.join(' · ')}`;
}).join('\\n');

const snapshots = projects.map((project) => [
  `### ${project.name}`,
  '',
  `**${project.category}** — ${project.demoCapabilities.slice(0, 3).join(' · ')}`,
  '',
  `*Limites :* ${project.limitations.join('; ')}`,
  '',
  `[Explorer la démo](${project.demo}) · [Lire le code](${project.repository}) · [Passport](${project.repository}/blob/main/engineering-passport.md)`
].join('\\n')).join('\\n\\n');

const evidenceRows = projects.map((project, index) => {
  const passport = passports[index];

  return `| **${project.name}** | ${status(passport, 'BUILD')} | ${status(passport, 'CI')} | ${status(passport, 'DEPLOYMENT')} | ${status(passport, 'LIVE DEMO')} | [Passport](${project.repository}/blob/main/engineering-passport.md) |`;
}).join('\\n');

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const colorFor = (value) =>
  value === 'VERIFIED'
    ? '#3fb950'
    : value === 'DETECTED'
      ? '#d29922'
      : '#8b949e';

const cards = projects.map((project, index) => {
  const passport = passports[index];
  const x = 24 + index * 301;
  const checks = ['BUILD', 'CI', 'DEPLOYMENT', 'LIVE DEMO'];

  const rows = checks.map((key, row) => {
    const value = status(passport, key);
    const y = 135 + row * 38;

    return `<text x="${x + 18}" y="${y}" class="label">${escapeXml(key)}</text><text x="${x + 182}" y="${y}" class="state" fill="${colorFor(value)}">${value}</text>`;
  }).join('');

  return `<g><rect x="${x}" y="76" width="277" height="246" rx="12" class="card"/><text x="${x + 18}" y="108" class="name">${escapeXml(project.name)}</text>${rows}</g>`;
}).join('');

const evidenceSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="950" height="350" viewBox="0 0 950 350">
<style>
.bg{fill:#0d1117}.card{fill:#161b22;stroke:#30363d}.title{fill:#f0f6fc;font:700 20px system-ui}.sub{fill:#8b949e;font:13px system-ui}.name{fill:#f0f6fc;font:600 14px system-ui}.label{fill:#8b949e;font:600 11px ui-monospace}.state{font:700 11px ui-monospace}
</style>
<rect class="bg" width="100%" height="100%" rx="16"/>
<text x="24" y="34" class="title">ENGINEERING EVIDENCE</text>
<text x="24" y="56" class="sub">Generated from repository Passport artifacts · evidence, not scores</text>
${cards}
</svg>
`;

const generated = `<!-- GENERATED:ENGINEERING_PROFILE:START -->
## Engineering projects

${featured}

## Project snapshots

${snapshots}

## Engineering evidence

![Engineering Evidence](./assets/engineering-evidence.svg)

| Project | Build | CI | Deployment | Live demo | Evidence |
| --- | --- | --- | --- | --- | --- |
${evidenceRows}

**VERIFIED** = observed from available GitHub/API execution evidence · **DETECTED** = repository evidence found · **UNKNOWN** = evidence unavailable

_Generated from the public project catalog and project Passport artifacts. The catalog remains the source of truth for project links and capabilities._
<!-- GENERATED:ENGINEERING_PROFILE:END -->`;

const readme = await readFile(readmePath, 'utf8');
const marker = /<!-- GENERATED:ENGINEERING_PROFILE:START -->[\s\S]*?<!-- GENERATED:ENGINEERING_PROFILE:END -->/;
const next = marker.test(readme)
  ? readme.replace(marker, generated)
  : `${readme.trim()}\n\n${generated}\n`;

await mkdir(new URL('../assets/', import.meta.url), { recursive: true });
await writeFile(readmePath, next);
await writeFile(evidenceSvgPath, evidenceSvg);

console.log(`Generated ${projects.length} flagship projects and engineering evidence from ${catalogUrl}`);
