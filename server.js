const express = require('express')
const app = express()
const authController  = require('./auth')
const authJwtController = require('./auth_jwt')
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
db = require('./db.js')()
const passport = require('passport')
const port = process.env.PORT || 3000
const User = require('./Schema/User')
const Movie = require('./Schema/Movie')
const Review = require('./Schema/Review')
const jwtDecode = require('jwt-decode');
const cors = require('cors');
const sha1 = require('sha1');
const crypto = require("crypto");
const GA_TRACKING_ID = process.env.GA_KEY;
const  rp = require('request-promise');
app.use(cors());
require('dotenv').config()
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(passport.initialize());

mongoose.connect(`mongodb+srv://${process.env.USER_NAME_DB}:${process.env.PASSWORD_DB}@cluster0-n7zxr.mongodb.net/test?retryWrites=true&w=majority`)
var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));


var router = express.Router()

app.use('/',router)



function trackDimension(category, action, label, value, dimension, metric) {

    var options = { method: 'GET',
        url: 'https://www.google-analytics.com/collect',
        qs:
            {   // API Version.
                v: '1',
                // Tracking ID / Property ID.
                tid: GA_TRACKING_ID,
                // Random Client Identifier. Ideally, this should be a UUID that
                // is associated with particular user, device, or browser instance.
                cid: crypto.randomBytes(16).toString("hex"),
                // Event hit type.
                t: 'event',
                // Event category.
                ec: category,
                // Event action.
                ea: action,
                // Event label.
                el: label,
                // Event value.
                ev: value,
                // Custom Dimension
                dimension1: dimension,
                // Custom Metric
                metric1: metric
            },
        headers:
            {  'Cache-Control': 'no-cache' } };

    return rp(options);
}
router.post('/signup', (req, res) =>
{
    if(req.body.username && req.body.password && req.body.name){
        var password = sha1(req.body.password);
        var newUser = new User({
            username: req.body.username,
            password: password,
            name: req.body.name
        });
        newUser.save(function (err, result) {
            if (err) {
              console.error(err);
              res.status(200).send({success: false,msg:"User already in the database"})
              return
            }
              res.status(200).send({success: true, msg: 'Successful created new user.'})
        });


    }
    else{
        res.status(500).send({success: false, msg:"In valid request"})
    }

})


router.post('/signin', (req, res) => {
    //var user = db.findOne(req.body.username);

        if(typeof req.body.username == "undefined"|| typeof req.body.password == "undefined" ){
            return res.status(401).send({success: false, msg: 'Please input username or passwpord'});
        }
        var password = sha1(req.body.password);
        User.findOne({username: req.body.username,password: password},function(err,result){

                if (err) res.status(401).send({success: false, msg: 'Authentication failed. Wrong password.'});

                    if(!result) res.status(401).send({success: false, msg: 'Authentication failed. Wrong password.'});
                    else {
                        var userToken = {id: result._id, username: result.username,name:result.name};
                        var token = jwt.sign(userToken, process.env.SECRET_KEY);
                        res.json({success: true, token: 'Bearer ' + token})
                    }

            })
})


router.route('/movies')
    .get(authJwtController.isAuthenticated, function(req,res){

        //Pass review == false
       if(typeof req.body.reviews !== "undefined"  && req.body.reviews.toLowerCase() === "true"){
           if (typeof req.body.title !== "undefined"){
               //Do a look up here
               Movie.aggregate([
                   { $match : { Title :   req.body.title} },
                   { $lookup:
                           {
                               localField: "Title",
                               from: "reviews",
                               foreignField: "movie_name",
                               as: "reviews"
                           }
                   }
               ],function(err,result){
                   res.status(200).send({success:"True",results: result})
               })
           }
           else {
               Movie.aggregate([
                   { $lookup:
                           {
                               localField: "Title",
                               from: "reviews",
                               foreignField: "movie_name",
                               as: "reviews"
                           }
                   }
               ],function(err,result){
                   res.status(200).send({success:"True",results: result})
               })
           }
       }
       else{
           if (typeof req.body.title !== "undefined"){
               Movie.findOne({Title: req.body.title}, function(err, result) {
                   if (err) return res.status(500).send({success:false,msg:"There is something wrong with the database"})
                   else if(!result) return res.status(200).send({success:false,msg:"There is something wrong with your input"})
                   else {
                       return res.status(200).send({success: true, result:result});
                   }
               })
           }
           else {
               Movie.find({}, function(err, result) {
                   if (err) return res.status(500).send({success:false,msg:"There is something wrong with the database"})
                   else if(!result) return res.status(200).send({success:false,msg:"There is something wrong with your input"})
                   else {
                       return res.status(200).send({success: true, result:result});
                   }
               })
           }
       }



})

router.route('/movies')
    .post(authJwtController.isAuthenticated, function(req, res) {
    if(req.body.Actor.length < 3){
        return res.status(200).send({success:false, msg:"Check your input, your actor field is less than 3"})
    }
    let newMovie = new Movie({Title:req.body.title, yearReleased: req.body.yearReleased,Genre:req.body.Genre, Actor:req.body.Actor})

        newMovie.save(function (err, result) {
            if (err) {
                //console.error(err);
                return res.status(200).send({success:false, msg:"Something wrong with your input"})

            }
            if(!result) return res.status(200).send({success:false, msg:"Movies already in the database"})
            return res.status(200).send({success: true, msg: 'Successful store new movies.'})
        });

    })
router.route('/movies')
    .put(authJwtController.isAuthenticated, function (req, res) {
        if(req.body.Actor.length < 3){
            return res.status(200).send({success:false, msg:"Check your input, your actor field is less than 3"})
        }
        Movie.findOneAndUpdate({Title: req.body.title}, {Title:req.body.title, yearReleased: req.body.yearReleased,Genre:req.body.Genre, Actor:req.body.Actor}, function(err, result) {
            if (err) return res.status(500).send({success:false,msg:"There is something wrong with the database"})
            if(!result) return res.status(200).send({success:false,msg:"There is something wrong with your input"})

            return res.status(200).send({success:true,msg:'Succesfully saved.'});
        })

    })
router.route('/movies')
    .delete(authJwtController.isAuthenticated, function(req,res){

    Movie.findOneAndDelete({ Title: req.body.title }, function(err, result) {

            if (err) {
                return res.status(500).send({success:false,msg:"Something wrong, Please contact your admin"});
            }
            if(!result)
            {
                return res.status(200).send({success:false,msg:"Movie not in the database"});
            }
            else{
                return res.status(200).send({success:true, msg:"Movie is deleted"});
            }
        });
    })

router.route('/reviews')
    .post(authJwtController.isAuthenticated, function(req,res){

        let token = req.headers['authorization']
        let decode = jwtDecode(token);
        let author_name = decode.username
        //Check if the movies is in the movie database
        Movie.findOne(  {Title: req.body.title }, function (err, result) {
            if (err) {
                console.log(err)
                res.status(500).send({success: false, msg: "Something is wrong with your input"})
                res.end();
            }
            else if (!result) {
                res.status(200).send({success: false, msg: "Movies are not in the database"})
                res.end();
            }
            else{
                //Get the token
                //Decode so I have username

                let newReview = new Review(
                    {movie_name:req.body.title, review: req.body.review,Rating: req.body.rating, author_name: author_name}
                )

                newReview.save(function (err, result) {
                    console.log("Goto review movie")
                    if (err) {
                        res.status(500).send({success:false, msg:"Something wrong with your input"})
                        res.end();
                    }
                    else if(!result) {
                        res.status(200).send({success: false, msg: "Something wrong with your input"})
                        res.end();
                    }
                    else {
                        let rating = req.body.rating
                        let movies_name = req.body.title
                        trackDimension('Feedback', 'Rating', 'Feedback for Movie', rating, movies_name, '1').then(function (response) {
                            console.log(response.body);
                        })


                        res.status(200).send({success: true, msg: 'Successful store new reviews.'})
                        res.end();
                    }
                });

            }

        })


    })

router.route('/reviews')
    .get(authJwtController.isAuthenticated, function(req,res){
        //Check to see if movie is in the dabase
        Movie.find({Title: req.body.title}, function (err, result) {
            if (err) {
                console.log(err)
                return res.status(500).send({success: false, msg: "Some thing wrong with your input"})
            }
            if (!result) {
                return res.status(200).send({success: false, msg: "Movies are not in the database"})
            }
        })

        Review.find({Title:req.body.title},function(err,result){
            if(err) {
                console.log(err)
                res.status(500).send({success: false, msg: "Some thing wrong with your input"})
            }
            if(!result){
                res.status(200).send({success: false, msg: "Movies are not in the database"})
            }
            else{
                res.status(200).send({success: true, result:result })
            }
        })

    })

app.listen(port, () => console.log(`HW2 app listening on port ${port}!`))

module.exports = app