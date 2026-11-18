async function startDownload(file) {
  const url = new URL(file.url);
  if (url.protocol !== 'https:' || url.username || url.password ||
      !['mp4', 'webm', 'mov', 'm4v', 'ogv', 'hls'].includes(file.extension)) {
    throw new Error('Unsupported video source.');
  }
  const title = (file.title || 'Whop video')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim().replace(/^[.]+|[. ]+$/g, '').slice(0, 120) || 'Whop video';
  if (file.extension === 'hls') {
    const key = crypto.randomUUID();
    await chrome.storage.session.set({ [key]: { url: file.url, title } });
    try {
      await chrome.tabs.create({ url: chrome.runtime.getURL('stream.html#' + key) });
    } catch (error) {
      await chrome.storage.session.remove(key);
      throw error;
    }
    return;
  }
  await chrome.downloads.download({
    url: file.url,
    filename: 'Whop videos/' + title + '.' + file.extension,
    saveAs: true
  });
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'save-video' || sender.id !== chrome.runtime.id) return;
  startDownload(message.file).then(
    () => reply({ ok: true }),
    error => reply({ ok: false, error: error.message })
  );
  return true;
});
