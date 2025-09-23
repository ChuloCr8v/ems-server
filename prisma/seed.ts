// prisma/seed.ts
import { PrismaClient, JobType, Role, Status } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Department
let department = await prisma.department.findFirst({
  where: { name: 'Product Management' },
});

if (!department) {
  department = await prisma.department.create({
    data: {
      name: 'Product & Services',
      // description: 'Handles all engineering and product development tasks',
      // createdById: 'SYSTEM', // adjust to valid user id
      // departmentHeadId: 'SYSTEM', 
    },
  });
}

// Level
let level = await prisma.level.findFirst({
  where: { name: 'Senior' },
});

if (!level) {
  level = await prisma.level.create({
    data: {
      name: 'Senior',
      rank: 3,
    },
  });
}
// userRole: [Role.ADMIN, Role.HR, Role.ASSET_MANAGER, Role.FACILITY],

  // 3. Seed an employee
  const employee = await prisma.user.upsert({
    where: { email: 'victor@zoracom.com' },
    update: {},
    create: {
      firstName: 'Victor',
      lastName: 'Ogunwehin',
      phone: '+23498765432',
      workPhone: '+2349062431702',
      gender: 'MALE', // ensure your schema supports enum/string
      role: 'Software Engineer', // Position
      userRole: Role.ADMIN, // System role
      jobType: JobType.FULL_TIME,
      startDate: new Date(),
      duration: null,
      department: { connect: { id: department.id } },
      level: { connect: { id: level.id } },
      country: 'Nigeria',
      state: 'Lagos',
      address: '123 Broad Street, Lagos',
      maritalStatus: 'SINGLE', // adjust if your schema has enum/string
      email: 'victor@zoracom.com',
      eId: 'EMP12876', // Employee ID
      status: Status.ACTIVE,
      contacts: {
        create: {
          emergency: {
            create: {
              firstName: 'Jane',
              lastName: 'Doe',
              phone: '+2348111111111',
              email: 'jane.doe@example.com',
            },
          },
          guarantor: {
            create: {
              firstName: 'Mike',
              lastName: 'Smith',
              phone: '+2348222222222',
              email: 'mike.smith@example.com',
            },
          },
        },
      },
    },
    include: {
      contacts: {
        include: {
          emergency: true,
          guarantor: true,
        },
      },
      department: true,
      level: true,
    },
  });

  console.log('✅ Department:', department.name);
  console.log('✅ Level:', level.name);
  console.log('✅ Employee:', `${employee.firstName} ${employee.lastName}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
