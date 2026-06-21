import { NpAccount, Parcel } from "../types";

const apiCache = new Map<string, { data: any; expiry: number }>();
let lastRateLimitTime = 0;

async function safeFetch(url: string, options: RequestInit, retries = 5): Promise<any> {
  const isBypass = options.headers && (options.headers as any)["x-bypass-cache"] === "true";
  
  if (options.headers && (options.headers as any)["x-bypass-cache"]) {
    const headersCopy = { ...options.headers };
    delete (headersCopy as any)["x-bypass-cache"];
    options.headers = headersCopy;
  }

  const now = Date.now();
  if (now - lastRateLimitTime < 10000) {
    throw new Error("Перевищено ліміт запитів до Нової Пошти. Рекомендуємо зачекати кілька секунд перед повторною спробою.");
  }

  const bodyStr = options.body ? String(options.body) : "";
  const cacheKey = url + "_" + bodyStr;

  const isCacheable = !isBypass && options.body && 
    (bodyStr.includes("getCities") || 
     bodyStr.includes("getWarehouses") || 
     bodyStr.includes("getStatusDocuments") ||
     bodyStr.includes("getDocumentList"));

  if (isCacheable) {
    const cached = apiCache.get(cacheKey);
    const cacheDuration = (bodyStr.includes("getCities") || bodyStr.includes("getWarehouses"))
      ? 10 * 60 * 1000 // 10 minutes for cities and warehouses
      : 30 * 1000;    // 30 seconds for parcel statuses/lists
    
    if (cached && now < cached.expiry) {
      return JSON.parse(JSON.stringify(cached.data));
    }
  }

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        if (i === retries - 1) {
          lastRateLimitTime = Date.now();
        }
        await delay(3500 * (i + 1));
        continue;
      }
      const cloned = response.clone();
      const text = await cloned.text();
      const textLower = text.toLowerCase();
      if (textLower.includes("many requests") || textLower.includes("too many requests")) {
        if (i === retries - 1) {
          lastRateLimitTime = Date.now();
        }
        await delay(3500 * (i + 1));
        continue;
      }
      try {
        const parsed = JSON.parse(text);
        
        // Handle custom JSON error indications of rate limiting or limit exceeded
        let isRateLimitError = false;
        if (parsed && parsed.success === false) {
          const errorsArray = Array.isArray(parsed.errors) ? parsed.errors : [];
          const joinedErrors = errorsArray.join(" ").toLowerCase();
          if (
            joinedErrors.includes("limit") ||
            joinedErrors.includes("ліміт") ||
            joinedErrors.includes("перевищено") ||
            joinedErrors.includes("excessive") ||
            joinedErrors.includes("too many") ||
            joinedErrors.includes("rate") ||
            joinedErrors.includes("запит")
          ) {
            isRateLimitError = true;
          }
        }

        if (isRateLimitError) {
          if (i === retries - 1) {
            lastRateLimitTime = Date.now();
          }
          await delay(3500 * (i + 1));
          continue;
        }

        if (parsed && parsed.success && isCacheable) {
          const cacheDuration = (bodyStr.includes("getCities") || bodyStr.includes("getWarehouses"))
            ? 10 * 60 * 1000
            : 30 * 1000;
          apiCache.set(cacheKey, { data: parsed, expiry: Date.now() + cacheDuration });
        }
        return parsed;
      } catch (jsonErr) {
        const lowerText = text.toLowerCase();
        if (
          lowerText.includes("invalid api key") ||
          lowerText.includes("api key in not valid") ||
          lowerText.includes("api key is not valid") ||
          lowerText.includes("invalid key")
        ) {
          throw new Error("Недійсний або некоректний API ключ Нової Пошти. Перевірте правильність ключа в налаштуваннях акаунту.");
        }
        const plainText = text.replace(/<[^>]*>/g, "").trim();
        throw new Error(`Некоректна відповідь від сервера Нової Пошти: ${plainText.slice(0, 150)}...`);
      }
    } catch (error: any) {
      if (i === retries - 1) {
        const errStr = String(error.message || "").toLowerCase();
        if (errStr.includes("limit") || errStr.includes("ліміт") || errStr.includes("rate") || errStr.includes("429")) {
          lastRateLimitTime = Date.now();
        }
        throw error;
      }
      await delay(3500 * (i + 1));
    }
  }
  lastRateLimitTime = Date.now();
  throw new Error("Перевищено ліміт запитів до Нової Пошти. Спробуйте пізніше.");
}

function getFriendlyStatus(status: string, statusCode: string): string {
  const code = Number(statusCode);
  if (code === 106) return "Одержано (Повернення)";
  if (code === 108) return "Одержано (Переадресація)";
  if ([9, 10, 11, 14].includes(code)) return "Одержано";
  return status;
}

export async function fetchAccountParcels(account: NpAccount, bypassCache = false): Promise<Parcel[]> {
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const dTo = new Date();
  const dFrom = new Date();
  dFrom.setMonth(dFrom.getMonth() - 2); // Fetch last 2 months to stay safely under 3-month limit
  
  const formatDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const dateTo = formatDate(dTo);
  const dateFrom = formatDate(dFrom);

  // 1. Get documents list created by this token owner
  const docListData = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...(bypassCache ? { "x-bypass-cache": "true" } : {})
    },
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
    const statusData = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(bypassCache ? { "x-bypass-cache": "true" } : {})
      },
      body: JSON.stringify({
        apiKey: account.apiKey,
        modelName: "TrackingDocument",
        calledMethod: "getStatusDocuments",
        methodProperties: {
          Documents: chunk,
        },
      }),
    });
    
    if (statusData.success && statusData.data) {
      allStatuses.push(...statusData.data);
    }
  }

  const statusMap = new Map<string, any>(allStatuses.map((s) => [s.Number, s]));

  // Recursively fetch any additional basis documents (returns/redirections) up to 5 levels deep
  let depth = 0;
  while (depth < 5) {
    const basisTtnList = Array.from(statusMap.values())
      .map(s => s.LastCreatedOnTheBasisNumber)
      .filter((num): num is string => typeof num === "string" && num.trim() !== "" && !statusMap.has(num.trim()));

    if (basisTtnList.length === 0) break;

    const basisQuery = basisTtnList.map(num => ({
      DocumentNumber: num.trim(),
      Phone: "",
    }));

    const basisStatusData = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(bypassCache ? { "x-bypass-cache": "true" } : {})
      },
      body: JSON.stringify({
        apiKey: account.apiKey,
        modelName: "TrackingDocument",
        calledMethod: "getStatusDocuments",
        methodProperties: {
          Documents: basisQuery,
        },
      }),
    });

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

    // Trace the chain of basis documents
    let current = statusInfo;
    const visited = new Set<string>([doc.IntDocNumber]);

    while (current && current.LastCreatedOnTheBasisNumber) {
      const nextTtn = String(current.LastCreatedOnTheBasisNumber).trim();
      if (!nextTtn || visited.has(nextTtn)) break;
      visited.add(nextTtn);

      const nextStatus = statusMap.get(nextTtn);
      if (nextStatus) {
        current = nextStatus;
      } else {
        break;
      }
    }

    // Now collect all discovered basis documents (excluding the original) and sort chronologically
    const chain = Array.from(visited)
      .filter((ttn) => ttn !== doc.IntDocNumber)
      .map((ttn) => statusMap.get(ttn))
      .filter(Boolean)
      .sort((a, b) => {
        const parseDate = (dstr: string) => {
          if (!dstr) return 0;
          const [d, t] = dstr.split(' ');
          if (!d || !t) return 0;
          const [D, M, Y] = d.split('-');
          return new Date(`${Y}-${M}-${D}T${t}`).getTime();
        };
        return parseDate(a.DateCreated) - parseDate(b.DateCreated);
      })
      .map((nextStatus) => ({
        ttn: nextStatus.Number,
        status: nextStatus.Status || "Невідомо",
        statusCode: nextStatus.StatusCode || "0",
        actualDeliveryDate: nextStatus.ActualDeliveryDate || "",
        estimatedDeliveryDate: nextStatus.ScheduledDeliveryDate || "",
        cityName: nextStatus.CityRecipient || "",
        rawStatus: nextStatus
      }));

    let basisTtn = chain.length > 0 ? chain[chain.length - 1].ttn : "";
    let basisStatus = chain.length > 0 ? chain[chain.length - 1].status : "";
    let basisStatusCode = chain.length > 0 ? chain[chain.length - 1].statusCode : "";

    return {
      ttn: doc.IntDocNumber,
      accountName: account.name,
      accountId: account.id,
      status: getFriendlyStatus(statusInfo.Status || doc.StateName || "Невідомо", statusInfo.StatusCode || doc.StateId || "0"),
      statusCode: statusInfo.StatusCode || doc.StateId || "0",
      sender: doc.SenderDescription || statusInfo.SenderFullNameEW || "Невідомий відправник",
      recipient: doc.RecipientContactPerson || doc.RecipientDescription || statusInfo.RecipientFullNameEW || "Невідомий отримувач",
      cost: doc.CostOnSite || statusInfo.DocumentCost || "0",
      announcedPrice: doc.Cost || statusInfo.AnnouncedPrice || "0",
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

export async function fetchManualParcels(
  accounts: NpAccount[],
  manualTtns: { 
    ttn: string; 
    phone?: string; 
    accountId?: string; 
    afterpaymentSum?: number; 
    afterpaymentType?: 'Money' | 'PaymentControl' | 'None';
    prolongDate?: string;
    prolongDays?: number;
  }[],
  bypassCache = false
): Promise<Parcel[]> {
  if (manualTtns.length === 0 || accounts.length === 0) return [];
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // Group manualTtns by accountId. Fallback to accounts[0] if no accountId or not found.
  const groupsAndKeys = new Map<string, { account: NpAccount; items: typeof manualTtns }>();
  for (const item of manualTtns) {
    let matchedAcc = item.accountId ? accounts.find(a => a.id === item.accountId) : undefined;
    if (!matchedAcc) {
      matchedAcc = accounts[0];
    }
    const accId = matchedAcc.id;
    if (!groupsAndKeys.has(accId)) {
      groupsAndKeys.set(accId, { account: matchedAcc, items: [] });
    }
    groupsAndKeys.get(accId)!.items.push(item);
  }

  const allParcels: Parcel[] = [];

  for (const [accId, group] of groupsAndKeys) {
    const apiKey = group.account.apiKey;
    const documentsQuery = group.items.map(item => ({
      DocumentNumber: item.ttn.trim(),
      Phone: item.phone ? item.phone.trim() : "",
    }));

    const allStatuses: any[] = [];
    const chunkSize = 100;
    
    for (let i = 0; i < documentsQuery.length; i += chunkSize) {
      if (i > 0) await delay(500);
      const chunk = documentsQuery.slice(i, i + chunkSize);
      const statusData = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(bypassCache ? { "x-bypass-cache": "true" } : {})
        },
        body: JSON.stringify({
          apiKey,
          modelName: "TrackingDocument",
          calledMethod: "getStatusDocuments",
          methodProperties: {
            Documents: chunk,
          },
        }),
      });

      if (statusData.success && statusData.data) {
        allStatuses.push(...statusData.data);
      }
    }

    const statusMap = new Map<string, any>(allStatuses.map((s) => [s.Number, s]));

    let depth = 0;
    while (depth < 5) {
      const basisTtnList = Array.from(statusMap.values())
        .map(s => s.LastCreatedOnTheBasisNumber)
        .filter((num): num is string => typeof num === "string" && num.trim() !== "" && !statusMap.has(num.trim()));

      if (basisTtnList.length === 0) break;

      const basisQuery = basisTtnList.map(num => ({
        DocumentNumber: num.trim(),
        Phone: "",
      }));

      const basisStatusData = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(bypassCache ? { "x-bypass-cache": "true" } : {})
        },
        body: JSON.stringify({
          apiKey,
          modelName: "TrackingDocument",
          calledMethod: "getStatusDocuments",
          methodProperties: {
            Documents: basisQuery,
          },
        }),
      });

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

    const groupParcels = group.items.map(item => {
      const baseStatusInfo = statusMap.get(item.ttn.trim()) || {};
      const statusInfo = { ...baseStatusInfo };

      // Apply manual overrides if present
      if (item.prolongDate) {
        statusInfo.DatePayedKeeping = item.prolongDate;
      }

      if (item.afterpaymentType) {
        if (item.afterpaymentType === 'None') {
          statusInfo.BackwardDeliveryMoney = "0";
          statusInfo.BackwardDeliverySum = "0";
          statusInfo.RedeliverySum = "0";
          statusInfo.AfterpaymentOnGoodsCost = "0";
          statusInfo.BackwardDeliveryData = [];
        } else {
          const sumStr = String(item.afterpaymentSum || 0);
          statusInfo.BackwardDeliveryData = [{
            PayerType: "Recipient",
            CargoType: "Money",
            RedeliveryString: sumStr
          }];
          if (item.afterpaymentType === 'PaymentControl') {
            statusInfo.AfterpaymentOnGoodsCost = sumStr;
            statusInfo.ServiceType = 'PaymentControl';
          } else {
            statusInfo.BackwardDeliveryMoney = sumStr;
            statusInfo.BackwardDeliverySum = sumStr;
            statusInfo.RedeliverySum = sumStr;
            statusInfo.ServiceType = 'Money';
          }
        }
      }

      const chain: any[] = [];
      let current = statusInfo;
      const visited = new Set<string>([item.ttn.trim()]);

      while (current && current.LastCreatedOnTheBasisNumber) {
        const nextTtn = String(current.LastCreatedOnTheBasisNumber).trim();
        if (!nextTtn || visited.has(nextTtn)) break;
        visited.add(nextTtn);

        const nextStatus = statusMap.get(nextTtn);
        if (nextStatus) {
          current = nextStatus;
        } else {
          break;
        }
      }

      const sortedChain = Array.from(visited)
        .filter((ttn) => ttn !== item.ttn.trim())
        .map((ttn) => statusMap.get(ttn))
        .filter(Boolean)
        .sort((a, b) => {
          const parseDate = (dstr: string) => {
            if (!dstr) return 0;
            const [d, t] = dstr.split(' ');
            if (!d || !t) return 0;
            const [D, M, Y] = d.split('-');
            return new Date(`${Y}-${M}-${D}T${t}`).getTime();
          };
          return parseDate(a.DateCreated) - parseDate(b.DateCreated);
        })
        .map((nextStatus) => ({
          ttn: nextStatus.Number,
          status: nextStatus.Status || "Невідомо",
          statusCode: nextStatus.StatusCode || "0",
          actualDeliveryDate: nextStatus.ActualDeliveryDate || "",
          estimatedDeliveryDate: nextStatus.ScheduledDeliveryDate || "",
          cityName: nextStatus.CityRecipient || "",
          rawStatus: nextStatus
        }));

      let basisTtn = sortedChain.length > 0 ? sortedChain[sortedChain.length - 1].ttn : "";
      let basisStatus = sortedChain.length > 0 ? sortedChain[sortedChain.length - 1].status : "";
      let basisStatusCode = sortedChain.length > 0 ? sortedChain[sortedChain.length - 1].statusCode : "";

      return {
        ttn: item.ttn.trim(),
        accountName: `${group.account.name} (ручна)`,
        accountId: group.account.id,
        isManual: true,
        status: getFriendlyStatus(statusInfo.Status || "У процесі оформлення", statusInfo.StatusCode || "0"),
        statusCode: statusInfo.StatusCode || "0",
        sender: statusInfo.SenderFullNameEW || statusInfo.SenderContactPerson || "Невідомий відправник",
        recipient: statusInfo.RecipientFullNameEW || statusInfo.RecipientContactPerson || "Невідомий отримувач",
        cost: statusInfo.DocumentCost || "0",
        announcedPrice: statusInfo.AnnouncedPrice || "0",
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
        basisChain: sortedChain
      };
    });

    allParcels.push(...groupParcels);
  }

  return allParcels;
}

export interface NpCity {
  Ref: string;
  Description: string;
  AreaDescription: string;
}

export interface NpWarehouse {
  Ref: string;
  Description: string;
  Number: string;
  ShortAddress: string;
}

export async function searchCities(apiKey: string, query: string): Promise<NpCity[]> {
  let cleanedQuery = query.trim();
  // Strip common Ukrainian city prefixes/abbreviations to prevent empty API searches
  cleanedQuery = cleanedQuery.replace(/^(м\.|м\s+|смт\.|смт\s+|с\.|с\s+|село\s+|селище\s+)/gi, "").trim();

  if (!cleanedQuery) return [];

  const data = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      modelName: "Address",
      calledMethod: "getCities",
      methodProperties: {
        FindByString: cleanedQuery,
        Limit: "20",
      },
    }),
  });

  if (!data?.success) {
    const errText = data?.errors?.join(", ") || "";
    if (
      errText.toLowerCase().includes("city not found") || 
      errText.toLowerCase().includes("not found")
    ) {
      return [];
    }
    throw new Error(errText || "Помилка при завантаженні міст");
  }

  return (data.data || []).map((city: any) => ({
    Ref: city.Ref,
    Description: city.Description,
    AreaDescription: city.AreaDescription || city.Area,
  }));
}

export async function getWarehouses(apiKey: string, cityRef: string, query?: string): Promise<NpWarehouse[]> {
  const data = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      modelName: "Address",
      calledMethod: "getWarehouses",
      methodProperties: {
        CityRef: cityRef,
        FindByString: query || "",
        Limit: "100",
      },
    }),
  });

  if (!data?.success) {
    const errText = data?.errors?.join(", ") || "";
    if (
      errText.toLowerCase().includes("city not found") || 
      errText.toLowerCase().includes("cityrecipient") || 
      errText.toLowerCase().includes("citysender") || 
      errText.toLowerCase().includes("not found")
    ) {
      console.warn("Nova Poshta returned City not found for Ref:", cityRef);
      return [];
    }
    throw new Error(errText || "Помилка при завантаженні відділень");
  }

  return (data.data || []).map((w: any) => ({
    Ref: w.Ref,
    Description: w.Description,
    Number: w.Number,
    ShortAddress: w.ShortAddress,
  }));
}

export async function checkRedirectionOpportunity(apiKey: string, ttn: string, phone: string): Promise<{ success: boolean; error?: string; info?: any }> {
  try {
    const data = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        modelName: "AdditionalService",
        calledMethod: "checkRedirection",
        methodProperties: {
          DocumentNumber: ttn,
          Phone: phone,
        },
      }),
    });

    if (!data?.success) {
      return {
        success: false,
        error: data?.errors?.join(", ") || "Не вдалося перевірити можливість переадресації",
      };
    }

    return {
      success: true,
      info: data.data?.[0],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Помилка мережі при перевірці переадресації",
    };
  }
}

export async function submitRedirection(
  apiKey: string,
  params: {
    IntDocNumber: string;
    PaymentMethod: string;
    PayerType: string;
    RecipientWarehouseRef: string;
    Note?: string;
  }
): Promise<{ success: boolean; ttn?: string; error?: string }> {
  const data = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      modelName: "AdditionalService",
      calledMethod: "save",
      methodProperties: {
        IntDocNumber: params.IntDocNumber,
        PaymentMethod: params.PaymentMethod,
        PayerType: params.PayerType,
        OrderType: "Redirection",
        RecipientWarehouse: params.RecipientWarehouseRef,
        Note: params.Note || "",
      },
    }),
  });

  if (!data?.success) {
    throw new Error(data?.errors?.join(", ") || "Помилка при створенні переадресації");
  }

  return {
    success: true,
    ttn: data.data?.[0]?.Number || data.data?.[0]?.Ref || "",
  };
}

// method
export async function submitReturn(
  apiKey: string,
  params: {
    IntDocNumber: string;
    PaymentMethod: string;
    PayerType: string;
    ReturnAddressRef?: string;
    RecipientSettlement?: string;
    RecipientWarehouse?: string;
    Note?: string;
  }
): Promise<{ success: boolean; ttn?: string; error?: string }> {
  const data = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      modelName: "AdditionalService",
      calledMethod: "save",
      methodProperties: {
        IntDocNumber: params.IntDocNumber,
        PaymentMethod: params.PaymentMethod,
        PayerType: params.PayerType,
        OrderType: "orderCargoReturn",
        Reason: "49754eb2-a9e1-11e3-9fa0-0050568002cf",
        SubtypeReason: "49754ec8-a9e1-11e3-9fa0-0050568002cf",
        ...(params.ReturnAddressRef && { ReturnAddressRef: params.ReturnAddressRef }),
        ...(params.RecipientSettlement && { RecipientSettlement: params.RecipientSettlement }),
        ...(params.RecipientWarehouse && { RecipientWarehouse: params.RecipientWarehouse }),
        ...(params.Note && { Note: params.Note })
      },
    }),
  });

  if (!data?.success) {
    throw new Error(data?.errors?.join(", ") || "Помилка при замовленні повернення");
  }

  return {
    success: true,
    ttn: data.data?.[0]?.Number || data.data?.[0]?.Ref || "",
  };
}

export async function submitChangeData(
  apiKey: string,
  params: {
    IntDocNumber: string;
    PaymentMethod: string;
    PayerType: string;
    RecipientContactPerson: string;
    RecipientPhone: string;
    BackwardDeliveryData?: any[];
    AfterpaymentOnGoodsCost?: string;
  }
): Promise<{ success: boolean; ttn?: string; error?: string }> {
  const data = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      modelName: "AdditionalService",
      calledMethod: "save",
      methodProperties: {
        IntDocNumber: params.IntDocNumber,
        OrderType: "orderChangeEW",
        RecipientContactPerson: params.RecipientContactPerson,
        RecipientPhone: params.RecipientPhone,
        PaymentMethod: params.PaymentMethod,
        PayerType: params.PayerType,
        BackwardDeliveryData: params.BackwardDeliveryData,
        AfterpaymentOnGoodsCost: params.AfterpaymentOnGoodsCost,
      },
    }),
  });

  if (!data?.success) {
    throw new Error(data?.errors?.join(", ") || "Помилка при зміні даних ТТН");
  }

  return {
    success: true,
    ttn: data.data?.[0]?.Number || data.data?.[0]?.Ref || "",
  };
}

export async function submitProlongStorage(
  apiKey: string,
  params: {
    IntDocNumber: string;
    prolongDate?: string;
    prolongDays?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey || apiKey.startsWith("mock_") || apiKey === "sandbox_key") {
    return { success: true };
  }

  const data = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      modelName: "AdditionalService",
      calledMethod: "save",
      methodProperties: {
        IntDocNumber: params.IntDocNumber,
        OrderType: "orderCargoStorage",
      },
    }),
  });

  if (!data?.success) {
    throw new Error(data?.errors?.join(", ") || "Помилка при оформленні заяви на продовження зберігання");
  }

  return {
    success: true,
  };
}

export interface SenderCounterparty {
  Ref: string;
  Description: string;
  FirstName: string;
  LastName: string;
  MiddleName: string;
  OwnershipFormRef: string;
  OwnershipFormDescription: string;
  EDRPOU: string;
  CounterpartyType: string;
}

export interface SenderContactPerson {
  Ref: string;
  Description: string;
  LastName: string;
  FirstName: string;
  MiddleName: string;
  Phones: string;
  Email: string;
}

export async function getSenderCounterparties(apiKey: string): Promise<SenderCounterparty[]> {
  const data = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      modelName: "Counterparty",
      calledMethod: "getCounterparties",
      methodProperties: {
        CounterpartyProperty: "Sender",
        Page: "1"
      },
    }),
  });

  if (!data?.success) {
    throw new Error(data?.errors?.join(", ") || "Помилка при завантаженні контрагентів відправника");
  }

  return data.data || [];
}

export async function getCounterpartyContactPersons(apiKey: string, counterpartyRef: string): Promise<SenderContactPerson[]> {
  const data = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      modelName: "Counterparty",
      calledMethod: "getCounterpartyContactPersons",
      methodProperties: {
        Ref: counterpartyRef,
        Page: "1"
      },
    }),
  });

  if (!data?.success) {
    throw new Error(data?.errors?.join(", ") || "Помилка при завантаженні контактних осіб");
  }

  return data.data || [];
}

export interface BackwardDelivery {
  PayerType: "Sender" | "Recipient";
  CargoType: "Money" | string;
  RedeliveryString: string;
}

export interface CreateTtnParams {
  SenderRef: string;
  SenderAddressRef: string;
  SenderContactRef: string;
  SenderPhone: string;
  CitySenderRef: string;
  
  CityRecipientRef: string;
  RecipientAddressRef: string;
  RecipientPhone: string;
  RecipientLastName: string;
  RecipientFirstName: string;
  RecipientMiddleName?: string;
  
  Weight: string;
  VolumeGeneral?: string;
  SeatsAmount: string;
  Cost: string;
  Description: string;
  PayerType: "Sender" | "Recipient";
  PaymentMethod: "Cash" | "NonCash";
  CargoType?: string;
  ServiceType?: string;
  BackwardDeliveryData?: BackwardDelivery[];
  AfterpaymentOnGoodsCost?: string;
}

export async function submitCreateTtn(apiKey: string, params: CreateTtnParams): Promise<{ success: boolean; ttn: string; cost: string; estimatedDeliveryDate: string }> {
  // 1. Create recipient counterparty
  const recipientData = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      modelName: "Counterparty",
      calledMethod: "save",
      methodProperties: {
        FirstName: params.RecipientFirstName,
        LastName: params.RecipientLastName,
        MiddleName: params.RecipientMiddleName || "",
        Phone: params.RecipientPhone,
        Email: "",
        CounterpartyType: "PrivatePerson",
        CounterpartyProperty: "Recipient",
      },
    }),
  });

  if (!recipientData?.success) {
    throw new Error(recipientData?.errors?.join(", ") || "Помилка при реєстрації отримувача у базі Нової Пошти");
  }

  const recipientRef = recipientData.data?.[0]?.Ref;
  const recipientContactRef = recipientData.data?.[0]?.ContactPerson?.data?.[0]?.Ref;

  if (!recipientRef || !recipientContactRef) {
    throw new Error("Не вдалося отримати референси створеного отримувача");
  }

  // 2. Prepare today's date in DD.MM.YYYY format
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const formattedDate = `${day}.${month}.${today.getFullYear()}`;

  // 3. Create Internet Document
  const documentProps: any = {
    NewAddress: "1",
    PayerType: params.PayerType,
    PaymentMethod: params.PaymentMethod,
    DateTime: formattedDate,
    CargoType: params.CargoType || "Cargo",
    VolumeGeneral: params.VolumeGeneral || "0.01",
    Weight: params.Weight,
    ServiceType: params.ServiceType || "WarehouseWarehouse",
    SeatsAmount: params.SeatsAmount,
    Description: params.Description,
    Cost: params.Cost,
    
    Sender: params.SenderRef,
    CitySender: params.CitySenderRef,
    SenderAddress: params.SenderAddressRef,
    ContactSender: params.SenderContactRef,
    SendersPhone: params.SenderPhone,
    
    Recipient: recipientRef,
    CityRecipient: params.CityRecipientRef,
    RecipientAddress: params.RecipientAddressRef,
    ContactRecipient: recipientContactRef,
    RecipientsPhone: params.RecipientPhone,
  };

  if (params.BackwardDeliveryData && params.BackwardDeliveryData.length > 0) {
    documentProps.BackwardDeliveryData = params.BackwardDeliveryData;
  }

  if (params.AfterpaymentOnGoodsCost) {
    documentProps.AfterpaymentOnGoodsCost = params.AfterpaymentOnGoodsCost;
  }

  const documentRes = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      modelName: "InternetDocument",
      calledMethod: "save",
      methodProperties: documentProps,
    }),
  });

  if (!documentRes?.success) {
    throw new Error(documentRes?.errors?.join(", ") || "Помилка при створенні ТТН");
  }

  const docData = documentRes.data?.[0];
  if (!docData) {
    throw new Error("Нова Пошта повернула порожню відповідь при створенні ТТН");
  }

  return {
    success: true,
    ttn: docData.IntDocNumber,
    cost: docData.CostOnSite || docData.Cost || "0",
    estimatedDeliveryDate: docData.EstimatedDeliveryDate || "",
  };
}

export async function deleteInternetDocument(apiKey: string, documentRef: string): Promise<{ success: boolean }> {
  const deleteRes = await safeFetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      modelName: "InternetDocument",
      calledMethod: "delete",
      methodProperties: {
        DocumentRefs: [documentRef],
      },
    }),
  });

  if (!deleteRes?.success) {
    throw new Error(deleteRes?.errors?.join(", ") || "Помилка при видаленні ТТН з Нової Пошти");
  }

  return { success: true };
}


