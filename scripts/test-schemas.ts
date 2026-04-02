import {
  ProjectNameSchema,
  UserEmailSchema,
  SecretSchema,
} from "../src/lib/types/schemas";

console.log("Testing Schemas...");

let failed = false;

// 1. Test ProjectNameSchema
const validProject = ProjectNameSchema.safeParse({ name: "My Project" });
const invalidProject = ProjectNameSchema.safeParse({ name: "Bad <script>" });

if (!validProject.success) {
  console.error("Valid project failed", validProject.error);
  failed = true;
}
if (invalidProject.success) {
  console.error("Invalid project passed");
  failed = true;
} else console.log("[OK] ProjectNameSchema: OK (Caught invalid characters)");

// 2. Test UserEmailSchema
const validUser = UserEmailSchema.safeParse({
  userId: "123e4567-e89b-12d3-a456-426614174000",
});
const invalidUser = UserEmailSchema.safeParse({ userId: "not-a-uuid" });

if (!validUser.success) {
  console.error("Valid user failed", validUser.error);
  failed = true;
}
if (invalidUser.success) {
  console.error("Invalid user passed");
  failed = true;
} else console.log("[OK] UserEmailSchema: OK (Caught invalid UUID)");

// 3. Test SecretSchema
const validSecret = SecretSchema.safeParse({
  key: "GOOD_KEY",
  value: "some value",
});
const invalidSecret = SecretSchema.safeParse({ key: "BAD KEY!", value: "val" });

if (!validSecret.success) {
  console.error("Valid secret failed", validSecret.error);
  failed = true;
}
if (invalidSecret.success) {
  console.error("Invalid secret passed");
  failed = true;
} else console.log("[OK] SecretSchema: OK (Caught invalid key chars)");

if (failed) process.exit(1);
console.log("All checks passed.");
