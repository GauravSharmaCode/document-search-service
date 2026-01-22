import { z } from 'zod';

export const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(500, 'Title must not exceed 500 characters'),
  content: z.string().min(1).max(1048576, 'Content must not exceed 1MB'),
  metadata: z.record(z.any()).optional(),
});

export const SearchQuerySchema = z.object({
  q: z.string().min(1, 'Query parameter is required'),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const DocumentIdSchema = z.string().uuid('Invalid document ID format');

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;
export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;
