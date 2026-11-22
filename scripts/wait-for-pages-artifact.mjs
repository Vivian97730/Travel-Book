import { pathToFileURL } from "node:url";

// Upload completion can precede visibility through the API used by deploy-pages.
export async function waitForPagesArtifact({ apiUrl, repository, runId, artifactId, artifactName, token,
  fetcher = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), attempts = 12 }) {
  if (![apiUrl, repository, runId, artifactId, artifactName, token].every(Boolean)) {
    throw new Error("Missing Pages artifact verification configuration.");
  }
  const url = `${apiUrl}/repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetcher(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "cache-control": "no-cache" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Pages artifact metadata request failed (${response.status}).`);
    const body = await response.json();
    const matches = (body.artifacts ?? []).filter((artifact) => artifact.name === artifactName && !artifact.expired);
    if (matches.length === 1 && String(matches[0].id) === String(artifactId)) return;
    if (attempt + 1 < attempts) await sleep(5000);
  }
  throw new Error("Uploaded Pages artifact is not uniquely visible; deployment was not started.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await waitForPagesArtifact({ apiUrl: process.env.GITHUB_API_URL, repository: process.env.GITHUB_REPOSITORY,
    runId: process.env.GITHUB_RUN_ID, artifactId: process.env.PAGES_ARTIFACT_ID,
    artifactName: process.env.PAGES_ARTIFACT_NAME, token: process.env.GITHUB_TOKEN });
  console.log("Pages artifact metadata ready.");
}
