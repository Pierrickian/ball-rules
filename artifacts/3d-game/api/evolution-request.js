const DEFAULT_REPO = "Pierrickian/ball-rules";
const DEFAULT_REF = "main";
const CODEX_WORKFLOW_FILE = "issues-codex.yml";

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readToken() {
  return process.env.GITHUB_PAT
    ?? process.env.CODEX_DISPATCH_TOKEN
    ?? process.env.GITHUB_TOKEN
    ?? "";
}

function parseRepo(repo) {
  const [owner, name] = repo.split("/");
  if (!owner || !name || repo.split("/").length !== 2) {
    throw new Error("Invalid repo. Expected owner/name.");
  }
  return { owner, name };
}

async function githubRequest(url, token, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub API ${response.status}: ${details}`);
  }

  return response.status === 204 ? {} : response.json();
}

async function dispatchCodexWorkflow({ token, owner, repo, issueNumber }) {
  await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${CODEX_WORKFLOW_FILE}/dispatches`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        ref: DEFAULT_REF,
        inputs: {
          issue_number: String(issueNumber),
        },
      }),
    },
  );
}

export default async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = readToken();
  if (!token) {
    response.status(500).json({
      error: "Missing GitHub token. Set GITHUB_PAT, CODEX_DISPATCH_TOKEN, or GITHUB_TOKEN in the deployment environment.",
    });
    return;
  }

  try {
    const payload = request.body ?? {};
    const repoFullName = payload.repo?.trim() || DEFAULT_REPO;
    const { owner, name } = parseRepo(repoFullName);
    const title = payload.title?.trim() || "Demande d'évolution depuis le jeu";
    const body = payload.body?.trim() || "Demande joueur depuis le jeu.";

    const issue = await githubRequest(
      `https://api.github.com/repos/${owner}/${name}/issues`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          labels: ["evolution", "codex"],
        }),
      },
    );

    await dispatchCodexWorkflow({
      token,
      owner,
      repo: name,
      issueNumber: issue.number,
    });

    response.status(201).json({
      type: "issue",
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      codex_dispatched: true,
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
