import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useSaved } from '../contexts/SavedContext';
import { colors } from '../lib/theme';

type Props = {
  listingId: string;
  size?: number;
  light?: boolean;
};

export function HeartButton({ listingId, size = 22, light }: Props) {
  const router = useRouter();
  const { token } = useAuth();
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(listingId);

  const onPress = async () => {
    if (!token) {
      router.push('/auth/signin');
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* web / unsupported */
    }
    await toggleSaved(listingId);
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={[styles.btn, light && styles.btnLight]}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save listing'}
    >
      <Ionicons
        name={saved ? 'heart' : 'heart-outline'}
        size={size}
        color={saved ? '#e11d48' : light ? '#fff' : colors.ink}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  btnLight: {
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
});
