import { DiscordSDK, Events } from "@discord/embedded-app-sdk";

console.log("Creating Discord SDK with client ID:", import.meta.env.VITE_DISCORD_CLIENT_ID);

export const discordSdk = new DiscordSDK(
  import.meta.env.VITE_DISCORD_CLIENT_ID
);

console.log("Discord SDK constructed. Immediate instanceId:", discordSdk.instanceId);

export async function setupDiscordSdk() {
  console.log("Waiting for discordSdk.ready()...");
  await discordSdk.ready();
  console.log("discordSdk.ready() resolved");
  return discordSdk;
}

export async function getConnectedParticipants() {
  console.log("Calling getInstanceConnectedParticipants...");
  const result = await discordSdk.commands.getInstanceConnectedParticipants();
  console.log("getInstanceConnectedParticipants result:", result);
  return result;
}

export async function subscribeToParticipants(callback) {
  console.log("Subscribing to ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE...");

  await discordSdk.subscribe(
    Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,
    callback
  );

  return async () => {
    console.log("Unsubscribing from ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE...");

    await discordSdk.unsubscribe(
      Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,
      callback
    );
  };
}