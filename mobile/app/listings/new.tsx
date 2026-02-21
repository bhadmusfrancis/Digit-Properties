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
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';
import { NIGERIAN_STATES, PROPERTY_TYPES, RENT_PERIODS } from '../../lib/constants';

const MAX_IMAGES = 10;

export default function NewListingScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
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
        const uri = asset.uri;
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
      }
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
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
      <View style={styles.container}>
        <Text style={styles.msg}>Sign in to create a listing.</Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/auth/signin')}>
          <Text style={styles.btnText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Basics</Text>
        <Text style={styles.label}>Title *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. 3 Bed Apartment in Lekki" />
        <Text style={styles.label}>Description * (min 20 chars)</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Describe the property..." multiline numberOfLines={4} />
        <View style={styles.row}>
          <Pressable style={[styles.chip, listingType === 'sale' && styles.chipActive]} onPress={() => setListingType('sale')}>
            <Text style={[styles.chipText, listingType === 'sale' && styles.chipTextActive]}>Sale</Text>
          </Pressable>
          <Pressable style={[styles.chip, listingType === 'rent' && styles.chipActive]} onPress={() => setListingType('rent')}>
            <Text style={[styles.chipText, listingType === 'rent' && styles.chipTextActive]}>Rent</Text>
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
                  <Text style={[styles.chipText, rentPeriod === p && styles.chipTextActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Location</Text>
        <Text style={styles.label}>Address *</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Street address" />
        <Text style={styles.label}>City *</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Lagos" />
        <Text style={styles.label}>State *</Text>
        <TextInput style={styles.input} value={state} onChangeText={setState} placeholder="e.g. Lagos" />
        <Text style={styles.label}>Suburb / Area (optional)</Text>
        <TextInput style={styles.input} value={suburb} onChangeText={setSuburb} placeholder="e.g. Lekki Phase 1" />

        <Text style={styles.sectionTitle}>Details</Text>
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
        <TextInput style={styles.input} value={area} onChangeText={setArea} placeholder="e.g. 120" keyboardType="numeric" />
        <Text style={styles.label}>Amenities (comma-separated)</Text>
        <TextInput style={styles.input} value={amenities} onChangeText={setAmenities} placeholder="Parking, Security, Pool" />

        <Text style={styles.sectionTitle}>Contact (optional)</Text>
        <TextInput style={styles.input} value={agentName} onChangeText={setAgentName} placeholder="Agent name" />
        <TextInput style={styles.input} value={agentPhone} onChangeText={setAgentPhone} placeholder="Phone" keyboardType="phone-pad" />
        <TextInput style={styles.input} value={agentEmail} onChangeText={setAgentEmail} placeholder="Email" keyboardType="email-address" />

        <Text style={styles.sectionTitle}>Photos</Text>
        <Pressable style={styles.uploadBtn} onPress={pickImages} disabled={uploading || images.length >= MAX_IMAGES}>
          <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : `+ Add photos (${images.length}/${MAX_IMAGES})`}</Text>
        </Pressable>
        {images.length > 0 && (
          <View style={styles.imageList}>
            {images.map((img, i) => (
              <View key={img.public_id} style={styles.imageItem}>
                <Text style={styles.imageUrl} numberOfLines={1}>{img.url}</Text>
                <Pressable onPress={() => removeImage(i)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

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
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  msg: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 16 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 20, marginBottom: 12 },
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
  chipActive: { backgroundColor: '#0c4a6e' },
  chipText: { fontSize: 14, color: '#475569' },
  chipTextActive: { color: '#fff' },
  uploadBtn: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadBtnText: { fontSize: 15, color: '#475569', fontWeight: '500' },
  imageList: { marginBottom: 12 },
  imageItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  imageUrl: { flex: 1, fontSize: 12, color: '#64748b' },
  removeBtn: { paddingLeft: 8 },
  removeBtnText: { color: '#dc2626', fontSize: 14 },
  err: { color: '#dc2626', marginBottom: 12 },
  btn: { backgroundColor: '#0c4a6e', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  submitBtn: { backgroundColor: '#0c4a6e', paddingVertical: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  submitDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backBtn: { marginTop: 16, alignItems: 'center' },
  backBtnText: { color: '#64748b', fontSize: 15 },
  bottomPad: { height: 40 },
});
