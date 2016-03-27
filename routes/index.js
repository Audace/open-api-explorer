var express = require('express');
var mongoose = require('mongoose');
var Post = mongoose.model('Post');
var router = express.Router();
var request = require('request');
var elasticsearch = require('elasticsearch');
var SwaggerParser = require('swagger-parser');

var client = new elasticsearch.Client();
var client = elasticsearch.Client({
  host: 'localhost:9200'
});

/* GET posts page. */
router.get('/posts', function(req, res, next) {
  Post.find(function(err, posts){
    if(err){ return next(err); }

    res.json(posts);
  });
});

/* POST posts page. */
router.post('/posts', function(req, res, next) {
  var post = new Post(req.body);

  request(post.link, function(err, res, bod) {
    if (!err && res.statusCode == 200) {
      var spec = JSON.parse(bod);
      client.index({
        index: 'explore',
        type: 'api',
        id: post.id,
        body: bod
      }, function(err, resp) {});
    } else {
      console.log("Got an error: ", err, ", status code: ", res.statusCode);
    }
  });

  post.save(function(err, post){
    if(err){ return next(err); }

    res.json(post);
  });
});

/* Post params page. */
router.param('post', function(req, res, next, id) {
  var query = Post.findById(id);

  query.exec(function (err, post){
    if (err) { return next(err); }
    if (!post) { return next(new Error('can\'t find post')); }

    req.post = post;
    return next();
  });
});

/* GET post page. */
router.get('/posts/:post', function(req, res) {
  res.json(req.post);
});

/* PUT upvote page. */
router.put('/posts/:post/upvote', function(req, res, next) {
  req.post.upvote(function(err, post){
    if (err) { return next(err); }

    res.json(post);
  });
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


module.exports = router;