import prisma from '../server/lib/prisma.js'
import { generateInviteCode } from '../server/lib/inviteCode.js'

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, inviteCode: true },
    orderBy: { createdAt: 'asc' },
  })

  let updated = 0
  for (const t of tenants) {
    if (t.inviteCode) continue

    // Try a few times in case of rare unique collision
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateInviteCode()
      try {
        await prisma.tenant.update({
          where: { id: t.id },
          data: { inviteCode: code },
        })
        updated++
        console.log(`[inviteCode] ${t.name} (${t.id}) -> ${code}`)
        break
      } catch (err) {
        // Unique collision, retry
        if (String(err?.code) === 'P2002') continue
        throw err
      }
    }
  }

  console.log(`[inviteCode] Backfill complete. Updated ${updated} tenant(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

