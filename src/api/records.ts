import { apiFetch } from './client';

export interface PropertyRecord {
  id: number;
  location: string;
  city: string;
  region: string;
  area_m2: string;
  price: string;
  currency: string;
  contract_duration_years: string;
  building_status: string;
  expected_completion_min_months: string;
  expected_completion_max_months: string;
  raw_text: string;
  Status: 'APPROVED' | 'REJECTED' | null;
  createdAt: string;
  updatedAt: string;
}

export type RecordStatus = 'APPROVED' | 'REJECTED' | null;

export async function fetchRecords(): Promise<PropertyRecord[]> {
  return apiFetch<PropertyRecord[]>('/webhook/api/list');
}

export async function updateRecord(record: PropertyRecord): Promise<PropertyRecord> {
  return apiFetch<PropertyRecord>('/webhook/api/list', {
    method: 'PATCH',
    body: JSON.stringify(record),
  });
}

export async function createRecord(
  data: Omit<PropertyRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PropertyRecord> {
  return apiFetch<PropertyRecord>('/webhook/api/list', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
