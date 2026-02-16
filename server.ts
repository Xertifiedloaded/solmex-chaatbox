const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
      origin: [
      'http://localhost:3000',   
      'http://localhost:5173',  
      'https://solmex.live',     
      'https://solmex-chaatbox.onrender.com' 
    ],
    methods: ['GET', 'POST'],
  },
})

const conversations = {} 

io.on('connection', (socket) => {
  console.log('New socket connected:', socket.id)

  socket.on('join', (customerId) => {
    socket.join(customerId)
    console.log(`Customer joined room: ${customerId}`)
    socket.emit('previous-messages', conversations[customerId] || [])
  })

  socket.on('admin-join', () => {
    socket.join('admin-room')
    console.log('Admin joined admin-room')
    socket.emit('all-conversations', conversations)
  })

  socket.on('send-message', (msg) => {
    const { customerId } = msg
    if (!conversations[customerId]) conversations[customerId] = []

    const isDuplicate = conversations[customerId].some((m) => m.id === msg.id)
    if (!isDuplicate) {
      conversations[customerId].push(msg)
    }


    io.to('admin-room').emit('receive-message', msg)
    io.to(customerId).emit('receive-message', msg)
  })

  socket.on('admin-send-message', (msg) => {
    const { customerId } = msg
    if (!conversations[customerId]) conversations[customerId] = []
    const isDuplicate = conversations[customerId].some((m) => m.id === msg.id)
    if (!isDuplicate) {
      conversations[customerId].push(msg)
    }

    io.to(customerId).emit('receive-message', msg)
    io.to('admin-room').emit('receive-message', msg)
  })
})

server.listen(5000, () => {
  console.log('Socket.IO server running on port 5000')
})