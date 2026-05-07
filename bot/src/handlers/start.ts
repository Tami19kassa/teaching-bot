import { Context } from "grammy";

export async function handleStart(ctx: Context): Promise<void> {
  const name = ctx.from?.first_name ?? "there";

  await ctx.reply(
    `👋 Hello, ${name}!\n\n` +
      `Welcome to the Teaching Bot. Here's what you can do:\n\n` +
      `📚 /levels — Browse available learning levels\n` +
      `🎓 /mylevels — See your enrolled levels\n` +
      `❓ /help — Show this message again`,
    {
      protect_content: true,
      parse_mode: "HTML",
    }
  );
}
