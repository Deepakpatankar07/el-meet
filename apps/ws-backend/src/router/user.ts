import prisma from "@repo/db/client";
import bcrypt from "bcrypt";
import express, { Router } from "express";
import jwt from "jsonwebtoken";
import { JWT_PASSWORD } from "../config";
import { CreateUserSchema, SigninSchema } from "../types/zodTypes";
const router:Router = express.Router();


/* -------------- Signup -------------- */

router.post("/signup", async (req, res) => {
  try {
    const parsedData = CreateUserSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.status(400).json({
        message: "Incorrect inputs",
      });
      return;
    }
    const { name, password, email } = parsedData.data;

    // Hash the password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    res.status(201).json({
      user,
      message: "User created successfully !!",
    });
  } catch (error: any) {
    console.error("Server Error:", error);
    // Handle unique constraint error
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      res.status(409).json({
        message: "User with this email already exists.",
      });
    } else {
      res.status(500).json({
        message: "An unexpected error occurred. Please try again later.",
      });
    }
  }
});

/* -------------- Signin -------------- */

router.post("/signin", async (req, res) => {
  try {
    const parsedData = SigninSchema.safeParse(req.body);

    if (!parsedData.success) {
      console.log("Validation Error :", parsedData.error);
      res.status(400).json({
        message: "Incorrect inputs",
      });
      return;
    }

    const { password, email } = parsedData.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json({
        message: "User does not exist.",
      });
      return;
    }

    // Compare the provided password with the stored hash using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        message: "Invalid email or password.",
      });
      return;
    }
    if(JWT_PASSWORD === undefined) {
      res.status(500).json({
        message: "JWT_PASSWORD is not defined",
      });
      return;
    }
    
    const token = jwt.sign({ userId: user.id }, JWT_PASSWORD);

    res.status(200).json({
      message: "Login successful",
      token,
    });
  } catch (error: any) {
    console.error("Server Error:", error);

    res.status(500).json({
      message: "An unexpected error occurred. Please try again later.",
    });
  }
});



export default router;