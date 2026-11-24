# Whop Video Downloader

The extension appears in Chrome as **Whop Video Saver**. It saves supported direct videos and compatible HLS streams from Whop. Download only videos you own or have permission to save.

## Install in Chrome

1. On this repository page, click **Code → Download ZIP**.
2. Extract the ZIP and find the folder containing `manifest.json`.
3. Open `chrome://extensions` in desktop Chrome.
4. Turn on **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`.
5. Refresh any Whop video tabs you already had open. To keep the extension handy, open Chrome’s **Extensions** menu and pin **Whop Video Saver**.

## Download a video

1. Open a Whop video you can access.
2. Click **Download video** next to the player. If the extension hasn’t detected the video yet, play it briefly and try again.
3. If the button is missing or detection still fails, open **Whop Video Saver** from Chrome’s toolbar, click **Scan tab**, and choose a detected download.
4. Check Chrome’s **Downloads** page at `chrome://downloads` for progress and the saved file.

If Chrome reports a missing manifest during installation, select the extracted folder that directly contains `manifest.json`. If scanning still finds nothing after refreshing and playing the video, that stream may be unsupported.
