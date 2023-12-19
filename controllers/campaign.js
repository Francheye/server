const Campaign = require('../models/Campaign');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, UnauthenticatedError } = require('../errors');

const mongoose = require('mongoose');

const editCampaign = async (req, res) => {
  try {
    const { id: CampaignId } = req.params;
    const changes = req.body; // Contains changes for different nested schemas

    let update = {};
    for (let key in changes) {
      if (changes.hasOwnProperty(key)) {
        update[key] = changes[key];
      }
    }

    // Updating the user document
    const updatedCampaign = await Campaign.findByIdAndUpdate(
      CampaignId,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updatedCampaign) {
      return res.status(StatusCodes.NOT_FOUND).json({ msg: 'Campaign not found or no changes made' });
    }

    res.status(StatusCodes.OK).json({ msg: 'Change has been successfully made', updatedCampaign });
  } catch (error) {
    console.log(error);
    res.status(StatusCodes.BAD_REQUEST).json({ msg: error.message });
  }
};

// Get Single Campaign

const getCampaign = async (req, res) => {
  const {
    params: { id: campaignId },
  } = req;

  const camp = await Campaign.findOne({ _id: campaignId })

  if (!camp) {
    res.status(StatusCodes.NOT_FOUND).json({ msg: 'Campaign does not exist' });
  }

  res.status(StatusCodes.OK).json({
    campaign: camp,
  });
};

const getAllCampaigns = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let sort = {};
    if (req.query.sort) {
      const sortFields = req.query.sort.split(',').join(' ');
      sort = sortFields;
    }

    const campaigns = await Campaign.find({})
      .select('title price _id') // Select specific fields
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Campaign.countDocuments({});

    res.status(200).json({
      status: 'success',
      count: campaigns.length,
      page,
      pages: Math.ceil(total / limit),
      total,
      data: campaigns,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

const getAllVerifiedCampaigns = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let sort = {};
    if (req.query.sort) {
      const sortFields = req.query.sort.split(',').join(' ');
      sort = sortFields;
    }

    const campaigns = await Campaign.find({ isVerified: true })
      .select('title price _id') // Select specific fields
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Campaign.countDocuments({ isVerified: true });

    res.status(200).json({
      status: 'success',
      count: campaigns.length,
      page,
      pages: Math.ceil(total / limit),
      total,
      data: campaigns,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

const createCampaign = async (req, res) => {
  try {
    req.body.createdBy = req.user._id
    req.body.isVerified = req.user.isVerified
    
      const campaignData = req.body;
      const newCampaign = new Campaign(campaignData);
      await newCampaign.save();

      res.status(201).json({
          message: 'Campaign created successfully',
          campaign: newCampaign
      });

  } catch (error) {
      res.status(400).json({
          message: 'Error creating campaign',
          error: error.message
      });
  }
};

module.exports = { editCampaign, getCampaign, getAllCampaigns, getAllVerifiedCampaigns, createCampaign };
