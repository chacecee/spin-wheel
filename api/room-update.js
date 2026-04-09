import { db, doc, getDoc, updateDoc } from "./_lib/serverFirebase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { instanceId, patch } = req.body || {};

    if (!instanceId || !patch || typeof patch !== "object") {
      return res.status(400).json({
        error: "Missing instanceId or patch",
      });
    }

    const roomRef = doc(db, "sessions", instanceId);

    await updateDoc(roomRef, patch);

    const updatedSnapshot = await getDoc(roomRef);

    return res.status(200).json({
      room: updatedSnapshot.exists() ? updatedSnapshot.data() : null,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to update room",
      details: error?.message || "Unknown error",
    });
  }
}