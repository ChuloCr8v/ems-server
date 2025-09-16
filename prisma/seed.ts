import { JobType, MaritalStatus, PrismaClient, Role, Status } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      firstName: "Bona",
      lastName: "Wewo",
      email: "bonaventure@zoracom.com",
      phone: "08044556677",
      country: "Nigeria",
      state: "Ogun",
      address: "88 Abeokuta Road",
      userRole: [Role.ADMIN, Role.HR, Role.ASSET_MANAGER, Role.FACILITY, Role.LEAVE_MANAGER],
      maritalStatus: MaritalStatus.MARRIED,
      gender: "Male",
      role: "Asset Manager",
      duration: "2 years",
      jobType: JobType.FULL_TIME,
      status: Status.ACTIVE,
      startDate: new Date("2025-07-20T11:00:00.000Z"),
      eId: "EMP41225",
    },
    {
      firstName: "Benedict",
      lastName: "Nwosu",
      email: "benedict@zoracom.com",
      phone: "09087654321",
      country: "Nigeria",
      state: "Lagos",
      address: "123 Zoracom Street",
      userRole: [Role.ADMIN, Role.HR, Role.ASSET_MANAGER, Role.FACILITY],
      maritalStatus: MaritalStatus.SINGLE,
      gender: "Female",
      role: "System Engineer",
      duration: "6 months",
      jobType: JobType.FULL_TIME,
      status: Status.ACTIVE,
      startDate: new Date("2025-07-25T15:30:00.000Z"),
      eId: "EMP41219",
    },
    {
      firstName: "Modesta",
      lastName: "Ekeh",
      email: "modesta@zoracom.com",
      phone: "08123456789",
      country: "Nigeria",
      state: "Abuja",
      address: "45 Unity Road",
      userRole: [Role.ADMIN, Role.HR, Role.ASSET_MANAGER, Role.FACILITY],
      maritalStatus: MaritalStatus.MARRIED,
      gender: "Male",
      role: "Software Developer",
      duration: "1 year",
      jobType: JobType.CONTRACT,
      status: Status.ACTIVE,
      startDate: new Date("2025-08-01T09:00:00.000Z"),
      eId: "EMP41220",
    },
    {
      firstName: "Olusegun",
      lastName: "Michael",
      email: "olusegun@zoracom.com",
      phone: "07033445566",
      country: "Nigeria",
      state: "Enugu",
      address: "7 Ogui Road",
      userRole: [Role.ADMIN, Role.HR, Role.ASSET_MANAGER, Role.FACILITY],
      maritalStatus: MaritalStatus.SINGLE,
      gender: "Male",
      role: "HR Officer",
      duration: "2 years",
      jobType: JobType.FULL_TIME,
      status: Status.ACTIVE,
      startDate: new Date("2025-07-15T10:00:00.000Z"),
      eId: "EMP41221",
    },
    {
      firstName: "Mistura",
      lastName: "Saraudeen",
      email: "mistura@zoracom.com",
      phone: "08099887766",
      country: "Nigeria",
      state: "Port Harcourt",
      address: "12 Aba Road",
      userRole: [Role.FACILITY],
      maritalStatus: MaritalStatus.MARRIED,
      gender: "Female",
      role: "Facility Manager",
      duration: "3 years",
      jobType: JobType.FULL_TIME,
      status: Status.ACTIVE,
      startDate: new Date("2025-09-10T08:30:00.000Z"),
      eId: "EMP41222",
    },
    {
      firstName: "Victor",
      lastName: "Ogunwehin",
      email: "victor@zoracom.com",
      phone: "08011223344",
      country: "Nigeria",
      state: "Ibadan",
      address: "5 Ring Road",
      userRole: [Role.ADMIN, Role.HR, Role.ASSET_MANAGER, Role.FACILITY],
      maritalStatus: MaritalStatus.SINGLE,
      gender: "Male",
      role: "Accountant",
      duration: "8 months",
      jobType: JobType.FULL_TIME,
      status: Status.ACTIVE,
      startDate: new Date("2025-06-05T09:00:00.000Z"),
      eId: "EMP41223",
    },
    {
      firstName: "Stephanie",
      lastName: "Alfred",
      email: "stephanie@zoracom.com",
      phone: "08199887755",
      country: "Nigeria",
      state: "Anambra",
      address: "23 Nkpor Road",
      userRole: [Role.ADMIN, Role.HR, Role.ASSET_MANAGER, Role.FACILITY],
      maritalStatus: MaritalStatus.SINGLE,
      gender: "Female",
      role: "Recruiter",
      duration: "1 year",
      jobType: JobType.CONTRACT,
      status: Status.ACTIVE,
      startDate: new Date("2025-08-12T10:15:00.000Z"),
      eId: "EMP41224",
    },
    {
      firstName: "Joy",
      lastName: "Ubani",
      email: "joy@zoracom.com",
      phone: "08122334455",
      country: "Nigeria",
      state: "Kano",
      address: "21 Airport Road",
      userRole: [Role.ADMIN, Role.HR, Role.ASSET_MANAGER, Role.FACILITY],
      maritalStatus: MaritalStatus.SINGLE,
      gender: "Female",
      role: "Customer Support",
      duration: "1 year",
      jobType: JobType.FULL_TIME,
      status: Status.ACTIVE,
      startDate: new Date("2025-08-05T14:30:00.000Z"),
      eId: "EMP41227", // ✅ fixed unique
    },
  ];

  for (const user of users) {
    await prisma.user.create({
      data: {
        ...user,
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
  }

  console.log("✅ Seeded 9 users successfully");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
