import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';
import { PROPERTY_TYPES, RENT_PERIODS, POPULAR_AMENITIES } from '../../lib/constants';
import { generateListingTitle } from '../../lib/listing-title';
import { AddressLocationInput } from '../../components/AddressLocationInput';

const MAX_IMAGES = 10;

const TOP_PADDING_EXTRA = 24;

export default function NewListingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const topPad = (insets.top || 0) + TOP_PADDING_EXTRA;
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<{ url: string; public_id: string }[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listingType, setListingType] = useState<'sale' | 'rent'>('sale');
  const [propertyType, setPropertyType] = useState('apartment');
  const [price, setPrice] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Lagos');
  const [suburb, setSuburb] = useState('');
  const [bedrooms, setBedrooms] = useState('0');
  const [bathrooms, setBathrooms] = useState('0');
  const [toilets, setToilets] = useState('');
  const [area, setArea] = useState('');
  const [amenities, setAmenities] = useState('');
  const [rentPeriod, setRentPeriod] = useState<'day' | 'month' | 'year'>('month');
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [error, setError] = useState('');

  const uploadUri = async (uri: string) => {
    if (!token) return;
    const filename = uri.split('/').pop() || 'image.jpg';
    const formData = new FormData();
    (formData as any).append('file', { uri, type: 'image/jpeg', name: filename });
    formData.append('folder', 'listings');
    const res = await fetch(getApiUrl('upload'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (data.url && data.public_id) setImages((prev) => [...prev, { url: data.url, public_id: data.public_id }]);
  };

  const pickImages = async () => {
    if (images.length >= MAX_IMAGES) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to photos to add images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_IMAGES - images.length,
    });
    if (result.canceled || !token) return;
    setUploading(true);
    setError('');
    try {
      for (const asset of result.assets) {
        if (images.length >= MAX_IMAGES) break;
        await uploadUri(asset.uri);
      }
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const takeCameraPhoto = async () => {
    if (images.length >= MAX_IMAGES) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets[0]?.uri || !token) return;
    setUploading(true);
    setError('');
    try {
      await uploadUri(result.assets[0].uri);
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const generateTitle = () => {
    const t = generateListingTitle({
      listingType,
      propertyType,
      address,
      city,
      state,
      suburb,
      bedrooms: parseInt(bedrooms, 10) || 0,
    });
    setTitle(t);
  };

  const onTitleFocus = () => {
    if (!title.trim()) generateTitle();
  };

  const toggleAmenity = (a: string) => {
    const list = amenities.split(',').map((s) => s.trim()).filter(Boolean);
    const set = new Set(list);
    if (set.has(a)) set.delete(a);
    else set.add(a);
    setAmenities(Array.from(set).join(', '));
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError('');
    const numPrice = parseFloat(price);
    const numBeds = parseInt(bedrooms, 10) || 0;
    const numBaths = parseInt(bathrooms, 10) || 0;
    const numToilets = toilets === '' ? undefined : parseInt(toilets, 10);
    const numArea = area === '' ? undefined : parseFloat(area);
    if (!title.trim() || title.length < 5) {
      setError('Title must be at least 5 characters');
      return;
    }
    if (!description.trim() || description.length < 20) {
      setError('Description must be at least 20 characters');
      return;
    }
    if (!numPrice || numPrice <= 0) {
      setError('Enter a valid price');
      return;
    }
    if (!address.trim() || address.length < 5) {
      setError('Address is required (min 5 characters)');
      return;
    }
    if (!city.trim() || city.length < 2) {
      setError('City is required');
      return;
    }
    if (listingType === 'rent') {
      setRentPeriod(rentPeriod);
    }
    if (!token || !user) {
      setError('Sign in to create a listing');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        listingType,
        propertyType,
        price: numPrice,
        location: {
          address: address.trim(),
          city: city.trim(),
          state,
          ...(suburb.trim() && { suburb: suburb.trim() }),
        },
        bedrooms: numBeds,
        bathrooms: numBaths,
        ...(numToilets != null && numToilets >= 0 && { toilets: numToilets }),
        ...(numArea != null && numArea > 0 && { area: numArea }),
        amenities: amenities.split(',').map((s) => s.trim()).filter(Boolean),
        tags: [],
        ...(agentName.trim() && { agentName: agentName.trim() }),
        ...(agentPhone.trim() && { agentPhone: agentPhone.trim() }),
        ...(agentEmail.trim() && { agentEmail: agentEmail.trim() }),
        ...(listingType === 'rent' && { rentPeriod }),
        status: 'draft',
        images,
      };
      const res = await fetch(getApiUrl('listings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create listing');
        return;
      }
      router.replace({ pathname: '/listings/[id]', params: { id: data._id } });
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.msg}>Sign in to create a listing.</Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/auth/signin')}>
          <Text style={styles.btnText}>Sign in</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: topPad }]} keyboardShouldPersistTaps="handled">
        <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Basics</Text>
        <Text style={styles.label}>Description * (min 20 chars)</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Describe the property in detail. Use words like luxury, modern, spacious." multiline numberOfLines={4} />
        <Text style={styles.label}>Listing type</Text>
        <View style={styles.row}>
          <Pressable style={[styles.chip, listingType === 'sale' && styles.chipActive]} onPress={() => setListingType('sale')}>
            <Text style={[styles.chipText, listingType === 'sale' && styles.chipTextActive]}>For Sale</Text>
          </Pressable>
          <Pressable style={[styles.chip, listingType === 'rent' && styles.chipActive]} onPress={() => setListingType('rent')}>
            <Text style={[styles.chipText, listingType === 'rent' && styles.chipTextActive]}>For Rent</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Property type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {PROPERTY_TYPES.map((t) => (
            <Pressable key={t} style={[styles.chip, propertyType === t && styles.chipActive]} onPress={() => setPropertyType(t)}>
              <Text style={[styles.chipText, propertyType === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.label}>Price (NGN) *</Text>
        <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="e.g. 50000000" keyboardType="numeric" />
        {listingType === 'rent' && (
          <>
            <Text style={styles.label}>Rent period</Text>
            <View style={styles.row}>
              {RENT_PERIODS.map((p) => (
                <Pressable key={p} style={[styles.chip, rentPeriod === p && styles.chipActive]} onPress={() => setRentPeriod(p)}>
                  <Text style={[styles.chipText, rentPeriod === p && styles.chipTextActive]}>Per {p}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        </View>

        <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Location</Text>
        <AddressLocationInput
          address={address}
          city={city}
          state={state}
          suburb={suburb}
          onAddressChange={setAddress}
          onCityChange={setCity}
          onStateChange={setState}
          onSuburbChange={setSuburb}
        />
        </View>

        <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Property details</Text>
        <View style={styles.row3}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Bedrooms</Text>
            <TextInput style={styles.input} value={bedrooms} onChangeText={setBedrooms} keyboardType="number-pad" />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Bathrooms</Text>
            <TextInput style={styles.input} value={bathrooms} onChangeText={setBathrooms} keyboardType="number-pad" />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Toilets</Text>
            <TextInput style={styles.input} value={toilets} onChangeText={setToilets} placeholder="0" keyboardType="number-pad" />
          </View>
        </View>
        <Text style={styles.label}>Area (sqm, optional)</Text>
        <TextInput style={styles.input} value={area} onChangeText={setArea} placeholder="e.g. 120" placeholderTextColor="#94a3b8" keyboardType="numeric" />
        </View>

        <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Images & media</Text>
        <Text style={styles.label}>Photos (first image used in search)</Text>
        <View style={styles.row}>
          <Pressable style={[styles.uploadBtn, styles.uploadBtnHalf]} onPress={takeCameraPhoto} disabled={uploading || images.length >= MAX_IMAGES}>
            <Text style={styles.uploadBtnText}>{uploading ? '…' : 'Camera'}</Text>
          </Pressable>
          <Pressable style={[styles.uploadBtn, styles.uploadBtnHalf]} onPress={pickImages} disabled={uploading || images.length >= MAX_IMAGES}>
            <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : 'Choose photos'}</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>Add multiple: use camera or choose photos repeatedly. ({images.length}/{MAX_IMAGES})</Text>
        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow} contentContainerStyle={styles.thumbRowContent}>
            {images.map((img, i) => (
              <View key={img.public_id} style={styles.thumbWrap}>
                <Image source={{ uri: img.url }} style={styles.thumb} />
                <Pressable onPress={() => removeImage(i)} style={styles.thumbRemove} hitSlop={8}>
                  <Text style={styles.thumbRemoveText}>×</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
        </View>

        <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Amenities</Text>
        <View style={styles.chipWrap}>
          {POPULAR_AMENITIES.map((a) => (
            <Pressable key={a} style={[styles.chip, amenities.includes(a) && styles.chipActive]} onPress={() => toggleAmenity(a)}>
              <Text style={[styles.chipText, amenities.includes(a) && styles.chipTextActive]}>{a}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={styles.input} value={amenities} onChangeText={setAmenities} placeholder="Or type custom (comma-separated)" placeholderTextColor="#94a3b8" />
        </View>

        <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Title & contact</Text>
        <Text style={styles.label}>Title * (tap field to auto-generate from location)</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          onFocus={onTitleFocus}
          placeholder="Tap to generate from location, or type your own"
          placeholderTextColor="#94a3b8"
        />
        <TextInput style={styles.input} value={agentName} onChangeText={setAgentName} placeholder="Agent name (optional)" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={agentPhone} onChangeText={setAgentPhone} placeholder="Phone" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
        <TextInput style={styles.input} value={agentEmail} onChangeText={setAgentEmail} placeholder="Email" placeholderTextColor="#94a3b8" keyboardType="email-address" />
        </View>

        {error ? <Text style={styles.err}>{error}</Text> : null}
        <Pressable style={[styles.submitBtn, submitting && styles.submitDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save as draft</Text>}
        </Pressable>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Cancel</Text>
        </Pressable>
        <View style={styles.bottomPad} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  msg: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 16 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, backgroundColor: '#f8fafc' },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 12,
    color: '#0f172a',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  row3: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  flex1: { flex: 1 },
  chipRow: { marginBottom: 12 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: '#0d9488' },
  chipText: { fontSize: 14, color: '#475569' },
  chipTextActive: { color: '#fff' },
  uploadBtn: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#0d9488',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadBtnHalf: { flex: 1, marginHorizontal: 4 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  uploadBtnText: { fontSize: 15, color: '#0d9488', fontWeight: '600' },
  thumbRow: { marginBottom: 16 },
  thumbRowContent: { gap: 12, paddingVertical: 4 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 88, height: 88, borderRadius: 10 },
  thumbRemove: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  thumbRemoveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  err: { color: '#dc2626', marginBottom: 12 },
  btn: { backgroundColor: '#0d9488', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  submitBtn: { backgroundColor: '#0d9488', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backBtn: { marginTop: 16, alignItems: 'center' },
  backBtnText: { color: '#64748b', fontSize: 15 },
  bottomPad: { height: 40 },
});
