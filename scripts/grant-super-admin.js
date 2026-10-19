// Run only against an existing, verified account with explicit operator access.
const mongoose = require("mongoose");

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const uri = process.env.MONGODB_URI;
  if (!email || !uri) throw new Error("Usage: MONGODB_URI=... node scripts/grant-super-admin.js email@example.com");
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || "lend" });
  const result = await mongoose.connection.collection("users").updateOne(
    { email }, { $set: { role: "super_admin" } },
  );
  if (result.matchedCount !== 1) throw new Error("Existing user not found");
  console.log(`super_admin granted to ${email}`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
