import { db, doc, getDoc } from "./_lib/serverFirebase";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { instanceId } = req.query;

    if (!instanceId) {
      return res.status(400).json({ error: "Missing instanceId" });
    }

    const roomRef = doc(db, "sessions", instanceId);
    const snapshot = await getDoc(roomRef);

    if (!snapshot.exists()) {
      return res.status(200).json({
        exists: false,
        room: null,
      });
    }

    return res.status(200).json({
      exists: true,
      room: snapshot.data(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to get room",
      details: error?.message || "Unknown error",
    });
  }
}