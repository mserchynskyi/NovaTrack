import fetch from 'node-fetch';

async function testFetch() {
  const result = await fetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: "", 
      modelName: "AdditionalService",
      calledMethod: "save",
      methodProperties: {
         IntDocNumber: "20450000000000",
         PaymentMethod: "Cash",
         OrderType: "orderCargoReturn",
         Reason: "49754eb2-a9e1-11e3-9fa0-0050568002cf",
         SubtypeReason: "49754ec8-a9e1-11e3-9fa0-0050568002cf",
         RecipientWarehouse: "1"
      }
    }),
  });
  console.log(await result.json());
}
testFetch();
