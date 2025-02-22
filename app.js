require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const fs = require('fs');
const mongoose = require ('mongoose');
const Blog = require('./models/Blog');
const User = require('./models/User');
const Usuario = require('./models/Usuario');
const methodOverride = require('method-override');
const multer = require('multer');
const Activity = require('./models/Log');
const Log = require('./models/Log');
const paypal = require('@paypal/checkout-server-sdk');
const Producto = require('./models/Productos');


// Para autentificar /////////////////////

const passport = require('passport') //para autenticar
const LocalStragegy = require ('passport-local').Strategy // para que sea estrategia local ( no externa, ej: facebook, google)
const sesion = require('express-session') //para cookies y manejo de sesiones
const bcrypt = require('bcryptjs') //para encriptar contraseñas
const flash = require('connect-flash')
//////////////////////////////////////////

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })

const app = express();
const PORT = process.env.PORT || 3000; // Corrección: Agregar un puerto por defecto

//conexion a la bbdd
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`)))
    .catch(error => console.log('Error al conectar a la base de datos', error));

console.log('esto se ejecuta antes o despues de la BBDD?')


//registro ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'vistahtml'));

app.use(bodyParser.urlencoded({ extended: false }));
/*definimos la carpeta public con express static*/
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({extended: true}));
app.use(methodOverride('_method')); // Corrección: "_method" debe ir con guion bajo para funcionar correctamente
/*midelware para gestionar imagenes*/
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

const Environment = new paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID, 
  process.env.PAYPAL_CLIENT_SECRET
);
const PaypalClient = new paypal.core.PayPalHttpClient(Environment);

/////////////////////////////////////////////////////////
//configurar passport
passport.use (new LocalStragegy(async(username, password, done) =>{
  try{
    const usuario = await Usuario.findOne({username}) //compara el usuario con el usuario de la DDBB
    if(!usuario){
      return done (null, false, {message: 'Usuario no encontrado'});
    }
    const isMatch = await bcrypt.compare(password,usuario.password) //compara contraseña con base de datos(encriptada)
    if(!isMatch){
      return done (null, false, {message: 'Contraseña incorrecta'});
    }
    return done (null, usuario); // si esta todo OK, es que nos hemos autentificado bien
  } catch (error){
      return done(error)
  }
}))

passport.serializeUser((usuario, done) =>{ // serializacion del usuario, fuarda una ID para poder acceder a la info del usuario solo manejando la ID
  done(null, usuario.id);
});

//deserializacion del usuario con el ID serializado lo utiliza para obtener toda la info del usuario mas seguro que usar TODOS LOSDATOS
passport.deserializeUser((async(id, done) =>{
  try{
      const usuario = await Usuario.findById(id);
      done(null, usuario);
  } catch (error){
    done(error);
  };
}));

//midleware para cookies

app.use(sesion({
  secret: require('crypto').randomBytes(64).toString('hex'), //ISEN-SESSION //firma de la session de la cookie
  resave: false, //evita que la sesion qse guarde hasta que haya algo que guardar
  saveUninitialized: false, //no crea una sesion hasta que haya algo que guardar
  rolling:true, //renueva la cookie en cada solicitud
  cookie:{
    maxAge: 1000 * 60 * 30, // 30min mantenemos sesion abierta
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash()); // flash messages middleware
app.use((req,res,next) => {
  res.locals.message=req.flash();
  next();
  })

//mensaje la proteccion de rutas usado luego en app.get('/basededatos') verifica si hay sesion activa y valida
function ensureAuthenticated (req,res,next){
 if(req.isAuthenticated()){
    return next(); //si el usuario esta autentificado, nos deja acceder a la ruta
  }
  res.status(401).render('errorAuth',{title:'no autentificado', message:'debes iniciar sesion para acceder a estapag'})
}

////////////////////////////////////////////////////////

//define carpeta uploads y guardamos con extensiones los archivos con un nombre aleatorio
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads')); 
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, filename); 
  },
});

const upload = multer({ storage });



//define la carpeta public con express static
app.use(bodyParser.urlencoded({ extended: false }));
// setup the logger
app.use(morgan('combined', { stream: accessLogStream }))


//rutas
app.get('/', (req, res) => {
  User.find().sort({ _id: -1 }) // Ordena por `_id` en orden descendente
    .then((resultado) => {
      res.render('main', { title: 'INICIO', user: resultado });
    })
    .catch((error) => {
      console.log(error);
    });
});

app.get('/crearUsuario', (req, res) => {
  res.render('crearUsuario', { title: 'Nuevo Usuario' }); 
});

//POST (CREAR) un usario desde formulario
app.post('/crearUsuario', upload.single('image'), (req, res) => {
  const {firstName, lastName, age, nationality, gender, email, dateOfBirth, } = req.body;

  // Si no se sube una imagen, `imagePath` será null
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  // Crear una nueva instancia del modelo User con todos los campos
  const newUser = new User({
    firstName,
    lastName,
    age,
    nationality,
    gender,
    email,
    dateOfBirth,
    imagePath,
  });

  newUser.save()
    .then(() => {
      res.redirect('/'); // Redirigir al inicio después de guardar el usuario
    })
    .catch((error) => {
      console.error('Error al guardar el usuario:', error);
      res.status(500).send('Hubo un error al guardar el usuario');
    });
});

//mostrar por id
app.get('/users/:id', (req,res,next) =>{
  const id =req.params.id
  if(!mongoose.Types.ObjectId.isValid(id))
  {
    next();
  }
  User.findById(id)
  .then((resultado) =>{
    res.render('detalles', {user: resultado, title: 'INFO' })
  })
  .catch((error) =>{
    console.log(error)
  })
  
})

app.get('/users/:id/editar', (req, res) => {
  const id = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).send('Usuario no encontrado');
  }
  User.findById(id)
    .then(user => {
      if (!user) {
        return res.status(404).send('Usuario no encontrado');
      }
      res.render('editar', { user, title: 'Editar Usuario' });
    })
    .catch(error => {
      console.error('Error al obtener el usuario:', error);
      res.status(500).send('Error del servidor');
    });
});

app.put('/users/:id', upload.single('image'), (req, res) => {
  const id = req.params.id;
  const { firstName, lastName, age, nationality, gender, email, dateOfBirth } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : undefined;

  User.findByIdAndUpdate(id, {
    firstName, lastName, age, nationality, gender, email, dateOfBirth,
    ...(imagePath && { imagePath })
  }, { new: true })
    .then(() => res.redirect(`/users/${id}`))
    .catch(error => {
      console.error('Error al actualizar el usuario:', error);
      res.status(500).send('Error del servidor');
    });
});

app.delete('/users/:id', (req, res) => {
  const id = req.params.id;
  User.findByIdAndDelete(id)
    .then(() => {
      res.redirect('/');
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send('Error al eliminar el blog');
    });
});

//////////////////////////////////////////////////////////////////////
app.get('/sing-up',(req,res) => {
  res.render('sing-up',{title:'crear cuenta'})
})

app.post('/sing-up', async(req, res) => {
  const {username,password,email,nombre,apellido,sexo,fechaNacimiento,foto} = req.body;
  try{
    //verifica si el nombre de ususario ya existe
    const existingUser = await Usuario.findOne({username})
    if(existingUser){
      return res.status(400).send('El nombre de usuario ya existe')
    }
    //si no existe el nombre de usuario lo creamos
    const newUser = new Usuario({username,password,email,nombre,apellido,sexo,fechaNacimiento,foto})
    await newUser.save();
    res.redirect('/login');
    } catch(error){
      console.log(error)
      res.status(500).send('Hubo un error al crear el usuario')
    }});

app.get('/login',(req,res)=>{
  res.render('login',{title:'Iniciar sesion'})
})

app.post('/login', (req, res, next) => {
  const { username, password } = req.body;
  Usuario.findOne({ username: username })
    .then(user => {
      if (user) {
        Log.findOne({ user: user._id }) // si el usuario existe verifica el numero de intentos fallidos
          .then(log => {
            if (log) {
              log.failedAttempts += 1;// si el log existe se aumenta el numero de intentos fallidos
              log.save();
            } else {
              Log.create({ user: user._id, failedAttempts: 1 });// si el log no existe se crea un nuevo log
            }
            next(); 
          })
          .catch(next);
      } else {
        next(); 
      }
    })
    .catch(next);
}, passport.authenticate('local', {
  successRedirect: '/', // si el inicio de sesion es correcto lleva a basededatos
  failureRedirect: '/login', // si falla a login
  failureFlash: true, // mensaje de fallo si falla la autentificacion
}));

// Ruta para ver todos los usuarios y su actividad (porque hice una para que solo la persona que se logera solo pudiera ver su basededatos pero me daba algunos fallos con los logs)
app.get('/basededatos', ensureAuthenticated, async (req, res) => {
  try {
    Log.findOne({ user: req.user._id })
      .then(log => {
        if (log) {
          log.lastActivity = Date.now();//actualiza la ultima actividad del susuario
          log.save();//lo guarda
        } else {
          Log.create({ user: req.user._id, lastActivity: Date.now(), failedAttempts: 0 });//si no hay log de actividad se crea uno nuevo para el usuario
        }
        return Usuario.find().sort({ createdAt: -1 });//Obtener todos los usuarios ordenados por su fecha
      })
      .then(usuario => {
        res.render('basededatos', { title: 'DDBB', usuario });
      })
      .catch(error => {
        console.log(error);
        res.status(500).send('Hubo un error al obtener los usuarios o al actualizar la actividad');
      });

  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error en la ruta');
  }
});

app.get('/logout', (req, res) => {
  req.logout((error) => {
    if (error) {
      console.log(error);
      return res.status(500).send('Error al cerrar sesión');
    }
    res.redirect('/');
  });
});
/////////////////////// EDITAR USUARIO Y ELIMINAR USUARIO 16/01/2025 /////////////////

app.get('/usuarios/:id/editarBaseDeDatos', ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).send('Usuario no encontrado');
    }

    console.log('Foto del usuario:', usuario.foto); // imprime la ruta de la foto

    res.render('editarBaseDeDatos', { title: 'Editar Usuario', usuario });
  } catch (error) {
    console.log(error);
    res.status(500).send('Error al obtener el usuario');
  }
});

app.post('/usuarios/:id', ensureAuthenticated, upload.single('foto'), async (req, res) => {
  const { id } = req.params;
  const { username, email, nombre, apellido, sexo, fechaNacimiento } = req.body;

  //si se sube una nueva foto, se usa la ruta correspondiente
  const foto = req.file ? `/uploads/${req.file.filename}` : undefined;

  //si el usuario está autorizado para editar este perfil
  if (req.user._id.toString() !== id) {
    return res.status(403).send('No tienes permiso para editar este usuario');
  }

  try {
    // actualiza
    await Usuario.findByIdAndUpdate(id, {
      username,
      email,
      nombre,
      apellido,
      sexo,
      fechaNacimiento,
      ...(foto && { foto }) //solo actualiza la foto si hay una nueva
    });
    res.redirect(`/usuarios/${id}/editarBaseDeDatos`);
  } catch (error) {
    console.log(error);
    res.status(500).send('Error al actualizar el usuario');
  }
});


app.get('/eliminar/:id', ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  if (req.user._id.toString() !== id) {
    return res.status(403).send('No tienes permiso para eliminar este usuario');
  }
  try {
    await Usuario.findByIdAndDelete(id);
    req.logout((error) => {
      if (error) {
        console.log(error);
        return res.status(500).send('Error al cerrar sesión');
      }
      res.redirect('/sing-up');
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Error al eliminar el usuario');
  }
});

///////////////// actividad de los usuarios ///////////////////

async function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.user) {
    try {
      //actualiza la fecha de última actividad
      let activity = await Activity.findOne({ user: req.user._id });
      if (activity) {
        activity.lastActivity = new Date();
        await activity.save();
      } else {
        //si no existe se crea una nueva
        const newActivity = new Activity({
          user: req.user._id,
          lastActivity: new Date(),
        });
        await newActivity.save();
      }
      return next();//si esta con la cuenta iniciada continúa
    } catch (err) {
      console.error(err);
      return res.status(500).send('Error al registrar la actividad del usuario');
    }
  }

  if (req.user) {
    try {
      let activity = await Activity.findOne({ user: req.user._id });
      if (activity) {
        activity.failedAttempts += 1;//aumenta el numero de intentos fallidos
        await activity.save();
      }
    } catch (err) {
      console.error(err);
    }
  }

  //si no tienes la cuenta iniciada te salta un mensaje que te redireccionara al main
  res.status(401).render('errorAuth', {
    title: 'No autenticado',
    message: 'Debes iniciar sesión para acceder a esta página.',
  });
}

// ruta actividad para ver todas las actividades de los usuarios
app.get('/actividad', ensureAuthenticated, async (req, res) => {
  try {
    const logs = await Activity.find().populate('user', 'username nombre apellido');
    res.render('actividad', { title: 'Actividad del Usuario', logs });
  } catch (error) {
    console.error(error);
    res.status(500).send('Hubo un error al obtener la actividad de los usuarios');
  }
});


app.use(
  sesion({
    secret: require('crypto').randomBytes(64).toString('hex'), 
    resave: false,  
    saveUninitialized: false, 
    rolling: true, 
    cookie: {
      maxAge: 1000 * 60 * 20, 
    },
  })
);
/////////////////////////////////PAYPAL////////////////////////////////////////////////////////



app.get('/productosCompClase', async (req, res) => {
  try {
      const productos = await Producto.find().sort({ createdAt: -1 }); // Corrección: "Producto.find()", no "productos.find()"
      const cesta= req.session.cesta || []
      const cestaCantidad = cesta.reduce((total, item) => total + item.cantidad, 0)
      res.render('productosCompClase', { title: 'Lista de productos', productos,cestaCantidad });
  } catch (error) {
      console.error('Error al obtener los productos', error);
      res.status(500).send('Error al cargar los productos');
  }
});

app.post('/add-to-cart', async (req, res) => {
  const {productoId, cantidad} = req.body
  const cantidadInt = parseInt(cantidad,10)
  const producto = await Producto.findById(productoId)//busca el producto por id en nuesta BBDD
  if (!producto) return res.status(404).send('Producto no encontrado')
    req.session.cesta=req.session.cesta || []//nos guarda las cantidades en nuestra sesion
  const productoExistente= req.session.cesta.find(item => item.productoId == productoId)
  if (productoExistente) {
    productoExistente.cantidad += cantidadInt //si el producto ya existe me suma una unidad al producto
  } else {//si aun no estaba en la cesta, extrae nombre prodcuto
    req.session.cesta.push({
      productoId,
      nombre: producto.nombre,
      precio: producto.precio,
      imageUrl: producto.imageUrl,
      cantidad: cantidadInt
    })
  }
  req.session.save(err => err ? res.status(500).send('error al actualizar la cesta') : res.redirect('/productosCompClase'));
})

app.get('/cesta', async (req, res) => {
  res.render('cesta', { title: 'cesta de la compra', cesta: req.session.cesta || [] })
})

app.post('/cesta/eliminar', (req, res) => {
  req.session.cesta = req.session.cesta.filter(item => item.productoId !== req.body.productoId);
  req.session.save(err => err ? res.status(500).send('error al actualizar la cesta') : res.redirect('/cesta'));
});

app.post('/cesta/vaciar', (req, res) => {
  req.session.cesta = [];
  req.session.save(err => err ? res.status(500).send('error al vaciar la cesta') : res.redirect('/cesta'));
});

app.get('/success', async (req, res) => {
  const { token } = req.query;
  const request = new paypal.orders.OrdersCaptureRequest(token);
  request.requestBody({});
  
  try {
    const capture = await PaypalClient.execute(request);
    const payment = capture.result;
    console.log('respuesta completa de paypal: ', JSON.stringify(payment, null, 2));

    // Obtener ID y total del pago
    const idPago = payment.id || (payment.purchase_units[0].payments.captures[0].id || 'ID no disponible');
    const total = payment.purchase_units[0].payments.captures[0].amount.value;

    // Obtener dirección de comprador
    const shipping = payment.purchase_units[0].shipping;
    const direccion = {
      recipient_name: shipping?.name?.full_name || 'no disponible',
      line1: shipping?.address?.address_line_1 || 'no disponible',
      city: shipping?.address?.admin_area_2 || 'no disponible',
      state: shipping?.address?.admin_area_1 || 'no disponible',
      postal_code: shipping?.address?.postal_code || 'no disponible',
      country_code: shipping?.address?.country_code || 'no disponible',
    };

    // Obtener productos de la cesta
    const productos = req.session.cesta || [];

    const factura = `INV-${Math.floor(Math.random() * 1000000)}`;

    // Vaciar cesta
    req.session.cesta = [];

    res.render('success', {
      factura,
      idPago,
      productos,
      total,
      direccion
    });
  } catch (error) {
    console.error('error ejecutando el pago', error);
    res.status(500).send('error al ejecutar el pago con paypal');
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////////
//404
app.use((req, res) => {
  res.status(404).render('404', { title: '404 - Página No Encontrada' });
});