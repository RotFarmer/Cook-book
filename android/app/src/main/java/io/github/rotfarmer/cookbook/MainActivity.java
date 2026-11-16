package io.github.rotfarmer.cookbook;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Shows the web app that is packed inside the APK, and gives it three things a web page
 * cannot do alone: report which version is installed, download a newer APK from this
 * project's GitHub releases, and hand that APK to Android's installer.
 */
public class MainActivity extends Activity {

    private static final String APP_URL = "https://appassets.androidplatform.net/www/index.html";
    private static final String APP_HOST = "appassets.androidplatform.net";
    /** Updates are only ever downloaded from this project's own releases. */
    private static final String RELEASE_PREFIX = "https://github.com/RotFarmer/Cook-book/releases/download/";
    private static final int REQ_FILE = 1;

    private FrameLayout root;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private volatile boolean downloading;
    private File pendingApk;
    private boolean waitingForPermission;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.bg));
        web = new WebView(this);
        web.setBackgroundColor(getColor(R.color.bg));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Draw behind the system bars and keep the page clear of them (and of the keyboard).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        setBarIcons(!isNight(getResources().getConfiguration()));
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets i = insets.getInsets(WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout()
                    | WindowInsetsCompat.Type.ime());
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); // where the app keeps your entries
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (APP_HOST.equals(uri.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri)); // other sites open in the browser
                } catch (ActivityNotFoundException e) {
                    // nothing can open it; stay where we are
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.loadUrl(APP_URL);
    }

    private static boolean isNight(Configuration config) {
        return (config.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    /** Dark icons on a light background, light icons on a dark one. */
    private void setBarIcons(boolean lightBackground) {
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), root);
        bars.setAppearanceLightStatusBars(lightBackground);
        bars.setAppearanceLightNavigationBars(lightBackground);
    }

    /** The phone switched between light and dark: tell the page, which repaints without reloading. */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        String mode = isNight(newConfig) ? "dark" : "light";
        web.evaluateJavascript("window.dispatchEvent(new CustomEvent('apptheme',{detail:'" + mode + "'}))", null);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Back from the "install unknown apps" setting: carry on with the update.
        if (waitingForPermission && getPackageManager().canRequestPackageInstalls()) installPending();
    }

    /** Back closes an open sheet in the page first; otherwise it leaves the app. */
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.__back&&window.__back())?1:0", handled -> {
            if (!"1".equals(handled)) moveTaskToBack(true);
        });
    }

    /** What the page can call as window.AndroidApp. */
    private final class Bridge {
        @JavascriptInterface
        public int versionCode() {
            return BuildConfig.VERSION_CODE;
        }

        @JavascriptInterface
        public String versionName() {
            return BuildConfig.VERSION_NAME;
        }

        @JavascriptInterface
        public void installUpdate(String url) {
            startUpdate(url);
        }

        /** Whether the phone is in dark mode right now. */
        @JavascriptInterface
        public boolean isNight() {
            return MainActivity.isNight(getResources().getConfiguration());
        }

        /** The page's background colour (#RRGGBB), so the area behind the system bars matches it. */
        @JavascriptInterface
        public void setBackground(String hex) {
            final int color;
            try {
                color = Color.parseColor(hex);
            } catch (IllegalArgumentException e) {
                return;
            }
            final boolean light = (0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color)) > 140;
            runOnUiThread(() -> {
                root.setBackgroundColor(color);
                web.setBackgroundColor(color);
                setBarIcons(light);
            });
        }
    }

    private void startUpdate(final String url) {
        if (url == null || !url.startsWith(RELEASE_PREFIX)) {
            emit("error", "That download is not a primal release.");
            return;
        }
        if (downloading) return;
        downloading = true;
        new Thread(() -> {
            File out = new File(new File(getCacheDir(), "updates"), "primal-cookbook.apk");
            try {
                File dir = out.getParentFile();
                if (dir != null) dir.mkdirs();
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                int status = conn.getResponseCode();
                if (status != HttpURLConnection.HTTP_OK) throw new IOException("HTTP " + status);
                long total = conn.getContentLengthLong();
                long done = 0;
                int last = -1;
                try (InputStream in = conn.getInputStream(); OutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        os.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int pct = (int) (done * 100 / total);
                            if (pct != last) {
                                last = pct;
                                emit("progress", String.valueOf(pct));
                            }
                        }
                    }
                } finally {
                    conn.disconnect();
                }
                pendingApk = out;
                runOnUiThread(this::installPending);
            } catch (Exception e) {
                emit("error", "The update could not be downloaded. Check your connection and try again.");
            } finally {
                downloading = false;
            }
        }).start();
    }

    private void installPending() {
        if (pendingApk == null || !pendingApk.exists()) return;
        if (!getPackageManager().canRequestPackageInstalls()) {
            // Android asks once for permission to install apps from this app.
            waitingForPermission = true;
            emit("permission", "");
            try {
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName())));
            } catch (ActivityNotFoundException e) {
                emit("error", "Allow this app to install apps in Android settings, then try again.");
            }
            return;
        }
        waitingForPermission = false;
        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", pendingApk);
        Intent install = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(install);
            emit("installing", "");
        } catch (ActivityNotFoundException e) {
            emit("error", "Android's installer could not be opened.");
        }
    }

    /** Tells the page how the update is going: progress, permission, installing or error. */
    private void emit(String state, String detail) {
        final String js = "window.dispatchEvent(new CustomEvent('appupdate',{detail:{state:"
                + JSONObject.quote(state) + ",detail:" + JSONObject.quote(detail) + "}}))";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }
}
