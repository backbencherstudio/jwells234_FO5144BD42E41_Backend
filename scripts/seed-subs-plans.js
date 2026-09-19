const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      slug: 'free',
      name: 'Free',
      description: 'Default free plan',
      isFree: true,
      price: 0,
      currency: 'USD',
      interval: null,
      intervalCount: null,
      type: 'FREE',
      trialDays: 0,
    },
    {
      slug: 'john.example.jwells.one_month',
      name: 'One Month',
      description: '1 month premium',
      isFree: false,
      price: 1.99,
      currency: 'USD',
      interval: 'monthly',
      intervalCount: 1,
      type: 'PREMIUM',
      trialDays: null,
    },
    {
      slug: 'john.example.jwells.three_months',
      name: 'Three Months',
      description: '3 month premium',
      isFree: false,
      price: 4.99,
      currency: 'USD',
      interval: 'quarterly',
      intervalCount: 1,
      type: 'PREMIUM',
      trialDays: null,
    },
    {
      slug: 'john.example.jwells.six_months',
      name: 'Six Months',
      description: '6 month premium',
      isFree: false,
      price: 8.99,
      currency: 'USD',
      interval: 'biannually',
      intervalCount: 1,
      type: 'PREMIUM',
      trialDays: null,
    },
    {
      slug: 'john.example.jwells.one_year',
      name: 'One Year',
      description: '1 year premium',
      isFree: false,
      price: 14.99,
      currency: 'USD',
      interval: 'annually',
      intervalCount: 1,
      type: 'PREMIUM',
      trialDays: null,
    },
  ];

  for (const plan of plans) {
    await prisma.subsPlan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        description: plan.description,
        isFree: plan.isFree,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        intervalCount: plan.intervalCount,
        type: plan.type,
        trialDays: plan.trialDays,
      },
      create: plan,
    });
  }

  const all = await prisma.subsPlan.findMany({
    select: { slug: true, type: true, price: true },
  });
  console.log('SubsPlan seeded:', all.length);
  console.log(all);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
