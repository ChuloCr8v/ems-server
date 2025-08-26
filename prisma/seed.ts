import { JobType, MaritalStatus, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Bona (ADMIN)
  await prisma.user.create({
    data: {
      firstName: "Modesta",
      lastName: "Wewo",
      email: "bonaventure@zoracom.com",
      phone: "09087654321",
      country: "Nigeria",
      state: "Lagos",
      address: "123 Zoracom Street",
      userRole: Role.ADMIN,
      maritalStatus: MaritalStatus.SINGLE,
      gender: "Male",
      role: "System Engineer",
      duration: "6 months",
      jobType: JobType.FULL_TIME,
      startDate: new Date("2025-07-25T15:30:00.000Z"),
      eId: "EMP41219",
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

  // 10 More Users
  const users = [
    {
      firstName: "Chinedu",
      lastName: "Okafor",
      email: "chinedu.okafor@zoracom.com",
      phone: "08011112221",
      gender: "Male",
      maritalStatus: MaritalStatus.MARRIED,
      role: "Software Engineer",
    },
    {
      firstName: "Amaka",
      lastName: "Eze",
      email: "amaka.eze@zoracom.com",
      phone: "08011112222",
      gender: "Female",
      maritalStatus: MaritalStatus.SINGLE,
      role: "UI/UX Designer",
    },
    {
      firstName: "Ibrahim",
      lastName: "Musa",
      email: "ibrahim.musa@zoracom.com",
      phone: "08011112223",
      gender: "Male",
      maritalStatus: MaritalStatus.MARRIED,
      role: "Network Engineer",
    },
    {
      firstName: "Ngozi",
      lastName: "Chukwu",
      email: "ngozi.chukwu@zoracom.com",
      phone: "08011112224",
      gender: "Female",
      maritalStatus: MaritalStatus.SINGLE,
      role: "Product Manager",
    },
    {
      firstName: "David",
      lastName: "Adeyemi",
      email: "david.adeyemi@zoracom.com",
      phone: "08011112225",
      gender: "Male",
      maritalStatus: MaritalStatus.MARRIED,
      role: "Data Analyst",
    },
    {
      firstName: "Fatima",
      lastName: "Bello",
      email: "fatima.bello@zoracom.com",
      phone: "08011112226",
      gender: "Female",
      maritalStatus: MaritalStatus.SINGLE,
      role: "HR Manager",
    },
    {
      firstName: "Emeka",
      lastName: "Obi",
      email: "emeka.obi@zoracom.com",
      phone: "08011112227",
      gender: "Male",
      maritalStatus: MaritalStatus.MARRIED,
      role: "Backend Developer",
    },
    {
      firstName: "Aisha",
      lastName: "Yusuf",
      email: "aisha.yusuf@zoracom.com",
      phone: "08011112228",
      gender: "Female",
      maritalStatus: MaritalStatus.SINGLE,
      role: "Frontend Developer",
    },
    {
      firstName: "Samuel",
      lastName: "Oluwaseun",
      email: "samuel.oluwaseun@zoracom.com",
      phone: "08011112229",
      gender: "Male",
      maritalStatus: MaritalStatus.SINGLE,
      role: "QA Engineer",
    },
    {
      firstName: "Grace",
      lastName: "Ifeanyi",
      email: "grace.ifeanyi@zoracom.com",
      phone: "08011112230",
      gender: "Female",
      maritalStatus: MaritalStatus.MARRIED,
      role: "Business Analyst",
    },
  ];

  // let counter = 1;
  // for (const u of users) {
  //   await prisma.user.create({
  //     data: {
  //       ...u,
  //       country: "Nigeria",
  //       state: counter % 2 === 0 ? "Lagos" : "Abuja",
  //       address: `${counter} Zoracom Close`,
  //       userRole: Role.USER,
  //       duration: counter % 2 === 0 ? "1 year" : "6 months",
  //       jobType: counter % 2 === 0 ? JobType.CONTRACT : JobType.FULL_TIME,
  //       startDate: new Date(`2025-08-${(counter + 10).toString().padStart(2, "0")}T09:00:00.000Z`),
  //       eId: `EMP30${counter}`,
  //       // departmentId: "ffffd76d-3852-44a5-af8c-09f556fd0b02",
  //       contacts: {
  //         create: {
  //           guarantor: {
  //             create: {
  //               firstName: `Guarantor${counter}`,
  //               lastName: "Okoro",
  //               email: `guarantor${counter}@mail.com`,
  //               phone: `070111111${counter}`,
  //             },
  //           },
  //           emergency: {
  //             create: {
  //               firstName: `Emergency${counter}`,
  //               lastName: "Uche",
  //               email: `emergency${counter}@mail.com`,
  //               phone: `070999999${counter}`,
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });
  //   counter++;
  // }

  console.log("✅ Seeded Bona + 10 real users");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
