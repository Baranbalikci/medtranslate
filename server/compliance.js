// Compliance rules: licence completeness, territory, language release and
// accreditation transparency. Every public read path goes through here, so a
// course or language cannot become visible without the required clearances.
import { get, all, parseJson } from './db.js';
import { isLaunchLanguage } from './launch.js';

export const RIGHTS = [
  { key: 'right_use', label: 'Use of the original video' },
  { key: 'right_translate', label: 'AI-assisted translation' },
  { key: 'right_subtitle', label: 'Creation of subtitles' },
  { key: 'right_ai_audio', label: 'AI-generated audio tracks' },
  { key: 'right_commercial', label: 'Commercial exploitation' },
  { key: 'right_worldwide', label: 'Worldwide publication (or defined territories)' },
  { key: 'right_storage', label: 'Technical storage & processing' },
];

const today = () => new Date().toISOString().slice(0, 10);

export function licenseFor(courseId) {
  const l = get('SELECT * FROM licenses WHERE course_id = ?', courseId);
  if (!l) return null;
  return { ...l, territories: parseJson(l.territories, []), languages: parseJson(l.languages, []) };
}

export function accreditationFor(courseId) {
  const a = get('SELECT * FROM accreditations WHERE course_id = ?', courseId);
  if (!a) return null;
  return { ...a, applies_to_languages: parseJson(a.applies_to_languages, []) };
}

/** Licence problems that block publication. Empty array = licence OK. */
export function licenseBlockers(license, at = today()) {
  if (!license) return ['No licence agreement is recorded for this course.'];
  const b = [];
  if (!license.right_use) b.push('Licence lacks the right to use the original video.');
  if (!license.right_storage) b.push('Licence lacks the right to store and process the content.');
  if (!license.right_commercial) b.push('Licence lacks the right to commercial exploitation.');
  if (!license.right_worldwide && license.territories.filter((t) => t !== '*').length === 0) {
    b.push('No publication territory: grant worldwide rights or list licensed countries.');
  }
  if (!license.term_start || !license.term_end) b.push('Licence term (start and end date) is missing.');
  else if (license.term_start > at) b.push(`Licence term starts on ${license.term_start}.`);
  else if (license.term_end < at) b.push(`Licence expired on ${license.term_end}.`);
  if (!license.contract_ref) b.push('Contract reference is missing.');
  return b;
}

export function accreditationBlockers(acc, at = today()) {
  if (!acc) return ['Accreditation status has not been declared (set "not accredited" explicitly if applicable).'];
  const b = [];
  if (acc.status === 'accredited') {
    if (!acc.body) b.push('Accredited status requires the accrediting body.');
    if (!acc.reference) b.push('Accredited status requires an accreditation reference / event number.');
    if (acc.credit_amount == null || !acc.credit_type) b.push('Accredited status requires credit amount and credit type.');
    if (!acc.valid_until) b.push('Accredited status requires a validity end date.');
    else if (acc.valid_until < at) b.push('Accreditation has expired — update the status.');
    if (!acc.verified_at) b.push('Accreditation evidence must be verified by an administrator.');
  }
  return b;
}

/** Everything that must be true before a course can be (or stay) published. */
export function publishBlockers(courseId) {
  const course = get('SELECT * FROM courses WHERE id = ?', courseId);
  if (!course) return ['Course not found.'];
  const b = [];
  if (!course.media_file) b.push('No video file is attached.');
  if (!get('SELECT 1 FROM cues WHERE course_id = ?', courseId)) b.push('No original transcript / subtitle cues exist.');
  if (!course.specialty_id) b.push('No medical specialty assigned.');
  if (!course.provider_id) b.push('No original provider assigned.');
  b.push(...licenseBlockers(licenseFor(courseId)));
  b.push(...accreditationBlockers(accreditationFor(courseId)));
  return b;
}

/** Problems that block releasing one translation to users. */
export function translationReleaseBlockers(translation, license) {
  const b = [];
  if (!license) return ['No licence recorded.'];
  if (!license.right_translate) b.push('Licence does not grant translation rights.');
  if (!license.right_subtitle) b.push('Licence does not grant subtitle rights.');
  if (!license.languages.includes('*') && !license.languages.includes(translation.language)) {
    b.push(`Language "${translation.language}" is not covered by the licence.`);
  }
  if (translation.status !== 'approved' && translation.status !== 'released') {
    b.push('Translation must pass medical quality control (status "approved") before release.');
  }
  const latest = get('SELECT * FROM qc_reviews WHERE translation_id = ? ORDER BY id DESC LIMIT 1', translation.id);
  if (!latest || latest.decision !== 'approved') b.push('Latest QC review is not an approval.');
  const n = get('SELECT COUNT(*) AS n FROM cues WHERE course_id = ?', translation.course_id).n;
  const m = get('SELECT COUNT(*) AS n FROM translation_cues WHERE translation_id = ?', translation.id).n;
  if (n !== m) b.push(`Translation has ${m} cues but the original has ${n}.`);
  return b;
}

/** Can a user in `country` access this licence's territory? */
export function territoryAllows(license, country) {
  if (!license) return false;
  if (license.right_worldwide || license.territories.includes('*')) return true;
  return !!country && license.territories.includes(country);
}

/**
 * Languages a viewer may actually select. The original language is always
 * available (it is the source). Other languages need a released translation
 * covered by the licence. Audio tracks additionally need the AI-audio right.
 */
export function availableTracks(course, license) {
  const tracks = [{
    language: course.original_language, original: true, subtitles: true,
    audio: course.media_has_audio ? 'original' : 'browser_tts', aiGenerated: false, review: 'source',
  }];
  if (!license?.right_translate || !license?.right_subtitle) return tracks;
  const rows = all("SELECT * FROM translations WHERE course_id = ? AND status = 'released' ORDER BY language", course.id);
  for (const t of rows) {
    if (!license.languages.includes('*') && !license.languages.includes(t.language)) continue;
    if (!isLaunchLanguage(t.language)) continue; // outside the launch language set: hidden for now
    const qc = get('SELECT is_demo, decision FROM qc_reviews WHERE translation_id = ? ORDER BY id DESC LIMIT 1', t.id);
    tracks.push({
      language: t.language, original: false, subtitles: true,
      audio: license.right_ai_audio ? t.audio_mode : 'none',
      audioFile: license.right_ai_audio && t.audio_mode === 'file' ? t.audio_file : null,
      aiGenerated: true,
      review: qc?.is_demo ? 'demo_unreviewed' : qc?.decision === 'approved' ? 'medically_reviewed' : 'unreviewed',
    });
  }
  return tracks;
}

/** Entitlement: free course, active subscription, or single purchase. */
export function entitlement(user, course) {
  if (course.access === 'free') return { full: true, reason: 'free' };
  if (!user) return { full: false, reason: 'login_required' };
  if (user.role === 'admin' || user.role === 'reviewer') return { full: true, reason: 'staff' };
  const sub = get(`SELECT id FROM subscriptions WHERE user_id = ? AND status IN ('active','canceled') AND current_period_end > ?`,
    user.id, new Date().toISOString());
  if (sub) return { full: true, reason: 'subscription' };
  if (get("SELECT id FROM purchases WHERE user_id = ? AND course_id = ? AND status = 'paid'", user.id, course.id)) {
    return { full: true, reason: 'purchase' };
  }
  return { full: false, reason: 'subscription_required' };
}

export function publicAccreditation(acc) {
  if (!acc) return { status: 'unknown', label: 'Accreditation status not declared' };
  const base = { status: acc.status };
  switch (acc.status) {
    case 'accredited':
      return { ...base, label: `${acc.credit_amount} ${acc.credit_type} · ${acc.body}`, body: acc.body, credits: acc.credit_amount,
        creditType: acc.credit_type, reference: acc.reference, validUntil: acc.valid_until, languages: acc.applies_to_languages };
    case 'pending': return { ...base, label: 'Accreditation pending — no credits can be claimed yet', body: acc.body };
    case 'expired': return { ...base, label: 'Accreditation expired — no credits available' };
    default: return { ...base, label: 'Not accredited — no CME/CPD credits' };
  }
}
