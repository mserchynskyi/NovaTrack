import https from 'node:https';

https.get('https://developers.novaposhta.ua/view/model/a55b2c64-8512-11e8-8b24-005056881c6b/method/a5eccfc7-8512-11e8-8b24-005056881c6b', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log(data.match(/.{0,50}OrderType.{0,50}/gi)));
});
