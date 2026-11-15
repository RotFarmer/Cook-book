// In-app updates for the Android app.
//
// The APK is published as a GitHub release on every push (see .github/workflows/android.yml).
// Each release is tagged v<number>, and that number is also the installed app's version code,
// so "is there an update?" is one comparison. The download and install happen natively
// (android/…/MainActivity.java), reached through window.AndroidApp.

const REPO = 'RotFarmer/Cook-book';
const CHECKED = 'primal-cookbook-ui:update-checked';
const SIX_HOURS = 6 * 60 * 60 * 1000;

/** Always the newest APK, for people opening the app in a browser. */
export const APK_URL = `https://github.com/${REPO}/releases/latest/download/primal-cookbook.apk`;

/** The native side of the Android app, or null in a browser. */
export const native = window.AndroidApp || null;

export const installedVersion = () => (native ? { code: native.versionCode(), name: native.versionName() } : null);

/** The newest release: {code, name, url}. Rejects when it cannot be reached. */
export async function latestRelease() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const rel = await res.json();
  const code = parseInt(String(rel.tag_name || '').replace(/^v/, ''), 10);
  const apk = (rel.assets || []).find(a => a.name && a.name.endsWith('.apk'));
  if (!code || !apk) throw new Error('No APK in the latest release');
  return { code, name: '1.' + code, url: apk.browser_download_url };
}

/** The newer release if there is one, otherwise null. */
export async function findUpdate() {
  if (!native) return null;
  const latest = await latestRelease();
  return latest.code > native.versionCode() ? latest : null;
}

/** Quiet check when the app opens, at most once every six hours. */
export async function autoCheck() {
  if (!native) return null;
  try {
    if (Date.now() - Number(localStorage.getItem(CHECKED) || 0) < SIX_HOURS) return null;
    localStorage.setItem(CHECKED, String(Date.now()));
  } catch {
    // no storage: just check
  }
  try {
    return await findUpdate();
  } catch {
    return null; // offline or rate-limited: try again next time
  }
}

export function install(release) {
  native.installUpdate(release.url);
}
