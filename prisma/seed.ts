import { JobType, MaritalStatus, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({
    data: {
      firstName: "Olusegun",
      lastName: "Johnson",
      email: "olusegun@zoracom.com",
      phone: "09087654321",
      country: "Nigeria",
      state: "Lagos",
      address: "123 Zoracom Street",
      userRole: Role.ADMIN,
      maritalStatus: MaritalStatus.MARRIED,
      gender: "Male",
      role: "System Engineer",
      // duration: "32 months",
      jobType: JobType.FULL_TIME,
      status: "ACTIVE",
      startDate: new Date("2025-07-25T15:30:00.000Z"),
      eId: "EMP41224",
      // departmentId: "ffffd76d-3852-44a5-af8c-09f556fd0b02",
      contacts: {
        create: {
          guarantor: {
            create: {
              firstName: "Precious",
              lastName: "Green",
              email: "pregreen@gmail.com",
              phone: "08012345678",
            },
          },
          emergency: {
            create: {
              firstName: "John",
              lastName: "Doe",
              email: "bryan@gmail.com",
              phone: "08087654321",
            },
          },
        },
      },
    },
  });

  console.log("✅ Seeded Bonaventure only");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
