import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a user with employment
  // const user = await prisma.user.create({
  //   data: {
  //     email: 'victor@zoracom.com',
  //     firstName: 'Victor',
  //     lastName: 'Ogunwehin',
  //     phone: '08012345678',
  //     gender: 'Male',
  //     role: Role.ADMIN,
  //     employment: {
  //       create: {
  //         role: 'System Admin',
  //         department: 'IT',
  //         jobType: 'Full-Time',
  //       //   duration: 'Permanent',
  //         contractLetter: 'contracts/letter.pdf',
  //         nda: 'nda/nda.pdf',
  //         guarantorForm: 'forms/guarantor.pdf',
  //       },
  //     },
  //   },
  //   include: { employment: true },
  // });

  // const user = await prisma.user.create({
  //   data: {
  //     email: "stephanie@zoracom.com",
  //     firstName: "Stephanie",
  //     lastName: "Alfred",
  //     phone: "09088776543",
  //     gender: "Female",
  //     role: Role.ADMIN
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
