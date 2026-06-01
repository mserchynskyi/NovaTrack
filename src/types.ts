export interface NpAccount {
  id: string;
  name: string;
  apiKey: string;
}

export interface Parcel {
  ttn: string;
  accountName: string;
  accountId: string;
  status: string;
  statusCode: string;
  sender: string;
  recipient: string;
  cost: string;
  cityName: string;
  weight: string;
  estimatedDeliveryDate: string;
  actualDeliveryDate: string;
  dateCreated: string;
  rawDoc?: any;
  rawStatus?: any;
  basisTtn?: string;
  basisStatus?: string;
  basisStatusCode?: string;
  basisChain?: any[];
}
