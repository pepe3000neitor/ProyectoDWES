const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // Ensure bcrypt is imported
const Schema = mongoose.Schema;

const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    age: Number,
    nationality: String,
    gender: String,
    email: String,
    dateOfBirth: Date,
    imagePath: String,

  });
const User = mongoose.model('User', userSchema);
module.exports=User;