import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import AppleProvider from 'next-auth/providers/apple';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { USER_ROLES } from '@/lib/constants';

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'Credentials',
    credentials: { email: { label: 'Email' }, password: { label: 'Password' } },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      await dbConnect();
      const user = await User.findOne({ email: credentials.email });
      if (!user?.password) return null;
      const valid = await bcrypt.compare(credentials.password, user.password);
      if (!valid) return null;
      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      };
    },
  }),
  ...(process.env.GOOGLE_CLIENT_ID
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : []),
  ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
    ? [
        FacebookProvider({
          clientId: process.env.FACEBOOK_CLIENT_ID,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        }),
      ]
    : []),
  ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
    ? [
        AppleProvider({
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET,
        }),
      ]
    : []),
];

export const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? USER_ROLES.GUEST;
      }
      if (account?.provider && account.provider !== 'credentials') {
        await dbConnect();
        const existing = await User.findOne({ email: token.email });
        if (existing) {
          token.id = existing._id.toString();
          token.role = existing.role;
        } else {
          const newUser = await User.create({
            email: token.email,
            name: token.name,
            image: token.picture,
            role: USER_ROLES.GUEST,
          });
          token.id = newUser._id.toString();
          token.role = newUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id;
        (session.user as { role: string }).role = token.role;
      }
      return session;
    },
  },
  pages: { signIn: '/auth/signin' },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
