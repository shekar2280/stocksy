import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { connectToDB } from "@/database/mongoose";
import { nextCookies } from "better-auth/next-js";
import { sendResetPasswordEmail, sendVerificationEmail } from "../nodemailer";
import { inngest } from "../inngest/client";
import { ObjectId } from "mongodb";

let authInstance: ReturnType<typeof betterAuth> | null = null;

export const getAuth = async () => {
  if (authInstance) return authInstance;

  const mongoose = await connectToDB();
  const db = mongoose.connection.db;

  if (!db) throw new Error("MongoDB connection not found");

  authInstance = betterAuth({
    database: mongodbAdapter(db as any),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,

    emailVerification: {
      sendOnSignUp: true,

      sendVerificationEmail: async ({ user, url, token }, request) => {
        const finalUrl = `${process.env.BETTER_AUTH_URL}/verify-email?token=${token}`;

        try {
          await sendVerificationEmail({
            email: user.email,
            url: finalUrl,
            token,
          });
        } catch (error) {
          console.error(
            `Failed to send verification email to ${user.email}:`,
            error
          );
        }
      },

      async afterEmailVerification(user, request) {
        try {
          const mongoose = await connectToDB();
          const db = mongoose.connection.db;

          if (!db) throw new Error("Not connected to DB");

          const userProfile = await db
            .collection("user")
            .findOne({ _id: new ObjectId(user.id) });

          await db
            .collection("user")
            .updateOne(
              { _id: new ObjectId(user.id) },
              { $set: { emailVerified: true } }
            );

          await inngest.send({
            name: "app/user.created",
            data: {
              email: user.email,
              name: user.name,
              country: userProfile?.country,
              investmentGoals: userProfile?.investmentGoals,
              riskTolerance: userProfile?.riskTolerance,
              preferredIndustry: userProfile?.preferredIndustry,
            },
          });
        } catch (error) {
          console.error("Error in afterEmailVerification hook:", error);
        }
      },
      autoSignInAfterVerification: true,
    },

    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,

      sendResetPassword: async ({ user, url, token }, req) => {
        const finalUrl = `${process.env.BETTER_AUTH_URL}/reset-password?token=${token}`;
        try {
          await sendResetPasswordEmail({
            email: user.email,
            url: finalUrl,
            token,
          });
        } catch (error) {
          console.error(
            `Failed to send reset password email to ${user.email}:`,
            error
          );
          throw error; 
        }
      },

      onPasswordReset: async ({ user }) => {
        console.log("Password reset completed for:", user.email);
      },
    },
    plugins: [nextCookies()],
  });

  return authInstance;
};

export const auth = await getAuth();
