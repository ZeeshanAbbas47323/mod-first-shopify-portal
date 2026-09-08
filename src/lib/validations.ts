import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

export type LoginValues = z.infer<typeof loginSchema>;


export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/\d/, "Include at least one number")
      .regex(/[^A-Za-z0-9]/, "Include at least one special character"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/\d/, "Include at least one number")
      .regex(/[^A-Za-z0-9]/, "Include at least one special character"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const productSchema = z.object({
  title: z.string().min(1, "Title is required").max(120, "Keep it under 120 characters"),
  price: z.coerce
    .number({ error: "Enter a valid price" })
    .positive("Price must be greater than 0"),
  inventory: z.coerce
    .number({ error: "Enter a valid quantity" })
    .int("Quantity must be a whole number")
    .min(0, "Quantity can't be negative"),
  status: z.enum(["Active", "Draft", "Archived"]),
  category: z.string().min(1, "Category is required"),
  vendor: z.string().min(1, "Vendor is required"),
});

export type ProductValues = z.infer<typeof productSchema>;
export type ProductInput = z.input<typeof productSchema>;
