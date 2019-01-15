const mongoose = require('mongoose')
const Schema = mongoose.Schema
const {ObjectId} = mongoose.Schema.Types

const {UserSchema} = require('./Users')

const TeeTimeSchema = new Schema({
    teeType: String,
    date: Date,
    golfers: [ObjectId],
    guests: Number 
})

const TeeTime = mongoose.model('TeeTime', TeeTimeSchema)

module.exports = {TeeTime, TeeTimeSchema} 