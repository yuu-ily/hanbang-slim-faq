// Vercel serverless function: commit FAQ JSON to GitHub on behalf of admin.
// Required env vars (set in Vercel dashboard):
//   ADMIN_PASSWORD  — plain password admin types in
//   GITHUB_TOKEN    — fine-grained PAT with contents:write on the repo
//   GITHUB_OWNER    — e.g. yuu-ily
//   GITHUB_REPO     — e.g. hanbang-slim-faq
//   GITHUB_BRANCH   — optional, defaults to main

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { password, faqs, categories, message, verifyOnly } = req.body || {};
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "パスワードが違います" });
    return;
  }
  if (verifyOnly) {
    res.status(200).json({ ok: true });
    return;
  }
  if (!Array.isArray(faqs) || !Array.isArray(categories)) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  const token = process.env.GITHUB_TOKEN;
  const path = "data/faqs.json";

  if (!owner || !repo || !token) {
    res.status(500).json({ error: "Server misconfigured (env vars missing)" });
    return;
  }

  try {
    // 1. Get current file SHA
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "hanbang-slim-faq",
        },
      }
    );
    if (!getRes.ok) {
      const err = await getRes.text();
      res.status(500).json({ error: "GitHub fetch failed: " + err });
      return;
    }
    const meta = await getRes.json();

    // 2. Commit new content
    const body = JSON.stringify({ categories, faqs }, null, 2) + "\n";
    const contentB64 = Buffer.from(body, "utf-8").toString("base64");

    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "hanbang-slim-faq",
        },
        body: JSON.stringify({
          message: message || "Update FAQs",
          content: contentB64,
          sha: meta.sha,
          branch,
        }),
      }
    );

    if (!putRes.ok) {
      const err = await putRes.text();
      res.status(500).json({ error: "GitHub commit failed: " + err });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
