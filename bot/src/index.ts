import "dotenv/config";
import { Bot, session } from "grammy";
import { SessionData } from "./lib/session";
import { userSyncMiddleware } from "./middleware/userSync";
import { handleStart } from "./handlers/start";
import { handleLevels, handleMyLevels, handleWatchCallback } from "./handlers/levels";
import {
  handleEnrollCallback,
  handleCancelPayment,
  handleReceiptPhoto,
} from "./handlers/payment";

// ─── Type augmentation ────────────────────────────────────────────────────────

type BotContext = import("grammy").Context & { session: SessionData };

// ─── Bot setup ────────────────────────────────────────────────────────────────

const bot = new Bot<BotContext>(process.env.BOT_TOKEN!);

// Session middleware (in-memory; swap for Redis/DB in production)
bot.use(
  session<SessionData, BotContext>({
    initial: (): SessionData => ({ step: "idle" }),
  })
);

// Sync every interacting user to DB
bot.use(userSyncMiddleware);

// ─── Commands ─────────────────────────────────────────────────────────────────

bot.command("start", handleStart);
bot.command("help", handleStart);
bot.command("levels", handleLevels);
bot.command("mylevels", handleMyLevels);

// ─── Callbacks ────────────────────────────────────────────────────────────────

bot.callbackQuery(/^enroll:\d+$/, handleEnrollCallback);
bot.callbackQuery("cancel_payment", handleCancelPayment);
bot.callbackQuery(/^watch:\d+$/, handleWatchCallback);

// ─── Photo handler (receipt upload) ──────────────────────────────────────────

bot.on("message:photo", handleReceiptPhoto);

// ─── Catch-all for unexpected messages during payment flow ───────────────────

bot.on("message:text", async (ctx: BotContext) => {
  if (ctx.session.step === "awaiting_receipt") {
    await ctx.reply(
      "📸 Please send a <b>photo/screenshot</b> of your payment receipt.",
      { parse_mode: "HTML", protect_content: true }
    );
    return;
  }
  // Default fallback
  await ctx.reply("Use /levels to browse courses or /mylevels to see your access.", {
    protect_content: true,
  });
});

// ─── Error handler ────────────────────────────────────────────────────────────

bot.catch((err) => {
  console.error("[Bot Error]", err.message, err.ctx?.update);
});

// ─── Start ────────────────────────────────────────────────────────────────────

bot.start({
  onStart: (info) => {
    console.log(`✅ Bot @${info.username} is running`);
  },
});
