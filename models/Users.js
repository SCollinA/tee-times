const mongoose = require('mongoose')
const Schema = mongoose.Schema

const UserSchema = new Schema({
    name: String,
    pwhash: String,
    userType: String
})

const User = mongoose.model('User', UserSchema)

module.exports = {User, UserSchema}