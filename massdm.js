console.log("By: synthra studios | discord.gg/sTrDDhqpHP")
console.log("thanks for you purchase on are code! ")
console.log("[i] Importing modules...")

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const axios = require('axios');

// ---------------- CONFIG ----------------
const MAIN_BOT_TOKEN = "BOT_TOKEN_HERE";  // put your main bot token (from developer portal)
const BOT_TOKENS_FILE = "bots.txt";
const GUILD_ID = "123456789012345678";  // your server ID for slash command sync (change this)
const RATE_LIMIT_WAIT = 0.85; // in seconds edit ts if you want monkeys
// ----------------------------------------

// Load other bot tokens
let spam_bots = [];
try {
    const data = fs.readFileSync(BOT_TOKENS_FILE, 'utf8');
    spam_bots = data.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
} catch (err) {
    spam_bots = [];
    console.log("[!] bots.txt not found or empty - no spamming possible");
}

class SpamClient {
    constructor(token) {
        // In the original Python code, this inherits discord.Client but only uses the token for REST
        this.token = token;
    }

    async send_dm(user_id, message) {
        const headers = {
            "Authorization": `Bot ${this.token}`,
            "User-Agent": "DiscordBot (https://example.com, 1.0)",
            "Content-Type": "application/json"
        };
        const url = `https://discord.com/api/v9/users/@me/channels`;
        const payload = { recipient_id: user_id };

        try {
            // Create DM Channel
            const channelResp = await axios.post(url, payload, { headers: headers, validateStatus: false });

            if (channelResp.status === 429) {
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_WAIT * 1000));
                return [false, "rate limited"];
            }
            if (channelResp.status !== 200) {
                return [false, `error ${channelResp.status}`];
            }

            const channel_id = channelResp.data.id;

            // Now send message
            const msg_url = `https://discord.com/api/v9/channels/${channel_id}/messages`;
            const msgPayload = { content: message };
            const msgResp = await axios.post(msg_url, msgPayload, { headers: headers, validateStatus: false });

            if (msgResp.status === 429) {
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_WAIT * 1000));
                return [false, "rate limited"];
            }
            if (msgResp.status === 200) {
                return [true, "sent"];
            }
            return [false, `error ${msgResp.status}`];

        } catch (error) {
            return [false, `exception: ${error.message}`];
        }
    }
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Helper for sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Define the spam command
const spamCommand = new SlashCommandBuilder()
    .setName('spam')
    .setDescription('Spam a user with messages using other bots')
    .addUserOption(option => 
        option.setName('user')
            .setDescription('The user to spam (mention or ID)')
            .setRequired(true))
    .addStringOption(option => 
        option.setName('message')
            .setDescription('The message to send')
            .setRequired(true))
    .addIntegerOption(option => 
        option.setName('amount')
            .setDescription('Number of messages per bot')
            .setRequired(true))
    .addIntegerOption(option => 
        option.setName('how_many_bots')
            .setDescription('Number of bots to use')
            .setRequired(true));

client.on('ready', async () => {
    try {
        const rest = new REST({ version: '10' }).setToken(MAIN_BOT_TOKEN);
        
        // Syncing commands to the specific guild
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, GUILD_ID),
            { body: [spamCommand.toJSON()] },
        );

        console.log(`[+] Main bot online: ${client.user.tag} | ${spam_bots.length} spam bots loaded`);
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'spam') {
        const user = interaction.options.getUser('user');
        const message = interaction.options.getString('message');
        const amount = interaction.options.getInteger('amount');
        const how_many_bots = interaction.options.getInteger('how_many_bots');

        await interaction.deferReply({ ephemeral: true });

        if (amount < 1 || how_many_bots < 1) {
            return await interaction.editReply({ content: "Amount and bot count must be at least 1", ephemeral: true });
        }

        let available_bots = spam_bots.length >= how_many_bots ? spam_bots.slice(0, how_many_bots) : [...spam_bots];
        
        if (available_bots.length === 0) {
            return await interaction.editReply({ content: "No spam bots loaded from bots.txt", ephemeral: true });
        }

        // Randomize order (shuffle)
        available_bots.sort(() => Math.random() - 0.5);

        let total_sent = 0;
        for (const bot_token of available_bots) {
            const spammer = new SpamClient(bot_token);
            for (let i = 0; i < amount; i++) {
                const [success, reason] = await spammer.send_dm(user.id, message);
                if (success) {
                    total_sent += 1;
                } else {
                    console.log(`[!] Failed for bot: ${reason}`);
                }
                
                // Delay to avoid instant rate limits: random between 1.5 and 4.0 seconds
                const delay = (Math.random() * (4.0 - 1.5) + 1.5) * 1000;
                await sleep(delay);
            }
        }

        await interaction.editReply({ 
            content: `Spammed ${user.username} with ${total_sent} messages using ${available_bots.length} bots`, 
            ephemeral: true 
        });
    }
});

client.login(MAIN_BOT_TOKEN).then(() => {
    console.log(" bot should be online everything ran thats how ur seeing this woah");
});
