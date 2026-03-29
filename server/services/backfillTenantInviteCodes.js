import prisma from '../lib/prisma.js'
import { generateInviteCode } from '../lib/inviteCode.js'

export async function backfillTenantInviteCodes() {
  const tenants = await prisma.tenant.findMany({
    where: { inviteCode: null },
    select: { id: true },
    take: 2000,
  })

  for (const t of tenants) {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await prisma.tenant.update({
          where: { id: t.id },
          data: { inviteCode: generateInviteCode() },
        })
        break
      } catch (err) {
        if (String(err?.code) === 'P2002') continue
        throw err
      }
    }
  }
}

