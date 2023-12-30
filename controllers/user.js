const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, UnauthenticatedError } = require('../errors');

const mongoose = require('mongoose');

const editUser = async (req, res) => {
  try {
    const { id: userId } = req.params;
    const changes = req.body; // Contains changes for different nested schemas

    let update = {};
    for (let key in changes) {
      if (changes.hasOwnProperty(key)) {
        update[key] = changes[key];
      }
    }

    // Updating the user document
    const updatedUser = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });

    if (!updatedUser) {
      return res.status(StatusCodes.NOT_FOUND).json({ msg: 'User not found or no changes made' });
    }

    res.status(StatusCodes.OK).json({ msg: 'Change has been successfully made', updatedUser });
  } catch (error) {
    console.log(error);
    res.status(StatusCodes.BAD_REQUEST).json({ msg: error.message });
  }
};

// Get Single User

const getUser = async (req, res) => {
  const {
    params: { id: userId },
  } = req;

  const user = await User.findOne({ _id: userId }).select('-data.password');

  if (!user) {
    res.status(StatusCodes.NOT_FOUND).json({ msg: 'User does not exist' });
  }

  res.status(StatusCodes.OK).json({
    userData: user,
  });
};



module.exports = { editUser, getUser };
