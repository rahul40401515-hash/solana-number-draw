/**
 * Telegram Bot Script
 *
 * Handles bot commands and notifications for the Number Draw game.
 * Run with: npm run bot
 */

import TelegramBot from 'node-telegram-bot-api';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.TELEGRAM_WEBAPP_URL || 'http://localhost:3000';

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set');
  console.log('Please set it in your .env.local file');
  console.log('Get a token from @BotFather on Telegram');
  process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(TOKEN, { polling: true });

console.log('🤖 Telegram Bot started');
console.log(`📱 WebApp URL: ${WEBAPP_URL}`);

// ── Commands ─────────────────────────────────

// /start - Welcome message
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from?.first_name || 'Player';

  bot.sendMessage(chatId, `
🎮 Welcome to *Solana Number Draw*, ${firstName}!

🏆 Choose your lucky number and win SOL prizes!

Here's how it works:
1️⃣ Pick a number from 1 to 5,000
2️⃣ Pay 0.05 SOL to enter
3️⃣ 5 winning numbers are drawn at round end
4️⃣ Prize pool is split among winners

👇 Tap below to start playing!
  `, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🎯 Play Now',
            web_app: { url: WEBAPP_URL },
          },
        ],
        [
          { text: '📜 Rules', callback_data: 'rules' },
          { text: '🏆 Results', callback_data: 'results' },
        ],
        [
          { text: '👤 My Entries', callback_data: 'myentries' },
          { text: '❓ Help', callback_data: 'help' },
        ],
      ],
    },
  });
});

// /game - Open the game
bot.onText(/\/game/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, '🎮 Opening Number Draw...', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🎯 Open Game',
            web_app: { url: WEBAPP_URL },
          },
        ],
      ],
    },
  });
});

// /myentries - View user's entries
bot.onText(/\/myentries/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, '👤 Your Entries', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📋 View My Numbers',
            web_app: { url: `${WEBAPP_URL}/profile` },
          },
        ],
      ],
    },
  });
});

// /results - View latest results
bot.onText(/\/results/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, '🏆 Latest Results', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🏆 View Results',
            web_app: { url: `${WEBAPP_URL}/game/results` },
          },
        ],
      ],
    },
  });
});

// /rules - Show game rules
bot.onText(/\/rules/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, `
📜 *Game Rules*

🔢 *Numbers:* 1 to 5,000
💰 *Entry Price:* 0.05 SOL
🏆 *Winners:* 5 per round
📊 *Prize:* Pool split equally

*How to play:*
1. Open the Mini App
2. Choose an available number
3. Pay 0.05 SOL
4. Wait for the draw
5. If your number wins, you receive your share!

*Important:*
• Each number can only be purchased once
• Numbers are assigned on first-come basis
• The draw is provably fair (verifiable)
• Entry fees are non-refundable
• Outcome depends on chance

⚠️ *This game involves financial risk. Play responsibly.*
  `, { parse_mode: 'Markdown' });
});

// /help - Help message
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, `
❓ *Help*

*Commands:*
/start - Welcome message
/game - Open the game
/myentries - View your numbers
/results - Latest results
/rules - Game rules
/status - Game status
/help - This message

*Need more help?*
Contact the admin in the group chat.
  `, { parse_mode: 'Markdown' });
});

// /status - Current game status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Fetch current round data from API
    const response = await fetch(`${WEBAPP_URL}/api/game/current`);
    const data = await response.json();

    if (data.success && data.data.round) {
      const round = data.data.round;
      const stats = data.data.stats;

      bot.sendMessage(chatId, `
📊 *Game Status*

*Round:* #${String(round.roundNumber).padStart(3, '0')}
*Status:* ${round.status}
*Entries:* ${stats.taken.toLocaleString()} / ${stats.totalNumbers.toLocaleString()}
*Available:* ${stats.available.toLocaleString()}
*Prize Pool:* ${(Number(round.prizePoolLamports) / 1e9).toFixed(2)} SOL
*Ends:* ${new Date(round.endAt).toLocaleDateString()}

👇 Tap below to play!
      `, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎯 Play Now',
                web_app: { url: WEBAPP_URL },
              },
            ],
          ],
        },
      });
    } else {
      bot.sendMessage(chatId, '⏳ No active round. Next round starting soon!');
    }
  } catch (err) {
    bot.sendMessage(chatId, '⚠️ Could not fetch game status. Please try again later.');
  }
});

// ── Callback Queries ─────────────────────────

bot.on('callback_query', (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId) return;

  switch (query.data) {
    case 'rules':
      bot.sendMessage(chatId, 'Use /rules to see the game rules');
      break;
    case 'results':
      bot.sendMessage(chatId, '🏆 Latest Results', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏆 View Results', web_app: { url: `${WEBAPP_URL}/game/results` } }],
          ],
        },
      });
      break;
    case 'myentries':
      bot.sendMessage(chatId, '👤 Your Entries', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 View My Numbers', web_app: { url: `${WEBAPP_URL}/profile` } }],
          ],
        },
      });
      break;
    case 'help':
      bot.sendMessage(chatId, 'Use /help to see all commands');
      break;
  }

  bot.answerCallbackQuery(query.id);
});

// ── Announcements ────────────────────────────

/**
 * Announce new round (call this from admin API)
 */
export async function announceNewRound(
  chatId: string | number,
  roundNumber: number,
  totalNumbers: number,
  entryPriceSol: number
): Promise<void> {
  await bot.sendMessage(chatId, `
🎉 *New Round Opened!*

📋 Round #${String(roundNumber).padStart(3, '0')}
🔢 ${totalNumbers.toLocaleString()} numbers available
💰 Entry: ${entryPriceSol} SOL
🏆 5 winners selected at draw time

👇 Tap below to choose your number!
  `, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎯 Play Now', web_app: { url: WEBAPP_URL } }],
      ],
    },
  });
}

/**
 * Announce round closing
 */
export async function announceRoundClosing(chatId: string | number): Promise<void> {
  await bot.sendMessage(chatId, `
🔒 *Entries Closed*

The draw is being processed. Results will be announced shortly.

Good luck to all participants! 🍀
  `, { parse_mode: 'Markdown' });
}

/**
 * Announce draw results
 */
export async function announceResults(
  chatId: string | number,
  roundNumber: number,
  winners: Array<{ number: number; username: string; prize: string }>
): Promise<void> {
  const winnerText = winners
    .map((w, i) => `${i + 1}️⃣ #${String(w.number).padStart(3, '0')} - @${w.username} - ${w.prize} SOL`)
    .join('\n');

  await bot.sendMessage(chatId, `
🏆 *ROUND #${String(roundNumber).padStart(3, '0')} COMPLETE!*

${winners.length} winners selected!

${winnerText}

👇 View full results and verify the draw!
  `, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🏆 View Results', web_app: { url: `${WEBAPP_URL}/game/results` } },
          { text: '🔍 Verify Draw', web_app: { url: `${WEBAPP_URL}/game/transparency` } },
        ],
      ],
    },
  });
}

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Bot polling error:', error.message);
});

console.log('✅ Bot is ready and listening for commands');
