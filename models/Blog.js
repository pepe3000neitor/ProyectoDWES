const mongoose = require('mongoose')
const Schema = mongoose.Schema

const blogSchema = new Schema({
    title:{
        type:String,
        required:true
    },
    snippet:{
        type:String,
        required:true
    },
    body:{
        type:String,
        required:true
    },
    imagePath:{
        type:String, //este campo alamcenara la ruta de la imagen subida
        required:true
    }

    


},{timestamps:true});

const Blog = mongoose.model('Blog',blogSchema);
module.exports = Blog;