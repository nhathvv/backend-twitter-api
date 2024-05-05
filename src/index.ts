import express from 'express'
import userRouter from './routes/users.routes'
import databaseService from './services/database.services'
import defaultErrorHandler from './middlewares/error.middlewares'
import mediasRouter from './routes/medias.routes'
import { initFolder } from './utils/file'
// Connect to MongoDB
databaseService.connect()
const app = express()
const port = 4000
app.use(express.json())
// Init folder for upload
initFolder()
app.use('/users', userRouter)
app.use('/medias', mediasRouter)
// Defaut error handler
app.use(defaultErrorHandler)
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
