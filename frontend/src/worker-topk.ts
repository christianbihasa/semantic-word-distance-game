self.addEventListener('message', async (e) => {
  const { target, url } = e.data || {};
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to fetch topk');
    const data = await resp.json();
    // data expected as [{w: word, s: score}, ...]
    // convert into entries array
    const entries = (Array.isArray(data) ? data : []).map((it: any, idx: number) => ({ w: it.w, s: it.s, r: idx + 1 }));
    // post back compact payload
    // Use structured cloneable simple arrays
    postMessage({ target, entries });
  } catch (err) {
    postMessage({ error: String(err) });
  }
});
