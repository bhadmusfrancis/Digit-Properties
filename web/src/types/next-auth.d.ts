import 'next-auth';
import { USER_ROLES } from '@/lib/constants';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      role: (typeof USER_ROLES)[keyof typeof USER_ROLES];
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
  }
}
