import { DiscordSDK, Events } from "@discord/embedded-app-sdk";

let discordSdkInstance = null;

export function isDiscordEmbedded() {
  const params = new URLSearchParams(window.location.search);
  return params.has("frame_id");
}

export function getDiscordSdk() {
  if (!isDiscordEmbedded()) {
    return null;
  }

  if (!discordSdkInstance) {
    discordSdkInstance = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
  }

  return discordSdkInstance;
}

export async function setupDiscordSdk() {
  const sdk = getDiscordSdk();

  if (!sdk) {
    throw new Error("Not running inside Discord Activity");
  }

  await sdk.ready();
  return sdk;
}

export async function authorizeDiscordUser() {
  const sdk = getDiscordSdk();

  if (!sdk) {
    throw new Error("Not running inside Discord Activity");
  }

  const result = await sdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds"],
  });

  return result;
}

export async function authenticateDiscordUser(accessToken) {
  const sdk = getDiscordSdk();

  if (!sdk) {
    throw new Error("Not running inside Discord Activity");
  }

  return await sdk.commands.authenticate({
    access_token: accessToken,
  });
}

export async function getConnectedParticipants() {
  const sdk = getDiscordSdk();

  if (!sdk) {
    return [];
  }

  return await sdk.commands.getInstanceConnectedParticipants();
}

export async function subscribeToParticipants(callback) {
  const sdk = getDiscordSdk();

  if (!sdk) {
    return () => {};
  }

  await sdk.subscribe(
    Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,
    callback
  );

  return async () => {
    await sdk.unsubscribe(
      Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,
      callback
    );
  };
}