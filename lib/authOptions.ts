/**
 * NextAuth configuration
 * Google OAuth provider setup for WiMaRC
 *
 * Required environment variables:
 *   GOOGLE_CLIENT_ID     — OAuth 2.0 Client ID from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET — OAuth 2.0 Client Secret from Google Cloud Console
 *   NEXTAUTH_SECRET      — Random secret for JWT signing (generate with: openssl rand -base64 32)
 *   NEXTAUTH_URL         — Full base URL of the app (e.g. http://localhost:3000)
 */

import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  /**
   * Use JWT strategy (no database required).
   * Switch to "database" and configure an adapter if you want to persist Google accounts.
   */
  session: { strategy: "jwt" },

  callbacks: {
    /**
     * Attach Google profile info to the JWT so it is available in session.
     */
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile) {
        token.googleId = profile.sub
      }
      return token
    },

    /**
     * Expose relevant fields to the client-side session object.
     */
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).googleId = token.googleId
      }
      return session
    },
  },

  pages: {
    signIn: "/", // redirect back to our custom login page on error
  },
}
