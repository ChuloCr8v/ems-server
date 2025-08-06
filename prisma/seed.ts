import { JobType, MaritalStatus, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {

await prisma.user.create({
  data: {
    firstName: "Benedict",
    lastName: "Nwosu",
    email: "benedict@zoracom.com",
    phone: "08012345678",
    country: "Nigeria",
    state: "Lagos",
    address: "123 Zoracom Street",
    userRole: Role.ADMIN,
    maritalStatus: MaritalStatus.SINGLE,
    gender: "Male",
    role: "System Admin",
    duration: "6 months",
    jobType: JobType.FULL_TIME,
    departmentId: "cf9ac736-ba22-4629-8093-db31b4008cfd",
    contacts: {
      create: {
        guarantor: {
          create: {
            firstName: "Herd;",
            lastName: "Down",
            email: "down@gmail.com",
            phone: "08012345678",
          },
        },
        emergency: {
        create: {
          firstName: "Blue",
          lastName: "Sheep",
          email: "blue@gmail.com",
          phone: "08087654321",
        },
      },
      }
    }
  },
})

// await prisma.level.create({
//   data: {
//     name: "ADMIN",
//     rank: 1
//   }
// })
  // console.log('✅ Seeded user:', user);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
