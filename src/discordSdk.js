import { DiscordSDK, Events } from "@discord/embedded-app-sdk";

export const discordSdk = new DiscordSDK(
  import.meta.env.VITE_DISCORD_CLIENT_ID
);

export async function setupDiscordSdk() {
  await discordSdk.ready();
  return discordSdk;
}

export async function getConnectedParticipants() {
  const result = await discordSdk.commands.getInstanceConnectedParticipants();
  return result;
}

export async function subscribeToParticipants(callback) {
  await discordSdk.subscribe(
    Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,
    callback
  );

  return async () => {
    await discordSdk.unsubscribe(
      Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,
      callback
    );
  };
}