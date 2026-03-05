import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import AppleProvider from 'next-auth/providers/apple';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { USER_ROLES } from '@/lib/constants';

/** Shown for all users until they complete liveness verification. */
export const GUEST_AVATAR_PATH = '/avatar-guest.svg';

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
      if (!user.verifiedAt && user.emailVerificationToken) {
        throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
      }
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
        await dbConnect();
        const dbUser = await User.findById(user.id).select('verifiedAt emailVerificationToken emailVerificationExpires termsAcceptedAt privacyAcceptedAt').lean();
        if (dbUser && !dbUser.verifiedAt) {
          const tokenExpired = !dbUser.emailVerificationExpires || new Date() > dbUser.emailVerificationExpires;
          const noPendingToken = !dbUser.emailVerificationToken || tokenExpired;
          if (noPendingToken) {
            await User.findByIdAndUpdate(user.id, { $set: { verifiedAt: new Date() } });
          }
        }
        const u = dbUser as { termsAcceptedAt?: Date; privacyAcceptedAt?: Date } | null;
        token.needsLegalAcceptance = !u?.termsAcceptedAt || !u?.privacyAcceptedAt;
      }
      if (account?.provider && account.provider !== 'credentials') {
        await dbConnect();
        const existing = await User.findOne({ email: token.email }).select('role verifiedAt termsAcceptedAt privacyAcceptedAt').lean();
        if (existing) {
          const ex = existing as { _id: unknown; role?: string; verifiedAt?: Date; termsAcceptedAt?: Date; privacyAcceptedAt?: Date };
          token.id = ex._id?.toString?.() ?? token.id;
          token.role = ex.role ?? token.role;
          token.needsLegalAcceptance = !ex.termsAcceptedAt || !ex.privacyAcceptedAt;
          if (!ex.verifiedAt) {
            await User.findByIdAndUpdate(ex._id, { $set: { verifiedAt: new Date() } });
          }
        } else {
          const newUser = await User.create({
            email: token.email,
            name: token.name,
            image: token.picture,
            role: USER_ROLES.GUEST,
            verifiedAt: new Date(),
          });
          token.id = newUser._id.toString();
          token.role = newUser.role;
          token.needsLegalAcceptance = true;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id;
        (session.user as { role: string }).role = token.role;
        (session.user as { needsLegalAcceptance?: boolean }).needsLegalAcceptance = !!token.needsLegalAcceptance;
        // Guests (not yet liveness-verified) see generic avatar; verified users see their profile image. Refresh legal acceptance from DB so it updates after user accepts.
        if (token.id) {
          await dbConnect();
          const u = await User.findById(token.id).select('image livenessVerifiedAt termsAcceptedAt privacyAcceptedAt').lean();
          const image = u && (u as { livenessVerifiedAt?: Date }).livenessVerifiedAt && (u as { image?: string }).image
            ? (u as { image: string }).image
            : GUEST_AVATAR_PATH;
          (session.user as { image: string | null }).image = image;
          const terms = u as { termsAcceptedAt?: Date; privacyAcceptedAt?: Date } | null;
          (session.user as { needsLegalAcceptance?: boolean }).needsLegalAcceptance = !terms?.termsAcceptedAt || !terms?.privacyAcceptedAt;
        } else {
          (session.user as { image: string | null }).image = GUEST_AVATAR_PATH;
        }
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
