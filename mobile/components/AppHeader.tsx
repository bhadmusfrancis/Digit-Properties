import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const TEAL = '#0d9488';
const SLATE_600 = '#475569';
const SLATE_900 = '#0f172a';
const MIN_TOUCH_HEIGHT = 48;

function MenuItem({
  label,
  onPress,
  icon,
  danger,
}: {
  label: string;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
      android_ripple={null}
    >
      <Ionicons name={icon} size={22} color={danger ? '#dc2626' : SLATE_600} style={styles.menuIcon} />
      <Text style={[styles.menuItemText, danger && styles.menuItemTextDanger]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={SLATE_600} />
    </Pressable>
  );
}

export function AppHeader() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeAnd = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.logoWrap}
        onPress={() => router.push('/(tabs)/home')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>DP</Text>
        </View>
        <Text style={styles.logoTitle} numberOfLines={1}>Digit Properties</Text>
      </Pressable>

      <Pressable
        style={styles.menuBtn}
        onPress={() => setMenuOpen(true)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        {user ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
        ) : (
          <Ionicons name="menu" size={28} color={SLATE_900} />
        )}
      </Pressable>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.menuBackdrop}>
          <Pressable style={styles.menuBackdropPressable} onPress={() => setMenuOpen(false)} />
          <View style={styles.menuPanel}>
                <View style={styles.menuHeader}>
                  <Text style={styles.menuTitle}>Menu</Text>
                  <Pressable
                    onPress={() => setMenuOpen(false)}
                    style={styles.menuCloseBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="close" size={26} color={SLATE_900} />
                  </Pressable>
                </View>

                <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.menuSection}>
                    <Text style={styles.menuSectionLabel}>Browse</Text>
                    <MenuItem
                      label="Buy property"
                      icon="home-outline"
                      onPress={() => closeAnd(() => router.push('/listings?listingType=sale'))}
                    />
                    <MenuItem
                      label="Rent property"
                      icon="key-outline"
                      onPress={() => closeAnd(() => router.push('/listings?listingType=rent'))}
                    />
                    <MenuItem
                      label="Sell or list"
                      icon="add-circle-outline"
                      onPress={() => closeAnd(() => router.push('/listings/new'))}
                    />
                    <MenuItem
                      label="Trends"
                      icon="trending-up-outline"
                      onPress={() => closeAnd(() => router.push('/trends'))}
                    />
                  </View>

                  {user ? (
                    <View style={styles.menuSection}>
                      <Text style={styles.menuSectionLabel}>Account</Text>
                      <MenuItem
                        label="Dashboard"
                        icon="grid-outline"
                        onPress={() => closeAnd(() => router.push('/(tabs)/dashboard'))}
                      />
                      <MenuItem
                        label="My properties"
                        icon="list-outline"
                        onPress={() => closeAnd(() => router.push('/(tabs)/listings'))}
                      />
                      <MenuItem
                        label="Sign out"
                        icon="log-out-outline"
                        danger
                        onPress={() => closeAnd(() => signOut())}
                      />
                    </View>
                  ) : (
                    <View style={styles.menuSection}>
                      <Pressable
                        style={styles.menuSignInBtn}
                        onPress={() => closeAnd(() => router.push('/auth/signin'))}
                      >
                        <Text style={styles.menuSignInBtnText}>Sign in</Text>
                      </Pressable>
                    </View>
                  )}
                </ScrollView>
              </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  logoTitle: { fontSize: 17, fontWeight: '600', color: SLATE_900, flex: 1 },
  menuBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: TEAL, fontWeight: '700', fontSize: 16 },

  menuBackdrop: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  menuBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  menuPanel: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  menuTitle: { fontSize: 18, fontWeight: '700', color: SLATE_900 },
  menuCloseBtn: { padding: 4 },
  menuScroll: { maxHeight: 400 },
  menuSection: { paddingVertical: 8 },
  menuSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SLATE_600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_HEIGHT,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  menuItemPressed: { backgroundColor: '#f1f5f9' },
  menuIcon: { marginRight: 14 },
  menuItemText: { fontSize: 16, color: SLATE_900, flex: 1, fontWeight: '500' },
  menuItemTextDanger: { color: '#dc2626' },
  menuSignInBtn: {
    marginHorizontal: 20,
    marginVertical: 8,
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  menuSignInBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
