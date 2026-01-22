import prisma from '../db/prisma';
import { Document, Prisma } from '@prisma/client';

export { Document };

export interface CreateDocumentData {
  title: string;
  content: string;
  metadata?: any;
}

export const create = async (
  tenantId: string,
  data: CreateDocumentData
): Promise<Document> => {
  const document = await prisma.document.create({
    data: {
      tenant_id: tenantId,
      title: data.title,
      content: data.content,
      metadata: data.metadata ?? Prisma.JsonNull,
    },
  });
  return document;
};

export const findById = async (
  tenantId: string,
  id: string
): Promise<Document | null> => {
  const document = await prisma.document.findUnique({
    where: {
      id: id,
    },
  });

  if (document && document.tenant_id === tenantId && !document.deleted_at) {
    return document;
  }
  
  return null;
};

export const softDelete = async (
  tenantId: string,
  id: string
): Promise<boolean> => {
  // First check if it exists and belongs to tenant
  const existing = await findById(tenantId, id);
  if (!existing) {
    return false;
  }

  await prisma.document.update({
    where: {
      id: id,
    },
    data: {
      deleted_at: new Date(),
    },
  });

  return true;
};

export default {
  create,
  findById,
  softDelete,
};
