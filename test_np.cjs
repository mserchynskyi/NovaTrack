require("dotenv").config({ path: ".env.local" });

fetch("https://api.novaposhta.ua/v2.0/json/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    apiKey: "12345678901234567890123456789012", 
    modelName: "AdditionalService",
    calledMethod: "save",
    methodProperties: {
      IntDocNumber: "59001682619780",
      OrderType: "orderChangeEW",
      RecipientContactPerson: "Some Name",
      RecipientPhone: "380991234567",
      PayerType: "Recipient",
      PaymentMethod: "Cash"
    }
  })
}).then(res => res.json()).then(res => console.dir(res, {depth: null})).catch(console.error);
