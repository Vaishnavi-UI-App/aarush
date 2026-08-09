package com.aarushfire.billing;

import android.app.DownloadManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

/**
 * A bare Android WebView (which is what Capacitor's BridgeActivity wraps) has no
 * built-in file-download support -- a real browser hands a Content-Disposition:
 * attachment response to the OS's download manager, but a WebView just silently does
 * nothing. Every "Download PDF" / "Download CSV" link in the app (invoices, delivery
 * challans, expense reports, monthly attendance reports) relies on that, so without a
 * DownloadListener here those buttons appear to do nothing when tapped in the app.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getBridge().getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));

                // The download request goes through Android's DownloadManager as a fresh
                // HTTP request, not the WebView's own session -- it needs the session
                // cookie forwarded explicitly or the server rejects it as unauthenticated.
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) {
                    request.addRequestHeader("Cookie", cookie);
                }
                request.addRequestHeader("User-Agent", userAgent);

                String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
                request.setMimeType(mimeType);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.allowScanningByMediaScanner();

                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                dm.enqueue(request);
                Toast.makeText(getApplicationContext(), "Downloading " + filename + "…", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(getApplicationContext(), "Download failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
}
