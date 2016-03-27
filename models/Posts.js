var mongoose = require('mongoose');

var PostSchema = new mongoose.Schema({
  title: String,
  link: String
});

mongoose.model('Post', PostSchema);
