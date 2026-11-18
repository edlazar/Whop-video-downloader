const status = document.querySelector('#status');
const videos = document.querySelector('#videos');
const scan = document.querySelector('#scan');

function addDownload(file) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  item.textContent = file.title || 'Video';
  button.textContent = file.extension === 'hls' ? 'Save stream as MP4' : 'Save ' + file.extension.toUpperCase();
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'save-video', file });
      if (!result?.ok) throw new Error(result?.error || 'Could not start the download.');
      status.textContent = 'Download handed to Chrome.';
    } catch (error) {
      status.textContent = error.message || 'Chrome could not start the download.';
    } finally {
      button.disabled = false;
    }
  });
  item.append(button);
  videos.append(item);
}

async function scanTab() {
  scan.disabled = true;
  videos.replaceChildren();
  status.textContent = 'Scanning…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ? new URL(tab.url) : null;
    if (!url || url.protocol !== 'https:' ||
        (url.hostname !== 'whop.com' && !url.hostname.endsWith('.whop.com'))) {
      status.textContent = 'Open a Whop video page and try again.';
      return;
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: detectVideos
    });
    const files = new Map();
    let playerDetected = false;
    for (const { result } of results) {
      if (!result) continue;
      playerDetected ||= result.playerDetected;
      for (const file of result.files) files.set(file.url, file);
    }
    files.forEach(addDownload);
    status.textContent = files.size
      ? files.size + (files.size === 1 ? ' video file found.' : ' video files found.')
      : playerDetected
        ? 'Player found. Play the lesson for a few seconds, then scan again.'
        : 'No video found. Play the video, then scan again.';
  } catch (error) {
    status.textContent = error.message || 'Could not scan the tab.';
  } finally {
    scan.disabled = false;
  }
}

scan.addEventListener('click', scanTab);
scanTab();
