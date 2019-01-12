const mongoose = require('mongoose')
const Schema = mongoose.Schema
const {ObjectId} = mongoose.Schema.Types

// const FriendShipSchema = require('./FriendShip')

const UserSchema = new Schema({
    name: String,
    pwhash: String,
    picture: Buffer,
    userType: String,
    friends: [ObjectId],
    requestedFriends: [ObjectId],
    friendRequests: [ObjectId]
})

const User = mongoose.model('User', UserSchema)

module.exports = {User, UserSchema}