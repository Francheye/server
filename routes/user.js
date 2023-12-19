const express = require('express');
const router = express.Router();

const authenticateUser = require('../middleware/authenticateUser');

const { editUser, getUser} = require('../controllers/user');

router.patch('/editUser/:id', editUser);
router.get('/:id', authenticateUser, getUser);


module.exports = router;
