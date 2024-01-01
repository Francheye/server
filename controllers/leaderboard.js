const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, UnauthenticatedError } = require('../errors');

const getAllCreatorsYoutube = async (req, res) => {
    try {
      const { page = 1, limit = 10, sortBy = 'analytics.youtube.lifeTimeTotalViews', sortOrder = -1 } = req.query;
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder; // Dynamic sorting
  
      const matchQuery = {
        'type': 'creator',
        'analytics.youtube': { $exists: true, $ne: null }
      };
  
      // Additional query parameters for filtering based on tags
      if (req.query.region) matchQuery['tags.region'] = req.query.region;
      if (req.query.niche) matchQuery['tags.niche'] = { $in: [req.query.niche] };
      if (req.query.partner) matchQuery['tags.partner'] = { $in: [req.query.partner] };

  
      const creators = await User.find(matchQuery)
        .sort(sortOptions)
        .select('data.name _id analytics.youtube.lifeTimeTotalViews analytics.youtube.thirtyDaysViews analytics.youtube.avgViews')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();
  
      res.status(200).json(creators);
    } catch (error) {
      console.error('Error fetching creators:', error);
      res.status(500).send('Youtube Leader board is experiencing downtime, please contact support');
    }
  };
  

module.exports = { getAllCreatorsYoutube };
