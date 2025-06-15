import NextAuth from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

const scopes = [
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "streaming"
];

async function refreshAccessToken(token: any) {
  try {
    console.log("Attempting to refresh token...");
    const url = "https://accounts.spotify.com/api/token";
    
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
      method: "POST",
    });

    const refreshedTokens = await response.json();
    console.log("Refresh response:", response.status, refreshedTokens);

    if (!response.ok) {
      throw refreshedTokens;
    }

    console.log("Token refreshed successfully");
    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("Error refreshing access token", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

const handler = NextAuth({
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: scopes.join(" "),
          show_dialog: "true",
          access_type: "offline",
        },
      },
    })
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      console.log("JWT callback - account:", !!account, "token keys:", Object.keys(token));
      
      // Initial sign in
      if (account) {
        console.log("Initial sign in - account expires_in:", account.expires_in);
        console.log("Has refresh token:", !!account.refresh_token);
        console.log("Account keys:", Object.keys(account));
        
        const newToken = {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: Date.now() + ((account.expires_in as number) || 3600) * 1000,
          refreshToken: account.refresh_token,
          error: undefined, // Clear any previous errors
        };
        
        console.log("New token created with expiry:", new Date(newToken.accessTokenExpires));
        return newToken;
      }

      // Return previous token if the access token has not expired yet
      const tokenWithExpiry = token as any;
      const now = Date.now();
      const expiresAt = tokenWithExpiry.accessTokenExpires;
      
      console.log("Token check - now:", now, "expires:", expiresAt, "expired:", now >= expiresAt);
      
      if (tokenWithExpiry.accessTokenExpires && now < tokenWithExpiry.accessTokenExpires) {
        console.log("Token still valid, returning existing token");
        return token;
      }

      // Access token has expired, try to update it
      console.log("Token expired, attempting refresh...");
      if (!tokenWithExpiry.refreshToken) {
        console.error("No refresh token available");
        return {
          ...token,
          error: "RefreshAccessTokenError",
        };
      }
      
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      console.log("Session callback - token error:", token.error);
      
      if (token.error) {
        session.error = token.error as string;
      }
      session.accessToken = (token as { accessToken?: string }).accessToken;
      return session;
    }
  }
});

export { handler as GET, handler as POST };
