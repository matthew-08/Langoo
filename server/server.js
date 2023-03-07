const express = require('express')
const cors = require('cors')
const { Server } = require('socket.io')
const helmet = require('helmet')
const http = require('http')
const session = require('express-session')
require('dotenv').config()
const sessionMiddleware = require('./controllers/serverController').sessionMiddleware
const authorizeMiddleware = require('./controllers/socketcontroller').authorizeUser

const RedisStore = require('connect-redis')(session)

const app = express()

const server = http.createServer(app)

const redisClient = require('./redis').redisClient

const io = new Server(server, {
    cors: {
        credentials: true,
        origin: 'http://localhost:5173'
    }

})
app.use(cors({
    credentials: true,
    origin: 'http://localhost:5173'
}))

io.engine.use(sessionMiddleware);
io.use(authorizeMiddleware);
app.use(sessionMiddleware)

io.on('connect', async socket => {
    console.log('in io connect')
    const ok = await redisClient.set(
        `${socket.request.session.user.userId}`, `${socket.id}`, 'EX', 1000,
    )
    const hello = await redisClient.ttl(`${socket.request.session.user.id}`).then(res => console.log(res))
    
    const check = await redisClient.exists(`${socket.request.user}`)
    
    socket.on('disconnect', async () => {
        const userId = socket.request.session.user.id
        await redisClient.del(`${userId}`, 'connected').then(res => console.log(res));
    })

    socket.on('private_chat', async (data) => {
        const userSocket = await redisClient.get(data.to)
        const response = {
            message: data.message,
            conversationId: data.conversationId
        }
        if(userSocket) {
            console.log('sent');
           io.to(userSocket).emit('chat_message', response)
        }
    })
})





app.use(helmet())

app.use(express.json())

app.use('/auth', require('./routes/auth'))

app.use('/userInfo', require('./routes/userInfo'))

app.use('/convo', require('./routes/friends'))

server.listen(3000, () => console.log('server listening'))

