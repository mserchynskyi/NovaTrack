const https = require('https');
https.get('https://raw.githubusercontent.com/lis-dev/nova-poshta-api-2/master/src/NovaPoshta/Models/AdditionalService.php', (res) => {
  let data = '';
  res.on('data', (d) => data += d);
  res.on('end', () => console.log(data));
});
