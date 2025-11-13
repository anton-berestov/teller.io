import prisma from "../db.server";

export type ZelleRecipientInput = {
  shop: string;
  recipientName: string;
  recipientEmail: string;
};

export async function getZelleRecipientByShop(shop: string) {
  return prisma.zelleRecipient.findUnique({
    where: { shop },
  });
}

export async function upsertZelleRecipient({
  shop,
  recipientName,
  recipientEmail,
}: ZelleRecipientInput) {
  return prisma.zelleRecipient.upsert({
    where: { shop },
    create: {
      shop,
      recipientName,
      recipientEmail,
    },
    update: {
      recipientName,
      recipientEmail,
    },
  });
}
