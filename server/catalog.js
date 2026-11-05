import { get, all, parseJson, getSetting } from './db.js';
import { config } from './config.js';
import { licenseFor, accreditationFor, availableTracks, territoryAllows, publicAccreditation, entitlement } from './compliance.js';

const COURSE_SELECT = `SELECT c.*, s.slug AS specialty_slug, s.name AS specialty_name, s2.slug AS specialty2_slug, s2.name AS specialty2_name,
  p.slug AS provider_slug, p.name AS provider_name, p.is_demo AS provider_is_demo
  FROM courses c LEFT JOIN specialties s ON s.id = c.specialty_id LEFT JOIN specialties s2 ON s2.id = c.secondary_specialty_id
  LEFT JOIN providers p ON p.id = c.provider_id`;

export const loadCourseBySlug = (slug) => get(`${COURSE_SELECT} WHERE c.slug = ?`, slug);
export const loadCourseById = (id) => get(`${COURSE_SELECT} WHERE c.id = ?`, id);
/** The launch focus (specialty slug) or null when the whole catalogue is public. */
export function launchFocus() {
  if (config.launchFocus !== undefined) return config.launchFocus || null;
  return getSetting('launch_focus', 'emergency-medicine') || null;
}
const inFocus = (c, f = launchFocus()) => !f || c.specialty_slug === f || c.specialty2_slug === f;
/** A course is public when it is published AND inside the launch focus. */
export const isPubliclyVisible = (c) => !!c && c.status === 'published' && inFocus(c);
export const loadPublishedCourses = () => all(`${COURSE_SELECT} WHERE c.status = 'published' ORDER BY c.release_date DESC`).filter((c) => inFocus(c));

export function courseCard(c, user) {
  const license = licenseFor(c.id);
  const tracks = availableTracks(c, license);
  const acc = accreditationFor(c.id);
  return {
    id: c.id, slug: c.slug, title: c.title, description: c.description,
    specialty: c.specialty_slug ? { slug: c.specialty_slug, name: c.specialty_name } : null,
    secondarySpecialty: c.specialty2_slug ? { slug: c.specialty2_slug, name: c.specialty2_name } : null,
    provider: { slug: c.provider_slug, name: c.provider_name, isDemo: !!c.provider_is_demo },
    level: c.level, durationSec: c.duration_sec, originalLanguage: c.original_language,
    languages: tracks.map((t) => t.language),
    audioLanguages: tracks.filter((t) => t.audio !== 'none').map((t) => t.language),
    accreditation: publicAccreditation(acc),
    access: c.access, priceCents: c.price_cents,
    poster: c.poster_file ? `/media/${c.poster_file}` : null,
    releaseDate: c.release_date, featured: !!c.featured, isDemo: !!c.is_demo,
    territory: license?.right_worldwide ? ['*'] : (license?.territories || []),
    availableInYourCountry: territoryAllows(license, user?.country),
    saved: user ? !!get('SELECT 1 FROM saved_courses WHERE user_id = ? AND course_id = ?', user.id, c.id) : false,
  };
}

export function courseDetail(c, user) {
  const card = courseCard(c, user);
  const cues = all('SELECT idx, start_sec, end_sec, speaker, slide FROM cues WHERE course_id = ? ORDER BY idx', c.id);
  const license = licenseFor(c.id);
  return {
    ...card,
    objectives: parseJson(c.objectives, []),
    chapters: cues.filter((q) => q.slide).map((q) => ({ start: q.start_sec, title: q.slide })),
    speakers: [...new Set(cues.map((q) => q.speaker).filter(Boolean))],
    tracks: availableTracks(c, license),
    entitlement: entitlement(user, c),
    liveAi: { allowed: !!(license?.allow_live_ai && license.right_translate && license.right_subtitle) },
    licenseSummary: license ? { licensor: license.licensor, isDemo: !!license.is_demo, aiAudioPermitted: !!license.right_ai_audio } : null,
  };
}
