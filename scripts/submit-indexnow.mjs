const host = 'www.gobaispace.com';
const key = process.env.INDEXNOW_KEY?.trim();
const sitemapUrl = `https://${host}/sitemap.xml`;
if (!key) { console.log('[IndexNow] INDEXNOW_KEY absent : aucune soumission.'); process.exit(0); }
const response = await fetch(sitemapUrl);
if (!response.ok) throw new Error(`Sitemap inaccessible (${response.status}) : ${sitemapUrl}`);
const xml = await response.text();
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].trim()).filter((url) => url.startsWith(`https://${host}/`));
if (!urls.length) throw new Error('Aucune URL canonique trouvée dans le sitemap.');
const result = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: urls }),
});
if (![200, 202].includes(result.status)) throw new Error(`IndexNow a répondu ${result.status}: ${await result.text()}`);
console.log(`[IndexNow] ${urls.length} URL soumises (${result.status}).`);
