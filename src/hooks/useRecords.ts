import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRecords, updateRecord, createRecord } from '../api/records';
import type { PropertyRecord } from '../api/records';
import { toast } from 'sonner';

export const RECORDS_KEY = ['records'] as const;

export function useRecords() {
  return useQuery({
    queryKey: RECORDS_KEY,
    queryFn: fetchRecords,
    staleTime: 15_000,
    refetchInterval: 20_000,
  });
}

export function useUpdateRecord() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PropertyRecord> }) => {
      // onMutate already ran and merged data into the cache entry
      const records = qc.getQueryData<PropertyRecord[]>(RECORDS_KEY);
      const record = records?.find((r) => r.id === id);
      if (!record) throw new Error('Record not found');
      return updateRecord({ ...record, ...data });
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: RECORDS_KEY });
      const prev = qc.getQueryData<PropertyRecord[]>(RECORDS_KEY);
      qc.setQueryData<PropertyRecord[]>(RECORDS_KEY, (old) =>
        old?.map((r) => (r.id === id ? { ...r, ...data } : r)) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(RECORDS_KEY, ctx.prev);
      toast.error('فشل التحديث، تم الرجوع للحالة السابقة');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECORDS_KEY });
    },
  });
}

export function useCreateRecord() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<PropertyRecord, 'id' | 'createdAt' | 'updatedAt'>) =>
      createRecord(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECORDS_KEY });
      toast.success('تم إرسال الطلب بنجاح');
    },
    onError: () => {
      toast.error('فشل الإرسال، حاول مجدداً');
    },
  });
}
