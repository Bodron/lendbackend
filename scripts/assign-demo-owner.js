// Usage: node --env-file=.env scripts/assign-demo-owner.js [--apply]
// Creates one login account and assigns the six seeded listings to it.
const { randomBytes } = require('node:crypto');
const { hash } = require('bcryptjs');
const mongoose = require('mongoose');

const email = 'demo-owner@pinlend.invalid';
const fullName = 'Proprietar Demo';
const slugs = [
  'playstation-5-digital-edition',
  'canon-eos-r50-creator-kit',
  'dji-mini-4-pro-fly-more',
  'macbook-pro-14-m3',
  'bosch-professional-tool-set',
  'gopro-hero12-black-bundle',
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB,
  });
  try {
    const users = mongoose.connection.db.collection('users');
    const products = mongoose.connection.db.collection('products');
    const listings = await products.find({ slug: { $in: slugs } }, {
      projection: { slug: 1, title: 1, ownerId: 1, ownerName: 1 },
    }).toArray();
    if (listings.length !== slugs.length) {
      throw new Error(`Expected ${slugs.length} demo listings, found ${listings.length}.`);
    }

    let account = await users.findOne({ email });
    if (account && account.seedDemoOwner !== true) {
      throw new Error('The demo owner email is already used by another account.');
    }
    const conflicting = listings.filter((item) => item.ownerId &&
      (!account || item.ownerId !== String(account._id)));
    if (conflicting.length > 0) {
      throw new Error(`Listings already assigned to another owner: ${conflicting.map((item) => item.slug).join(', ')}`);
    }

    console.log(JSON.stringify({
      mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
      account: { email, fullName, exists: Boolean(account) },
      listings: listings.map((item) => ({
        slug: item.slug, title: item.title,
        previousOwnerName: item.ownerName,
        previousOwnerId: item.ownerId ?? null,
      })),
    }, null, 2));
    if (!process.argv.includes('--apply')) return;

    let password;
    if (!account) {
      password = randomBytes(24).toString('base64url');
      const now = new Date();
      const inserted = await users.insertOne({
        role: 'user',
        fullName,
        email,
        phone: 'Demo',
        authProvider: 'password',
        passwordHash: await hash(password, 12),
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        seedDemoOwner: true,
        createdAt: now,
        updatedAt: now,
      });
      account = { _id: inserted.insertedId };
    }

    await products.bulkWrite(listings.map((item) => ({
      updateOne: {
        filter: { _id: item._id, $or: [
          { ownerId: { $exists: false } }, { ownerId: null }, { ownerId: '' },
          { ownerId: String(account._id) },
        ] },
        update: { $set: { ownerId: String(account._id), ownerName: fullName } },
      },
    })));

    const verified = await products.countDocuments({
      slug: { $in: slugs }, ownerId: String(account._id), ownerName: fullName,
    });
    if (verified !== slugs.length) {
      throw new Error(`Only ${verified}/${slugs.length} listings have the demo owner.`);
    }
    console.log(JSON.stringify({
      ownerId: String(account._id),
      assignedListings: verified,
      missingOwnerAcrossDatabase: await products.countDocuments({ $or: [
        { ownerId: { $exists: false } }, { ownerId: null }, { ownerId: '' },
      ] }),
      loginEmail: email,
      ...(password ? { loginPassword: password } : {}),
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
