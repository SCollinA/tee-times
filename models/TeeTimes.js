const mongoose = require('mongoose')
const Schema = mongoose.Schema

const TeeTimeSchema = new Schema({
    date: Date
})

const TeeTime = mongoose.model('TeeTime', TeeTimeSchema)

module.exports = {TeeTime, TeeTimeSchema}