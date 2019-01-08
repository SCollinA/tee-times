const mongoose = require('mongoose')
const Schema = mongoose.Schema

const FriendShipSchema = require('./FriendShip')

const UserSchema = new Schema({
    name: String,
    pwhash: String,
    userType: String,
    friends: [FriendShipSchema]
})

const User = mongoose.model('User', UserSchema)

module.exports = {User, UserSchema}