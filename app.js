require('dotenv').config();
require('express-async-errors');
require('./oauth2Client');

//extra security packages
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const rateLimiter = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const session = require('express-session');

//swagger ui design
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');

const express = require('express');
const app = express();
const connectDB = require('./db/connectdb');

const authenticateUser = require('./middleware/authenticateUser');

//routers
const auth = require('./routes/auth');
const user = require('./routes/user');
const campaign = require('./routes/campaign');
const leaderboard = require('./routes/leaderboard');

//error-handlers
const notFoundMiddleware = require('./middleware/not-found');
const errorHandlerMiddleware = require('./middleware/error-handler');

app.set('trust proxy', 1);
app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);
app.use(express.json());
app.use(cors({ origin: '*' }));
app.use(helmet());
app.use(xss());
app.use(session({ secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true }));

//home route

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/', (req, res) => {
  res.send('<h1>Francheye Api is live</h1>');
});

//routes
app.use('/api/v1/auth', auth);
app.use('/api/v1/user', user);
app.use('/api/v1/campaign', campaign)
app.use('/api/v1/leaderboard', leaderboard)

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 3000;

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    app.listen(port, () => console.log(`server is listening on ${port}...`));
  } catch (error) {
    console.log(error);
  }
};

start();

//module.exports.handler =  serverless(app)
