import https from 'node:https';

https.get('https://raw.githubusercontent.com/lis-dev/nova-poshta-api-2/master/src/Delivery/NovaPoshtaApi2.php', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log(data.match(/.{0,50}OrderType.{0,50}/gi)));
});
