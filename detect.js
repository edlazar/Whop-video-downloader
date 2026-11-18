function detectVideos(player = null, includeObserved = true) {
  const files = [];
  let playerDetected = Boolean(document.querySelector('iframe[src*="mux.com"]'));

  function addFile(raw, type, title) {
    if (!raw) return;
    let url;
    try {
      url = new URL(raw, document.baseURI);
    } catch {
      return;
    }
    const pathExtension = url.pathname.match(/\.(mp4|webm|mov|m4v|ogv)$/i)?.[1];
    const mimeExtension = {
      'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
      'video/x-m4v': 'm4v', 'video/ogg': 'ogv'
    }[type?.split(';')[0].trim().toLowerCase()];
    const extension = /\.m3u8$/i.test(url.pathname) &&
      (url.hostname.endsWith('.mux.com') || url.hostname === 'whop.com' || url.hostname.endsWith('.whop.com'))
      ? 'hls' : pathExtension?.toLowerCase() || mimeExtension;
    if (url.protocol !== 'https:' || url.username || url.password ||
        /\.mpd$/i.test(url.pathname) || !extension) return;
    url.hash = '';
    files.push({ url: url.href, title, extension });
  }

  function visit(root) {
    for (const video of root.querySelectorAll('video, mux-player, mux-video')) {
      playerDetected = true;
      const title = video.getAttribute('aria-label') ||
        video.getAttribute('title') || document.title;
      addFile(video.currentSrc, null, title);
      addFile(video.getAttribute('src'), null, title);
      for (const source of video.querySelectorAll('source[src]')) {
        addFile(source.getAttribute('src'), source.getAttribute('type'), title);
      }
    }
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) visit(element.shadowRoot);
    }
  }

  if (player) {
    visit({ querySelectorAll: selector => [
      ...(player.matches(selector) ? [player] : []),
      ...player.querySelectorAll(selector)
    ] });
  } else {
    visit(document);
  }
  if (includeObserved && (playerDetected || player)) {
    for (const entry of performance.getEntriesByType('resource')) {
      if (/\.m3u8(?:[?#]|$)/i.test(entry.name)) addFile(entry.name, null, document.title);
    }
  }
  return { files, playerDetected };
}

