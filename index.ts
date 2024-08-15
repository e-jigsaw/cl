import { Client, GatewayIntentBits } from "discord.js";
import AI from "@anthropic-ai/sdk";
import path from "path";

const SystemPrompt = await Bun.file(
  path.resolve(import.meta.dir, "./prompts/systemPrompt.md")
).text();

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
    return;
  }
  if (message.channelId === Bun.env.DISCORD_CHANNEL_ID) {
    const thread = await message.startThread({
      name: message.content,
    });
    const res = await thread.send("(考え中)");
    const assistantMessage = await client.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: message.content,
        },
      ],
      system: SystemPrompt,
    });
    if (assistantMessage.content[0].type === "text") {
      await res.edit(assistantMessage.content[0].text);
    } else {
      await res.edit("わからん！");
    }
    return;
  }
  if (message.channel.isThread()) {
    if (message.channel.parentId === Bun.env.DISCORD_CHANNEL_ID) {
      const res = await message.channel.send("(考え中)");
      const [allMessages, startMessage] = await Promise.all([
        message.channel.messages.fetch(),
        message.channel.fetchStarterMessage(),
      ]);
      if (startMessage?.content) {
        const messages = [
          {
            role: "user",
            content: startMessage.content,
          },
          ...allMessages
            .filter((msg) => msg.content.length > 0)
            .reverse()
            .map((msg) => ({
              role: msg.author.bot ? "assistant" : "user",
              content: msg.content,
            })),
        ] as Array<{ role: "user" | "assistant"; content: string }>;
        try {
          const assistantMessage = await client.messages.create({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 1024,
            messages,
            system: SystemPrompt,
          });
          if (assistantMessage.content.length > 0) {
            if (assistantMessage.content[0].type === "text") {
              res.edit(assistantMessage.content[0].text);
            } else {
              res.edit("わからん！");
            }
          } else {
            res.edit("おわり〜");
          }
        } catch (err) {
          console.log(err);
          res.edit("エラーみたい");
        }
      }
    }
    return;
  }
});

discord.login(Bun.env.TOKEN);
