const mongoose = require('mongoose')
const Schema = mongoose.Schema

const {UserSchema} = require('./Users')

const TeeTimeSchema = new Schema({
    teeType: String,
    date: Date,
    golfers: [UserSchema]
})

const TeeTime = mongoose.model('TeeTime', TeeTimeSchema)

module.exports = {TeeTime, TeeTimeSchema}