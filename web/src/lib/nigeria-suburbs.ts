/**
 * Nigerian areas/suburbs/streets by state for geocode fallback when Nominatim
 * does not return a suburb. Used to match or suggest from display_name.
 */
export const NIGERIA_AREAS_BY_STATE: Record<string, string[]> = {
  Lagos: [
    'Lekki', 'Lekki Phase 1', 'Lekki Phase 2', 'Victoria Island', 'VI', 'Ikoyi', 'Ikeja', 'Ikeja GRA',
    'Yaba', 'Surulere', 'Mushin', 'Agege', 'Oshodi', 'Apapa', 'Marina', 'Lagos Island', 'Isale Eko',
    'Maryland', 'Ilupeju', 'Ojodu', 'Ojota', 'Kosofe', 'Shomolu', 'Satellite Town', 'Festac', 'Amuwo Odofin',
    'Alimosho', 'Ajah', 'Sangotedo', 'Osapa', 'Chevron', 'Admiralty Way', 'Osapa London', 'Ikate',
    'Ogudu', 'Magodo', 'Omole', 'GRA Ikeja', 'Allen Avenue', 'Opebi', 'Ogba', 'Alausa',
    'Badagry', 'Ikorodu', 'Epe', 'Isolo', 'Ejigbo', 'Idimu', 'Egbeda', 'Igando', 'Abule Egba',
  ],
  FCT: [
    'Abuja', 'Maitama', 'Garki', 'Wuse', 'Wuse 2', 'Gwarinpa', 'Kubwa', 'Lugbe', 'Karu', 'Nyanya',
    'Mabushi', 'Jabi', 'Utako', 'Kado', 'Katampe', 'Life Camp', 'Gaduwa', 'Lokogoma', 'Garki 2',
    'Central Area', 'Asokoro', 'Guzape', 'Wuye', 'Dutse', 'Bwari', 'Kuje', 'Abaji',
  ],
  Rivers: [
    'Port Harcourt', 'PH', 'GRA Port Harcourt', 'Rumola', 'Rumola 1', 'Rumola 2', 'Trans Amadi',
    'Eleme', 'Ogbogoro', 'Obuama', 'Woji', 'Elekahia', 'New GRA', 'Old GRA', 'Mile 1', 'Mile 2',
    'Mile 3', 'Mile 4', 'D/Line', 'Borokiri', 'Oyigbo', 'Obigbo', 'Aluu', 'Choba', 'Alakahia',
  ],
  Abia: [
    'Umuahia', 'Aba', 'Aba North', 'Aba South', 'Osisioma', 'Ogbor Hill', 'Ariaria', 'Umungasi',
    'Asa', 'Ohafia', 'Arochukwu', 'Bende', 'Isuikwuato',
  ],
  Oyo: [
    'Ibadan', 'Bodija', 'UI', 'Dugbe', 'Mokola', 'Challenge', 'Ring Road', 'Sango', 'Eleyele',
    'Ologuneru', 'Oluyole', 'Akobo', 'Agodi', 'Ojo', 'Ogbomoso', 'Oyo', 'Ogbomosho',
  ],
  Kano: [
    'Kano', 'Nassarawa', 'Fagge', 'Dala', 'Gwale', 'Tarauni', 'Ungogo', 'Kumbotso', 'Dawakin Tofa',
    'GRA Kano', 'Sabon Gari', 'Noman\'s Land', 'Hotoro', 'Sharada', 'Tudun Wada',
  ],
  Kaduna: [
    'Kaduna', 'Barnawa', 'Kawo', 'Malali', 'Ungwan Rimi', 'Ungwan Dosa', 'NARICT', 'Kaduna South',
    'Sabon Tasha', 'Kajuru', 'Zaria', 'Tudun Wada Zaria', 'Samaru', 'Hanwa',
  ],
  Delta: [
    'Warri', 'Asaba', 'Uvwie', 'Effurun', 'Sapele', 'Ughelli', 'Agbor', 'Oghara', 'Burutu',
    'Warri GRA', 'Ekpan', 'Jeddo', 'Udu',
  ],
  Anambra: [
    'Awka', 'Onitsha', 'Nnewi', 'Nkpor', 'Ogidi', 'Obosi', 'Oba', 'Ihiala', 'Ekwulobia',
    'GRA Onitsha', 'Fegge', 'Main Market', 'Bridge Head',
  ],
  Edo: [
    'Benin City', 'Benin', 'GRA Benin', 'Ugbowo', 'Uselu', 'Siluko Road', 'Sapele Road', 'Ikpoba Hill',
    'New Benin', 'Ogida', 'Ekpoma', 'Auchi', 'Irrua',
  ],
  Enugu: [
    'Enugu', 'GRA Enugu', 'Independence Layout', 'New Haven', 'Ogui', 'Abakpa', 'Trans Ekulu',
    'Emene', 'Nsukka', 'Ogbete', 'Uwani', 'Achara Layout',
  ],
  Imo: [
    'Owerri', 'Orlu', 'Okigwe', 'Aladinma', 'Ikenegbu', 'New Owerri', 'World Bank', 'Douglas',
    'Amakohia', 'Nekede', 'Orogwe', 'Orji',
  ],
  Ogun: [
    'Abeokuta', 'Sagamu', 'Ijebu Ode', 'Ijebu Igbo', 'Ifo', 'Sango Ota', 'Ota', 'Ado Odo',
    'Mowe', 'Ibafo', 'Arepo', 'Redemption Camp', 'Lafenwa', 'Kuto', 'Panseke',
  ],
  'Akwa Ibom': [
    'Uyo', 'Eket', 'Ikot Ekpene', 'Oron', 'Abak', 'Etinan', 'Nwaniba', 'Ibeno',
  ],
  'Cross River': [
    'Calabar', 'Calabar South', 'Calabar Municipality', 'Atimbo', '8 Miles', 'Marian', 'Efio-Etung',
  ],
};

/** Extract suburb/area from Nominatim display_name when address components lack it. */
export function extractSuburbFromDisplayName(
  displayName: string,
  city: string,
  state: string
): string {
  if (!displayName || typeof displayName !== 'string') return '';
  const parts = displayName.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return '';

  const cityLower = city?.toLowerCase() || '';
  const stateLower = state?.toLowerCase() || '';
  const stateList = Object.keys(NIGERIA_AREAS_BY_STATE);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partLower = part.toLowerCase();
    if (!part || partLower === cityLower || stateList.some((s) => s.toLowerCase() === partLower)) continue;
    if (partLower === 'nigeria' || partLower === 'ng') continue;
    const looksLikeArea = part.length >= 2 && part.length <= 50 && /^[\w\s\-\.\'\/]+$/.test(part);
    if (looksLikeArea) return part;
  }
  return '';
}

/** Match display_name segment to known area for a state. */
export function matchKnownSuburb(displayName: string, state: string): string {
  const areas = NIGERIA_AREAS_BY_STATE[state] || [];
  const displayLower = displayName.toLowerCase();
  for (const area of areas) {
    if (displayLower.includes(area.toLowerCase())) return area;
  }
  return '';
}
