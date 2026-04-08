import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import confetti from "canvas-confetti";
import {
  setupDiscordSdk,
  getConnectedParticipants,
  isDiscordEmbedded,
  authorizeDiscordUser,
  authenticateDiscordUser,
  getDiscordSdk,
} from "./discordSdk";

function polarToCartesian(cx, cy, r, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

function describeArcSlice(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

const COLORED_SLICES = [
  "#e44444",
  "#f3ab08",
  "#279373",
  "#317bc5",
  "#ce3978",
];

const OFF_WHITE_SLICE = "#d8d4c8";
const OFF_WHITE_TEXT = "#1f1a17";
const GOLD_MAIN = "#d4a62a";
const GOLD_DARK = "#8a5a12";
const RIM_PURPLE = "#5a2d91";
const RIM_PURPLE_DARK = "#34155f";

function getSliceFill(index) {
  if (index % 2 === 1) return OFF_WHITE_SLICE;
  const colorIndex = Math.floor(index / 2) % COLORED_SLICES.length;
  return COLORED_SLICES[colorIndex];
}

function getSliceTextColor(index) {
  return index % 2 === 1 ? OFF_WHITE_TEXT : "#ffffff";
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

export default function App() {
  const [roomData, setRoomData] = useState(null);
  const [debugMessage, setDebugMessage] = useState("Starting connection...");
  const [discordInstanceId, setDiscordInstanceId] = useState(null);
  const [showIntro, setShowIntro] = useState(true);
  const [introFading, setIntroFading] = useState(false);
  const [draftMode, setDraftMode] = useState("custom");
  const [draftEntries, setDraftEntries] = useState([]);
  const [selectedHostId, setSelectedHostId] = useState("");
  const [removeWinnerNextSpin, setRemoveWinnerNextSpin] = useState(false);
  const [displayRotation, setDisplayRotation] = useState(0);

  const [discordParticipants, setDiscordParticipants] = useState([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [isBrowserMode, setIsBrowserMode] = useState(false);
  const [participantDebug, setParticipantDebug] = useState("not fetched yet");
  const [renderCheckpoint, setRenderCheckpoint] = useState("Component started");

  const [authDebug, setAuthDebug] = useState("not started");
  const [discordAuthUser, setDiscordAuthUser] = useState(null);

  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const tadaAudioRef = useRef(null);
  const spinAudioRef = useRef(null);
  const introAudioRef = useRef(null);
  const celebratedSpinRef = useRef(null);
  const spinFadeIntervalRef = useRef(null);
  const spinStopTimeoutRef = useRef(null);

  const roomRef = useMemo(() => {
    if (!discordInstanceId) return null;
    return discordInstanceId;
  }, [discordInstanceId]);

  const localUserId = discordAuthUser?.id || null;

  const localDisplayName =
    discordAuthUser?.global_name ||
    discordAuthUser?.username ||
    "Player";

  async function fetchRoomFromApi(instanceId) {
    const response = await fetch(
      `/api/room-get?instanceId=${encodeURIComponent(instanceId)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || data?.details || "Failed to fetch room");
    }

    return data;
  }

  async function createOrJoinRoomViaApi(instanceId, participantId, participantName) {
    const response = await fetch("/api/room-create-or-join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instanceId,
        participantId,
        participantName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error || data?.details || "Failed to create or join room"
      );
    }

    return data;
  }

  async function updateRoomViaApi(instanceId, patch) {
    const response = await fetch("/api/room-update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instanceId,
        patch,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || data?.details || "Failed to update room");
    }

    return data;
  }

  useEffect(() => {
    async function initDiscord() {
      try {
        if (!isDiscordEmbedded()) {
          setIsBrowserMode(true);
          setSdkReady(false);
          setDebugMessage("Browser mode detected. Discord SDK not started.");
          setDiscordInstanceId("browser-preview");
          return;
        }

        setRenderCheckpoint("About to call setupDiscordSdk");

        const sdk = await setupDiscordSdk();

        setRenderCheckpoint("setupDiscordSdk finished");

        console.log("Discord SDK ready");
        console.log("Discord raw sdk object:", sdk);
        console.log("Discord instance ID:", sdk.instanceId);
        console.log("Discord channel ID:", sdk.channelId);
        console.log("Discord guild ID:", sdk.guildId);

        setSdkReady(true);
        setIsBrowserMode(false);

        if (sdk.instanceId) {
          setDiscordInstanceId(sdk.instanceId);
          setDebugMessage(`SDK ready. Instance ID: ${sdk.instanceId}`);
        } else {
          setDebugMessage("Discord SDK connected, but no instance ID was found.");
        }
      } catch (error) {
        console.error("Discord SDK failed to initialize:", error);
        setDebugMessage(
          `Discord SDK failed to initialize: ${error?.message || "Unknown error"}`
        );
      }
    }

    initDiscord();
  }, []);


  useEffect(() => {
    try {
      if (introAudioRef.current) {
        introAudioRef.current.currentTime = 0;
        introAudioRef.current.volume = 0.8;
        introAudioRef.current.play().catch(() => { });
      }
    } catch (error) {
      console.error("Intro audio failed:", error);
    }

    const confettiTimer = setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 75,
        startVelocity: 24,
        origin: { y: 0.48 },
        scalar: 0.9,
      });
    }, 500);

    const fadeTimer = setTimeout(() => {
      setIntroFading(true);
    }, 1900);

    const hideTimer = setTimeout(() => {
      setShowIntro(false);
    }, 2600);

    return () => {
      clearTimeout(confettiTimer);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    if (!roomRef) return;

    let cancelled = false;

    async function loadRoom() {
      try {
        const data = await fetchRoomFromApi(roomRef);

        if (cancelled) return;

        if (data?.room) {
          setRoomData(data.room);
          setDebugMessage("Room loaded successfully.");
        } else {
          setRoomData(null);
          setDebugMessage("Room document does not exist yet.");
        }
      } catch (error) {
        console.error("Room poll failed:", error);
        if (!cancelled) {
          setDebugMessage(`Room poll failed: ${error?.message || "Unknown error"}`);
        }
      }
    }

    loadRoom();

    const interval = setInterval(loadRoom, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomRef]);


  useEffect(() => {
    if (!sdkReady) return;
    if (isBrowserMode) return;

    async function runDiscordAuth() {
      try {
        setAuthDebug("Starting authorize...");

        setRenderCheckpoint("About to authorize");

        const authResult = await authorizeDiscordUser();
        const code = authResult?.code;

        if (!code) {
          throw new Error("No authorization code returned");
        }

        setAuthDebug("Authorization code received. Exchanging token...");

        const tokenResponse = await fetch("/api/discord-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
          throw new Error(
            tokenData?.error_description ||
            tokenData?.error ||
            "Token exchange failed"
          );
        }

        const accessToken = tokenData?.access_token;

        if (!accessToken) {
          throw new Error("No access token returned");
        }

        setAuthDebug("Access token received. Authenticating user...");

        const authUser = await authenticateDiscordUser(accessToken);

        setRenderCheckpoint("authenticate finished");

        setDiscordAuthUser(authUser?.user || null);
        setAuthDebug(
          `Authenticated as ${authUser?.user?.username || authUser?.user?.global_name || "unknown user"}`
        );
      } catch (error) {
        console.error("Discord auth failed:", error);
        setAuthDebug(`AUTH ERROR: ${error?.message || "Unknown error"}`);
      }
    }

    runDiscordAuth();
  }, [sdkReady, isBrowserMode]);

  useEffect(() => {
    if (!sdkReady) return;
    if (isBrowserMode) return;
    if (!discordAuthUser) return;

    async function loadParticipants() {
      try {
        const result = await getConnectedParticipants();

        console.log("RAW getConnectedParticipants result:", result);
        setParticipantDebug(JSON.stringify(result, null, 2));

        let participantsArray = [];

        if (Array.isArray(result)) {
          participantsArray = result;
        } else if (Array.isArray(result?.participants)) {
          participantsArray = result.participants;
        } else if (Array.isArray(result?.connected_participants)) {
          participantsArray = result.connected_participants;
        }

        console.log("Parsed connected participants:", participantsArray);
        setDiscordParticipants(participantsArray);
      } catch (error) {
        console.error("Failed to fetch connected participants:", error);
        setParticipantDebug(`FETCH ERROR: ${error?.message || "Unknown error"}`);
        setDebugMessage(
          `Failed to fetch connected participants: ${error?.message || "Unknown error"}`
        );
      }
    }

    loadParticipants();

  }, [sdkReady, isBrowserMode, discordAuthUser]);

  useEffect(() => {
    if (!roomRef) return;
    if (!discordAuthUser?.id) return;

    let cancelled = false;

    async function createOrJoinRoom() {
      try {
        const participantName =
          discordAuthUser.global_name ||
          discordAuthUser.username ||
          "Player";

        const result = await createOrJoinRoomViaApi(
          roomRef,
          discordAuthUser.id,
          participantName
        );

        if (cancelled) return;

        if (result?.room) {
          setRoomData(result.room);
        }

        if (result?.created) {
          setDebugMessage("Room created and host assigned.");
        } else {
          setDebugMessage("Joined existing room.");
        }
      } catch (error) {
        console.error("Create/join room failed:", error);
        if (!cancelled) {
          setDebugMessage(
            `Create/join room failed: ${error?.message || "Unknown error"}`
          );
        }
      }
    }

    createOrJoinRoom();

    return () => {
      cancelled = true;
    };
  }, [roomRef, discordAuthUser]);

  const participantsMap = roomData?.participants || {};

  const participantList = useMemo(() => {
    return Object.entries(participantsMap).map(([id, value]) => ({
      id,
      name: value?.name || id,
    }));
  }, [participantsMap]);

  const participantNames = useMemo(() => {
    return participantList.map((participant) => participant.name);
  }, [participantList]);

  const isHost = roomData?.hostId === localUserId;
  const phase = roomData?.phase || "editing";
  const currentEntries = roomData?.entries || [];
  const winnerIndex = roomData?.winnerIndex;

  const winnerName =
    typeof winnerIndex === "number" && currentEntries[winnerIndex]
      ? currentEntries[winnerIndex]
      : "";

  useEffect(() => {
    if (!roomData) return;
    if (!isHost) return;
    if (phase !== "editing") return;

    const modeFromRoom = roomData.mode || "custom";
    const entriesFromRoom = roomData.entries || [];

    setDraftMode(modeFromRoom);

    if (modeFromRoom === "participants") {
      if (entriesFromRoom.length > 0) {
        setDraftEntries(entriesFromRoom);
      } else {
        setDraftEntries(participantNames.slice(0, 20));
      }
    } else {
      if (entriesFromRoom.length > 0 && entriesFromRoom.some((entry) => entry.trim() !== "")) {
        setDraftEntries(entriesFromRoom);
      } else {
        setDraftEntries(["", "", ""]);
      }
    }

    setSelectedHostId("");
  }, [
    roomData?.hostId,
    roomData?.phase,
    roomData?.mode,
    roomData?.entries,
    isHost,
    phase,
    participantNames,
  ]);

  useEffect(() => {
    if (!roomRef) return;
    if (!roomData) return;
    if (!isHost) return;
    if (phase !== "spinning") return;

    const spinStartedAt = roomData.spinStartedAt || Date.now();
    const spinDurationMs = roomData.spinDurationMs || 5000;
    const elapsed = Date.now() - spinStartedAt;
    const remaining = Math.max(spinDurationMs - elapsed, 0);

    const timeout = setTimeout(async () => {
      try {
        const result = await updateRoomViaApi(roomRef, {
          phase: "result",
          status: "done",
        });

        if (result?.room) {
          setRoomData(result.room);
        }
      } catch (error) {
        console.error("Failed to finish spin:", error);
        setDebugMessage(`Failed to finish spin: ${error.message}`);
      }
    }, remaining);

    return () => clearTimeout(timeout);
  }, [
    roomRef,
    roomData,
    isHost,
    phase,
    roomData?.spinStartedAt,
    roomData?.spinDurationMs,
  ]);

  useEffect(() => {
    if (!roomData) return;

    if (phase === "ready" || phase === "result") {
      setDisplayRotation(roomData.resultRotation || 0);
    }

    if (phase !== "spinning") return;

    const spinStartedAt = roomData.spinStartedAt || Date.now();
    const spinDurationMs = roomData.spinDurationMs || 5000;
    const resultRotation = roomData.resultRotation || 0;

    const elapsed = Date.now() - spinStartedAt;
    const remaining = Math.max(spinDurationMs - elapsed, 0);

    setDisplayRotation(resultRotation);

    const timeout = setTimeout(() => {
      setDisplayRotation(resultRotation);
    }, remaining);

    return () => clearTimeout(timeout);
  }, [
    roomData?.phase,
    roomData?.spinStartedAt,
    roomData?.resultRotation,
    roomData?.spinDurationMs,
    phase,
  ]);

  useEffect(() => {
    if (!roomData) return;

    if (spinFadeIntervalRef.current) {
      clearInterval(spinFadeIntervalRef.current);
      spinFadeIntervalRef.current = null;
    }

    if (spinStopTimeoutRef.current) {
      clearTimeout(spinStopTimeoutRef.current);
      spinStopTimeoutRef.current = null;
    }

    if (phase === "spinning") {
      try {
        if (spinAudioRef.current) {
          const spinAudio = spinAudioRef.current;
          const spinDuration = roomData.spinDurationMs || 5000;

          spinAudio.pause();
          spinAudio.currentTime = 0;
          spinAudio.loop = false;
          spinAudio.volume = 1;
          spinAudio.play().catch(() => { });

          const fadeStartMs = Math.max(spinDuration - 1200, 0);
          const stopEarlyMs = Math.max(spinDuration - 250, 0);

          spinStopTimeoutRef.current = setTimeout(() => {
            if (!spinAudioRef.current) return;

            const fadeDuration = Math.max(stopEarlyMs - fadeStartMs, 1);
            const fadeSteps = 12;
            const fadeStepMs = Math.max(Math.floor(fadeDuration / fadeSteps), 30);
            let currentStep = 0;

            spinFadeIntervalRef.current = setInterval(() => {
              currentStep += 1;

              const progress = currentStep / fadeSteps;
              const nextVolume = Math.max(1 - progress, 0);

              if (spinAudioRef.current) {
                spinAudioRef.current.volume = nextVolume;
              }

              if (currentStep >= fadeSteps) {
                clearInterval(spinFadeIntervalRef.current);
                spinFadeIntervalRef.current = null;
              }
            }, fadeStepMs);
          }, fadeStartMs);

          spinStopTimeoutRef.current = setTimeout(() => {
            if (spinFadeIntervalRef.current) {
              clearInterval(spinFadeIntervalRef.current);
              spinFadeIntervalRef.current = null;
            }

            if (spinAudioRef.current) {
              spinAudioRef.current.pause();
              spinAudioRef.current.currentTime = 0;
              spinAudioRef.current.volume = 1;
            }
          }, stopEarlyMs);
        }
      } catch (error) {
        console.error("Spin audio play failed:", error);
      }

      return () => {
        if (spinFadeIntervalRef.current) {
          clearInterval(spinFadeIntervalRef.current);
          spinFadeIntervalRef.current = null;
        }

        if (spinStopTimeoutRef.current) {
          clearTimeout(spinStopTimeoutRef.current);
          spinStopTimeoutRef.current = null;
        }

        try {
          if (spinAudioRef.current) {
            spinAudioRef.current.pause();
            spinAudioRef.current.currentTime = 0;
            spinAudioRef.current.volume = 1;
          }
        } catch (error) {
          console.error("Spin audio cleanup failed:", error);
        }
      };
    }

    try {
      if (spinAudioRef.current) {
        spinAudioRef.current.pause();
        spinAudioRef.current.currentTime = 0;
        spinAudioRef.current.volume = 1;
      }
    } catch (error) {
      console.error("Spin audio stop failed:", error);
    }

    if (phase !== "result") return;

    const celebrationKey = `${roomData.spinStartedAt}-${roomData.winnerIndex}-${roomData.resultRotation}`;

    if (celebratedSpinRef.current === celebrationKey) return;
    celebratedSpinRef.current = celebrationKey;

    try {
      if (tadaAudioRef.current) {
        tadaAudioRef.current.pause();
        tadaAudioRef.current.currentTime = 0;
        tadaAudioRef.current.play().catch(() => { });
      }
    } catch (error) {
      console.error("Tada audio play failed:", error);
    }

    confetti({
      particleCount: 140,
      spread: 90,
      origin: { y: 0.6 },
    });
  }, [
    phase,
    roomData?.spinStartedAt,
    roomData?.winnerIndex,
    roomData?.resultRotation,
    roomData?.spinDurationMs,
    roomData,
  ]);

  function handleModeChange(nextMode) {
    if (!isHost) return;

    setDraftMode(nextMode);

    if (nextMode === "participants") {
      const limitedParticipants = participantNames.slice(0, 20);
      setDraftEntries(limitedParticipants);

      if (participantNames.length > 20) {
        setDebugMessage("Only the first 20 participants will be used.");
      }
    } else {
      setDraftEntries(["", "", ""]);
    }
  }

  function handleEntryChange(index, newValue) {
    if (!isHost) return;

    const updatedEntries = [...draftEntries];
    updatedEntries[index] = newValue;
    setDraftEntries(updatedEntries);
  }

  function handleAddDraftEntry() {
    if (!isHost) return;

    if (draftEntries.length >= 20) {
      setDebugMessage("You can add up to 20 entries only.");
      return;
    }

    setDraftEntries([...draftEntries, ""]);
  }

  function handleRemoveDraftEntry(indexToRemove) {
    if (!isHost) return;

    const updatedEntries = draftEntries.filter((_, index) => index !== indexToRemove);
    setDraftEntries(updatedEntries);
  }

  async function handleSaveSetup() {
    if (!isHost) {
      setDebugMessage("Only the host can save setup.");
      return;
    }

    const cleanedEntries = draftEntries
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "");

    if (cleanedEntries.length > 20) {
      setDebugMessage("Please keep the wheel to 20 entries or fewer.");
      return;
    }

    if (cleanedEntries.length < 2) {
      setDebugMessage("Please keep at least 2 entries before saving.");
      return;
    }

    try {
      const result = await updateRoomViaApi(roomRef, {
        mode: draftMode,
        entries: cleanedEntries,
        phase: "ready",
        status: "idle",
        winnerIndex: null,
      });

      if (result?.room) {
        setRoomData(result.room);
      }

      setDebugMessage("Setup saved.");
    } catch (error) {
      console.error("Failed to save setup:", error);
      setDebugMessage(`Failed to save setup: ${error.message}`);
    }
  }

  async function handleEditSetup() {
    if (!isHost) return;

    try {
      const result = await updateRoomViaApi(roomRef, {
        phase: "editing",
        winnerIndex: null,
        mode: "custom",
        entries: ["", "", ""],
      });

      if (result?.room) {
        setRoomData(result.room);
      }

      setDebugMessage("Returned to edit mode.");
    } catch (error) {
      console.error("Failed to switch to edit mode:", error);
      setDebugMessage(`Failed to switch to edit mode: ${error.message}`);
    }
  }

  async function handleTransferHost() {
    if (!isHost) {
      setDebugMessage("Only the current host can transfer host.");
      return;
    }

    if (!selectedHostId) {
      setDebugMessage("Please choose a participant first.");
      return;
    }

    try {
      const result = await updateRoomViaApi(roomRef, {
        hostId: selectedHostId,
      });

      if (result?.room) {
        setRoomData(result.room);
      }

      setDebugMessage("Host transferred successfully.");
    } catch (error) {
      console.error("Failed to transfer host:", error);
      setDebugMessage(`Failed to transfer host: ${error.message}`);
    }
  }

  async function handleSpin() {
    if (!roomRef) {
      setDebugMessage("Room is not ready yet.");
      return;
    }

    if (!isHost) {
      setDebugMessage("Only the host can spin the wheel.");
      return;
    }

    if (currentEntries.length < 2) {
      setDebugMessage("You need at least 2 entries to spin.");
      return;
    }

    const nextWinnerIndex = Math.floor(Math.random() * currentEntries.length);
    const localSliceAngle = 360 / currentEntries.length;

    const baseRotation = roomData?.resultRotation || 0;
    const baseNormalized = normalizeDegrees(baseRotation);
    const extraTurns = 360 * 6;

    const targetOffset = nextWinnerIndex * localSliceAngle + localSliceAngle / 2;
    const pointerAngle = 90;
    const desiredFinalNormalized = normalizeDegrees(pointerAngle - targetOffset);
    const deltaToTarget = normalizeDegrees(desiredFinalNormalized - baseNormalized);
    const nextRotation = baseRotation + extraTurns + deltaToTarget;

    const spinDurationMs = 5000;

    try {
      const result = await updateRoomViaApi(roomRef, {
        phase: "spinning",
        status: "spinning",
        winnerIndex: nextWinnerIndex,
        spinStartedAt: Date.now(),
        spinDurationMs,
        resultRotation: nextRotation,
      });

      if (result?.room) {
        setRoomData(result.room);
      }

      setDebugMessage("Spin started.");
    } catch (error) {
      console.error("Failed to spin:", error);
      setDebugMessage(`Failed to spin: ${error.message}`);
    }


  }

  async function handleKeepSpinning() {
    if (!isHost) return;

    let updatedEntries = [...currentEntries];

    if (
      removeWinnerNextSpin &&
      typeof winnerIndex === "number" &&
      updatedEntries[winnerIndex]
    ) {
      updatedEntries.splice(winnerIndex, 1);
    }

    if (updatedEntries.length < 2) {
      setDebugMessage("Not enough entries left. Returning to edit mode.");

      const result = await updateRoomViaApi(roomRef, {
        entries: updatedEntries,
        phase: "editing",
        status: "idle",
        winnerIndex: null,
      });

      if (result?.room) {
        setRoomData(result.room);
      }

      setRemoveWinnerNextSpin(false);
      return;
    }

    try {
      const result = await updateRoomViaApi(roomRef, {
        entries: updatedEntries,
        phase: "ready",
        status: "idle",
        winnerIndex: null,
      });

      if (result?.room) {
        setRoomData(result.room);
      }

      setRemoveWinnerNextSpin(false);
      setDebugMessage("Ready for another spin.");
    } catch (error) {
      console.error("Failed to keep spinning:", error);
      setDebugMessage(`Failed: ${error.message}`);
    }
  }

  async function handleStartFresh() {
    if (!isHost) return;

    let nextEntries = [...currentEntries];

    if (
      removeWinnerNextSpin &&
      typeof winnerIndex === "number" &&
      nextEntries[winnerIndex]
    ) {
      nextEntries.splice(winnerIndex, 1);
    }

    if (roomData?.mode === "participants") {
      nextEntries = participantNames.slice(0, 20);
    }

    try {
      const result = await updateRoomViaApi(roomRef, {
        entries: nextEntries,
        phase: "editing",
        status: "idle",
        winnerIndex: null,
      });

      if (result?.room) {
        setRoomData(result.room);
      }

      setRemoveWinnerNextSpin(false);
      setDebugMessage("Returned to edit mode.");
    } catch (error) {
      console.error("Failed to start fresh:", error);
      setDebugMessage(`Failed: ${error.message}`);
    }
  }

  const transferCandidates = participantList.filter(
    (participant) => participant.id !== roomData?.hostId
  );

  const stageIsWheel =
    phase === "ready" || phase === "spinning" || phase === "result";

  const wheelSize = 760;
  const center = wheelSize / 2;
  const outerRadius = 242;
  const sliceRadius = 228;
  const hubRadius = 66;
  const studRingRadius = 238;
  const studCount = 18;
  const sliceAngle = currentEntries.length > 0 ? 360 / currentEntries.length : 360;

  const purpleButtonStyle = {
    background: "#3a1d63",
    border: "1px solid #56308d",
    color: "#ffffff",
    borderRadius: "5px",
    padding: "12px 16px",
    boxShadow: "none",
  };

  const mutedButtonStyle = {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.22)",
    color: "rgba(255,255,255,0.74)",
    borderRadius: "5px",
    padding: "12px 16px",
    boxShadow: "none",
  };

  const iconButtonStyle = {
    width: "46px",
    minWidth: "46px",
    height: "46px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#3a1d63",
    border: "1px solid #56308d",
    color: "#ffffff",
    borderRadius: "5px",
    padding: 0,
    boxShadow: "none",
  };
  return (
    <div
      className="app"
      style={{
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(180deg, #09111f 0%, #0a1324 35%, #090d15 70%, #05070c 100%)",
      }}
    >
      <audio ref={tadaAudioRef} src="/tada.mp3" preload="auto" />
      <audio ref={spinAudioRef} src="/spin.mp3" preload="auto" />
      <audio ref={introAudioRef} src="/gamesound.mp3" preload="auto" />

      {showIntro && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(circle at center, rgba(39,22,65,0.50) 0%, rgba(8,13,28,0.88) 58%, rgba(3,5,10,0.98) 100%)",
            opacity: introFading ? 0 : 1,
            transition: "opacity 0.7s ease",
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "min(72vw, 72vh, 720px)",
              aspectRatio: "1 / 1",
              borderRadius: "999px",
              background:
                "radial-gradient(circle, rgba(255,220,120,0.06) 0%, rgba(122,73,184,0.08) 38%, rgba(0,0,0,0) 72%)",
              animation: "introWheelPulse 2.2s ease-in-out infinite",
            }}
          />

          <div
            style={{
              position: "absolute",
              width: "min(52vw, 52vh, 520px)",
              aspectRatio: "1 / 1",
              borderRadius: "999px",
              border: "10px solid rgba(123, 73, 191, 0.85)",
              boxShadow:
                "0 0 0 2px rgba(212,166,42,0.22), inset 0 0 30px rgba(0,0,0,0.25), 0 0 50px rgba(0,0,0,0.28)",
              background:
                "conic-gradient(from 0deg, rgba(243,171,8,0.95) 0deg 60deg, rgba(216,212,200,0.98) 60deg 120deg, rgba(228,68,68,0.95) 120deg 180deg, rgba(216,212,200,0.98) 180deg 240deg, rgba(39,147,115,0.95) 240deg 300deg, rgba(216,212,200,0.98) 300deg 360deg)",
              opacity: 0.32,
              filter: "blur(0.2px)",
              animation: "introWheelSpin 5s linear infinite",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "36%",
                borderRadius: "999px",
                background:
                  "radial-gradient(circle at 35% 30%, rgba(90,60,25,0.92) 0%, rgba(35,24,18,0.96) 55%, rgba(18,14,12,0.98) 100%)",
                boxShadow: "0 0 18px rgba(0,0,0,0.32)",
              }}
            />
          </div>

          <div
            style={{
              position: "relative",
              textAlign: "center",
              zIndex: 2,
            }}
          >
            <div
              style={{
                fontSize: "clamp(40px, 6vw, 92px)",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: "#f6d97a",
                textShadow:
                  "0 0 12px rgba(244,214,111,0.26), 0 0 28px rgba(212,166,42,0.18), 0 4px 24px rgba(0,0,0,0.42)",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "relative",
                  display: "inline-block",
                  overflow: "hidden",
                  padding: "0 12px",
                }}
              >
                Spin the Wheel

                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "-35%",
                    width: "30%",
                    height: "100%",
                    transform: "skewX(-20deg)",
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,245,200,0.85) 50%, rgba(255,255,255,0) 100%)",
                    animation: "introShine 1.6s ease-in-out 0.35s 1 forwards",
                    pointerEvents: "none",
                  }}
                />
              </span>
            </div>

            <div
              style={{
                marginTop: "14px",
                fontSize: "clamp(12px, 1.2vw, 16px)",
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                color: "rgba(255,231,170,0.72)",
              }}
            >
              Random Spinner
            </div>

            {[
              { top: "-18px", left: "8%", delay: "0s" },
              { top: "8px", right: "-6%", delay: "0.25s" },
              { bottom: "-10px", left: "18%", delay: "0.5s" },
              { bottom: "4px", right: "12%", delay: "0.8s" },
              { top: "-28px", right: "18%", delay: "1.1s" },
            ].map((sparkle, index) => (
              <span
                key={index}
                style={{
                  position: "absolute",
                  width: "10px",
                  height: "10px",
                  borderRadius: "999px",
                  background:
                    "radial-gradient(circle, #fff6c9 0%, #f2c94c 60%, rgba(242,201,76,0) 100%)",
                  boxShadow: "0 0 10px rgba(242,201,76,0.65)",
                  animation: `introSparkle 1.6s ease-in-out ${sparkle.delay} infinite`,
                  ...sparkle,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {stageIsWheel && (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid slice"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            opacity: 0.55,
          }}
        >
          <defs>
            <radialGradient id="rayFade" cx="50%" cy="42%" r="62%">
              <stop offset="0%" stopColor="rgba(140, 87, 211, 0.18)" />
              <stop offset="38%" stopColor="rgba(110, 63, 178, 0.1)" />
              <stop offset="72%" stopColor="rgba(49, 27, 92, 0.04)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
            </radialGradient>
          </defs>

          {Array.from({ length: 12 }).map((_, index) => {
            const start = index * 30;
            const end = start + 15;

            const p1 = polarToCartesian(800, 500, 900, start);
            const p2 = polarToCartesian(800, 500, 900, end);
            const p3 = polarToCartesian(800, 500, 140, end);
            const p4 = polarToCartesian(800, 500, 140, start);

            const path = [
              `M ${p1.x} ${p1.y}`,
              `L ${p2.x} ${p2.y}`,
              `L ${p3.x} ${p3.y}`,
              `L ${p4.x} ${p4.y}`,
              "Z",
            ].join(" ");

            return <path key={index} d={path} fill="url(#rayFade)" />;
          })}
        </svg>
      )}

      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: stageIsWheel ? "flex-start" : "center",
          padding: stageIsWheel ? "18px 18px 12px" : "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "960px",
            marginBottom: "12px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => setShowDebugPanel((prev) => !prev)}
            style={{
              background: "rgba(7, 12, 24, 0.92)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "#d1d5db",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            {showDebugPanel ? "Hide Debug" : "Show Debug"}
          </button>
        </div>

        {showDebugPanel && (
          <div
            style={{
              width: "100%",
              maxWidth: "960px",
              marginBottom: "12px",
              padding: "10px 12px",
              borderRadius: "6px",
              background: "rgba(7, 12, 24, 0.92)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "#d1d5db",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            <div><strong>instanceId</strong> — {discordInstanceId || "none"}</div>
            <div><strong>sdkReady</strong> — {sdkReady ? "yes" : "no"}</div>
            <div><strong>browser mode</strong> — {isBrowserMode ? "yes" : "no"}</div>
            <div><strong>channelId</strong> — {String(getDiscordSdk()?.channelId || "none")}</div>
            <div><strong>guildId</strong> — {String(getDiscordSdk()?.guildId || "none")}</div>
            <div><strong>auth user id</strong> — {discordAuthUser?.id || "none"}</div>
            <div><strong>discord participants</strong> — {discordParticipants.length}</div>
            <div><strong>local user id</strong> — {localUserId}</div>
            <div>
              <strong>participant names</strong> —{" "}
              {discordParticipants.length > 0
                ? discordParticipants
                  .map((p) => p.global_name || p.username || p.id || "unknown")
                  .join(", ")
                : "none"}
            </div>
            <div><strong>debug</strong> — {debugMessage}</div>
            <div><strong>render checkpoint</strong> — {renderCheckpoint}</div>
            <div><strong>auth debug</strong> — {authDebug}</div>
            <div><strong>authed user</strong> — {discordAuthUser?.username || discordAuthUser?.global_name || "none"}</div>

            <div>
              <strong>participant raw</strong> —
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  margin: "6px 0 0",
                  background: "rgba(255,255,255,0.04)",
                  padding: "8px",
                  borderRadius: "4px",
                  overflowX: "auto",
                  maxHeight: "220px",
                  overflowY: "auto",
                }}
              >
                {participantDebug}
              </pre>
            </div>
          </div>
        )}

        <div
          style={{
            width: "100%",
            maxWidth: stageIsWheel ? "1400px" : "760px",
            position: "relative",
          }}
        >
          {(phase === "ready" || phase === "result") && isHost && (
            <button
              onClick={handleEditSetup}
              style={{
                position: "absolute",
                top: "18px",
                right: "6px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.26)",
                color: "rgba(255,255,255,0.82)",
                fontSize: "14px",
                cursor: "pointer",
                padding: "7px 12px",
                borderRadius: "5px",
                zIndex: 20,
              }}
            >
              Edit
            </button>
          )}

          {!stageIsWheel && (
            <h1
              style={{
                textAlign: "center",
                fontSize: "32px",
                fontWeight: "800",
                marginBottom: "18px",
                marginTop: "0",
                letterSpacing: "-0.03em",
              }}
            >
              Spin the Wheel
            </h1>
          )}

          {phase === "editing" ? (
            <>
              {isHost ? (
                <div
                  style={{
                    width: "100%",
                    padding: "0",
                  }}
                >
                  <div
                    style={{
                      marginBottom: "18px",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        marginBottom: "10px",
                        fontWeight: "bold",
                      }}
                    >
                      Transfer host
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "stretch",
                      }}
                    >
                      <select
                        value={selectedHostId}
                        onChange={(e) => setSelectedHostId(e.target.value)}
                        style={{
                          flex: "0 1 420px",
                          maxWidth: "420px",
                          padding: "12px",
                          borderRadius: "5px",
                          border: "1px solid #334155",
                          background: "#091833",
                          color: "white",
                          fontSize: "16px",
                        }}
                      >
                        <option value="">Select a participant</option>
                        {transferCandidates.map((participant) => (
                          <option key={participant.id} value={participant.id}>
                            {participant.name}
                          </option>
                        ))}
                      </select>

                      <button onClick={handleTransferHost} style={purpleButtonStyle}>
                        Transfer Host
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      marginBottom: "20px",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          color:
                            draftMode === "custom"
                              ? "#ffffff"
                              : "rgba(255,255,255,0.55)",
                          fontWeight: draftMode === "custom" ? 700 : 500,
                        }}
                      >
                        Spin Custom Entries
                      </span>

                      <button
                        onClick={() =>
                          handleModeChange(
                            draftMode === "custom" ? "participants" : "custom"
                          )
                        }
                        style={{
                          width: "58px",
                          height: "30px",
                          borderRadius: "999px",
                          border: "1px solid #56308d",
                          background:
                            draftMode === "participants" ? "#3a1d63" : "#111827",
                          position: "relative",
                          padding: 0,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: "3px",
                            left: draftMode === "participants" ? "31px" : "3px",
                            width: "22px",
                            height: "22px",
                            borderRadius: "999px",
                            background: "#ffffff",
                            transition: "left 0.2s ease",
                          }}
                        />
                      </button>

                      <span
                        style={{
                          color:
                            draftMode === "participants"
                              ? "#ffffff"
                              : "rgba(255,255,255,0.55)",
                          fontWeight: draftMode === "participants" ? 700 : 500,
                        }}
                      >
                        Spin Participants
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: "left" }}>
                    <div style={{ marginBottom: "10px", fontWeight: "bold" }}>
                      Entries
                    </div>

                    <div
                      style={{
                        maxHeight: "198px",
                        overflowY: "auto",
                        paddingRight: "4px",
                        marginBottom: "12px",
                      }}
                    >
                      {draftEntries.map((entry, index) => (
                        <div
                          key={index}
                          style={{
                            display: "flex",
                            gap: "10px",
                            marginBottom: "10px",
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="text"
                            value={entry}
                            placeholder={`Entry ${index + 1}`}
                            onChange={(e) => handleEntryChange(index, e.target.value)}
                            style={{
                              flex: 1,
                              padding: "12px",
                              borderRadius: "5px",
                              border: "1px solid #334155",
                              background: "#091833",
                              color: "white",
                              fontSize: "16px",
                            }}
                          />

                          <button
                            onClick={() => handleRemoveDraftEntry(index)}
                            style={iconButtonStyle}
                            aria-label="Remove entry"
                            title="Remove entry"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: "12px", display: "flex", gap: "10px" }}>
                      <button onClick={handleAddDraftEntry} style={purpleButtonStyle}>
                        Add More
                      </button>
                      <button onClick={handleSaveSetup} style={purpleButtonStyle}>
                        Go to Spinner
                      </button>
                    </div>
                  </div>

                  <p
                    style={{
                      marginTop: "18px",
                      fontSize: "14px",
                      color: "#86efac",
                    }}
                  >
                    {debugMessage}
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "16px",
                    borderRadius: "5px",
                    background: "#091833",
                    border: "1px solid #334155",
                  }}
                >
                  Host is currently setting up the wheel.
                </div>
              )}
            </>
          ) : (
            <>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  minHeight: "calc(100vh - 28px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "min(96vw, 90vh, 1120px)",
                    aspectRatio: "1 / 1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: "6px",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
                      transform: `rotate(${displayRotation}deg)`,
                      transition:
                        phase === "spinning"
                          ? "transform 5s cubic-bezier(0.12, 0.8, 0.2, 1)"
                          : "none",
                      zIndex: 2,
                    }}
                  >
                    <svg
                      width="100%"
                      height="100%"
                      viewBox={`0 0 ${wheelSize} ${wheelSize}`}
                      style={{
                        filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.42))",
                      }}
                    >
                      <defs>
                        <radialGradient id="rimPurpleGradient" cx="50%" cy="40%" r="70%">
                          <stop offset="0%" stopColor="#8e57d3" />
                          <stop offset="55%" stopColor={RIM_PURPLE} />
                          <stop offset="100%" stopColor={RIM_PURPLE_DARK} />
                        </radialGradient>

                        <radialGradient id="goldStudGradient" cx="35%" cy="30%" r="75%">
                          <stop offset="0%" stopColor="#fff6c7" />
                          <stop offset="40%" stopColor="#f8d96b" />
                          <stop offset="75%" stopColor="#d19a1b" />
                          <stop offset="100%" stopColor="#8d5b0d" />
                        </radialGradient>

                        <radialGradient id="hubDarkGradient" cx="40%" cy="35%" r="80%">
                          <stop offset="0%" stopColor="#4b3720" />
                          <stop offset="38%" stopColor="#2b2119" />
                          <stop offset="100%" stopColor="#17120f" />
                        </radialGradient>
                      </defs>

                      <circle
                        cx={center}
                        cy={center}
                        r={outerRadius}
                        fill="url(#rimPurpleGradient)"
                        stroke="#a874ea"
                        strokeWidth="1.1"
                      />

                      {currentEntries.map((entry, index) => {
                        const startAngle = index * sliceAngle;
                        const endAngle = (index + 1) * sliceAngle;
                        const midAngle = startAngle + sliceAngle / 2;
                        const path = describeArcSlice(
                          center,
                          center,
                          sliceRadius,
                          startAngle,
                          endAngle
                        );

                        const textRadius = sliceRadius * 0.74;
                        const textPoint = polarToCartesian(
                          center,
                          center,
                          textRadius,
                          midAngle
                        );
                        const textRotation = midAngle;
                        const textColor = getSliceTextColor(index);
                        const fillColor = getSliceFill(index);

                        return (
                          <g key={`${entry}-${index}`}>
                            <path
                              d={path}
                              fill={fillColor}
                              stroke="rgba(20,20,20,0.14)"
                              strokeWidth="0.8"
                            />
                            <text
                              x={textPoint.x}
                              y={textPoint.y}
                              fill={textColor}
                              fontSize={
                                currentEntries.length > 10
                                  ? "12"
                                  : currentEntries.length > 7
                                    ? "14"
                                    : "16"
                              }
                              fontWeight="700"
                              letterSpacing="0.2px"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              transform={`rotate(${textRotation} ${textPoint.x} ${textPoint.y})`}
                            >
                              {entry.length > 18 ? entry.slice(0, 18) + "…" : entry}
                            </text>
                          </g>
                        );
                      })}

                      {Array.from({ length: studCount }).map((_, index) => {
                        const angle = (360 / studCount) * index;
                        const point = polarToCartesian(
                          center,
                          center,
                          studRingRadius,
                          angle
                        );

                        return (
                          <circle
                            key={index}
                            cx={point.x}
                            cy={point.y}
                            r="4.2"
                            fill="url(#goldStudGradient)"
                            stroke="#fff0a5"
                            strokeWidth="0.8"
                          />
                        );
                      })}

                      <circle
                        cx={center}
                        cy={center}
                        r={hubRadius}
                        fill="url(#hubDarkGradient)"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="3"
                      />

                      <circle
                        cx={center}
                        cy={center}
                        r={hubRadius * 0.78}
                        fill="rgba(255,255,255,0.035)"
                      />
                    </svg>
                  </div>

                  <div
                    style={{
                      position: "absolute",
                      right: "16%",
                      top: "50%",
                      transform: "translateY(-50%) rotate(90deg)",
                      width: 0,
                      height: 0,
                      borderLeft: "16px solid transparent",
                      borderRight: "16px solid transparent",
                      borderTop: `34px solid ${GOLD_MAIN}`,
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
                      zIndex: 7,
                    }}
                  />

                  <div
                    style={{
                      position: "absolute",
                      right: "14%",
                      top: "50%",
                      transform: "translateY(-50%) rotate(90deg)",
                      width: "22px",
                      height: "28px",
                      borderRadius: "0 0 5px 5px",
                      background:
                        "linear-gradient(180deg, #fff3b5 0%, #d8a81f 48%, #8b580f 100%)",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
                      zIndex: 6,
                    }}
                  />

                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 8,
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      onClick={phase === "ready" && isHost ? handleSpin : undefined}
                      style={{
                        width: "19%",
                        minWidth: "108px",
                        maxWidth: "150px",
                        aspectRatio: "1 / 1",
                        borderRadius: "999px",
                        background:
                          "radial-gradient(circle at 35% 30%, #4a3722 0%, #231b15 50%, #15110e 100%)",
                        border: "2px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        boxShadow: "0 12px 34px rgba(0,0,0,0.35)",
                        pointerEvents: "auto",
                        userSelect: "none",
                        cursor: phase === "ready" && isHost ? "pointer" : "default",
                      }}
                    >
                      {phase === "ready" && (
                        <>
                          {isHost ? (
                            <div
                              style={{
                                color: "#ffffff",
                                fontWeight: 800,
                                fontSize: "clamp(20px, 2.1vw, 34px)",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                              }}
                            >
                              Spin
                            </div>
                          ) : (
                            <div
                              style={{
                                color: "#e5e7eb",
                                fontWeight: 700,
                                fontSize: "clamp(12px, 1.1vw, 16px)",
                                padding: "0 10px",
                              }}
                            >
                              Waiting
                            </div>
                          )}
                        </>
                      )}

                      {phase === "spinning" && (
                        <div
                          style={{
                            color: "#ffffff",
                            fontWeight: 800,
                            fontSize: "clamp(14px, 1.5vw, 24px)",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          ...
                        </div>
                      )}

                      {phase === "result" && (
                        <div
                          style={{
                            color: "#ffffff",
                            fontWeight: 900,
                            fontSize: "clamp(34px, 4vw, 58px)",
                            lineHeight: 1,
                          }}
                        >
                          ✓
                        </div>
                      )}
                    </div>
                  </div>

                  {phase === "result" && (
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        bottom: "7%",
                        transform: "translateX(-50%)",
                        width: "min(72%, 560px)",
                        background: "rgba(7, 7, 10, 0.95)",
                        border: `1px solid ${GOLD_DARK}`,
                        borderRadius: "5px",
                        boxShadow:
                          "0 18px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(246,222,138,0.06)",
                        zIndex: 10,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          background:
                            "linear-gradient(90deg, #6f4b08 0%, #c99819 35%, #f4d66f 50%, #c99819 65%, #6f4b08 100%)",
                          color: "#17120b",
                          padding: "10px 16px",
                          fontWeight: "800",
                          textAlign: "center",
                          letterSpacing: "0.2px",
                          fontSize: "clamp(14px, 1vw, 16px)",
                        }}
                      >
                        We have a winner!
                      </div>

                      <div
                        style={{
                          padding: "18px 18px 16px",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "clamp(28px, 4vw, 52px)",
                            fontWeight: 300,
                            marginBottom: "14px",
                            color: "#fff7d7",
                            textShadow: "0 0 20px rgba(212,166,42,0.08)",
                            lineHeight: 1.05,
                            wordBreak: "break-word",
                          }}
                        >
                          {winnerName || "Unknown"}
                        </div>

                        {isHost ? (
                          <>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "10px",
                                marginBottom: "14px",
                                color: "#f1e7bf",
                                fontSize: "clamp(12px, 1vw, 16px)",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={removeWinnerNextSpin}
                                onChange={(e) =>
                                  setRemoveWinnerNextSpin(e.target.checked)
                                }
                              />
                              Remove winner from next spin
                            </label>

                            <div
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                gap: "12px",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                onClick={handleKeepSpinning}
                                style={mutedButtonStyle}
                              >
                                Keep Spinning
                              </button>
                              <button onClick={handleStartFresh} style={mutedButtonStyle}>
                                Start Fresh
                              </button>
                            </div>
                          </>
                        ) : (
                          <div style={{ color: "#d6d0b2" }}>
                            Waiting for host to continue.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <p
                style={{
                  marginTop: "4px",
                  textAlign: "center",
                  fontSize: "14px",
                  color: "#86efac",
                }}
              >
                {debugMessage}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}