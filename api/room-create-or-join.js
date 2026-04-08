import { db, doc, getDoc, setDoc } from "./_lib/serverFirebase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { instanceId, participantId, participantName } = req.body || {};

    if (!instanceId || !participantId || !participantName) {
      return res.status(400).json({
        error: "Missing instanceId, participantId, or participantName",
      });
    }

    const roomRef = doc(db, "sessions", instanceId);
    const snapshot = await getDoc(roomRef);

    if (!snapshot.exists()) {
      const newRoom = {
        hostId: participantId,
        phase: "editing",
        mode: "custom",
        entries: ["", "", ""],
        status: "idle",
        winnerIndex: null,
        participants: {
          [participantId]: {
            name: participantName,
          },
        },
      };

      await setDoc(roomRef, newRoom);

      return res.status(200).json({
        created: true,
        room: newRoom,
      });
    }

    const existing = snapshot.data() || {};
    const mergedRoom = {
      ...existing,
      participants: {
        ...(existing.participants || {}),
        [participantId]: {
          name: participantName,
        },
      },
    };

    await setDoc(roomRef, mergedRoom);

    return res.status(200).json({
      created: false,
      room: mergedRoom,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create or join room",
      details: error?.message || "Unknown error",
    });
  }
}