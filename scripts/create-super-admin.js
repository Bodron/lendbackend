// One-time bootstrap. Pass the password on stdin so it is not in the process arguments.
const fs = require("node:fs");
const mongoose = require("mongoose");
const { hash } = require("bcryptjs");

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = fs.readFileSync(0, "utf8").trimEnd();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Provide a valid email address.");
  }
  if (password.length < 8) throw new Error("Password must have at least 8 characters.");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");

  const passwordHash = await hash(password, 12);
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || "lend",
    serverSelectionTimeoutMS: 8000,
  });
  try {
    const users = mongoose.connection.collection("users");
    if (await users.findOne({ email }, { projection: { _id: 1 } })) {
      throw new Error("An account with this email already exists; no credentials were changed.");
    }
    const now = new Date();
    await users.insertOne({
      fullName: "Cosmin Admin",
      email,
      phone: "Admin",
      passwordHash,
      authProvider: "password",
      role: "super_admin",
      stripePayoutsEnabled: false,
      stripeDetailsSubmitted: false,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`super_admin account created: ${email}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.name === "MongooseServerSelectionError"
    ? "MongoDB unavailable; admin account was not created."
    : error.message);
  process.exitCode = 1;
});
