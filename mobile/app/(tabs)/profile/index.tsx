import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import { colors, radius } from '../../../lib/theme';
import { LEGAL_URLS } from '../../../lib/theme';

function Row({
  icon,
  label,
  hint,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.icon, danger && { backgroundColor: '#fee2e2' }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoaded, signOut } = useAuth();
  const isAdmin = user?.role === 'admin';

  if (!isLoaded) {
    return <View style={styles.flex} />;
  }

  if (!user) {
    return (
      <View style={[styles.flex, styles.guest, { paddingTop: insets.top + 48 }]}>
        <View style={styles.logo}>
          <Ionicons name="home" size={28} color="#fff" />
        </View>
        <Text style={styles.guestTitle}>Your account</Text>
        <Text style={styles.guestBody}>
          Sign in to save homes, message listers, and post a property.
        </Text>
        <Pressable style={styles.primary} onPress={() => router.push('/auth/signin')}>
          <Text style={styles.primaryText}>Sign in</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push('/auth/signup')}>
          <Text style={styles.secondaryText}>Create account</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name?.[0]?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <Pressable style={styles.listCta} onPress={() => router.push('/listings/new')}>
        <Ionicons name="add-circle" size={22} color="#fff" />
        <Text style={styles.listCtaText}>List a property</Text>
      </Pressable>

      <Text style={styles.section}>Activity</Text>
      <View style={styles.group}>
        <Row
          icon="home-outline"
          label="My listings"
          hint="Edit, boost, mark sold or rented"
          onPress={() => router.push('/(tabs)/listings')}
        />
        <Row
          icon="heart-outline"
          label="Saved homes"
          onPress={() => router.push('/(tabs)/saved')}
        />
        <Row
          icon="chatbubble-ellipses-outline"
          label="Messages"
          hint="Chat about listings"
          onPress={() => router.push('/messages')}
        />
        <Row
          icon="flag-outline"
          label="Claims"
          hint="Properties you have claimed"
          onPress={() => router.push('/dashboard/claims')}
        />
        <Row
          icon="person-outline"
          label="Profile & verification"
          onPress={() => router.push('/(tabs)/dashboard/profile')}
        />
      </View>

      {isAdmin ? (
        <>
          <Text style={styles.section}>Admin</Text>
          <View style={styles.group}>
            <Row icon="settings-outline" label="Admin home" onPress={() => router.push('/(tabs)/admin')} />
            <Row icon="people-outline" label="Users" onPress={() => router.push('/admin/users')} />
            <Row icon="list-outline" label="All listings" onPress={() => router.push('/admin/listings')} />
            <Row icon="checkmark-done-outline" label="Claims review" onPress={() => router.push('/admin/claims')} />
          </View>
        </>
      ) : null}

      <Text style={styles.section}>Support</Text>
      <View style={styles.group}>
        <Row icon="document-text-outline" label="Terms of Service" onPress={() => Linking.openURL(LEGAL_URLS.terms)} />
        <Row icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => Linking.openURL(LEGAL_URLS.privacy)} />
        <Row icon="help-circle-outline" label="Help" onPress={() => Linking.openURL(LEGAL_URLS.support)} />
      </View>

      <Text style={styles.section}>Account</Text>
      <View style={styles.group}>
        <Row icon="log-out-outline" label="Sign out" onPress={() => signOut()} />
        <Row
          icon="trash-outline"
          label="Delete account"
          hint="Required by App Store guidelines"
          danger
          onPress={() => router.push('/settings/delete-account')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  guest: { paddingHorizontal: 28, alignItems: 'center' },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  guestTitle: { fontSize: 26, fontWeight: '800', color: colors.ink },
  guestBody: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  primary: {
    marginTop: 24,
    backgroundColor: colors.primary,
    alignSelf: 'stretch',
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { marginTop: 12, paddingVertical: 14 },
  secondaryText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  head: { alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: colors.primaryDark },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 12 },
  email: { fontSize: 14, color: colors.muted, marginTop: 4 },
  listCta: {
    marginHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  listCtaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  section: {
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 24,
    fontSize: 12,
    fontWeight: '700',
    color: colors.faint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  group: {
    marginHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 16, fontWeight: '600', color: colors.ink },
  rowHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
