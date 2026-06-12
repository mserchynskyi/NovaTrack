import https from 'node:https';

const testOrderType = async (orderType) => {
  return new Promise((resolve) => {
    const data = JSON.stringify({
        apiKey: "",
        modelName: "AdditionalService",
        calledMethod: "save",
        methodProperties: {
            IntDocNumber: "20450000000000",
            PaymentMethod: "Cash",
            PayerType: "Recipient",
            OrderType: orderType,
            Reason: "49754eb2-a9e1-11e3-9fa0-0050568002cf",
            SubtypeReason: "49754ec8-a9e1-11e3-9fa0-0050568002cf",
            ReturnAddressRef: "49754ec8-a9e1-11e3-9fa0-0050568002cf"
        }
    });

    const req = https.request('https://api.novaposhta.ua/v2.0/json/', {
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => resolve(JSON.parse(raw).errors));
    });
    req.write(data);
    req.end();
  });
};

(async () => {
    for (const ot of ["Return", "CargoReturn", "orderReturn", "orderCargoReturn", "Redirection", "ReturnCargo"]) {
        const err = await testOrderType(ot);
        console.log(ot, "=>", err);
    }
})();
