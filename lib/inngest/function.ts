import { success } from "better-auth";
import { inngest } from "./client";
import {
  NEWS_SUMMARY_EMAIL_PROMPT,
  PERSONALIZED_WELCOME_EMAIL_PROMPT,
} from "./prompt";
import {
  sendNewsSummaryEmail,
  sendWelcomeEmail,
  sendUpperAlert,
  sendLowerAlert,
  sendBuyOrderPin,
  sendSellOrderPin,
} from "../nodemailer";
import { getAllUsersForNewsEmail } from "../actions/user.action";
import { getCurrentPrice } from "../actions/finnhub.actions";
import { getFormattedTodayDate } from "../utils";
import { getWatchlistSymbolsByUserId } from "../actions/watchlist.actions";
import { connectToDB } from "@/database/mongoose";
import positionsModels from "@/database/models/positions.models";
import { ClosingPrice } from "@/database/models/closingPrices.models";

export const sendSignUpEmail = inngest.createFunction(
  { id: "sign-up-email" },
  { event: "app/user.created" },
  async ({ event, step }) => {
    const userProfile = `
        - Country: ${event.data.country}
        - Investment goals: ${event.data.investmentGoals}
        - Risk tolerance: ${event.data.riskTolerance}
        - Preferred industry: ${event.data.preferredIndustry}
        `;

    const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace(
      "{{userProfile}}",
      userProfile
    );

    const response = await step.ai.infer("generate-welcome-intro", {
      model: step.ai.models.gemini({ model: "gemini-2.0-flash-lite" }),
      body: {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      },
    });

    await step.run("send-welcome-email", async () => {
      const part = response.candidates?.[0]?.content?.parts?.[0];
      const introText =
        (part && "text" in part ? part.text : null) ||
        "Thanks for joining the app";

      const {
        data: { email, name },
      } = event;
      return await sendWelcomeEmail({
        email,
        name,
        intro: introText,
      });
    });

    return {
      success: true,
      message: "Welcome email sent successfully",
    };
  }
);

// export const sendWeeklyNewsSummary = inngest.createFunction(
//   { id: "weekly-news-summary" },
//   [{ event: "app/send.weekly.news" }, { cron: "30 3 * * 0" }],
//   async ({ step }) => {
//     const users = await step.run("get-all-users", getAllUsersForNewsEmail);
//     if (!users || users.length === 0)
//       return { success: false, message: "No users found for news email" };

//     const results = await step.run("fetch-user-news", async () => {
//       const list: Array<{ user: User; articles: MarketNewsArticle[] }> = [];

//       for (const user of users as User[]) {
//         try {
//           const symbols = await getWatchlistSymbolsByUserId(user.id);
//           const primary = await getNews(symbols.map((s) => s.s));
//           const finalArticles =
//             (primary && primary.length > 0 ? primary : await getNews()).slice(
//               0,
//               6
//             );

//           list.push({ user, articles: finalArticles });
//         } catch {
//           list.push({ user, articles: [] });
//         }
//       }

//       return list;
//     });

//     const outputs: { user: User; newsContent: string }[] = [];

//     for (const { user, articles } of results) {
//       if (!articles || articles.length === 0) {
//         outputs.push({
//           user,
//           newsContent:
//             "No relevant market news available for your watchlist this week.",
//         });
//         continue;
//       }

//       const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace(
//         "{{newsData}}",
//         JSON.stringify(articles, null, 2)
//       );

//       try {
//         const response = await step.ai.infer(`weekly-news-${user.email}`, {
//           model: step.ai.models.gemini({ model: "gemini-2.5-flash-lite" }),
//           body: {
//             contents: [{ role: "user", parts: [{ text: prompt }] }],
//           },
//         });

//         const p = response.candidates?.[0]?.content?.parts?.[0];
//         const text =
//           (p && "text" in p ? p.text : null) ||
//           "No relevant market news available for your watchlist this week.";

//         outputs.push({ user, newsContent: text });
//       } catch {
//         outputs.push({
//           user,
//           newsContent:
//             "No relevant market news available for your watchlist this week.",
//         });
//       }
//     }

//     await step.run("send-news-emails", async () => {
//       await Promise.all(
//         outputs.map(({ user, newsContent }) =>
//           sendNewsSummaryEmail({
//             email: user.email,
//             date: getFormattedTodayDate(),
//             newsContent,
//           })
//         )
//       );
//     });

//     return { success: true, message: "Weekly news summary emails sent successfully" };
//   }
// );


export const sendUpperAlertEmail = inngest.createFunction(
  { id: "send-upper-alert-email" },
  { event: "app/stock.upper_alert" },
  async ({ event, step }) => {
    await step.run("send-upper-alert-email", async () => {
      const {
        userEmail,
        symbol,
        timestamp,
        companyName,
        currentPrice,
        targetPrice,
      } = event.data;
      return await sendUpperAlert({
        userEmail,
        symbol,
        timestamp,
        companyName,
        currentPrice,
        targetPrice,
      });
    });

    return {
      success: true,
      message: "Upper target reached",
    };
  }
);

export const sendLowerAlertEmail = inngest.createFunction(
  { id: "send-lower-alert-email" },
  { event: "app/stock.lower_alert" },
  async ({ event, step }) => {
    await step.run("send-lower-alert-email", async () => {
      const {
        userEmail,
        symbol,
        timestamp,
        companyName,
        currentPrice,
        targetPrice,
      } = event.data;
      return await sendLowerAlert({
        userEmail,
        symbol,
        timestamp,
        companyName,
        currentPrice,
        targetPrice,
      });
    });

    return {
      success: true,
      message: "Lower target reached",
    };
  }
);

export const sendBuyOrderPinEmail = inngest.createFunction(
  { id: "send-buy-order-pin-email" },
  { event: "app/orders.buy_pin_generated" },
  async ({ event, step }) => {
    await step.run("send-buy-order-pin-email", async () => {
      const { userEmail, symbol, pin, qty, price, timestamp, ttl } = event.data;
      return await sendBuyOrderPin({
        userEmail,
        symbol,
        pin,
        qty,
        price,
        timestamp,
        ttl,
      });
    });

    return {
      success: true,
      message: "Buy order pin email sent",
    };
  }
);

export const sendSellOrderPinEmail = inngest.createFunction(
  { id: "send-sell-order-pin-email" },
  { event: "app/orders.sell_pin_generated" },
  async ({ event, step }) => {
    await step.run("send-sell-order-pin-email", async () => {
      const { userEmail, symbol, pin, qty, price, timestamp, ttl } = event.data;
      return await sendSellOrderPin({
        userEmail,
        symbol,
        pin,
        qty,
        price,
        timestamp,
        ttl,
      });
    });

    return {
      success: true,
      message: "Sell order pin email sent",
    };
  }
);

export const updateClosingPrices = inngest.createFunction(
  { id: "update-closing-prices" },

  [{ cron: "30 20 * * 1-5" }],

  async ({ step }) => {
    await step.run("connect-db", async () => {
      await connectToDB();
    });

    const symbols = await step.run("get-unique-symbols", async () => {
      const positions = await positionsModels.find({});
      return [...new Set(positions.map((p) => p.symbol))];
    });

    if (symbols.length === 0) {
      return { success: false, message: "No symbols found" };
    }

    await step.run("update-prices", async () => {
      for (const symbol of symbols) {
        const price = await getCurrentPrice(symbol);
        if (!price) continue;

        await ClosingPrice.findOneAndUpdate(
          { symbol },
          { closePrice: price, updatedAt: new Date() },
          { upsert: true }
        );
      }
    });

    return { success: true };
  }
);
