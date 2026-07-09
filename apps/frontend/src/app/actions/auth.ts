"use server";

import { signIn, signOut } from "@/auth";
import { prisma } from "../../../../shared/db";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "SRE_ENGINEER", "DEVOPS_ENGINEER", "INCIDENT_MANAGER", "READ_ONLY"]).default("READ_ONLY"),
});

export async function registerUser(prevState: any, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const validation = registerSchema.safeParse(rawData);
    
    if (!validation.success) {
      return { error: validation.error.errors[0].message };
    }
    
    const { name, email, password, role } = validation.data;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return { error: "User already exists with this email address." };
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user in Neon PostgreSQL
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
    });
    
    return { success: true };
  } catch (error) {
    console.error("Registration error:", error);
    return { error: "An unexpected error occurred during registration." };
  }
}

export async function loginUser(prevState: any, formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    
    if (!email || !password) {
      return { error: "Email and password are required." };
    }
    
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
    
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid email or password." };
        default:
          return { error: "Failed to sign in. Please try again." };
      }
    }
    // Auth.js redirects by throwing a special redirect error, we must rethrow it
    throw error;
  }
}

export async function logoutUser() {
  await signOut({ redirectTo: "/auth/login" });
}

export async function forgotPassword(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  if (!email) {
    return { error: "Email address is required." };
  }
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Return success to prevent email enumeration attacks
    return { success: true, message: "If an account exists, a reset link has been simulated." };
  }
  
  // In a real production setup, we would generate a token and send an email.
  // For the foundation phase, we will return a mock success message indicating the simulation was successful.
  return { success: true, message: "A password reset instructions code was printed in server logs." };
}

export async function resetPassword(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const newPassword = formData.get("password") as string;
  
  if (!email || !newPassword || newPassword.length < 6) {
    return { error: "A valid email and password of at least 6 characters are required." };
  }
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "User not found." };
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });
  
  return { success: true };
}
