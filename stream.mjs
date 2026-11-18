import {
  ALL_FORMATS, BlobSource, Input, Output, Mp4OutputFormat, BufferTarget,
  EncodedPacketSink, EncodedAudioPacketSource, EncodedVideoPacketSource
} from './vendor/mediabunny.mjs';

const status = document.querySelector('#status');
const signal = AbortSignal.timeout(30 * 60 * 1000);

function mediaUrl(raw, base) {
  const url = new URL(raw, base);
  if (url.protocol !== 'https:' || url.username || url.password ||
      !(url.hostname === 'whop.com' || url.hostname.endsWith('.whop.com') ||
        url.hostname.endsWith('.mux.com'))) throw new Error('Unsupported media host.');
  if (base) {
    const parent = new URL(base);
    const token = parent.searchParams.get('token');
    if (token && parent.origin === url.origin && !url.searchParams.has('token')) {
      url.searchParams.set('token', token);
    }
  }
  return url.href;
}

async function fetchMedia(url, stage) {
  const response = await fetch(mediaUrl(url), { credentials: 'include', signal });
  if (!response.ok) throw new Error(stage + ' returned HTTP ' + response.status + '.' +
    (response.status === 403 ? ' Reload the lesson, start playback, and scan again.' : ''));
  return response;
}

function attributes(line) {
  return Object.fromEntries(Array.from(line.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g),
    ([, key, value]) => [key, value.replace(/^"|"$/g, '')]));
}

async function playlist(url) {
  const response = await fetchMedia(url, 'HLS playlist');
  const lines = (await response.text()).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines[0] !== '#EXTM3U') throw new Error('The server did not return an HLS playlist.');
  if (lines.some(line => /^#EXT-X-(SESSION-)?KEY:/.test(line) && attributes(line).METHOD !== 'NONE')) {
    throw new Error('Encrypted HLS streams are unsupported.');
  }
  return { lines, url: mediaUrl(response.url || url) };
}

async function readTrack({ lines, url }, label) {
  if (!lines.includes('#EXT-X-ENDLIST')) throw new Error('Wait for a completed recording.');
  if (lines.some(line => /^#EXT-X-(BYTERANGE|DISCONTINUITY)(:|$)/.test(line))) {
    throw new Error('This recording uses an unsupported HLS segment layout.');
  }
  const maps = lines.filter(line => line.startsWith('#EXT-X-MAP:'));
  if (maps.length !== 1 || attributes(maps[0]).BYTERANGE || !attributes(maps[0]).URI) {
    throw new Error('This build supports fragmented MP4 HLS recordings.');
  }
  const segments = lines.filter(line => !line.startsWith('#'));
  if (!segments.length) throw new Error('The playlist contains no media segments.');
  const initialization = await fetchMedia(mediaUrl(attributes(maps[0]).URI, url), label + ' initialization');
  const parts = [await initialization.blob()];
  for (const [index, segment] of segments.entries()) {
    const response = await fetchMedia(mediaUrl(segment, url), label + ' segment ' + (index + 1));
    parts.push(await response.blob());
    status.textContent = label + ' ' + (index + 1) + ' / ' + segments.length;
  }
  return new Input({ source: new BlobSource(new Blob(parts)), formats: ALL_FORMATS });
}

async function copyPackets(track, source) {
  let metadata = { decoderConfig: await track.getDecoderConfig() };
  for await (const packet of new EncodedPacketSink(track).packets()) {
    await source.add(packet, metadata);
    metadata = undefined;
  }
  source.close();
}

async function run() {
  const key = location.hash.slice(1);
  const job = (await chrome.storage.session.get(key))[key];
  if (!job) throw new Error('Open the extension and start a new download.');
  await chrome.storage.session.remove(key);
  history.replaceState(null, '', 'stream.html');
  const master = await playlist(job.url);
  const variants = master.lines.flatMap((line, index) =>
    line.startsWith('#EXT-X-STREAM-INF:') && master.lines[index + 1] &&
    !master.lines[index + 1].startsWith('#')
      ? [{ ...attributes(line), uri: master.lines[index + 1] }] : []);
  variants.sort((a, b) => Number(b.BANDWIDTH) - Number(a.BANDWIDTH));
  const variant = variants[0];
  const videoPlaylist = variant ? await playlist(mediaUrl(variant.uri, master.url)) : master;
  const renditions = master.lines.filter(line => line.startsWith('#EXT-X-MEDIA:'))
    .map(attributes).filter(item => item.TYPE === 'AUDIO' && item['GROUP-ID'] === variant?.AUDIO);
  const rendition = renditions.find(item => item.DEFAULT === 'YES') || renditions[0];
  const audioPlaylist = rendition?.URI ? await playlist(mediaUrl(rendition.URI, master.url)) : null;
  const videoInput = await readTrack(videoPlaylist, 'Downloading video segments');
  const audioInput = audioPlaylist ? await readTrack(audioPlaylist, 'Downloading audio segments') : videoInput;
  const video = await videoInput.getPrimaryVideoTrack();
  const audio = await audioInput.getPrimaryAudioTrack();
  if (!video?.codec || (audioPlaylist && !audio?.codec)) throw new Error('Required media tracks could not be read.');
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const videoSource = new EncodedVideoPacketSource(video.codec);
  output.addVideoTrack(videoSource);
  const audioSource = audio?.codec ? new EncodedAudioPacketSource(audio.codec) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  status.textContent = 'Assembling MP4…';
  await output.start();
  const copies = [copyPackets(video, videoSource)];
  if (audioSource) copies.push(copyPackets(audio, audioSource));
  await Promise.all(copies);
  await output.finalize();
  const url = URL.createObjectURL(new Blob([target.buffer], { type: 'video/mp4' }));
  const id = await chrome.downloads.download({ url, filename: job.title + '.mp4', saveAs: true });
  status.textContent = 'Saving MP4…';
  const completed = delta => {
    if (delta.id !== id || !['complete', 'interrupted'].includes(delta.state?.current)) return;
    chrome.downloads.onChanged.removeListener(completed);
    URL.revokeObjectURL(url);
    status.textContent = delta.state.current === 'complete' ? 'MP4 saved.' : 'Chrome interrupted the download.';
  };
  chrome.downloads.onChanged.addListener(completed);
  const [download] = await chrome.downloads.search({ id });
  if (download) completed({ id, state: { current: download.state } });
}

run().catch(error => { status.textContent = error.message; });
