const mongoose = require('mongoose');
const bcrypt = require ('bcrypt');
const Schema = mongoose.Schema;

const userSchema = new mongoose.Schema(
  {
    username: {
        type: String,
        required: true,
        unique: true,
        },
    password: {
        type: String,
        required: true,
        },
    email: {
      type: String,
      required: true,
      unique: true,
      match: /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/i,
     },
    nombre: {
      type: String,
      required: true,
    },
    apellido:{
      type: String,
      required: true,
    },
    sexo:{
      type: String,
      required: true,
    },
    fechaNacimiento:{
      type: Date,
      required: true,
    },
    foto:{
      type: String,
      required: true,
    }
    },
    {timestamps:true});
    
    // para encriptar las contraseña antes de guardar el usuari
    userSchema.pre('save', async function (next){
      if(!this.isModified('password')) return next();
      this.password = await bcrypt.hash(this.password, 10);
      next();
    });
    
    //comparar contraseña
    userSchema.method.comparePassword = async function (password) {
      return bcrypt.compare(password, this.password);
    };

    const Usuario = mongoose.model('Usuario', userSchema);
    module.exports=Usuario;