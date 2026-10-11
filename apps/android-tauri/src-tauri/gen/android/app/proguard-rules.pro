# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# JunkSnap: window.JunkSnapAndroid (MainActivity.AppBridge: print, openAppSettings, checkLocation, linkReady) is only
# called from the page, so R8 must keep its @JavascriptInterface methods. AGP 9.3's optimization DSL adds the default
# proguard-android-optimize.txt (which has this rule) unless keepRules.includeDefault is false; wry's own
# proguard-wry.pro keeps only its Ipc class. Stated here so the bridge never depends on that default.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
