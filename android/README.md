# Android app

A thin Android shell around the web app in the repository root. The web files are copied into
the APK at build time, so the app works offline and keeps its entries on the phone.

## How updates work

1. Every push runs `.github/workflows/android.yml`, which builds the APK and publishes it as a
   GitHub release tagged `v<run number>`. That number is also the APK's version code.
2. When the app opens (at most every six hours) it asks GitHub for the latest release. If its
   number is higher than the installed version, a bar offers the update. Settings → Check for
   updates does the same on demand.
3. Tapping Update downloads the APK and hands it to Android's installer. The first time,
   Android asks you to allow primal to install apps.

Entries survive updates. They are lost if the app is uninstalled, so copy a backup first
(Settings → Copy backup).

## The signing key

Android only installs an update over an existing app if both are signed with the same key, so
the key has to be the same for every build. It is kept in this folder (`release.keystore`,
password in `app/build.gradle`) so that the build needs no setup.

Because this repository is public, so is the key: anyone could sign their own APK with it. That
only matters if such an APK is installed from somewhere else, because the app itself downloads
updates only from this repository's releases. To lock it down, generate a new key, store it as
a GitHub Actions secret and change the workflow to use it; installed copies then need one
uninstall and reinstall, because the key changes.

## Building by hand

With the Android SDK and Gradle 8.11 or newer installed:

```
cd android
gradle assembleRelease -PversionCode=1
```

The APK lands in `app/build/outputs/apk/release/`.
