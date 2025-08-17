export interface ImportedRow {
  A?: string;
  B?: string;
  G?: string;
  [key: string]: any;
}

export type Region = 'Todos' | 'São Paulo' | 'Rio De Janeiro' | 'Nespresso' | 'Dafiti';

export interface DeliveryData {
  id: string;
  driver: string;
  deliveryPercentage: number;
  routes: number;
  totalOrders: number;
  delivered: number;
  pending: number;
  unsuccessful: number;
  routePercentage: number;
  region: Region;
  serviceCodes: string[];
  successfulCodes: string[];
  unsuccessfulCodes: string[];
  senderMap: { [key: string]: string };
}

export interface ProcessedData {
  drivers: {
    [key: string]: {
      totalOrders: number;
      region: Region;
      serviceCodes: string[];
    }
  };
}