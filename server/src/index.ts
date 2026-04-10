import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import prisma from './lib/prisma';
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import clientRoutes from './routes/clients';
import projectRoutes from './routes/projects';
import milestoneRoutes from './routes/milestones';
import budgetRoutes from './routes/budget';
import partnerRoutes from './routes/partners';
import scoutRoutes from './routes/scout';
import googleRoutes from './routes/google';
import categoryRoutes from './routes/categories';
import teamMemberRoutes from './routes/teamMembers';
import budgetScenarioRoutes from './routes/budgetScenarios';

const app = express();
const PORT = process.env.PORT ?? 3001;
const isProd = process.env.NODE_ENV === 'production';

// In development allow cross-origin requests from the Vite dev server
if (!isProd) {
  app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
}

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Public routes (no auth required)
app.use('/api/v1/auth', authRoutes);
app.use('/auth/google', googleRoutes);

// Protected routes (JWT required)
app.use('/api/v1/users', authenticateToken, userRoutes);
app.use('/api/v1/clients', authenticateToken, clientRoutes);
app.use('/api/v1/projects', authenticateToken, projectRoutes);
app.use('/api/v1/projects/:id/milestones', authenticateToken, milestoneRoutes);
app.use('/api/v1/projects/:id/budget', authenticateToken, budgetRoutes);
app.use('/api/v1/partners', authenticateToken, partnerRoutes);
app.use('/api/v1/scout', authenticateToken, scoutRoutes);
app.use('/api/v1/categories', authenticateToken, categoryRoutes);
app.use('/api/v1/team-members', authenticateToken, teamMemberRoutes);
app.use('/api/v1/budget-scenarios', authenticateToken, budgetScenarioRoutes);

// In production, serve the React build and handle SPA routing
if (isProd) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('/*path', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global error handler
app.use(errorHandler);

async function seedProd() {
  if (!isProd) return;
  try {
    // ── Admin user ────────────────────────────────────────────────────────────
    const hash = await bcrypt.hash('mifflin2026', 10);
    await prisma.user.upsert({
      where: { email: 'michael@hippomifflin.app' },
      update: {},
      create: {
        email: 'michael@hippomifflin.app',
        password_hash: hash,
        role: 'EP',
        name: 'Michael Scott',
        title: 'Executive Producer',
      },
    });

    // Guard: skip rich seed if data already exists
    const alreadySeeded = await prisma.client.findFirst({ where: { name: 'Dunder Mifflin' } });
    if (alreadySeeded) {
      console.log('✔  Hippo-Mifflin seed complete — michael@hippomifflin.app ready');
      return;
    }

    // ── Categories ────────────────────────────────────────────────────────────
    const [commercial, brandFilm, social, documentary, corporate] = await Promise.all([
      prisma.category.create({ data: { name: 'Commercial' } }),
      prisma.category.create({ data: { name: 'Brand Film' } }),
      prisma.category.create({ data: { name: 'Social Content' } }),
      prisma.category.create({ data: { name: 'Documentary' } }),
      prisma.category.create({ data: { name: 'Corporate Video' } }),
    ]);

    // ── Clients ───────────────────────────────────────────────────────────────
    const dm    = await prisma.client.create({ data: { name: 'Dunder Mifflin',             color_hex: '2563A2' } });
    const sabre = await prisma.client.create({ data: { name: 'Sabre Corporation',          color_hex: 'E8391D' } });
    const mspc  = await prisma.client.create({ data: { name: 'Michael Scott Paper Co.',    color_hex: '3DAA6E' } });
    const vance = await prisma.client.create({ data: { name: 'Vance Refrigeration',        color_hex: '8B4CB8' } });

    // ── Production partners ───────────────────────────────────────────────────
    const lp = await prisma.partner.create({
      data: {
        company_name: 'Lackawanna Productions',
        type: 'Production Company',
        location: 'Scranton, PA',
        notes: 'Local production house with strong commercial experience.',
        contacts: { create: [{ name: 'Bob Vance', title: 'Executive Producer', email: 'bob@lackawanna.com', phone: '570-555-0100' }] },
      },
    });
    const ss = await prisma.partner.create({
      data: {
        company_name: 'Scranton Studio',
        type: 'Post House',
        location: 'Scranton, PA',
        notes: 'Full-service post house. Great for quick-turnaround projects.',
        contacts: { create: [{ name: 'Meredith Palmer', title: 'Studio Manager', email: 'meredith@scrantonstudio.com', phone: '570-555-0120' }] },
      },
    });
    const pif = await prisma.partner.create({
      data: {
        company_name: 'Print It Forward',
        type: 'Photography Studio',
        location: 'Scranton, PA',
        notes: 'Paper and print specialists. Strong brand photography portfolio.',
        contacts: { create: [{ name: 'Creed Bratton', title: 'Director of Photography', email: 'creed@printitforward.com', phone: '570-555-0199' }] },
      },
    });

    // ── Team members ──────────────────────────────────────────────────────────
    // Post team (post = true)
    const jim    = await prisma.teamMember.create({ data: { name: 'Jim Halpert',   title: 'Senior Editor',     email: 'jim@dundermifflin.com',    post: true  } });
    const pam    = await prisma.teamMember.create({ data: { name: 'Pam Beesly',    title: 'Motion Graphics',   email: 'pam@dundermifflin.com',    post: true  } });
    const dwight = await prisma.teamMember.create({ data: { name: 'Dwight Schrute',title: 'Colorist',          email: 'dwight@dundermifflin.com', post: true  } });
    const kevin  = await prisma.teamMember.create({ data: { name: 'Kevin Malone',  title: 'Audio Engineer',    email: 'kevin@dundermifflin.com',  post: true  } });
    // Creative directors (post = false)
    const oscar  = await prisma.teamMember.create({ data: { name: 'Oscar Martinez',title: 'Creative Director', email: 'oscar@dundermifflin.com',  post: false } });
    const kelly  = await prisma.teamMember.create({ data: { name: 'Kelly Kapoor',  title: 'Creative Director', email: 'kelly@dundermifflin.com',  post: false } });
    // Engagement managers (post = false)
    const andy   = await prisma.teamMember.create({ data: { name: 'Andy Bernard',  title: 'Engagement Manager',email: 'andy@dundermifflin.com',   post: false } });
    const phyllis= await prisma.teamMember.create({ data: { name: 'Phyllis Vance', title: 'Engagement Manager',email: 'phyllis@dundermifflin.com',post: false } });

    // ── Project 1: Paper Empire Campaign — Dunder Mifflin — ACTIVE ───────────
    const p1 = await prisma.project.create({
      data: {
        client_id: dm.id,
        name: 'Paper Empire Campaign',
        status: 'ACTIVE',
        due_date: new Date('2026-04-18'),
        notes: 'Brand awareness campaign for the Scranton branch. Focus on quality and reliability messaging.',
        categories: { create: [{ category_id: commercial.id }] },
      },
    });
    await prisma.projectMember.createMany({ data: [
      { project_id: p1.id, team_member_id: jim.id,    role_label: 'Lead Editor' },
      { project_id: p1.id, team_member_id: pam.id,    role_label: 'Motion Graphics' },
      { project_id: p1.id, team_member_id: oscar.id,  role_label: 'Creative Director' },
      { project_id: p1.id, team_member_id: andy.id,   role_label: 'Engagement Manager' },
    ]});
    await prisma.projectPartner.create({ data: { project_id: p1.id, partner_id: lp.id } });
    await prisma.milestone.createMany({ data: [
      { project_id: p1.id, name: 'Pre-production Brief', tm_assignee_id: oscar.id,  start_date: new Date('2026-02-10'), end_date: new Date('2026-02-14'), completed: true,  sort_order: 1 },
      { project_id: p1.id, name: 'Rough Cut',            tm_assignee_id: jim.id,    start_date: new Date('2026-03-10'), end_date: new Date('2026-03-28'), completed: true,  sort_order: 2 },
      { project_id: p1.id, name: 'Client Review',        tm_assignee_id: andy.id,   start_date: new Date('2026-04-01'), end_date: new Date('2026-04-03'), completed: false, sort_order: 3 },
      { project_id: p1.id, name: 'Motion Graphics',      tm_assignee_id: pam.id,    start_date: new Date('2026-04-01'), end_date: new Date('2026-04-08'), completed: false, sort_order: 4 },
      { project_id: p1.id, name: 'Final Delivery',       tm_assignee_id: jim.id,    start_date: new Date('2026-04-14'), end_date: new Date('2026-04-18'), completed: false, sort_order: 5 },
    ]});
    await prisma.budgetLineItem.createMany({ data: [
      { project_id: p1.id, label: 'Director',        amount_cents: 1800000, actuals_cents: 1800000, sort_order: 1 },
      { project_id: p1.id, label: 'Editor',          amount_cents:  950000, actuals_cents:  780000, sort_order: 2 },
      { project_id: p1.id, label: 'Motion Graphics', amount_cents:  600000, actuals_cents:       0, sort_order: 3 },
      { project_id: p1.id, label: 'Color Grade',     amount_cents:  350000, actuals_cents:       0, sort_order: 4 },
      { project_id: p1.id, label: 'Agency fee',      amount_cents:  718000, actuals_cents:  390000, is_agency_fee: true, sort_order: 5 },
    ]});

    // ── Project 2: Sabre Printer Launch — Sabre — ACTIVE ─────────────────────
    const p2 = await prisma.project.create({
      data: {
        client_id: sabre.id,
        name: 'Sabre Printer Launch',
        status: 'ACTIVE',
        due_date: new Date('2026-04-25'),
        notes: 'Product launch video for the new Sabre printer line. Emphasize design and speed. Must not show fire.',
        categories: { create: [{ category_id: commercial.id }, { category_id: social.id }] },
      },
    });
    await prisma.projectMember.createMany({ data: [
      { project_id: p2.id, team_member_id: dwight.id,  role_label: 'Lead Editor / Colorist' },
      { project_id: p2.id, team_member_id: kevin.id,   role_label: 'Audio Engineer' },
      { project_id: p2.id, team_member_id: kelly.id,   role_label: 'Creative Director' },
      { project_id: p2.id, team_member_id: phyllis.id, role_label: 'Engagement Manager' },
    ]});
    await prisma.projectPartner.create({ data: { project_id: p2.id, partner_id: ss.id } });
    await prisma.milestone.createMany({ data: [
      { project_id: p2.id, name: 'Offline Edit',    tm_assignee_id: dwight.id, start_date: new Date('2026-03-15'), end_date: new Date('2026-03-31'), completed: true,  sort_order: 1 },
      { project_id: p2.id, name: 'Color Grade',     tm_assignee_id: dwight.id, start_date: new Date('2026-04-01'), end_date: new Date('2026-04-10'), completed: false, sort_order: 2 },
      { project_id: p2.id, name: 'Sound Mix',       tm_assignee_id: kevin.id,  start_date: new Date('2026-04-07'), end_date: new Date('2026-04-14'), completed: false, sort_order: 3 },
      { project_id: p2.id, name: 'Social Cuts',     tm_assignee_id: dwight.id, start_date: new Date('2026-04-14'), end_date: new Date('2026-04-20'), completed: false, sort_order: 4 },
      { project_id: p2.id, name: 'Final Delivery',  tm_assignee_id: kevin.id,  start_date: new Date('2026-04-22'), end_date: new Date('2026-04-25'), completed: false, sort_order: 5 },
    ]});
    await prisma.budgetLineItem.createMany({ data: [
      { project_id: p2.id, label: 'Director',          amount_cents: 2200000, actuals_cents: 2200000, sort_order: 1 },
      { project_id: p2.id, label: 'Editor / Colorist', amount_cents: 1200000, actuals_cents:  650000, sort_order: 2 },
      { project_id: p2.id, label: 'Audio Post',        amount_cents:  450000, actuals_cents:       0, sort_order: 3 },
      { project_id: p2.id, label: 'Social Versioning', amount_cents:  300000, actuals_cents:       0, sort_order: 4 },
      { project_id: p2.id, label: 'Agency fee',        amount_cents:  835000, actuals_cents:  430000, is_agency_fee: true, sort_order: 5 },
    ]});

    // ── Project 3: Threat Level Midnight — MSPC — ACTIVE ─────────────────────
    const p3 = await prisma.project.create({
      data: {
        client_id: mspc.id,
        name: 'Threat Level Midnight',
        status: 'ACTIVE',
        due_date: new Date('2026-05-09'),
        notes: 'Feature-length brand film. Full narrative with original score. Michael has strong opinions on the action sequences.',
        categories: { create: [{ category_id: brandFilm.id }] },
      },
    });
    await prisma.projectMember.createMany({ data: [
      { project_id: p3.id, team_member_id: jim.id,    role_label: 'Editor' },
      { project_id: p3.id, team_member_id: pam.id,    role_label: 'VFX & Motion Graphics' },
      { project_id: p3.id, team_member_id: dwight.id, role_label: 'Colorist' },
      { project_id: p3.id, team_member_id: oscar.id,  role_label: 'Creative Director' },
      { project_id: p3.id, team_member_id: andy.id,   role_label: 'Engagement Manager' },
    ]});
    await prisma.projectPartner.create({ data: { project_id: p3.id, partner_id: pif.id } });
    await prisma.milestone.createMany({ data: [
      { project_id: p3.id, name: 'Assembly Cut',   tm_assignee_id: jim.id,    start_date: new Date('2026-03-01'), end_date: new Date('2026-03-21'), completed: true,  sort_order: 1 },
      { project_id: p3.id, name: 'Director Cut',   tm_assignee_id: jim.id,    start_date: new Date('2026-03-24'), end_date: new Date('2026-04-04'), completed: false, sort_order: 2 },
      { project_id: p3.id, name: 'VFX & Titles',   tm_assignee_id: pam.id,    start_date: new Date('2026-04-06'), end_date: new Date('2026-04-20'), completed: false, sort_order: 3 },
      { project_id: p3.id, name: 'Color Grade',    tm_assignee_id: dwight.id, start_date: new Date('2026-04-21'), end_date: new Date('2026-05-01'), completed: false, sort_order: 4 },
      { project_id: p3.id, name: 'Final Delivery', tm_assignee_id: jim.id,    start_date: new Date('2026-05-05'), end_date: new Date('2026-05-09'), completed: false, sort_order: 5 },
    ]});
    await prisma.budgetLineItem.createMany({ data: [
      { project_id: p3.id, label: 'Director',              amount_cents: 3500000, actuals_cents: 3500000, sort_order: 1 },
      { project_id: p3.id, label: 'Editor',                amount_cents: 2200000, actuals_cents: 1100000, sort_order: 2 },
      { project_id: p3.id, label: 'VFX & Motion Graphics', amount_cents: 1500000, actuals_cents:       0, sort_order: 3 },
      { project_id: p3.id, label: 'Color Grade',           amount_cents:  800000, actuals_cents:       0, sort_order: 4 },
      { project_id: p3.id, label: 'Original Score',        amount_cents:  600000, actuals_cents:  600000, sort_order: 5 },
      { project_id: p3.id, label: 'Agency fee',            amount_cents: 1320000, actuals_cents:  720000, is_agency_fee: true, sort_order: 6 },
    ]});

    // ── Project 4: Scranton Knows Coffee — Dunder Mifflin — ACTIVE ───────────
    const p4 = await prisma.project.create({
      data: {
        client_id: dm.id,
        name: 'Scranton Knows Coffee',
        status: 'ACTIVE',
        due_date: new Date('2026-04-11'),
        notes: 'Internal employee engagement video series. Keeping it fun, keeping it Scranton.',
        categories: { create: [{ category_id: corporate.id }] },
      },
    });
    await prisma.projectMember.createMany({ data: [
      { project_id: p4.id, team_member_id: kevin.id,   role_label: 'Audio Engineer' },
      { project_id: p4.id, team_member_id: pam.id,     role_label: 'Motion Graphics' },
      { project_id: p4.id, team_member_id: kelly.id,   role_label: 'Creative Director' },
      { project_id: p4.id, team_member_id: phyllis.id, role_label: 'Engagement Manager' },
    ]});
    await prisma.milestone.createMany({ data: [
      { project_id: p4.id, name: 'Script & Storyboard',   tm_assignee_id: kelly.id,  start_date: new Date('2026-03-10'), end_date: new Date('2026-03-20'), completed: true,  sort_order: 1 },
      { project_id: p4.id, name: 'Edit & Sound',          tm_assignee_id: kevin.id,  start_date: new Date('2026-03-25'), end_date: new Date('2026-04-04'), completed: false, sort_order: 2 },
      { project_id: p4.id, name: 'Lower Thirds & Graphics',tm_assignee_id: pam.id,   start_date: new Date('2026-04-02'), end_date: new Date('2026-04-08'), completed: false, sort_order: 3 },
      { project_id: p4.id, name: 'Final Delivery',        tm_assignee_id: kevin.id,  start_date: new Date('2026-04-09'), end_date: new Date('2026-04-11'), completed: false, sort_order: 4 },
    ]});
    await prisma.budgetLineItem.createMany({ data: [
      { project_id: p4.id, label: 'Director',        amount_cents: 1200000, actuals_cents: 1200000, sort_order: 1 },
      { project_id: p4.id, label: 'Editor',          amount_cents:  650000, actuals_cents:  520000, sort_order: 2 },
      { project_id: p4.id, label: 'Motion Graphics', amount_cents:  400000, actuals_cents:       0, sort_order: 3 },
      { project_id: p4.id, label: 'Agency fee',      amount_cents:  445000, actuals_cents:  340000, is_agency_fee: true, sort_order: 4 },
    ]});

    // ── Project 5: Vance Refrigeration Rebrand — Vance — COMPLETED ───────────
    const p5 = await prisma.project.create({
      data: {
        client_id: vance.id,
        name: 'Vance Refrigeration Rebrand',
        status: 'COMPLETED',
        due_date: new Date('2026-02-28'),
        notes: 'Brand identity film for Vance Refrigeration. Delivered on time and under budget.',
        categories: { create: [{ category_id: brandFilm.id }] },
      },
    });
    await prisma.projectMember.createMany({ data: [
      { project_id: p5.id, team_member_id: dwight.id,  role_label: 'Editor / Colorist' },
      { project_id: p5.id, team_member_id: pam.id,     role_label: 'Motion Graphics' },
      { project_id: p5.id, team_member_id: oscar.id,   role_label: 'Creative Director' },
      { project_id: p5.id, team_member_id: phyllis.id, role_label: 'Engagement Manager' },
    ]});
    await prisma.projectPartner.create({ data: { project_id: p5.id, partner_id: lp.id } });
    await prisma.milestone.createMany({ data: [
      { project_id: p5.id, name: 'Rough Cut',      tm_assignee_id: dwight.id, start_date: new Date('2026-01-20'), end_date: new Date('2026-02-03'), completed: true, sort_order: 1 },
      { project_id: p5.id, name: 'Motion Graphics',tm_assignee_id: pam.id,    start_date: new Date('2026-02-04'), end_date: new Date('2026-02-14'), completed: true, sort_order: 2 },
      { project_id: p5.id, name: 'Color & Sound',  tm_assignee_id: dwight.id, start_date: new Date('2026-02-15'), end_date: new Date('2026-02-22'), completed: true, sort_order: 3 },
      { project_id: p5.id, name: 'Final Delivery', tm_assignee_id: dwight.id, start_date: new Date('2026-02-25'), end_date: new Date('2026-02-28'), completed: true, sort_order: 4 },
    ]});
    await prisma.budgetLineItem.createMany({ data: [
      { project_id: p5.id, label: 'Director',          amount_cents: 1600000, actuals_cents: 1600000, sort_order: 1 },
      { project_id: p5.id, label: 'Editor / Colorist', amount_cents:  900000, actuals_cents:  900000, sort_order: 2 },
      { project_id: p5.id, label: 'Motion Graphics',   amount_cents:  500000, actuals_cents:  500000, sort_order: 3 },
      { project_id: p5.id, label: 'Agency fee',        amount_cents:  600000, actuals_cents:  600000, is_agency_fee: true, sort_order: 4 },
    ]});

    // ── Budget Scenarios ──────────────────────────────────────────────────────
    await prisma.budgetScenario.createMany({
      data: [
        {
          name: 'Dunder Mifflin — Paper Empire Campaign',
          project_name: 'Paper Empire Campaign',
          client_name: 'Dunder Mifflin',
          client_color: '2563A2',
          cad_rate: 1.38,
          rows: [
            { id: 1, category: 'Director',        desc: '' },
            { id: 2, category: 'Editor',          desc: '' },
            { id: 3, category: 'Motion Graphics', desc: '' },
            { id: 4, category: 'Color Grade',     desc: '' },
            { id: 5, category: 'Audio Post',      desc: '' },
          ],
          budgets: [
            { id: 'a', name: 'Conservative', values: { '1': 16000, '2': 8500,  '3': 5000, '4': 3000, '5': 2500, fee: 6300  } },
            { id: 'b', name: 'Recommended',  values: { '1': 20000, '2': 10500, '3': 6500, '4': 4000, '5': 3200, fee: 7840  } },
            { id: 'c', name: 'Premium',      values: { '1': 26000, '2': 13000, '3': 8500, '4': 5500, '5': 4200, fee: 10010 } },
          ],
        },
        {
          name: 'Sabre Corporation — Sabre Printer Launch',
          project_name: 'Sabre Printer Launch',
          client_name: 'Sabre Corporation',
          client_color: 'E8391D',
          cad_rate: 1.38,
          rows: [
            { id: 1, category: 'Director',         desc: '' },
            { id: 2, category: 'Editor / Colorist', desc: '' },
            { id: 3, category: 'Audio Post',        desc: '' },
            { id: 4, category: 'Social Versioning', desc: '' },
          ],
          budgets: [
            { id: 'a', name: 'Lean', values: { '1': 18000, '2': 9500,  '3': 3500, '4': 2500, fee: 6675 } },
            { id: 'b', name: 'Full', values: { '1': 26000, '2': 14000, '3': 5500, '4': 4000, fee: 9975 } },
          ],
        },
        {
          name: 'Michael Scott Paper Co. — Threat Level Midnight',
          project_name: 'Threat Level Midnight',
          client_name: 'Michael Scott Paper Co.',
          client_color: '3DAA6E',
          cad_rate: 1.38,
          rows: [
            { id: 1, category: 'Director',              desc: '' },
            { id: 2, category: 'Editor',                desc: '' },
            { id: 3, category: 'VFX & Motion Graphics', desc: '' },
            { id: 4, category: 'Color Grade',           desc: '' },
            { id: 5, category: 'Original Score',        desc: '' },
          ],
          budgets: [
            { id: 'a', name: "Original Cut",    values: { '1': 28000, '2': 18000, '3': 12000, '4': 6500, '5': 5000, fee: 13975 } },
            { id: 'b', name: "Director's Cut",  values: { '1': 38000, '2': 24000, '3': 18000, '4': 9000, '5': 8000, fee: 19350 } },
          ],
        },
      ],
    });

    // Suppress unused var warnings — variables referenced to satisfy TS
    void [documentary, p1, p2, p3, p4, p5];

    console.log('✔  Hippo-Mifflin seed complete — michael@hippomifflin.app / mifflin2026');
  } catch (e) {
    console.error('Seed error (non-fatal):', e);
  }
}

seedProd().then(() => {
  app.listen(PORT, () => {
    console.log(`Hippo server running on http://localhost:${PORT}`);
  });
});

export default app;
