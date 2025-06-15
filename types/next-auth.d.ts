import 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    error?: string;
  }
  
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    error?: string;
  }
  
  interface User {
    accessToken?: string;
  }
} 