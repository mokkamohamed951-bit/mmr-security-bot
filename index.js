const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, REST, Routes, ApplicationCommandOptionType, ChannelType } = require('discord.js');
require('dotenv').config(); // تشغيل مكتبة dotenv لقراءة التوكن بأمان من ملف .env

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Advanced Configuration
const CONFIG = {
  maxSpamMessages: 4, 
  spamInterval: 6000, 
  maxMentions: 4, 
  timeoutDuration: 5 * 60 * 1000, // 5 minutes
  minAccountAgeDays: 3, 
  maxStaffActions: 3, 
  staffActionWindow: 60000 
};

// مصفوفة ديناميكية لحفظ معرفات رومات اللوق لكل سيرفر تلقائياً
const guildLogChannels = new Map();

const userMessages = new Map();
const userViolations = new Map(); 
const staffActions = new Map(); 
const tempBans = new Map(); 

let badWords = [
  "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "dick", "slut", "whore",
  "motherfucker", "idiot", "stupid", "nigger", "nigga", "faggot", "retard", "dumbass",
  "pussy", "jackass", "wanker", "bullshit", "prick", "cock", "twat", "dipshit",
  "free nitro", "discord.gifts", "crypto scam", "free gift card", "earn money fast",
  "dm for info", "clck.ru", "steamcommunity-nitro", "free-nitro", "get free nitro",
  "خرا", "زق", "exploit", "selling accounts", "buy cheap",
  "كلب", "حمار", "غبي", "يا ابن", "شرموطه", "منيوك", "قحبة", "تفو", "كس اختك", "كس امك",
  "khara", "sharmouta", "kosomak", "kessokhtak", "gabi", "انيكك", "انيك امك"
];

// دالة ذكية لفحص أو إنشاء روم لوق مخصصة ومحمية داخل السيرفر تلقائياً
async function ensureLogChannel(guild) {
  let logChannel = guild.channels.cache.find(ch => ch.name === 'mmr-logs' && ch.type === ChannelType.GuildText);
  
  if (!logChannel) {
    try {
      logChannel = await guild.channels.create({
        name: 'mmr-logs',
        type: ChannelType.GuildText,
        topic: '🛡️ MMR Security Hub - Advanced Cyber Security System Logs.',
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages], // إخفاء عن الأعضاء
          },
          {
            id: guild.client.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks], // البوت يرى ويرسل
          }
        ],
      });

      // إرسال رسالة ترحيبية وتدشين الروم بشكل سايبربانك فخم
      const setupEmbed = new EmbedBuilder()
        .setColor(0x00FFCC) // نيون فيروزي
        .setTitle('🛰️ MMR SECURITY SYSTEM INITIALIZED')
        .setDescription(`>>> **🛡️ MMR Cyber Guard** has successfully deployed a secure log architecture in **${guild.name}**.\n\nAll administrative actions, raid detections, and automated bans will be securely cataloged inside this channel.`)
        .addFields({ name: '🔒 Security Status', value: '`ENCRYPTED & RESTRICTED`', inline: true })
        .setFooter({ text: 'System Online • Neural Network Active' })
        .setTimestamp();

      await logChannel.send({ embeds: [setupEmbed] });
    } catch (error) {
      console.error(`Failed to create log channel in guild: ${guild.name}`, error);
      return null;
    }
  }
  
  guildLogChannels.set(guild.id, logChannel.id);
  return logChannel;
}

async function registerSlashCommands(botId) {
  const commands = [
    {
      name: 'kick',
      description: 'Kick a member from the server (Public Announcement)',
      options: [
        { name: 'user', description: 'The member to kick', type: ApplicationCommandOptionType.User, required: true },
        { name: 'reason', description: 'Reason for the kick', type: ApplicationCommandOptionType.String, required: false }
      ]
    },
    {
      name: 'ban',
      description: 'Ban a member temporarily or permanently (Public Announcement)',
      options: [
        { name: 'user', description: 'The member to ban', type: ApplicationCommandOptionType.User, required: true },
        { name: 'days', description: 'Number of days for the ban (0 for permanent)', type: ApplicationCommandOptionType.Integer, required: true },
        { name: 'reason', description: 'Reason for the ban', type: ApplicationCommandOptionType.String, required: true }
      ]
    },
    {
      name: 'timeout',
      description: 'Timeout/Mute a member in the server',
      options: [{ name: 'user', description: 'The member to timeout', type: ApplicationCommandOptionType.User, required: true }, { name: 'minutes', description: 'Duration in minutes', type: ApplicationCommandOptionType.Integer, required: true }, { name: 'reason', description: 'Reason for the timeout', type: ApplicationCommandOptionType.String, required: false }]
    },
    {
      name: 'clear',
      description: 'Delete a specific amount of messages',
      options: [{ name: 'amount', description: 'Number of messages to delete (1-100)', type: ApplicationCommandOptionType.Integer, required: true }]
    },
    {
      name: 'lock',
      description: 'Lock the current text channel'
    },
    {
      name: 'unlock',
      description: 'Unlock the current text channel'
    },
    {
      name: 'slowmode',
      description: 'Set slowmode for the current channel',
      options: [{ name: 'seconds', description: 'Slowmode duration in seconds (0 to turn off)', type: ApplicationCommandOptionType.Integer, required: true }]
    },
    {
      name: 'warn',
      description: 'Manually warn a member (Private Warning)',
      options: [{ name: 'user', description: 'The member to warn', type: ApplicationCommandOptionType.User, required: true }, { name: 'reason', description: 'Reason for the warning', type: ApplicationCommandOptionType.String, required: true }]
    },
    {
      name: 'warnings',
      description: 'Check a member\'s warning count',
      options: [{ name: 'user', description: 'The member to check', type: ApplicationCommandOptionType.User, required: true }]
    },
    {
      name: 'clearwarns',
      description: 'Reset and clear all warnings for a member',
      options: [{ name: 'user', description: 'The member to clear warnings for', type: ApplicationCommandOptionType.User, required: true }]
    },
    {
      name: 'addword',
      description: 'Add a new custom bad word to the block list',
      options: [{ name: 'word', description: 'The word to block', type: ApplicationCommandOptionType.String, required: true }]
    },
    {
      name: 'removeword',
      description: 'Remove a word from the blocked list',
      options: [{ name: 'word', description: 'The word to unblock', type: ApplicationCommandOptionType.String, required: true }]
    },
    {
      name: 'scan',
      description: 'Scan the server for security vulnerabilities and dangerous permission leaks'
    },
    {
      name: 'userinfo',
      description: 'Display detailed information about a member',
      options: [{ name: 'user', description: 'The member to view info of', type: ApplicationCommandOptionType.User, required: false }]
    },
    {
      name: 'serverinfo',
      description: 'Display detailed statistics about this server'
    }
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('🔄 Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(botId), { body: commands });
    console.log('✅ Successfully reloaded application (/) commands globally.');
  } catch (error) {
    console.error(error);
  }
}

client.once('ready', async () => {
  console.log(`🛡️ MMR Global Security Guard is now ONLINE as: ${client.user.tag}`);
  await registerSlashCommands(client.user.id);

  // فحص جميع السيرفرات عند تشغيل البوت لإنشاء الروم إذا لم تكن موجودة
  client.guilds.cache.forEach(async (guild) => {
    await ensureLogChannel(guild);
  });

  // نظام فحص تلقائي كل دقيقة لفك البان المؤقت
  setInterval(async () => {
    const now = Date.now();
    for (const [key, expireTime] of tempBans.entries()) {
      if (now >= expireTime) {
        const [guildId, userId] = key.split('-');
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          try {
            await guild.members.unban(userId, "MMR Temporary Ban Expired");
            const unbanEmbed = new EmbedBuilder()
              .setColor(0x00FF88) 
              .setTitle('🔓 [SYSTEM] TEMPORARY BAN EXPIRED')
              .setDescription(`>>> **Target ID:** \`${userId}\` has been automatically unbanned after completing the specified time window.`)
              .setTimestamp();
            sendToLog(guild, unbanEmbed);
          } catch (e) { console.log("Failed to auto-unban user:", userId); }
        }
        tempBans.delete(key);
      }
    }
  }, 60000);
});

// عند دخول البوت إلى أي سيرفر جديد يصنع القناة تلقائياً
client.on('guildCreate', async (guild) => {
  console.log(`📥 Joined a new server: ${guild.name}`);
  await ensureLogChannel(guild);
});

async function sendToLog(guild, embed) {
  let channelId = guildLogChannels.get(guild.id);
  let logChannel = guild.channels.cache.get(channelId);

  if (!logChannel) {
    logChannel = await ensureLogChannel(guild);
  }

  if (logChannel) {
    try { logChannel.send({ embeds: [embed] }); } catch (e) { console.log(e); }
  }
}

async function checkStaffRaid(executor, guild, actionType) {
  if (executor.id === guild.ownerId) return;
  const now = Date.now();
  const actions = staffActions.get(executor.id) || [];
  const validActions = actions.filter(time => now - time < CONFIG.staffActionWindow);
  validActions.push(now);
  staffActions.set(executor.id, validActions);

  if (validActions.length > CONFIG.maxStaffActions) {
    const member = await guild.members.fetch(executor.id).catch(() => null);
    if (member) {
      try {
        const rolesToRemove = member.roles.cache.filter(role => role.id !== guild.id && !role.managed);
        await member.roles.remove(rolesToRemove, "MMR Anti-Raid Protocol: Staff malicious activity detected");
        
        const raidEmbed = new EmbedBuilder()
          .setColor(0xFF0055) 
          .setTitle('🚨 ANTI-RAID SYSTEM DISPATCHED [CRITICAL]')
          .setDescription(`>>> ⚠️ **Staff Member:** ${executor} (\`${executor.tag}\`)\n**Status:** **DEMOTED & ROLES STRIPPED FORTHWITH**.\n**Reason:** Exceeded maximum safe administrative threshold (${actionType}) inside a 60s window.`)
          .setFooter({ text: 'MMR Hard Lockdown Protocol Activated' })
          .setTimestamp();
        sendToLog(guild, raidEmbed);
      } catch (err) { console.log(err); }
    }
  }
}

// ================= [ Automated Protection System ] =================
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  
  const member = message.member;
  const userId = message.author.id;

  // الحسابات الوهمية (Anti-Alt)
  const accountAgeInDays = (Date.now() - message.author.createdTimestamp) / (1000 * 60 * 60 * 24);
  if (accountAgeInDays < CONFIG.minAccountAgeDays && !member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    try {
      await message.delete();
      await member.timeout(CONFIG.timeoutDuration, "MMR Anti-Alt Policy: Suspiciously New Account");
      
      const altEmbed = new EmbedBuilder()
        .setColor(0xFF0055)
        .setTitle('🛡️ MMR SHIELD: ANTI-ALT ALARM')
        .setDescription(`>>> ❌ **User:** ${message.author}\n**Detection:** Suspiciously New Account (Age: \`${accountAgeInDays.toFixed(1)}\` days).\n**Action:** Thread suppressed & placed under 5-minute isolation containment.`)
        .setTimestamp();
      sendToLog(message.guild, altEmbed);
      return;
    } catch (err) { console.log(err); }
  }

  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  let isViolating = false;
  let reason = "";
  const cleanMessage = message.content.toLowerCase().replace(/\s+/g, '');

  if (badWords.some(word => message.content.toLowerCase().includes(word) || cleanMessage.includes(word))) {
    isViolating = true;
    reason = "Prohibited Language / Vulgarity Filter Trip";
  }

  if (message.content.includes("http://") || message.content.includes("https://") || message.content.includes("discord.gg/")) {
    isViolating = true;
    reason = "Unauthorized Phishing / Link Propagation Attempt";
  }

  if (message.mentions.everyone || message.mentions.users.size > CONFIG.maxMentions) {
    isViolating = true;
    reason = "Mass Mention Broadcast (High Spam Threshold)";
  }

  const repetitiveText = /(.)\1{15,}/g;
  if (repetitiveText.test(message.content)) {
    isViolating = true;
    reason = "Buffer Overflow Spam / Flooding Characters";
  }

  const now = Date.now();
  const timestamps = userMessages.get(userId) || [];
  const filtered = timestamps.filter(t => now - t < CONFIG.spamInterval);
  filtered.push(now);
  userMessages.set(userId, filtered);

  if (filtered.length > CONFIG.maxSpamMessages) {
    isViolating = true;
    reason = "Rapid Message Inundation (Chat Flooding)";
  }

  if (isViolating) {
    try { await message.delete(); } catch (err) { console.log(err); }

    let warnings = (userViolations.get(userId) || 0) + 1;
    userViolations.set(userId, warnings);

    const logEmbed = new EmbedBuilder()
      .setColor(0xFF9900) 
      .setTitle('🚨 WIRE TAP DETECTED ANOMALY')
      .addFields(
        { name: '👤 Operator', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
        { name: '📊 Index Status', value: `Warning \`[ ${warnings} / 3 ]\``, inline: true },
        { name: '⚙️ Breach Factor', value: `>>> \`${reason}\``, inline: false }
      ).setTimestamp();

    if (warnings === 2) {
      try { await member.timeout(CONFIG.timeoutDuration, "Automated Threat Isolation"); } catch (err) {}
    } 
    else if (warnings >= 3) {
      try {
        await member.kick("MMR Critical Threat Response Threshold reached.");
        userViolations.set(userId, 0);
      } catch (err) {}
    }
    sendToLog(message.guild, logEmbed);
    return;
  }
});

// ================= [ Handling Slash Commands Interactions ] =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, guild, member, user, channel } = interaction;

  // 1. /kick Command -> علني للكل
  if (commandName === 'kick') {
    if (!member.permissions.has(PermissionsBitField.Flags.KickMembers)) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    const target = options.getMember('user');
    const reason = options.getString('reason') || "No reason provided";
    if (!target || !target.kickable) return interaction.reply({ content: "❌ Target invalid or unkickable.", ephemeral: true });

    await checkStaffRaid(user, guild, "KICK_MEMBER");
    await target.kick(reason);
    
    const embed = new EmbedBuilder()
      .setColor(0xFF0055)
      .setTitle('👢 TARGET PURGED (KICKED)')
      .setDescription(`>>> **Subject:** ${target.user} (\`${target.user.tag}\`)\n**Enforcer:** ${user}\n**Reason:** \`${reason}\``)
      .setTimestamp();
      
    await interaction.reply({ embeds: [embed], ephemeral: false }); 
    sendToLog(guild, embed);
  }

  // 2. /ban Command -> علني للكل + مؤقت بالأيام والسبب يظهر للناس
  if (commandName === 'ban') {
    if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    const target = options.getMember('user');
    const days = options.getInteger('days');
    const reason = options.getString('reason');
    if (!target || !target.bannable) return interaction.reply({ content: "❌ Target invalid or unbannable.", ephemeral: true });

    await checkStaffRaid(user, guild, "BAN_MEMBER");
    await target.ban({ reason });

    if (days > 0) {
      const expireTime = Date.now() + (days * 24 * 60 * 60 * 1000);
      tempBans.set(`${guild.id}-${target.id}`, expireTime);
    }

    const embed = new EmbedBuilder()
      .setColor(0x7f0000)
      .setTitle('🚫 HARD PERMANENT / TEMPORARY BAN EXECUTED')
      .setDescription(`>>> **Subject terminated:** ${target.user} (\`${target.user.tag}\`)\n**Timeline:** \`${days === 0 ? 'PERMANENT CONTAINMENT' : `${days} Days Cage`}\` \n**Enforcer:** ${user}\n**Reason:** \`${reason}\``)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: false }); 
    sendToLog(guild, embed);
  }

  // 3. /timeout Command -> مخفي (Ephemeral) للإدارة والمخالف
  if (commandName === 'timeout') {
    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    const target = options.getMember('user');
    const minutes = options.getInteger('minutes');
    const reason = options.getString('reason') || "No reason provided";
    if (!target) return interaction.reply({ content: "❌ Subject offline.", ephemeral: true });

    await target.timeout(minutes * 60 * 1000, reason);
    const embed = new EmbedBuilder()
      .setColor(0xFFFF00)
      .setTitle('⏳ ISOLATION CONFINEMENT (TIMEOUT)')
      .setDescription(`>>> **Subject:** ${target.user.tag}\n**Duration:** \`${minutes} Minutes\`\n**Reason:** \`${reason}\``)
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true }); 
    sendToLog(guild, embed);
  }

  // 4. /warn Command -> مخفي (Ephemeral)
  if (commandName === 'warn') {
    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    const target = options.getUser('user');
    const reason = options.getString('reason');

    let warnings = (userViolations.get(target.id) || 0) + 1;
    userViolations.set(target.id, warnings);

    const embed = new EmbedBuilder()
      .setColor(0xFF9900)
      .setTitle('⚠️ SYSTEM STRIKE LOGGED')
      .setDescription(`>>> **Subject:** ${target}\n**Enforcer:** ${user}\n**Reason:** \`${reason}\`\n**Accumulated Points:** \`${warnings} / 3\``)
      .setTimestamp();
    await interaction.reply({ content: `✅ Warning issued to ${target.tag} privately. Registered in Matrix Logs.`, ephemeral: true });
    sendToLog(guild, embed);
  }

  // باقي الأوامر الإدارية (تظهر مخفية لحماية خصوصية الشات)
  if (commandName === 'clear') {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    const amount = options.getInteger('amount');
    if (amount < 1 || amount > 100) return interaction.reply({ content: "❌ Provide a number between 1 and 100.", ephemeral: true });
    await channel.bulkDelete(amount, true);
    await interaction.reply({ content: `🧹 Cleared **${amount}** messages successfully.`, ephemeral: true });
  }

  if (commandName === 'lock') {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
    await interaction.reply({ content: "🔒 Channel has been locked successfully." });
  }

  if (commandName === 'unlock') {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
    await interaction.reply({ content: "🔓 Channel has been unlocked successfully." });
  }

  if (commandName === 'slowmode') {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    const seconds = options.getInteger('seconds');
    await channel.setRateLimitPerUser(seconds);
    await interaction.reply({ content: `⏳ Slowmode set to **${seconds}** seconds.`, ephemeral: true });
  }

  if (commandName === 'warnings') {
    const target = options.getUser('user');
    const warnings = userViolations.get(target.id) || 0;
    await interaction.reply({ content: `👤 ${target.tag} has **${warnings}** warning(s).`, ephemeral: true });
  }

  if (commandName === 'clearwarns') {
    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    const target = options.getUser('user');
    userViolations.set(target.id, 0);
    await interaction.reply({ content: `✅ Reset all warnings for ${target.tag}.`, ephemeral: true });
  }

  if (commandName === 'addword') {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    const newWord = options.getString('word').toLowerCase();
    if (badWords.includes(newWord)) return interaction.reply({ content: "❌ Word already blocked.", ephemeral: true });
    badWords.push(newWord);
    await interaction.reply({ content: `✅ Word \`${newWord}\` added to MMR Blocklist.`, ephemeral: true });
  }

  if (commandName === 'removeword') {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    const oldWord = options.getString('word').toLowerCase();
    if (!badWords.includes(oldWord)) return interaction.reply({ content: "❌ Word not found.", ephemeral: true });
    badWords = badWords.filter(w => w !== oldWord);
    await interaction.reply({ content: `✅ Word \`${oldWord}\` removed from MMR Blocklist.`, ephemeral: true });
  }

  if (commandName === 'scan') {
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    let dangerousChannels = [];
    guild.channels.cache.forEach(ch => {
      if (ch.isTextBitrateable()) {
        const perms = ch.permissionsFor(guild.roles.everyone);
        if (perms && perms.has(PermissionsBitField.Flags.SendMessages) && (ch.name.includes("rules") || ch.name.includes("announcement") || ch.name.includes("log"))) {
          dangerousChannels.push(`🚨 Channel **#${ch.name}** allows @everyone to send messages!`);
        }
      }
    });
    const scanEmbed = new EmbedBuilder()
      .setColor(dangerousChannels.length > 0 ? 0xFF0055 : 0x00FFCC)
      .setTitle('🛡️ MMR CYBER-SECURITY REPORT')
      .setDescription(dangerousChannels.length > 0 ? dangerousChannels.join('\n') : "✅ **PERFECT STATUS:** No critical privilege leaks found.")
      .setTimestamp();
    await interaction.editReply({ embeds: [scanEmbed] });
  }

  if (commandName === 'userinfo') {
    const targetUser = options.getUser('user') || user;
    const targetMember = options.getMember('user') || member;
    const embed = new EmbedBuilder().setColor(0x00FFCC).setTitle(`👤 User Info Matrix`).setThumbnail(targetUser.displayAvatarURL()).addFields({ name: 'ID', value: targetUser.id, inline: true }, { name: 'Nickname', value: targetMember.nickname || 'None', inline: true }, { name: 'Created Account', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: false }, { name: 'Joined Server', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`, inline: false });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (commandName === 'serverinfo') {
    const embed = new EmbedBuilder().setColor(0x00FFCC).setTitle(`🏰 Server Architecture`).setThumbnail(guild.iconURL()).addFields({ name: 'Owner', value: `<@${guild.ownerId}>`, inline: true }, { name: 'Total Members', value: `${guild.memberCount}`, inline: true }, { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

// تسجيل الدخول الآمن من متغير البيئة المشفر
client.login(process.env.DISCORD_TOKEN);
