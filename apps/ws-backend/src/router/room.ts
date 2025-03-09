import prisma from "@repo/db/client";
import express, { Request, Response, Router } from "express";
import { authMiddleware } from "../middleware";
import { CreateRoomSchema } from "../types/zodTypes";
import { users } from "../websocket";
const router:Router = express.Router();

/* -------------- room/create -------------- */

router.post("/create", authMiddleware, async (req: Request, res: Response) => {
    try {
      const parsedData = CreateRoomSchema.safeParse(req.body);
      console.log("parsed data",parsedData);
      if (!parsedData.success) {
        res.status(400).json({
          message: "Incorrect inputs",
        });
        return;
      }
      const userId = req.userId;
      if (!userId) {
        res.status(400).json({
          message: "User not login",
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if(!user){
        res.status(404).json({
          message: "User not found",
        });
        return;
      }
  
      const room = await prisma.room.create({
        data: {
          name: parsedData.data.name,
          hostId: Number(userId),
        },
        include: {
          host: true,
        },
      });
      
      console.log("room created successfully")
      res.status(201).json({
        roomName: room.name,
        email: room.host.email,
        message: "Room created successfully",
      });
      return;
    } catch (error: any) {
      console.error("Server Error:", error);
  
      if (error.code === "P2002" && error.meta?.modelName === "Room") {
        res.status(409).json({
          message: "Room with this Name already exists.",
        });
      } else {
        res.status(500).json({
          message: "An unexpected error occurred. Please try again later.",
        });
      }
    }
  });

/* -------------- room/join -------------- */


router.post("/join", authMiddleware, async (req: Request, res: Response) => {
    try {
      const parsedData = CreateRoomSchema.safeParse(req.body);
      console.log("parsed data",parsedData);
      if (!parsedData.success) {
        res.status(400).json({
          message: "Incorrect inputs",
        });
        return;
      }
      const userId = req.userId;
      if (!userId) {
        res.status(400).json({
          message: "User not login",
        });
        return;
      }
  
      const room = await prisma.room.findFirst({
        where: { name: parsedData.data.name },
      });

      if (!room) {
        res.status(400).json({
          message: "Room not found",
        });
        return;
      }
      if (room.hostId === Number(userId)) {
        res.status(400).json({
          message: "You are the host of this room",
        });
        return;
      }

      // Check if the user is already a participant
      const existingParticipant = await prisma.roomParticipant.findFirst({
        where: {
          userId: userId,
          roomId: room.id,
        },
        include: {
          user: true,
        }
      });

      if (existingParticipant) {
        res.status(200).json({
          message: "You are already in this room",
          email: existingParticipant.user.email,
          roomName: room.name,
        });
        return;
      }

      // Add the user as a participant
      const data = await prisma.roomParticipant.create({
        data: {
          userId: userId,
          roomId: room.id,
        },
        include: {
          user: true,
        },
      });

      console.log("room joined successfully")
      res.status(201).json({
        roomName: room.name,
        email: data.user.email,
        message: "Room joined successfully",
      });
      return;
    } catch (error: any) {
      console.error("Server Error:", error);
        res.status(500).json({
          message: "An unexpected error occurred. Please try again later.",
        });
    }
  });

  
/* -------------- room/allparticipants -------------- */


router.post("/allparticipants", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      res.status(400).json({ message: "Room name is required" });
      return;
    }
    const room = await prisma.room.findFirst({
      where: { name: roomName },
      include: {
        host: true,
        participants: {
          include: { user: true },
        },
      },
    });

    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }

    // Check online users
    const onlineUsers = new Set(users.get(roomName)?.map((user) => user.userId) || []);

    // Host Data
    const hostData = {
      email: room.host.email,
      status: onlineUsers.has(room.host.id) ? "online" : "offline",
    };

    // Participants Data
    const participants = room.participants.map((participant) => ({
      email: participant.user.email,
      status: onlineUsers.has(participant.user.id) ? "online" : "offline",
    }));

    res.status(200).json({
      host: hostData,
      participants,
    });
    return;
  } catch (error) {
    console.error("Error fetching participants:", error);
    res.status(500).json({ message: "Internal server error" });
    return;
  }
});
export default router;