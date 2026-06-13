
import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getLevelingConfig, getUserLevelData } from '../services/leveling.js';
import { addXp } from '../services/xpSystem.js';
import { checkRateLimit } from '../utils/rateLimiter.js';

const MESSAGE_XP_RATE_LIMIT_ATTEMPTS = 12;
const MESSAGE_XP_RATE_LIMIT_WINDOW_MS = 10000;

const PREFIX = 'S!';

export default {
  name: Events.MessageCreate,
  async execute(message, client) {
    try {
      if (message.author.bot || !message.guild) return;

      // ===== PREFIX COMMAND HANDLER =====
      if (message.content.startsWith(PREFIX)) {
        await handlePrefixCommand(message, client);
        return;
      }
      // ==================================

      await handleLeveling(message, client);
    } catch (error) {
      logger.error('Error in messageCreate event:', error);
    }
  }
};

// =============================================
// PREFIX COMMAND ENGINE
// Bridges message commands → slash command execute()
// =============================================
async function handlePrefixCommand(message, client) {
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  if (!commandName) return;

  const command = client.commands.get(commandName);

  if (!command) {
    return message.reply(`❌ Unknown command \`${PREFIX}${commandName}\`. Use \`${PREFIX}help\` to see available commands.`);
  }

  // Check member permissions
  if (command.data?.default_member_permissions) {
    const required = BigInt(command.data.default_member_permissions);
    if (!message.member.permissions.has(required)) {
      return message.reply('❌ You do not have permission to use this command.');
    }
  }

  // Build a fake interaction object that mimics discord.js interaction
  const fakeInteraction = buildFakeInteraction(message, args, command);

  try {
    await command.execute(fakeInteraction, client.config, client);
  } catch (error) {
    logger.error(`Error executing prefix command "${commandName}":`, error);
    await message.reply('❌ An error occurred while running that command.');
  }
}

// =============================================
// FAKE INTERACTION BUILDER
// Maps message + args → interaction-like object
// =============================================
function buildFakeInteraction(message, args, command) {
  // Parse options from args based on command definition
  const optionValues = parseArgs(args, command);

  const replied = { value: false };

  const sendReply = async (data) => {
    if (replied.value) {
      return message.channel.send(data);
    }
    replied.value = true;
    return message.reply(data);
  };

  return {
    // Identity
    user: message.author,
    member: message.member,
    guild: message.guild,
    channel: message.channel,
    channelId: message.channel.id,
    guildId: message.guild.id,
    client: message.client,
    createdTimestamp: message.createdTimestamp,

    // Reply methods
    reply: sendReply,
    editReply: sendReply,
    followUp: (data) => message.channel.send(data),
    deferReply: async () => { replied.value = true; },
    deferUpdate: async () => {},
    deleteReply: async () => {},

    // Flags (prefix commands are always visible)
    ephemeral: false,

    // Options parser
    options: {
      _values: optionValues,

      getString: (name) => optionValues[name] ?? null,
      getInteger: (name) => {
        const v = optionValues[name];
        return v !== undefined ? parseInt(v) : null;
      },
      getNumber: (name) => {
        const v = optionValues[name];
        return v !== undefined ? parseFloat(v) : null;
      },
      getBoolean: (name) => {
        const v = optionValues[name];
        if (v === undefined) return null;
        return v === 'true' || v === '1' || v === 'yes';
      },
      getUser: (name) => {
        const v = optionValues[name];
        if (!v) return null;
        const id = v.replace(/[<@!>]/g, '');
        return message.client.users.cache.get(id) ?? null;
      },
      getMember: (name) => {
        const v = optionValues[name];
        if (!v) return null;
        const id = v.replace(/[<@!>]/g, '');
        return message.guild.members.cache.get(id) ?? null;
      },
      getChannel: (name) => {
        const v = optionValues[name];
        if (!v) return null;
        const id = v.replace(/[<#>]/g, '');
        return message.guild.channels.cache.get(id) ?? null;
      },
      getRole: (name) => {
        const v = optionValues[name];
        if (!v) return null;
        const id = v.replace(/[<@&>]/g, '');
        return message.guild.roles.cache.get(id) ?? null;
      },
      getSubcommand: () => null,
      getSubcommandGroup: () => null,
      data: optionValues,
    },

    // Make isRepliable checks pass
    isRepliable: () => true,
    isChatInputCommand: () => true,
    isCommand: () => true,
    inGuild: () => true,
  };
}

// =============================================
// ARG PARSER
// Maps positional args to named options
// using the command's slash definition
// =============================================
function parseArgs(args, command) {
  const values = {};

  try {
    const options = command.data?.options ?? [];

    // Flatten: skip subcommand groups, just get option definitions
    const flatOptions = options.filter(o => o.type !== 1 && o.type !== 2);

    flatOptions.forEach((option, index) => {
      if (args[index] !== undefined) {
        // Last option gets all remaining args joined (good for reason, text, etc.)
        if (index === flatOptions.length - 1 && args.length > flatOptions.length) {
          values[option.name] = args.slice(index).join(' ');
        } else {
          values[option.name] = args[index];
        }
      }
    });
  } catch (e) {
    logger.warn('Could not parse args for prefix command:', e.message);
  }

  return values;
}

// =============================================
// LEVELING HANDLER (unchanged)
// =============================================
async function handleLeveling(message, client) {
  try {
    const rateLimitKey = `xp-event:${message.guild.id}:${message.author.id}`;
    const canProcess = await checkRateLimit(rateLimitKey, MESSAGE_XP_RATE_LIMIT_ATTEMPTS, MESSAGE_XP_RATE_LIMIT_WINDOW_MS);
    if (!canProcess) return;

    const levelingConfig = await getLevelingConfig(client, message.guild.id);
    if (!levelingConfig?.enabled) return;
    if (levelingConfig.ignoredChannels?.includes(message.channel.id)) return;

    if (levelingConfig.ignoredRoles?.length > 0) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member && member.roles.cache.some(role => levelingConfig.ignoredRoles.includes(role.id))) return;
    }

    if (levelingConfig.blacklistedUsers?.includes(message.author.id)) return;
    if (!message.content || message.content.trim().length === 0) return;

    const userData = await getUserLevelData(client, message.guild.id, message.author.id);
    const cooldownTime = levelingConfig.xpCooldown || 60;
    const now = Date.now();
    if ((now - (userData.lastMessage || 0)) < cooldownTime * 1000) return;

    const minXP = levelingConfig.xpRange?.min || levelingConfig.xpPerMessage?.min || 15;
    const maxXP = levelingConfig.xpRange?.max || levelingConfig.xpPerMessage?.max || 25;
    const safeMinXP = Math.max(1, minXP);
    const safeMaxXP = Math.max(safeMinXP, maxXP);
    const xpToGive = Math.floor(Math.random() * (safeMaxXP - safeMinXP + 1)) + safeMinXP;

    let finalXP = xpToGive;
    if (levelingConfig.xpMultiplier && levelingConfig.xpMultiplier > 1) {
      finalXP = Math.floor(finalXP * levelingConfig.xpMultiplier);
    }

    const result = await addXp(client, message.guild, message.member, finalXP);
    if (result.success && result.leveledUp) {
      logger.info(`${message.author.tag} leveled up to level ${result.level} in ${message.guild.name}`);
    }
  } catch (error) {
    logger.error('Error handling leveling for message:', error);
  }
}



