import { JobType, MaritalStatus, PrismaClient, Role } from '@prisma/client';

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
  //         department: 'cf9ac736-ba22-4629-8093-db31b4008cfd',
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

//    await prisma.user.create({
//     data: {
//       email: "bonaventure@zoracom.com",
//       country: "Nigeria",
//       state: "Lagos",
//       address: "123 Zoracom Street",
//       userRole: Role.ADMIN,
//       maritalStatus: MaritalStatus.SINGLE,
//       // levelId: "",
//       prospect: {
//         create: {
//           firstName: "Bonaventure",
//           lastName: "Ogunwehin",
//           email: "bonaventure@gmail.com",
//           phone: "08012345678", 
//           gender: "Male",
//           role: "System Admin",
//           duration: "3 months",
//           jobType: JobType.FULL_TIME,
//           departmentId: "cf9ac736-ba22-4629-8093-db31b4008cfd",
//     },
//   },
//   contacts: {
//     create: {
//       emergencyContact: {
//         create: {
//           firstName: "Jane",
//           lastName: "Doe",
//           email: "jane21@gmail.com",
//           phoneNumber: "08087654321",
//         }
//       },
//       gurantorContact: {
//         create: {
//           firstName: "John",
//           lastName: "Doe",
//           email: "john700@gmail.com",
//           phoneNumber: "08012345678",
//         },
//       },
//     }
//   },
//   level: {
//     create: {
//       name: "ADMIN",
//       rank: 1
//     }
//   }
// }
//   })

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
