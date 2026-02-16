import { createServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import pkg from "@prisma/client"
import dotenv from "dotenv"

dotenv.config()
const { PrismaClient } = pkg
const prisma = new PrismaClient()


const getOrigin = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  return process.env.NODE_ENV !== "production"
    ? "http://localhost:3000"
    : "https://solmex.live"
}

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200)
    res.end("OK")
    return
  }
  res.writeHead(404)
  res.end()
})

const io = new SocketIOServer(server, {
  cors: {
    origin: getOrigin(),
    methods: ["GET", "POST"],
  },
})

const adminConnections = new Map()
const customerConnections = new Map()

io.on("connection", (socket) => {
  console.log(`[Socket.IO] New connection: ${socket.id}`)

  socket.on("join", (customerId) => {
    console.log(`[Socket.IO] Customer ${customerId} joined`)
    socket.join(customerId)
    customerConnections.set(customerId, socket.id)
    io.emit("customer-online", { customerId })
  })

  socket.on("admin-join", () => {
    console.log(`[Socket.IO] Admin joined`)
    adminConnections.set(socket.id, true)
    socket.emit("active-customers", Array.from(customerConnections.keys()))
  })

  socket.on("send-message", async ({ customerId, text, sender }) => {
    try {
      let conversation = await prisma.conversation.findFirst({
        where: { customerId },
      })

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { customerId },
        })
      }

      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          sender,
          text,
        },
      })

      io.to(customerId).emit("receive-message", message)
      io.emit("admin-update")
    } catch (error) {
      console.error("[Socket.IO] Error:", error)
      socket.emit("error", { message: "Failed to send message" })
    }
  })

  socket.on("disconnect", () => {
    console.log(`[Socket.IO] Disconnected: ${socket.id}`)
    adminConnections.delete(socket.id)
    for (const [customerId, socketId] of customerConnections.entries()) {
      if (socketId === socket.id) {
        customerConnections.delete(customerId)
        io.emit("customer-offline", { customerId })
        break
      }
    }
  })
})

const PORT = parseInt(process.env.PORT || "4000", 10)

server.listen(PORT, () => {
  console.log(`✓ Socket.IO server running on port ${PORT}`)
})

process.on("SIGTERM", async () => {
  await prisma.$disconnect()
  process.exit(0)
})