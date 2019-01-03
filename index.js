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
    .then(teeTimes => {
        // get the user
        return User.findOne({name})
        .then(user => {
            return {
                user,
                teeTimes
            }
        })
        .catch(err => {
            return {
                user: {},
                teeTimes
            }
        })
    })
}

app.get('/', sendTeeTimes)

// create user 
app.post('/register', (req, res, next) => {
    console.log('adding new user')
    const name = req.body.name.toLowerCase()
    const password = req.body.password
    const saltRounds = 10
    const salt = bcrypt.genSaltSync(saltRounds);
    const pwhash = bcrypt.hashSync(password, salt)
    const newUser = new User({name, pwhash})
    newUser.save(err => {
        if (err) return handleError(err)
    })
    console.log('new user saved')
    req.session.user = newUser
    next()
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

app.post('/', checkUser, (req, res, next) => {
    console.log('updating new user')
    next()
}, sendTeeTimes)

// delete user
app.delete('/user', (req, res) => {
    console.log('deleting new user')
    res.send()
}) 

// create tee time
app.post('/teetime', checkUser, (req, res, next) => {
    console.log('adding new teetime')
    const date = req.body.teeTime
    const newTeeTime = new TeeTime({date})
    User.findOne({name: req.session.user.name})
    .then(user => {
        user.teeTimes.push(newTeeTime)
        user.save(err => {
            if (err) return handleError(err)
        })
    })
    .then(() => {
        next()
    })
}, sendTeeTimes)

// update tee time

// delete tee time

app.listen(port, () => console.log(`My Tee Times App listening on port ${port}!`))