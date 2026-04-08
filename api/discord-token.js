export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { code } = req.body || {};

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    const params = new URLSearchParams();
    params.set("client_id", process.env.VITE_DISCORD_CLIENT_ID);
    params.set("client_secret", process.env.DISCORD_CLIENT_SECRET);
    params.set("grant_type", "authorization_code");
    params.set("code", code);
    params.set("redirect_uri", "https://127.0.0.1");

    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Token exchange failed",
      details: error?.message || "Unknown error",
    });
  }
}