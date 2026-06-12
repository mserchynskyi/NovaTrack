import https from 'node:https';

const data = JSON.stringify({
    apiKey: "",
    modelName: "AdditionalService",
    calledMethod: "save",
    methodProperties: {
        IntDocNumber: "20450000000000",
        PaymentMethod: "Cash",
        OrderType: "orderCargoReturn",
        ReasonRef: "49754eb2-a9e1-11e3-9fa0-0050568002cf",
        ReturnAddressRef: ""
    }
});

const req = https.request('https://api.novaposhta.ua/v2.0/json/', {
    method: "POST",
    headers: { "Content-Type": "application/json" }
}, (res) => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => console.log(raw));
});
req.write(data);
req.end();
