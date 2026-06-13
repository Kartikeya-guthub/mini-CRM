import { Server } from 'socket.io'
import { Server as HttpServer } from 'http'

let io: Server

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:5173',
        process.env.FRONTEND_URL || ''
      ],
      methods: ['GET', 'POST']
    }
  })

  io.on('connection', socket => {
    socket.on('join_campaign', (campaignId: string) => {
      socket.join(`campaign:${campaignId}`)
      console.log(`[SOCKET] Client joined campaign:${campaignId}`)
    })
  })

  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}
