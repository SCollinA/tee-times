const mongoose = require('mongoose')
const Schema = mongoose.Schema

const {TeeTimeSchema} = require('./TeeTimes')

const UserSchema = new Schema({
    name: String,
    teeTimes: [TeeTimeSchema],
    pwhash: String
})

const User = mongoose.model('User', UserSchema)

module.exports = {User, UserSchema}