import { Client, GatewayIntentBits } from "discord.js";
import AI from "@anthropic-ai/sdk";

const client = new AI({
  apiKey: Bun.env.CLAUDE_API_KEY,
});

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

discord.on("ready", () => {
  console.log("watching...");
});

discord.on("messageCreate", async (message) => {
  if (message.author.bot) {
    return;
  }
  if (message.content === "!ping") {
    await message.channel.send("pong");
  }
  if (message.channelId === Bun.env.DISCORD_CHANNEL_ID) {
    let answer = "";
    const stream = client.messages
      .stream({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: message.content,
          },
        ],
      })
      .on("text", (str) => {
        answer += str;
      });
    const thread = await message.startThread({
      name: message.content,
    });
    const res = await thread.send(answer.length === 0 ? "(考え中)" : answer);
    const id = setInterval(async () => {
      await res.edit(answer.length === 0 ? "(考え中)" : answer);
    }, 5000);
    await stream.finalMessage();
    clearInterval(id);
    await res.edit(answer.length === 0 ? "わからん！" : answer);
  }
});

discord.login(Bun.env.TOKEN);
