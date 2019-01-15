const {User} = require ('./models/Users')
const {TeeTime} = require('./models/TeeTimes')

const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose') 
const session = require('express-session')
const MongoDBStore = require('connect-mongodb-session')(session)
const bodyParser = require('body-parser')
const assert = require('assert')
const bcrypt = require('bcrypt')
const fs = require('fs')
require('dotenv').config()

const app = express()
const port = 3003
mongoose.connect('mongodb://localhost:27017/tee-times-db', { useNewUrlParser: true })
const store = new MongoDBStore({
    uri: 'mongodb://localhost:27017/tee-times-db',
    collection: 'sessions'
}) 

// catch errors
store.on('error', error => {
    assert.ifError(error)
    assert.ok(false)
})

app.use(session({
    secret: 'random123',
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    },
    store,
    resave: true,
    saveUninitialized: true,
}))

// const corsOptions = {origin: 'https://evanprocter.com'}

app.use(cors()) // set cors header on response

app.options('*', cors()) // include before other routes

app.use(bodyParser.urlencoded({extended: false}))

// app.use(bodyParser.json())

app.use(bodyParser.json({limit: '50mb'}));
// app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

function checkUser(req, res, next) {
    console.log('checking user')
    console.log(req.session, req.session.user)
    if (req.session.user && req.session.user._id) {
        console.log('user is logged in')
        next()
    } else {
        console.log('user is NOT logged in')
        res.redirect('/login')
    }
}

function sendTeeTimes(req, res) {
    const userID = req.session && req.session.user ? req.session.user._id : ''
    getTeeTimes(userID)
    .then(teeTimes => {
        console.log('sending tee times')
        return res.send(teeTimes)
    })
}

function getTeeTimes(_id) {
    console.log('getting tee times')
    // get all tee times
    return TeeTime.find()
    .then(allTeeTimes => {
        // get all users
        return User.find()
        .then(allUsers => {
            // get the user
            return User.findOne({_id})
            .then(user => {
                return TeeTime.find({ golfers: {$all: [_id]}})
                .then(userTeeTimes => {
                    return {
                        user,
                        userTeeTimes,
                        allUsers,
                        allTeeTimes
                    }
                })
            })
            .catch(err => {
                return {
                    user: {},
                    userTeeTimes: [],
                    allUsers,
                    allTeeTimes
                }
            })
        })
    })
}

app.get('/data', sendTeeTimes)

// create user 
app.post('/register', (req, res, next) => {
    console.log('adding new user')
    const name = req.body.name.toLowerCase()
    User.find({name}, (err, res) => {
        if (res.length === 0) {
            const {password, userType, adminPassword} = req.body
            const saltRounds = 10
            const salt = bcrypt.genSaltSync(saltRounds);
            const pwhash = bcrypt.hashSync(password, salt)
            const picture = req.body.picture || Buffer.from(fs.readFileSync(`${process.cwd()}/golf_ball.png`, 'binary'))
            let newUser
            if (adminPassword && bcrypt.compareSync(adminPassword, bcrypt.hashSync(process.env.ADMIN_PW, bcrypt.genSaltSync(saltRounds)))) {
                console.log('good admin password')
                newUser = new User({
                    name, 
                    pwhash, 
                    picture, 
                    userType
                })
            } else {
                console.log('bad admin password')
                newUser = new User({
                    name, 
                    pwhash, 
                    picture, 
                    userType: 'basic'
                })
            }
            newUser.save((err, user) => {
                if (err) {
                    return handleError(err)
                } else {
                    console.log('new user saved')
                    req.session.user = user
                    console.log(req.session.user)
                    next()
                }
            })
        } else {
            console.log('user name taken')
            next()
        }
    })
}, sendTeeTimes)

// retrieve user
app.post('/login', (req, res, next) => {
    console.log('logging in user')
    const name = req.body.name.toLowerCase()
    const password = req.body.password
    User.findOne({name})
    .then(user => {
        if (bcrypt.compareSync(password, user.pwhash)) {
            console.log('good password')
            req.session.user = user
            console.log(req.session.user)
        } 
        else {
            console.log('bad password')
        }
        next()
    })
    .catch(() => {
        console.log('username not found')
        next()
    })
}, sendTeeTimes)

// update user
app.get('/logout', (req, res, next) => {
    console.log('logging out user')
    req.session.destroy(err => next())
}, sendTeeTimes)

app.post('/requestFriend', checkUser, (req, res, next) => {
    console.log('requesting friend')
    const {requestingFriend, requestedFriend} = req.body
    User.updateOne({_id: requestingFriend._id}, {requestedFriends: [...requestingFriend.requestedFriends, requestedFriend._id]})
    .then(() => User.updateOne({_id: requestedFriend._id}, {friendRequests: [...requestedFriend.friendRequests, requestingFriend._id]}))
    .then(() => next())
}, sendTeeTimes)

app.post('/approveFriend', checkUser, (req, res, next) => {
    console.log('approving friend')
    const {approvingFriend, approvedFriend} = req.body
    // they swap friendshipIDs :')
    User.updateOne({_id: approvingFriend._id}, {friends: [...approvingFriend.friends, approvedFriend._id], friendRequests: approvingFriend.friendRequests.filter(friendRequest => friendRequest.toString() !== approvedFriend._id.toString())})
    .then(() => User.updateOne({_id: approvedFriend._id}, {friends: [...approvedFriend.friends, approvingFriend._id], requestedFriends: approvedFriend.requestedFriends.filter(requestedFriend => requestedFriend.toString() !== approvingFriend._id.toString())}))
    .then(() => next())
}, sendTeeTimes)

app.post('/denyFriend', checkUser, (req, res, next) => {
    console.log('denying friend')
    const {denyingFriend, deniedFriend} = req.body
    User.updateOne({_id: denyingFriend._id}, {friendRequests: denyingFriend.friendRequests.filter(friendRequest => friendRequest.toString() !== deniedFriend._id.toString())})
    .then(() => User.updateOne({_id: deniedFriend._id}, {requestedFriends: deniedFriend.requestedFriends.filter(requestedFriend => requestedFriend.toString() !== denyingFriend._id.toString())}))
    .then(() => next())
}, sendTeeTimes)

app.post('/removeFriend', checkUser, (req, res, next) => {
    console.log('removing friend')
    const {removingFriend, removedFriend} = req.body
    User.updateOne({_id: removingFriend._id}, {friends: removingFriend.friends.filter(friend => friend._id.toString() !== removedFriend._id.toString())})
    .then(() => User.updateOne({_id: removedFriend._id}, {friends: removedFriend.friends.filter(friend => friend._id.toString() !== removingFriend._id.toString())}))
    .then(() => next())
}, sendTeeTimes)

app.post('/updateUser', checkUser, (req, res, next) => {
    console.log('updating user')
    const {name, currentPassword} = req.body
    User.findOne({name})
    .then(user => {
        if (bcrypt.compareSync(currentPassword, user.pwhash)) {
            console.log('good password')
            // update the user here
            const updatingUser = req.body
            const newPassword = updatingUser.newPassword || currentPassword
            const newUsername = updatingUser.newUsername.toLowerCase() || name
            const newPicture = updatingUser.newPicture.length < 1000000 && updatingUser.newPicture
            !newPicture ? console.log(`image too large ${updatingUser.newPicture.length}`) : 
            console.log(`image just right :) ${updatingUser.newPicture.length}`)
            // update the password if it has a value
            const saltRounds = 10
            const salt = bcrypt.genSaltSync(saltRounds)
            const pwhash = bcrypt.hashSync(newPassword, salt)
            User.updateOne({_id: updatingUser._id}, 
                {
                    ...updatingUser, 
                    name: newUsername,
                    // either use the new hash password or the old one if not updated
                    pwhash: pwhash,
                    picture: newPicture ? Buffer.from(newPicture) : user.picture
                } 
            ).then(() => {
                User.findById(updatingUser._id)
                .then(user => {
                    // update session user also
                    req.session.user = user
                    console.log('user updated')
                    next()
                })
            })
        } 
        else {
            console.log('bad password')
            next()
        }
    })
    .catch(err => {
        console.log(err)
        next()
    })
}, sendTeeTimes)

// delete user
app.delete('/user', (req, res) => {
    console.log('deleting new user')
    //provide implementation here
    res.send()
}) 

// create tee time
app.post('/teetime', checkUser, (req, res, next) => {
    console.log('adding new teetime')
    const teeTime = req.body.teeTime
    // try to find existing tee time 
    TeeTime.find({date: teeTime.date}, (err, results) => {
        if (results.length > 0) {
            console.log('tee time already exists')
            next()
        } else { // if no existing tee time found, add new tee time
            const newTeeTime = new TeeTime({...teeTime})
            newTeeTime.save()
            .then(() => next())
        }
    })
}, sendTeeTimes)

// update tee time
app.post('/updateTeeTime', checkUser, (req, res, next) => {
    console.log('updating tee time')
    const updatingTeeTime = req.body.teeTime
    // try to find existing tee time
    TeeTime.find({date: updatingTeeTime.date}, (err, results) => {
        // there are already tee times at that time and they are not the new tee time
        if (results.length > 0 && !results.map(result => result._id.toString()).includes(updatingTeeTime._id)) {
            console.log('tee time already exists')
            next()
        } else { // if no existing tee time found, update tee time
            TeeTime.updateOne({_id: updatingTeeTime._id}, {...updatingTeeTime})
            .then(() => next())
        }
    })

}, sendTeeTimes)

// delete tee time
app.delete('/teetime', checkUser, (req, res, next) => {
    console.log('deleting tee time')
    TeeTime.deleteOne({_id: req.body.teeTime._id})
    .then(() => next())
}, sendTeeTimes)

app.listen(port, () => console.log(`My Tee Times App listening on port ${port}!`))