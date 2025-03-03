const { v4 } = require("uuid");
const fs = require("fs");
const mongoose = require("mongoose");
const HttpError = require("../models/http-error");
const { validationResult } = require("express-validator");
const Blog = require("../models/blog");
const User = require("../models/user");
const Redis = require("redis");
const redisClient =Redis.createClient();
const DEFAULT_EXPIRATION =3600;
redisClient.connect().then().catch((err) => console.log(err))
const getBlogs = async (req, res, next) => {
  let blogs;
  blogs=await redisClient.get("blogs");
  if(blogs!=null){
    console.log("Cache hit")
    res.json({ blogs: JSON.parse(blogs)});
  }
  else {
    console.log("Cache miss")
    try {
      blogs = await Blog.find({}, "-content");
    } catch (err) {
      return next(new HttpError("couldn't get all blogs", 500));
    }
    blogs=blogs.map((blog) => blog.toObject({ getters: true })) 
    await redisClient.setEx("blogs",DEFAULT_EXPIRATION,JSON.stringify(blogs));
    res.json({ blogs: blogs});
  }
};

const getBlogById = async (req, res, next) => {
  const blogId = req.params.bid; //reqs object has params property
  //   find returns the first item in the array that satisfy a test
  let blog=await redisClient.get("blogs"+blogId);
  if(blog!=null){
    console.log("Cache hit")
    res.json({ blog: JSON.parse(blog)});
  }
  else {
    console.log("Cache miss")
    try {
      // findById is a function directly applied to the constructor
      // it don't return a promise but we can use .exec() to convert it to a promise
      // but mongoose allow us to use aync await too.
      blog = await Blog.findById(blogId);
    } catch (err) {
      return next(new HttpError("Couldn't get the blog from the database", 500));
    }
    if (!blog) {
      // how to trigger the error handling middleware either throw new error here or pass the error to next function
      // if we are in async midddleware(database) we should use next(error) else we can use throw
      return next(
        new HttpError("Couldn't find the blog for provided blog Id", 404)
      );
    }
    // blog is a mongoose object hence we convert it into a js object and we set getters:true so that we get an additional id field
    blog=blog.toObject({ getters: true });
    await redisClient.setEx("blogs"+blogId,DEFAULT_EXPIRATION,JSON.stringify(blog));
    res.json({ blog: blog});
  }
};

const getLikedUsers = async (req, res, next) => {
  const blogId = req.params.bid;
  let blog;
  try {
    blog = await Blog.findById(blogId);
  } catch (err) {
    return next(new HttpError("Couldn't get the blog from the database", 500));
  }
  if (!blog) {
    return next(
      new HttpError(
        "Couldn't find the blog for provided blog Id while liking the blog",
        404
      )
    );
  }
  res.json({ likedUsers: blog.likeCount.toObject({ getters: true }) });
};

const updateLikedUsers = async (req, res, next) => {
  const blogId = req.params.bid;
  let blog;
  try {
    blog = await Blog.findById(blogId);
  } catch (err) {
    return next(new HttpError("Couldn't get the blog from the database", 500));
  }
  if (!blog) {
    return next(
      new HttpError(
        "Couldn't find the blog for provided blog Id while updating the blog",
        404
      )
    );
  }
  try {
    await blog.likeCount.push(req.body.userId);
    blog.save();
  } catch (err) {
    return next(new HttpError("Couldn't like the blog!", 500));
  }
  res.json({ message: "Updated the liked Users" });
};

const getBlogsByUserId = async (req, res, next) => {
  const userId = req.params.uid;
  let userWithBlogs=await redisClient.get("userBlogs"+userId);
  if(userWithBlogs!=null){
    console.log("Cache hit")
    res.json({ blogs: JSON.parse(userWithBlogs)});
  }
  else {
    try {
      // it will populate the blogs field of userWithBlogs with the blogs
      userWithBlogs = await User.findById(userId).populate("blogs");
    } catch (err) {
      return next(new HttpError("Fetching Blogs is failed", 500));
    }
    if (!userWithBlogs || userWithBlogs.length === 0) {
      return next(
        new HttpError("Couldn't find the blogs for provided userId", 404)
      );
    }
    console.log("cache miss");
    userWithBlogs=userWithBlogs.blogs.map((e) => e.toObject({ getters: true }));
    await redisClient.setEx("userBlogs"+userId,DEFAULT_EXPIRATION,JSON.stringify(userWithBlogs));
    res.json({
      blogs: userWithBlogs
    });
  }
};

const createBlog = async (req, res, next) => {
  // this function will look into request and return an errors array ,the result of validators middleware setup in the routes file.
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Provided data is invalid,Please check!", 422));
  }
  const { title, description, content, creator, date } = req.body; //added by bodyParser
  // what about uploading images??
  const createdBlog = new Blog({
    title,
    description,
    content,
    image: req.file.path,
    creator,
    date,
    likedUsers: [],
  });

  let user;
  try {
    // whether there is a user with the creator id provided
    user = await User.findById(creator);
    console.log(user);
  } catch (err) {
    return next(new HttpError("Creating Blog failed!", 500));
  }

  if (!user) {
    return next(new HttpError("Couldn't find user for provided id", 404));
  }

  // we have to do two things save the blog and add the blog id into the user,and undo everything if anything fails
  // we can use transactions build upon session for this
  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    // session we are in
    // Here if we don't have an existing collection manually collections are not created
    // console.log("CreatedBlog saving..");
    await createdBlog.save({ session: sess });
    // this is not normal JS push but mongoose push where mongoose adds the only id of the createdBlog into the user
    // console.log("CreatedBlog saved..");
    await user.blogs.push(createdBlog);
    // we can update the user and save it back to the database
    // console.log("User saving..")
    await user.save({ session: sess });
    // console.log("User saved")
    await sess.commitTransaction();
    await redisClient.del("userBlogs"+creator);
    console.log("userblogs cache cleared")
    await redisClient.del("blogs");
    console.log("blogs cache cleared")
  } catch (error) {
    return next(new HttpError("Couldn't create a blog!", 500));
  }

  res.status(201).json({ blog: createdBlog });
};

const updateBlog = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Provided data is invalid,Please check!", 422));
  }
  const { title, description, content, date } = req.body;
  const blogId = req.params.bid;

  let blog;
  try {
    blog = await Blog.findById(blogId);
  } catch (err) {
    return next(new HttpError("Something went wrong during update blog", 500));
  }
  if(blog.creator.toString() !==req.userData.userId){
    return next(new HttpError('You are not allowed to edit this place',401));
  }
  blog.title = title;
  blog.description = description;
  blog.content = content;
  blog.date = date;

  try {
    // there is save() function associated with blog returned using .findById as well
    await blog.save();
    await redisClient.del("blogs"+blogId)
    console.log("blogsbyId cache cleared")
    await redisClient.del("userBlogs"+req.userData.userId);
    console.log("userblogs cache cleared")
    await redisClient.del("blogs");
    console.log("blogs cache cleared")
  } catch (err) {
    return next(
      new HttpError("Couldn't save the updated blog into the database!", 500)
    );
  }

  res.status(200).json({ blog: blog.toObject({ getters: true }) });
};

const deleteBlog = async (req, res, next) => {
  const blogId = req.params.bid;
  let blog;
  try {
    // populate allows us to work with document of other collection and we need relation between two documents of the collections and now we get the user with the creator id and we can work with that too.
    // henceforth we can work with the user linked to this blog by the creator id using blog.creator
    blog = await Blog.findById(blogId).populate("creator");
  } catch (err) {
    return next(new HttpError("Something went wrong!", 500));
  }

  const imagePath = blog.image;  

  if (!blog) {
    return next(new HttpError("Couldn't find blog with id!", 404));
  }

if(place.creator.id!==req.userData.userId){
  return next(new HttpError('You are not allowed to delete this place',401));
}

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await blog.remove({ session: sess });
    // pull will automatically remove id of the blog from the blogs array of the user
    // we can blogs.pull and save because creator thanks to populate gives the user linked to the blog and through it we can actually remove the id blog.
    blog.creator.blogs.pull(blog);
    await blog.creator.save({ session: sess });
    await sess.commitTransaction();
    await redisClient.del("blogs"+blogId)
    console.log("blogsbyId cache cleared")
    await redisClient.del("userBlogs"+req.userData.userId);
    console.log("userblogs cache cleared")
    await redisClient.del("blogs");
    console.log("blogs cache cleared")
  } catch (err) {
    return next(new HttpError("Couldn't delete the blog!", 500));
  }
  fs.unlink(imagePath,err=>{
    console.log(err);
  });
  res.status(200).json({ message: "Deleted" });
};

exports.getBlogs = getBlogs;
exports.getBlogById = getBlogById;
exports.getBlogsByUserId = getBlogsByUserId;
exports.createBlog = createBlog;
exports.updateBlog = updateBlog;
exports.deleteBlog = deleteBlog;
exports.getLikedUsers = getLikedUsers;
exports.updateLikedUsers = updateLikedUsers;
