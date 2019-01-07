const {User} = require ('./models/Users')
const {TeeTime} = require('./models/TeeTimes')

const express = require('express')
const mongoose = require('mongoose') 
const {ObjectId} = require('mongodb')
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
                return TeeTime.find({ golfers: {$all: [user]}})
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
                    allUsers,
                    allTeeTimes
                }
            })
        })
    })
}

app.get('/', sendTeeTimes)

// create user 
app.post('/register', (req, res, next) => {
    console.log('adding new user')
    const name = req.body.name.toLowerCase()
    const password = req.body.password
    console.log(password);
    const saltRounds = 10
    const salt = bcrypt.genSaltSync(saltRounds);
    const pwhash = bcrypt.hashSync(password, salt)
    const newUser = new User({name, pwhash})
    newUser.save((err, user) => {
        if (err) {
            return handleError(err)
        } else {
            console.log('new user saved')
            req.session.user = user
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

app.post('/updateUser', checkUser, (req, res, next) => {
    console.log('updating user')
    const updatingUser = req.body.user
    User.update({_id: updatingUser._id}, {...updatingUser})
    .then(() => next())
}, sendTeeTimes)

// delete user
app.delete('/user', (req, res) => {
    console.log('deleting new user')
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
        if (results.length > 0) {
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