const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  lastActivity: { type: Date, default: Date.now },
  failedAttempts: { type: Number, default: 0 }, //numero de los intentos fallidos
});

const Log = mongoose.model('Log', activitySchema);
module.exports = Log;
