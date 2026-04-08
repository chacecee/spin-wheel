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
    console.log(
      "Creating Discord SDK with client ID:",
      import.meta.env.VITE_DISCORD_CLIENT_ID
    );

    discordSdkInstance = new DiscordSDK(
      import.meta.env.VITE_DISCORD_CLIENT_ID
    );

    console.log(
      "Discord SDK constructed. Immediate instanceId:",
      discordSdkInstance.instanceId
    );
  }

  return discordSdkInstance;
}

export async function setupDiscordSdk() {
  const sdk = getDiscordSdk();

  if (!sdk) {
    throw new Error("Not running inside Discord Activity");
  }

  console.log("Waiting for discordSdk.ready()...");
  await sdk.ready();
  console.log("discordSdk.ready() resolved");

  return sdk;
}

export async function getConnectedParticipants() {
  const sdk = getDiscordSdk();

  if (!sdk) {
    return [];
  }

  console.log("Calling getInstanceConnectedParticipants...");
  const result = await sdk.commands.getInstanceConnectedParticipants();
  console.log("getInstanceConnectedParticipants result:", result);
  return result;
}

export async function subscribeToParticipants(callback) {
  const sdk = getDiscordSdk();

  if (!sdk) {
    return () => {};
  }

  console.log("Subscribing to ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE...");

  await sdk.subscribe(
    Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,
    callback
  );

  return async () => {
    console.log("Unsubscribing from ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE...");

    await sdk.unsubscribe(
      Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,
      callback
    );
  };
}