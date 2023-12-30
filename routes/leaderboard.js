const express = require('express');
const router = express.Router();

//const authenticateUser = require('../middleware/authenticateUser');

const { getAllCreatorsYoutube} = require('../controllers/leaderboard');

router.get('/youtube', getAllCreatorsYoutube);



module.exports = router;
