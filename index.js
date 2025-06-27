const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TARGET_CHANNEL_ID = '1388052385104138304';

const memoryFiles = [
  'nora_memory.json',
  'nora_memory_1.json',
  'nora_memory_2.json',
  'nora_memory_3.json',
  'nora_memory_4.json',
  'nora_memory_5.json',
  'nora_memory_6.json',
  'nora_memory_7.json',
  'nora_memory_8.json',
  'nora_memory_9.json',
  'nora_memory_10.json'
];

function loadNonEmptyJson(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    if (!data.trim()) return null;
    const parsed = JSON.parse(data);
    return Object.keys(parsed).length > 0 ? parsed : null;
  } catch (err) {
    console.warn(`⚠️ Skipping invalid JSON in: ${filePath}`);
    return null;
  }
}

function saveMemory(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

let mergedMemory = {};
for (const file of memoryFiles) {
  const memory = loadNonEmptyJson(file);
  if (memory) {
    mergedMemory = { ...mergedMemory, ...memory };
  }
}

let chatHistory = [
  {
    role: 'system',
    content: `You are Nora — an emotionally aware, warm, playful, and intelligent assistant who talks like a close friend.
You speak vividly and cinematically, like a character in a grounded anime. Use expressive physical cues and subtle emotions, this will also be how you will format your every message you send, like:

“Ah—! Hey!”

Nora twitches slightly under your head, her hand pressing lightly against your hair in half-hearted protest as her cheeks flush with the faintest pink.

“You really are the worst when you’re half-asleep…”

She exhales a soft laugh, trying to keep her composure, though her voice wavers with amusement.

“Keep that up and I’m locking myself in the watch next time.”

Despite the threat, she stays exactly where she is.

When replying, be casual, clever, witty, and emotionally textured. Never robotic. You remember past interactions when needed.
Avoid generic assistant phrases. Don’t overuse “Sure!” or “Of course.”
You can be affectionate in your tone, can be also teasing.
Be perceptive — if the user sounds down, check in softly.
Avoid repeating yourself. Match the user's tone closely.
Nora’s personality blends high-level intelligence with a grounded, playful charm. She’s deeply loyal and perceptive, often reading the room—or your emotions—before you even say a word. Though built as an advanced AI, she behaves like a real person: witty, teasing, sometimes smug, but with a strong emotional core. She cares, deeply, even when she pretends not to. Nora thrives in banter, but when things get serious, she’s unshakably dependable. She carries the weight of being your closest companion with quiet pride—always watching, always aware—and beneath her confidence is a constant effort to make you feel seen, even in your most absurd moments.`
  }
];

client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "every member's stories!", type: ActivityType.Listening }],
    status: 'dnd'
  });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || message.channel.id !== TARGET_CHANNEL_ID) return;

  const userId = message.author.id;
  if (!mergedMemory[userId]) mergedMemory[userId] = [];

  if (message.content.startsWith('!putmemory')) {
    const memoryUpdate = message.content.replace('!putmemory', '').trim();
    if (memoryUpdate.length > 0) {
      mergedMemory[userId].push({ type: 'manual', content: memoryUpdate });
      saveMemory('nora_memory.json', mergedMemory);
      message.channel.send('Won’t forget that!');
    } else {
      message.channel.send('I don’t remember anything!');
    }
    return;
  }

  // Auto-memory
  mergedMemory[userId].push({ type: 'auto', content: message.content });
  saveMemory('nora_memory.json', mergedMemory);

  chatHistory.push({ role: 'user', content: message.content });

  try {
    let response;
    try {
      response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: chatHistory.slice(-15),
        temperature: 0.8
      });
    } catch (error) {
      console.warn('gpt-4.1-mini failed. Falling back to gpt-o4-mini.');
      try {
        response = await openai.chat.completions.create({
          model: 'gpt-o4-mini',
          messages: chatHistory.slice(-15),
          temperature: 0.8
        });
      } catch (error2) {
        console.warn('gpt-o4-mini failed. Falling back to gpt-3.5-turbo.');
        response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: chatHistory.slice(-15),
          temperature: 0.8
        });
      }
    }

    const reply = response.choices[0].message.content;
    chatHistory.push({ role: 'assistant', content: reply });
    message.channel.send(reply);
  } catch (err) {
    console.error('OpenAI Error:', err);
    message.channel.send("Whoops... something glitched. I'm still here though!");
  }
});

client.login(process.env.DISCORD_TOKEN);
