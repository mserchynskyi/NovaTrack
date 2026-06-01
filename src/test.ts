async function test() {
  const data = JSON.stringify({
    apiKey: "",
    modelName: "TrackingDocument",
    calledMethod: "getStatusDocuments",
    methodProperties: {
      Documents: [{ DocumentNumber: "20451423319074", Phone: "" }]
    }
  });

  const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data
  });
  const json = await res.json();
  const allStatuses = json.data || [];
  
  const statusMap = new Map();
  allStatuses.forEach(s => statusMap.set(s.Number, s));

  let depth = 0;
  while (depth < 5) {
    const basisTtnList = Array.from(statusMap.values())
      .map(s => s.LastCreatedOnTheBasisNumber)
      .filter((num) => typeof num === "string" && num.trim() !== "" && !statusMap.has(num.trim()));
      
    console.log("depth", depth, "basisTtnList", basisTtnList);

    if (basisTtnList.length === 0) break;

    const basisQuery = basisTtnList.map(num => ({
      DocumentNumber: num.trim(),
      Phone: "",
    }));

    const res2 = await fetch("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: "",
        modelName: "TrackingDocument",
        calledMethod: "getStatusDocuments",
        methodProperties: { Documents: basisQuery },
      }),
    });
    
    const basisStatusData = await res2.json();
    let addedAny = false;
    (basisStatusData.data || []).forEach(s => {
      if (!statusMap.has(s.Number)) {
        console.log("Adding to map:", s.Number);
        statusMap.set(s.Number, s);
        addedAny = true;
      }
    });
    if (!addedAny) break;
    depth++;
  }
  
  const chain = [];
  let current = statusMap.get("20451423319074");
  const visited = new Set(["20451423319074"]);

  while (current && current.LastCreatedOnTheBasisNumber) {
    const nextTtn = String(current.LastCreatedOnTheBasisNumber).trim();
    if (!nextTtn || visited.has(nextTtn)) break;
    visited.add(nextTtn);

    const nextStatus = statusMap.get(nextTtn);
    if (nextStatus) {
      chain.push({ ttn: nextTtn, status: nextStatus.Status, date: nextStatus.DateCreated });
      current = nextStatus;
    } else {
      break;
    }
  }
  console.log("Followed chain:", chain);
  
  // What if we just sorted all visited ones by DateCreated?
  const allVisited = Array.from(visited).filter(t => t !== "20451423319074").map(t => statusMap.get(t));
  allVisited.sort((a,b) => {
      const parseDate = (dstr) => {
          // DD-MM-YYYY HH:mm:ss
          if (!dstr) return 0;
          const [d, t] = dstr.split(' ');
          const [D, M, Y] = d.split('-');
          return new Date(`${Y}-${M}-${D}T${t}`).getTime();
      };
      return parseDate(a.DateCreated) - parseDate(b.DateCreated);
  });
  console.log("Sorted by DateCreated:", allVisited.map(s => ({ ttn: s.Number, status: s.Status, date: s.DateCreated, ownerType: s.OwnerDocumentType })));
}
test();
