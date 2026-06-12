import https from 'node:https';

https.get('https://api.github.com/repos/lis-dev/nova-poshta-api-2/git/trees/master?recursive=1', {headers: {'User-Agent': 'Nodejs'}}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log(data));
});
