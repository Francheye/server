const express = require('express');
const router = express.Router();

const authenticateUser = require('../middleware/authenticateUser');

const { getAllCampaigns, getCampaign, createCampaign, getAllVerifiedCampaigns, editCampaign} = require('../controllers/campaign');

router.get('/', getAllCampaigns);
router.get('/single/:id', getCampaign);
router.patch('/single/:id', authenticateUser, editCampaign);
router.post('/', authenticateUser, createCampaign);
router.get('/verified', getAllVerifiedCampaigns);

module.exports = router;
