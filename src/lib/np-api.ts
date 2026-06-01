import { NpAccount, Parcel } from "../types";

function getFriendlyStatus(status: string, statusCode: string): string {
  const code = Number(statusCode);
  if (code === 106) return "Одержано (Повернення)";
  if (code === 108) return "Одержано (Переадресація)";
  if ([9, 10, 11, 14].includes(code)) return "Одержано";
  return status;
}

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

  const statusMap = new Map<string, any>(allStatuses.map((s) => [s.Number, s]));

  // Recursively fetch any additional basis documents (returns/redirections) up to 3 levels deep
  let depth = 0;
  while (depth < 3) {
    const basisTtnList = Array.from(statusMap.values())
      .map(s => s.LastCreatedOnTheBasisNumber)
      .filter((num): num is string => typeof num === "string" && num.trim() !== "" && !statusMap.has(num.trim()));

    if (basisTtnList.length === 0) break;

    const basisQuery = basisTtnList.map(num => ({
      DocumentNumber: num.trim(),
      Phone: "",
    }));

    let basisStatusRes = await fetch("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: account.apiKey,
        modelName: "TrackingDocument",
        calledMethod: "getStatusDocuments",
        methodProperties: {
          Documents: basisQuery,
        },
      }),
    });

    const basisStatusData = await basisStatusRes.json();
    if (basisStatusData.success && basisStatusData.data) {
      let addedAny = false;
      basisStatusData.data.forEach((s: any) => {
        if (!statusMap.has(s.Number)) {
          statusMap.set(s.Number, s);
          addedAny = true;
        }
      });
      if (!addedAny) break;
    } else {
      break;
    }
    depth++;
  }

  return documents.map((doc: any): Parcel => {
    const statusInfo = statusMap.get(doc.IntDocNumber) || {};

    // Trace the chain of basis documents (each created on the basis of the previous one)
    const chain: any[] = [];
    let current = statusInfo;
    const visited = new Set<string>([doc.IntDocNumber]);

    while (current && current.LastCreatedOnTheBasisNumber) {
      const nextTtn = String(current.LastCreatedOnTheBasisNumber).trim();
      if (!nextTtn || visited.has(nextTtn)) break;
      visited.add(nextTtn);

      const nextStatus = statusMap.get(nextTtn);
      if (nextStatus) {
        chain.push({
          ttn: nextTtn,
          status: nextStatus.Status || "Невідомо",
          statusCode: nextStatus.StatusCode || "0",
          actualDeliveryDate: nextStatus.ActualDeliveryDate || "",
          estimatedDeliveryDate: nextStatus.ScheduledDeliveryDate || "",
          cityName: nextStatus.CityRecipient || "",
          rawStatus: nextStatus
        });
        current = nextStatus;
      } else {
        break;
      }
    }

    const basisTtn = statusInfo.LastCreatedOnTheBasisNumber ? String(statusInfo.LastCreatedOnTheBasisNumber).trim() : "";
    const basisStatusCode = current && current !== statusInfo ? String(current.StatusCode).trim() : "";
    const basisStatus = current && current !== statusInfo ? getFriendlyStatus(current.Status || "", basisStatusCode) : "";

    return {
      ttn: doc.IntDocNumber,
      accountName: account.name,
      accountId: account.id,
      status: getFriendlyStatus(statusInfo.Status || doc.StateName || "Невідомо", statusInfo.StatusCode || doc.StateId || "0"),
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
      rawStatus: statusInfo,
      basisTtn,
      basisStatus,
      basisStatusCode,
      basisChain: chain
    };
  });
}

export async function fetchManualParcels(apiKey: string, manualTtns: { ttn: string; phone?: string }[]): Promise<Parcel[]> {
  if (manualTtns.length === 0) return [];
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const documentsQuery = manualTtns.map(item => ({
    DocumentNumber: item.ttn.trim(),
    Phone: item.phone ? item.phone.trim() : "",
  }));

  const allStatuses: any[] = [];
  const chunkSize = 100;
  
  for (let i = 0; i < documentsQuery.length; i += chunkSize) {
    if (i > 0) await delay(500);
    const chunk = documentsQuery.slice(i, i + chunkSize);
    let statusRes = await fetch("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        modelName: "TrackingDocument",
        calledMethod: "getStatusDocuments",
        methodProperties: {
          Documents: chunk,
        },
      }),
    });

    if (statusRes.status === 429 || (await statusRes.clone().text()).includes("many requests")) {
       await delay(2000);
       statusRes = await fetch("https://api.novaposhta.ua/v2.0/json/", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           apiKey,
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

  const statusMap = new Map<string, any>(allStatuses.map((s) => [s.Number, s]));

  let depth = 0;
  while (depth < 3) {
    const basisTtnList = Array.from(statusMap.values())
      .map(s => s.LastCreatedOnTheBasisNumber)
      .filter((num): num is string => typeof num === "string" && num.trim() !== "" && !statusMap.has(num.trim()));

    if (basisTtnList.length === 0) break;

    const basisQuery = basisTtnList.map(num => ({
      DocumentNumber: num.trim(),
      Phone: "",
    }));

    let basisStatusRes = await fetch("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        modelName: "TrackingDocument",
        calledMethod: "getStatusDocuments",
        methodProperties: {
          Documents: basisQuery,
        },
      }),
    });

    const basisStatusData = await basisStatusRes.json();
    if (basisStatusData.success && basisStatusData.data) {
      let addedAny = false;
      basisStatusData.data.forEach((s: any) => {
        if (!statusMap.has(s.Number)) {
          statusMap.set(s.Number, s);
          addedAny = true;
        }
      });
      if (!addedAny) break;
    } else {
      break;
    }
    depth++;
  }

  return manualTtns.map(item => {
    const statusInfo = statusMap.get(item.ttn.trim()) || {};

    const chain: any[] = [];
    let current = statusInfo;
    const visited = new Set<string>([item.ttn.trim()]);

    while (current && current.LastCreatedOnTheBasisNumber) {
      const nextTtn = String(current.LastCreatedOnTheBasisNumber).trim();
      if (!nextTtn || visited.has(nextTtn)) break;
      visited.add(nextTtn);

      const nextStatus = statusMap.get(nextTtn);
      if (nextStatus) {
        chain.push({
          ttn: nextTtn,
          status: nextStatus.Status || "Невідомо",
          statusCode: nextStatus.StatusCode || "0",
          actualDeliveryDate: nextStatus.ActualDeliveryDate || "",
          estimatedDeliveryDate: nextStatus.ScheduledDeliveryDate || "",
          cityName: nextStatus.CityRecipient || "",
          rawStatus: nextStatus
        });
        current = nextStatus;
      } else {
        break;
      }
    }

    const basisTtn = statusInfo.LastCreatedOnTheBasisNumber ? String(statusInfo.LastCreatedOnTheBasisNumber).trim() : "";
    const basisStatusCode = current && current !== statusInfo ? String(current.StatusCode).trim() : "";
    const basisStatus = current && current !== statusInfo ? getFriendlyStatus(current.Status || "", basisStatusCode) : "";

    return {
      ttn: item.ttn.trim(),
      accountName: "Додано вручну",
      accountId: "manual",
      status: getFriendlyStatus(statusInfo.Status || "У процесі оформлення", statusInfo.StatusCode || "0"),
      statusCode: statusInfo.StatusCode || "0",
      sender: statusInfo.SenderFullNameEW || statusInfo.SenderContactPerson || "Невідомий відправник",
      recipient: statusInfo.RecipientFullNameEW || statusInfo.RecipientContactPerson || "Невідомий отримувач",
      cost: statusInfo.DocumentCost || "0",
      cityName: statusInfo.CityRecipient || statusInfo.CitySender || "",
      weight: statusInfo.DocumentWeight || "0",
      estimatedDeliveryDate: statusInfo.ScheduledDeliveryDate || "",
      actualDeliveryDate: statusInfo.ActualDeliveryDate || "",
      dateCreated: statusInfo.DateCreated || statusInfo.DateScan || "",
      rawDoc: statusInfo,
      rawStatus: statusInfo,
      basisTtn,
      basisStatus,
      basisStatusCode,
      basisChain: chain
    };
  });
}
