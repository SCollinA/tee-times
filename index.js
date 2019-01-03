const {User} = require ('./models/Users')
const {TeeTimes} = require('./models/TeeTimes')

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
    if (req.session.user._id) {
        console.log('user is logged in')
        next()
    } else {
        console.log('user is NOT logged in')
        res.redirect('/login')
    }
}

app.get('/', checkUser, (req, res) => {
    
    res.send('Hello')
})

// create user
app.post('/register', (req, res) => {
    console.log('adding new user')
    const name = req.body.name.toLowerCase()
    const password = req.body.password
    const saltRounds = 10
    const salt = bcrypt.genSaltSync(saltRounds);
    const pwhash = bcrypt.hashSync(password, salt)
    const newUser = new User({name, pwhash})
    newUser.save(err => {
        if (err) {
            console.log(err)
        } else {
            res.redirect('/')
        }
    })
})

// retrieve user
app.post('/login', (req, res) => {
    console.log('logging in user')
    const name = req.body.name.toLowerCase()
    const password = req.body.password
    User.findOne({name})
    .then(user => {
        if (bcrypt.compareSync(password, user.pwhash)) {
            req.session.user = user
            res.redirect('/')
        } else {
            console.log('bad password')
            res.send()
        }
    })
    .catch(() => {
        console.log('username not found')
        res.send()
    })
})

// update user
app.get('/logout', (req, res) => {
    console.log('logging out user')
    req.session.destroy()
    res.send()
})

app.post('/', checkUser, (req, res) => {
    console.log('updating new user')
    res.send()
})

// delete user
// app.delete('/user', (req, res) => {
//     console.log('deleting new user')
//     res.send()
// }) 

app.listen(port, () => console.log(`My Tee Times App listening on port ${port}!`))