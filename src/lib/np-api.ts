import { NpAccount, Parcel } from "../types";

export async function fetchAccountParcels(account: NpAccount): Promise<Parcel[]> {
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const dTo = new Date();
  const dFrom = new Date();
  dFrom.setMonth(dFrom.getMonth() - 2); // Fetch last 2 months to stay safely under 3-month limit
  
  const formatDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const dateTo = formatDate(dTo);
  const dateFrom = formatDate(dFrom);

  // 1. Get documents list created by this token owner
  let docListRes = await fetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: account.apiKey,
      modelName: "InternetDocument",
      calledMethod: "getDocumentList",
      methodProperties: {
        DateTimeFrom: dateFrom,
        DateTimeTo: dateTo,
        GetFullList: "1",
      },
    }),
  });

  if (docListRes.status === 429 || (await docListRes.clone().text()).includes("many requests")) {
    await delay(3000);
    docListRes = await fetch("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: account.apiKey,
        modelName: "InternetDocument",
        calledMethod: "getDocumentList",
        methodProperties: {
          DateTimeFrom: dateFrom,
          DateTimeTo: dateTo,
          GetFullList: "1",
        },
      }),
    });
  }

  const docListData = await docListRes.json();
  if (!docListData.success) {
    throw new Error(docListData.errors?.join(", ") || "Failed to fetch document list");
  }

  const documents = docListData.data || [];
  if (documents.length === 0) return [];

  // 2. Get detailed real-time tracking status for all those documents
  const documentsQuery = documents.map((doc: any) => ({
    DocumentNumber: doc.IntDocNumber,
    Phone: "",
  }));

  const allStatuses: any[] = [];
  const chunkSize = 100; // NP limit is usually 100 for getStatusDocuments
  
  for (let i = 0; i < documentsQuery.length; i += chunkSize) {
    if (i > 0) await delay(500); // 500ms delay between chunks to avoid rate limiting
    
    const chunk = documentsQuery.slice(i, i + chunkSize);
    let statusRes = await fetch("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: account.apiKey,
        modelName: "TrackingDocument",
        calledMethod: "getStatusDocuments",
        methodProperties: {
          Documents: chunk,
        },
      }),
    });
    
    // Simple retry if rate limited
    if (statusRes.status === 429 || (await statusRes.clone().text()).includes("many requests")) {
       await delay(2000);
       statusRes = await fetch("https://api.novaposhta.ua/v2.0/json/", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           apiKey: account.apiKey,
           modelName: "TrackingDocument",
           calledMethod: "getStatusDocuments",
           methodProperties: { Documents: chunk },
         }),
       });
    }

    const statusData = await statusRes.json();
    if (statusData.success && statusData.data) {
      allStatuses.push(...statusData.data);
    }
  }

  const statusMap = new Map(allStatuses.map((s) => [s.Number, s]));

  return documents.map((doc: any): Parcel => {
    const statusInfo = statusMap.get(doc.IntDocNumber) || {};
    return {
      ttn: doc.IntDocNumber,
      accountName: account.name,
      accountId: account.id,
      status: statusInfo.Status || doc.StateName || "Невідомо",
      statusCode: statusInfo.StatusCode || doc.StateId || "0",
      sender: doc.SenderDescription || statusInfo.SenderFullNameEW || "Невідомий відправник",
      recipient: doc.RecipientContactPerson || doc.RecipientDescription || statusInfo.RecipientFullNameEW || "Невідомий отримувач",
      cost: doc.CostOnSite || statusInfo.DocumentCost || "0",
      cityName: statusInfo.CityRecipient || doc.CityRecipientDescription || "",
      weight: doc.Weight || statusInfo.DocumentWeight || "0",
      estimatedDeliveryDate: statusInfo.ScheduledDeliveryDate || doc.EstimatedDeliveryDate || "",
      actualDeliveryDate: statusInfo.ActualDeliveryDate || "",
      dateCreated: doc.DateTime || "",
      rawDoc: doc,
      rawStatus: statusInfo
    };
  });
}
