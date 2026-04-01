import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Categories ────────────────────────────────────────────────────────────
  const categoryNames = [
    'Food', 'Pets', 'CPG', 'Documentary',
    'Automotive', 'Healthcare', 'Tech', 'Fashion',
  ];

  const categories = await Promise.all(
    categoryNames.map((name) =>
      prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  const catMap = Object.fromEntries(categories.map((c) => [c.name, c]));

  // ── Clients ───────────────────────────────────────────────────────────────
  const clientApex = await prisma.client.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Apex Foods',
      color_hex: 'C4512A',
    },
  });

  const clientOlio = await prisma.client.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Olio Pet Co.',
      color_hex: '2E6FBE',
    },
  });

  const clientKova = await prisma.client.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Kova Insurance',
      color_hex: '4A42A8',
    },
  });

  // ── Users ─────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10);

  const userEP = await prisma.user.upsert({
    where: { email: 'ep@hippo.co' },
    update: {},
    create: {
      email: 'ep@hippo.co',
      password_hash: passwordHash,
      role: 'EP',
      name: 'Morgan Chen',
    },
  });

  const userProducer1 = await prisma.user.upsert({
    where: { email: 'producer@hippo.co' },
    update: {},
    create: {
      email: 'producer@hippo.co',
      password_hash: passwordHash,
      role: 'PRODUCER',
      name: 'Jamie Rivera',
    },
  });

  const userProducer2 = await prisma.user.upsert({
    where: { email: 'producer2@hippo.co' },
    update: {},
    create: {
      email: 'producer2@hippo.co',
      password_hash: passwordHash,
      role: 'PRODUCER',
      name: 'Alex Kim',
    },
  });

  const userAssoc = await prisma.user.upsert({
    where: { email: 'assoc@hippo.co' },
    update: {},
    create: {
      email: 'assoc@hippo.co',
      password_hash: passwordHash,
      role: 'ASSOC_PRODUCER',
      name: 'Taylor Brooks',
    },
  });

  const userIntern = await prisma.user.upsert({
    where: { email: 'intern@hippo.co' },
    update: {},
    create: {
      email: 'intern@hippo.co',
      password_hash: passwordHash,
      role: 'INTERN',
      name: 'Sam Park',
    },
  });

  // ── Partners ──────────────────────────────────────────────────────────────
  const partner1 = await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      company_name: 'Meridian Films',
      type: 'Production company',
      location: 'Los Angeles, CA',
      notes: 'Strong food & lifestyle work.',
    },
  });

  const partner2 = await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      company_name: 'Atlas Post',
      type: 'Post-production',
      location: 'New York, NY',
      notes: 'Award-winning color and VFX.',
    },
  });

  const partner3 = await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000103' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000103',
      company_name: 'Wildlight Studios',
      type: 'Production company',
      location: 'Austin, TX',
      notes: 'Documentary and branded content specialists.',
    },
  });

  // Partner contacts
  await prisma.partnerContact.createMany({
    // skipDuplicates not supported on SQLite
    data: [
      {
        partner_id: partner1.id,
        name: 'Dana Torres',
        title: 'Executive Producer',
        email: 'dana@meridianfilms.com',
        phone: '310-555-0101',
      },
      {
        partner_id: partner2.id,
        name: 'Ryan Okafor',
        title: 'Head of Post',
        email: 'ryan@atlaspost.com',
        phone: '212-555-0202',
      },
      {
        partner_id: partner3.id,
        name: 'Priya Nair',
        title: 'Executive Producer',
        email: 'priya@wildlight.com',
        phone: '512-555-0303',
      },
    ],
  });

  // Partner specialities
  await prisma.partnerSpeciality.createMany({
    // skipDuplicates not supported on SQLite
    data: [
      { partner_id: partner1.id, name: 'Tabletop' },
      { partner_id: partner1.id, name: 'Lifestyle' },
      { partner_id: partner2.id, name: 'Color grading' },
      { partner_id: partner2.id, name: 'VFX' },
      { partner_id: partner3.id, name: 'Documentary' },
      { partner_id: partner3.id, name: 'Branded content' },
    ],
  });

  // Partner categories
  await prisma.partnerCategory.createMany({
    // skipDuplicates not supported on SQLite
    data: [
      { partner_id: partner1.id, category_id: catMap['Food'].id },
      { partner_id: partner1.id, category_id: catMap['CPG'].id },
      { partner_id: partner2.id, category_id: catMap['Tech'].id },
      { partner_id: partner3.id, category_id: catMap['Documentary'].id },
    ],
  });

  // ── Projects ──────────────────────────────────────────────────────────────
  const today = new Date();
  const addDays = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };

  const project1 = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000201' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000201',
      client_id: clientApex.id,
      name: 'Summer Campaign :30',
      status: 'ACTIVE',
      due_date: addDays(today, 30),
      notes: 'Hero spot for summer grilling season. Deliverables: 1x :30, 2x :15 cutdowns, social package.',
    },
  });

  const project2 = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000202' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000202',
      client_id: clientApex.id,
      name: 'Holiday Recipe Series',
      status: 'ACTIVE',
      due_date: addDays(today, 60),
      notes: 'Six-part digital series for Q4 holiday push.',
    },
  });

  const project3 = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000203' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000203',
      client_id: clientOlio.id,
      name: 'Rescue Stories Campaign',
      status: 'ACTIVE',
      due_date: addDays(today, 45),
      notes: 'Emotional brand campaign featuring pet rescue stories.',
    },
  });

  const project4 = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000204' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000204',
      client_id: clientKova.id,
      name: 'Brand Refresh :60',
      status: 'PAUSED',
      due_date: addDays(today, 90),
      notes: 'Full brand identity refresh spot. On hold pending creative approval.',
    },
  });

  const project5 = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000205' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000205',
      client_id: clientOlio.id,
      name: 'Product Launch :15s',
      status: 'COMPLETED',
      due_date: addDays(today, -10),
      notes: 'New kibble product launch. Delivered.',
    },
  });

  // ── Budget line items ─────────────────────────────────────────────────────
  await prisma.budgetLineItem.createMany({
    // skipDuplicates not supported on SQLite
    data: [
      { project_id: project1.id, label: 'Pre-production', amount_cents: 1500000, sort_order: 1 },
      { project_id: project1.id, label: 'Production day', amount_cents: 4500000, sort_order: 2 },
      { project_id: project1.id, label: 'Color grading', amount_cents: 800000, sort_order: 3 },
      { project_id: project1.id, label: 'Sound mix', amount_cents: 350000, sort_order: 4 },
      { project_id: project1.id, label: 'Agency fee', amount_cents: 720000, is_agency_fee: true, sort_order: 5 },
      { project_id: project2.id, label: 'Pre-production', amount_cents: 900000, sort_order: 1 },
      { project_id: project2.id, label: 'Production (3 days)', amount_cents: 6000000, sort_order: 2 },
      { project_id: project2.id, label: 'Post-production', amount_cents: 1200000, sort_order: 3 },
      { project_id: project2.id, label: 'Agency fee', amount_cents: 810000, is_agency_fee: true, sort_order: 4 },
      { project_id: project3.id, label: 'Pre-production', amount_cents: 600000, sort_order: 1 },
      { project_id: project3.id, label: 'Production (2 days)', amount_cents: 3200000, sort_order: 2 },
      { project_id: project3.id, label: 'Post-production', amount_cents: 950000, sort_order: 3 },
      { project_id: project3.id, label: 'Agency fee', amount_cents: 475000, is_agency_fee: true, sort_order: 4 },
    ],
  });

  // ── Milestones ────────────────────────────────────────────────────────────
  await prisma.milestone.createMany({
    // skipDuplicates not supported on SQLite
    data: [
      {
        project_id: project1.id,
        assignee_id: userProducer1.id,
        name: 'Treatment review',
        start_date: addDays(today, -5),
        end_date: addDays(today, -3),
        completed: true,
        sort_order: 1,
      },
      {
        project_id: project1.id,
        assignee_id: userProducer1.id,
        name: 'Production shoot',
        start_date: addDays(today, 5),
        end_date: addDays(today, 6),
        completed: false,
        sort_order: 2,
      },
      {
        project_id: project1.id,
        assignee_id: userAssoc.id,
        name: 'First color pass',
        start_date: addDays(today, 10),
        end_date: addDays(today, 14),
        completed: false,
        sort_order: 3,
      },
      {
        project_id: project1.id,
        assignee_id: userProducer1.id,
        name: 'Client delivery',
        start_date: addDays(today, 28),
        end_date: addDays(today, 30),
        completed: false,
        sort_order: 4,
      },
      {
        project_id: project2.id,
        assignee_id: userProducer2.id,
        name: 'Concept approval',
        start_date: addDays(today, 2),
        end_date: addDays(today, 5),
        completed: false,
        sort_order: 1,
      },
      {
        project_id: project3.id,
        assignee_id: userProducer1.id,
        name: 'Casting',
        start_date: addDays(today, 3),
        end_date: addDays(today, 7),
        completed: false,
        sort_order: 1,
      },
    ],
  });

  // ── Team members ──────────────────────────────────────────────────────────
  await prisma.projectTeamMember.createMany({
    // skipDuplicates not supported on SQLite
    data: [
      { project_id: project1.id, user_id: userEP.id, role_label: 'Executive Producer' },
      { project_id: project1.id, user_id: userProducer1.id, role_label: 'Producer' },
      { project_id: project1.id, user_id: userAssoc.id, role_label: 'Associate Producer' },
      { project_id: project2.id, user_id: userEP.id, role_label: 'Executive Producer' },
      { project_id: project2.id, user_id: userProducer2.id, role_label: 'Producer' },
      { project_id: project3.id, user_id: userProducer1.id, role_label: 'Producer' },
      { project_id: project3.id, user_id: userIntern.id, role_label: 'Production Intern' },
      { project_id: project4.id, user_id: userEP.id, role_label: 'Executive Producer' },
      { project_id: project4.id, user_id: userProducer2.id, role_label: 'Producer' },
    ],
  });

  // ── Project categories ────────────────────────────────────────────────────
  await prisma.projectCategory.createMany({
    // skipDuplicates not supported on SQLite
    data: [
      { project_id: project1.id, category_id: catMap['Food'].id },
      { project_id: project2.id, category_id: catMap['Food'].id },
      { project_id: project3.id, category_id: catMap['Pets'].id },
      { project_id: project4.id, category_id: catMap['Healthcare'].id },
      { project_id: project5.id, category_id: catMap['Pets'].id },
    ],
  });

  // ── Project partners ──────────────────────────────────────────────────────
  await prisma.projectPartner.createMany({
    // skipDuplicates not supported on SQLite
    data: [
      { project_id: project1.id, partner_id: partner1.id },
      { project_id: project1.id, partner_id: partner2.id },
      { project_id: project3.id, partner_id: partner3.id },
    ],
  });

  console.log('Seed complete.');
  console.log('\nTest accounts (password: password123):');
  console.log('  EP:             ep@hippo.co');
  console.log('  Producer:       producer@hippo.co');
  console.log('  Producer 2:     producer2@hippo.co');
  console.log('  Assoc Producer: assoc@hippo.co');
  console.log('  Intern:         intern@hippo.co');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
