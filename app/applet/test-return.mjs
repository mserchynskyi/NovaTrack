import https from 'https';
const req = https.request('https://api.novaposhta.ua/v2.0/json/', {
    method: "POST",
    headers: { "Content-Type": "application/json" }
}, (res) => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => console.log(JSON.stringify(JSON.parse(raw), null, 2)));
});
req.write(JSON.stringify({
    apiKey: "",
    modelName: "AdditionalService",
    calledMethod: "save",
    methodProperties: {
        IntDocNumber: "20450000000000",
        PaymentMethod: "Cash",
        OrderType: "orderCargoReturn",
        Reason: "49754eb2-a9e1-11e3-9fa0-0050568002cf",
        SubtypeReason: "49754ec8-a9e1-11e3-9fa0-0050568002cf"
    }
}));
req.end();
