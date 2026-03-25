import bcrypt from 'bcrypt'
import prisma from '../server/lib/prisma.js'

const email = (process.env.OPS_ADMIN_EMAIL || '').trim().toLowerCase()
const password = process.env.OPS_ADMIN_PASSWORD || ''

if (!email || !password) {
  console.error('Missing env: OPS_ADMIN_EMAIL and OPS_ADMIN_PASSWORD')
  process.exit(1)
}

async function main() {
  console.log('Creating/updating OpsUser for:', email)

  const passwordHash = await bcrypt.hash(password, 12)

  const existing = await prisma.opsUser.findUnique({ where: { email } })

  if (existing) {
    await prisma.opsUser.update({
      where: { email },
      data: {
        passwordHash,
      },
    })
    console.log('OpsUser updated')
  } else {
    await prisma.opsUser.create({
      data: {
        email,
        passwordHash,
        name: email.split('@')[0],
        role: 'ADMIN',
        isActive: true,
      },
    })
    console.log('OpsUser created')
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
