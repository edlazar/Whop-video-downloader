const playerSelector = 'mux-player, mux-video, video, iframe[src*="mux.com"]';
const controls = new Map();
let scheduled = false;

function renderControls() {
  scheduled = false;
  const players = [...document.querySelectorAll(playerSelector)].filter(player =>
    !player.parentElement?.closest(playerSelector) && player.getClientRects().length &&
    player.clientWidth >= 160 && player.clientHeight >= 90);
  for (const [player, row] of controls) {
    if (!players.includes(player)) {
      row.remove();
      controls.delete(player);
    }
  }
  for (const player of players) {
    if (controls.get(player)?.isConnected) continue;
    const row = document.createElement('div');
    row.className = 'whop-video-saver-controls';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Download video';
    const info = document.createElement('span');
    info.setAttribute('role', 'status');
    button.addEventListener('click', async event => {
      if (!event.isTrusted) return;
      button.disabled = true;
      try {
        const { files } = detectVideos(player, controls.size === 1);
        const unique = [...new Map(files.map(file => [file.url, file])).values()];
        const direct = unique.find(file => file.extension !== 'hls');
        if (!direct && unique.length > 1) {
          info.textContent = 'Multiple streams found. Choose one in the extension popup.';
          return;
        }
        const file = direct || unique[0];
        if (!file) {
          info.textContent = 'Play the video briefly and try again, or scan from the extension popup.';
          return;
        }
        const result = await chrome.runtime.sendMessage({ type: 'save-video', file });
        if (!result?.ok) throw new Error(result?.error || 'Could not start the download.');
        info.textContent = 'Download started.';
      } catch (error) {
        info.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
    row.append(button, info);
    player.after(row);
    controls.set(player, row);
  }
}

function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(renderControls);
}

new MutationObserver(records => {
  if (records.some(record => !record.target.parentElement?.closest('.whop-video-saver-controls') &&
      !record.target.closest?.('.whop-video-saver-controls'))) scheduleRender();
}).observe(document.body, { childList: true, subtree: true });
window.addEventListener('resize', scheduleRender);
scheduleRender();
