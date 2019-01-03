const mongoose = require('mongoose')
const Schema = mongoose.Schema

const {TeeTimeSchema} = require('./TeeTimes')

const UserSchema = new Schema({
    name: String,
    pwhash: String,
    teeTimes: [TeeTimeSchema],
})

const User = mongoose.model('User', UserSchema)

module.exports = {User, UserSchema}