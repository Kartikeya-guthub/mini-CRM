import { Server } from 'socket.io'
import { Server as HttpServer } from 'http'
import { prisma } from './db'

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
    socket.on('join_campaign', async (campaignId: string) => {
      socket.join(`campaign:${campaignId}`)
      console.log(`[SOCKET] Client joined campaign:${campaignId}`)

      // Emit current state so client doesn't miss events that fired before join
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
      if (campaign) {
        socket.emit('stats_update', {
          campaign_id: campaignId,
          delivered_count: campaign.delivered_count,
          failed_count: campaign.failed_count,
          opened_count: campaign.opened_count,
          read_count: campaign.read_count,
          clicked_count: campaign.clicked_count,
          attributed_orders: campaign.attributed_orders,
          sent_count: campaign.sent_count,
          status: campaign.status
        })
      }
    })
  })

  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}
