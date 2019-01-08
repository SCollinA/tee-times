const {User} = require ('./models/Users')
const {TeeTime} = require('./models/TeeTimes')

const express = require('express')
const mongoose = require('mongoose') 
const {ObjectId} = mongoose.Schema.Types
const session = require('express-session')
const MongoDBStore = require('connect-mongodb-session')(session)
const bodyParser = require('body-parser')
const assert = require('assert')
const bcrypt = require('bcrypt')

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

app.use(bodyParser.urlencoded({extended: false}))

app.use(bodyParser.json())

function checkUser(req, res, next) {
    console.log('checking user')
    if (req.session.user && req.session.user._id) {
        console.log('user is logged in')
        next()
    } else {
        console.log('user is NOT logged in')
        res.redirect('/login')
    }
}

function sendTeeTimes(req, res) {
    const username = req.session && req.session.user ? req.session.user.name : ''
    getTeeTimes(username)
    .then(teeTimes => {
        console.log('sending tee times')
        return res.send(teeTimes)
    })
}

function getTeeTimes(name) {
    console.log('getting tee times')
    // get all tee times
    return TeeTime.find()
    .then(allTeeTimes => {
        // get all users
        return User.find()
        .then(allUsers => {
            // get the user
            return User.findOne({name})
            .then(user => {
                const userFriends = allUsers.filter(golfer => user.friends.find(friendshipID => golfer.friends.includes(friendshipID)))
                return TeeTime.find({ golfers: {$all: [user]}})
                .then(userTeeTimes => {
                    return {
                        user,
                        userFriends,
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
            const password = req.body.password
            const userType = req.body.userType
            const saltRounds = 10
            const salt = bcrypt.genSaltSync(saltRounds);
            const pwhash = bcrypt.hashSync(password, salt)
            const newUser = new User({name, pwhash, userType})
            newUser.save((err, user) => {
                if (err) {
                    return handleError(err)
                } else {
                    console.log('new user saved')
                    req.session.user = user
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
        } 
        else {
            console.log('bad password')
            //     res.send()
        }
        next()
    })
    .catch(() => {
        console.log('username not found')
        next()
        // res.send()
    })
}, sendTeeTimes)

// update user
app.get('/logout', (req, res, next) => {
    console.log('logging out user')
    req.session.destroy()
    next()
}, sendTeeTimes)

app.post('/requestFriend', checkUser, (req, res, next) => {
    console.log('requesting friend')
    const {requestingUser, requestedFriend} = req.body.friends
    const friendshipID = new ObjectId()
    User.update({_id: requestingUser._id}, {requestedFriends: [...requestingUser.requestedFriends, friendshipID]})
    .then(() => User.update({_id: requestedFriend._id}, {friendRequests: [...requestedFriend.friendRequests, friendshipID]}))
    .then(() => next())
}, sendTeeTimes)

app.post('/approveFriend', checkUser, (req, res, next) => {
    console.log('approving friend')
    const {approvingFriend, approvedFriend} = req.body.friends
    const friendshipID =  approvingFriend.friendRequests.find(friendRequest => approvedFriend.requestedFriends.includes(friendRequest))
    // they swap friendshipIDs :')
    User.update({_id: approvingFriend._id}, {friends: [...approvingFriend.friends, friendshipID]})
    .then(() => User.update({_id: approvedFriend._id}, {friends: [...approvedFriend.friends, friendshipID]}))
    .then(() => next())
}, sendTeeTimes)

app.post('/denyFriend', checkUser, (req, res, next) => {
    console.log('denying friend')
    const {denyingFriend, deniedFriend} = req.body.friends
    const friendshipID =  denyingFriend.friendRequests.find(friendRequest => deniedFriend.requestedFriends.includes(friendRequest))
    User.update({_id: denyingFriend._id}, {friendRequests: denyingFriend.friendRequests.filter(friendRequest => friendRequest !== friendshipID)})
    .then(() => User.update({_id: deniedFriend._id}, {requestedFriends: deniedFriend.requestedFriends.filter(requestedFriend => requestedFriend !== friendshipID)}))
    .then(() => next())
}, sendTeeTimes)

app.post('/removeFriend', checkUser, (req, res, next) => {
    console.log('removing friend')
    const {removingFriend, removedFriend} = req.body.friends
    const friendshipID =  removingFriend.friends.find(friendRequest => removedFriend.friends.includes(friendRequest))
    User.update({_id: removingFriend._id}, {friends: removingFriend.friends.filter(friend => friend !== friendshipID)})
    .then(() => User.update({_id: removedFriend._id}, {friends: removedFriend.friends.filter(friend => friend !== friendshipID)}))
    .then(() => next())
}, sendTeeTimes)

app.post('/updateUser', checkUser, (req, res, next) => {
    console.log('updating user')
    const updatingUser = req.body.user
    User.update({_id: updatingUser._id}, {...updatingUser})
    .then(() => next())
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