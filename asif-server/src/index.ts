import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth'
import adminRouter from './routes/admin'
import ordersRouter from './routes/orders'
import dashboardRouter from './routes/dashboard'

const app = express()
const PORT = process.env.PORT || 3002

app.use(cors())
app.use(express.json())

app.use('/auth', authRouter)
app.use('/admin', adminRouter)
app.use('/orders', ordersRouter)
app.use('/dashboard', dashboardRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`ASIF server running on http://localhost:${PORT}`)
})
